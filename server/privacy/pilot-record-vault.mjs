import {createCipheriv,createDecipheriv,randomBytes,randomUUID,scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {chmodSync,existsSync,lstatSync} from 'node:fs';
import path from 'node:path';

export const PILOT_VAULT_FILE='rejon-protegido.sqlite';
const kinds=new Set(['workspace','matter','intake-pilot']);
const formatId=0x524a5031;
const invalid=()=>new Error('No se pudo abrir el expediente cifrado. Revisa la frase local y la integridad de la copia.');

function ordinaryFile(file) {
 const st=lstatSync(file,{throwIfNoEntry:false});
 if(!st)return;
 if(!st.isFile()||st.nlink!==1)throw invalid();
}

function seal(key,aad,value) {
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(aad);
 const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),data]);
}

function open(key,aad,bytes) {
 const packed=Buffer.from(bytes);
 if(packed.length<30)throw invalid();
 try {
  const cipher=createDecipheriv('aes-256-gcm',key,packed.subarray(0,12));
  cipher.setAAD(aad);
  cipher.setAuthTag(packed.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]).toString('utf8'));
 }catch{throw invalid();}
}

function copyLegacy(file,put,writeAudit) {
 if(!existsSync(file))return;
 ordinaryFile(file);
 const old=new DatabaseSync(file,{readOnly:true});
 try {
  old.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; BEGIN');
  const count=old.prepare('SELECT count(*) AS n FROM records').get().n;
  if(count&&!old.prepare("SELECT 1 FROM records WHERE kind='intake-pilot'").get())throw Error('El archivo anterior no es un expediente del piloto.');
  for(const row of old.prepare('SELECT id,kind,matter_id,payload FROM records ORDER BY rowid').iterate()){
   let entity;
   try{entity=JSON.parse(row.payload);}catch{throw Error('No se pudo leer un registro en la copia anterior.');}
   if(!kinds.has(row.kind)||entity.id!==row.id||(entity.matterId??null)!==row.matter_id)throw Error('La copia anterior incluye registros fuera del formato del piloto.');
   put(row.kind,entity);
  }
  for(const row of old.prepare('SELECT id,action,entity_id,created_at FROM audit ORDER BY rowid').iterate())writeAudit(row.id,row.action,row.entity_id,row.created_at);
  old.exec('COMMIT');
 }finally{old.close();}
}

// The main service database stays in memory. SQLite transacts the attached file
// on the same connection as store.transaction. Only sealed records hit that file.
export function attachPilotRecordVault(db,dataDir,passphrase) {
 if(!Buffer.isBuffer(passphrase)||passphrase.length<12||passphrase.length>1024)throw invalid();
 const directory=path.resolve(dataDir);
 const profile=path.basename(path.dirname(directory));
 const exercise=path.basename(directory);
 const context=(kind,id,matterId)=>Buffer.from(JSON.stringify(['rejon-pilot-record-v1',profile,exercise,kind,id,matterId]));
 const file=path.join(directory,PILOT_VAULT_FILE);
 ordinaryFile(file);
 db.prepare('ATTACH DATABASE ? AS sealed').run(file);
 chmodSync(file,0o600);
 db.exec('PRAGMA temp_store=MEMORY; PRAGMA busy_timeout=5000; PRAGMA sealed.journal_mode=DELETE; PRAGMA sealed.synchronous=FULL; BEGIN IMMEDIATE');
 let key;
 try {
  const info=db.prepare('PRAGMA sealed.application_id').get().application_id;
  const fresh=info===0&&!db.prepare("SELECT 1 FROM sealed.sqlite_schema WHERE name NOT LIKE 'sqlite_%'").get();
  if(!fresh&&info!==formatId)throw invalid();
  if(fresh)db.exec(`PRAGMA sealed.application_id=${formatId}; CREATE TABLE sealed.header(id INTEGER PRIMARY KEY CHECK(id=1),salt BLOB NOT NULL,checkvalue BLOB NOT NULL);
   CREATE TABLE sealed.records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,matter_id TEXT,payload BLOB NOT NULL);
   CREATE INDEX sealed.by_scope ON records(kind,matter_id);`);
  const header=fresh?null:db.prepare('SELECT salt,checkvalue FROM sealed.header WHERE id=1').get();
  if(!fresh&&header?.salt?.length!==32)throw invalid();
  const salt=fresh?randomBytes(32):Buffer.from(header.salt);
  key=scryptSync(passphrase,salt,32,{N:131072,r:8,p:1,maxmem:192*1024*1024});
  const check=context('header','v1',null);
  if(fresh)db.prepare('INSERT INTO sealed.header VALUES(1,?,?)').run(salt,seal(key,check,'Rejon.AI'));
  else if(open(key,check,header.checkvalue)!=='Rejon.AI')throw invalid();
  const insert=db.prepare('INSERT INTO sealed.records(id,kind,matter_id,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE kind=excluded.kind AND matter_id IS excluded.matter_id');
  const write=(kind,id,matterId,value)=>{
   if(insert.run(id,kind,matterId,seal(key,context(kind,id,matterId),value)).changes!==1)throw invalid();
  };
  const read=row=>row?open(key,context(row.kind,row.id,row.matter_id),row.payload):null;
  const put=(kind,entity)=>{
   if(!kinds.has(kind))throw Error('Tipo de registro no permitido en el piloto cifrado.');
   write(kind,entity.id,entity.matterId??null,entity);
   return entity;
  };
  const writeAudit=(id,action,entityId,stamp)=>write('audit',id,null,{id,action,entityId,createdAt:stamp});
  if(fresh)copyLegacy(path.join(dataDir,'lex.sqlite'),put,writeAudit);
  db.exec('COMMIT');
  return {
   protectedRecords:true,
   put,
   get(kind,id,matterId){
    const row=db.prepare('SELECT * FROM sealed.records WHERE kind=? AND id=?').get(kind,id);
    return row&&(matterId===undefined||row.matter_id===matterId)?read(row):null;
   },
   list(kind,matterId){
    const rows=matterId===undefined?db.prepare('SELECT * FROM sealed.records WHERE kind=? ORDER BY rowid').all(kind):
     db.prepare('SELECT * FROM sealed.records WHERE kind=? AND matter_id=? ORDER BY rowid').all(kind,matterId);
    return rows.map(read);
   },
   audit(action,id){writeAudit(randomUUID(),action,id??null,new Date().toISOString());},
   close(){try{db.close();}finally{key.fill(0);}},
  };
 }catch(error){key?.fill(0);db.exec('ROLLBACK');throw error;}
}

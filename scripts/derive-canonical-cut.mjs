// Deriva el corte canonico del corpus publico (metodo documentado en
// docs/qa/corte-canonico-reconciliacion-2026-11-14.md): universo = union de ids
// de resources/legal-acquisition-*.json EXCEPTO pilot.json y fed-diagnostic,
// MAS los 10 ids federales unicos del piloto original, MAS col-reg-023.
// presente = snapshot en el arbol; extraccion = >=1 archivo de extraccion;
// registros = extraccion MAS RECIENTE del id (resultado vigente).
// Uso: node scripts/derive-canonical-cut.mjs [--json]
import {readdirSync,statSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const corpus=path.join(root,'artifacts/public-corpus');
const regDir=path.join(root,'resources');
const FEDERAL_PILOT=['ccf','ccom','cff','cpeum','cpf','lamp','lfda','lfpc','lft','lgsm'];

const ids=new Set(FEDERAL_PILOT);ids.add('col-reg-023');
for(const file of readdirSync(regDir)){
  if(!/^legal-acquisition-.*\.json$/.test(file))continue;
  if(file==='legal-acquisition-pilot.json'||file.includes('fed-diagnostic'))continue;
  const registry=JSON.parse(readFileSync(path.join(regDir,file),'utf8'));
  const walk=value=>{if(Array.isArray(value)){for(const item of value)walk(item);return;}
    if(value&&typeof value==='object'){if(typeof value.id==='string'&&typeof value.url==='string')ids.add(value.id);
      for(const item of Object.values(value))walk(item);}};
  walk(registry.documents??registry.sources);
}

const snapshots=new Set();const extractions=new Map();
for(const batch of readdirSync(corpus)){
  const batchDir=path.join(corpus,batch);
  if(!statSync(batchDir).isDirectory())continue;
  const snapRoot=path.join(batchDir,'acquisitions','snapshots');
  if(existsSync(snapRoot))for(const id of readdirSync(snapRoot)){
    if(readdirSync(path.join(snapRoot,id)).some(f=>/^[a-f0-9]{64}\.(pdf|docx|doc)$/.test(f)))snapshots.add(id);}
  const extRoot=path.join(batchDir,'extractions');
  if(existsSync(extRoot))for(const id of readdirSync(extRoot)){
    for(const sha of readdirSync(path.join(extRoot,id))){
      for(const file of readdirSync(path.join(extRoot,id,sha))){
        if(!file.endsWith('.json'))continue;
        const full=path.join(extRoot,id,sha,file);const mtime=statSync(full).mtimeMs;
        const current=extractions.get(id);
        if(!current||mtime>current.mtime)extractions.set(id,{mtime,path:full});}}}
}

let registered=0,present=0,extracted=0,records=0;
const missingSnapshot=[],noExtraction=[];
for(const id of ids){registered++;
  if(snapshots.has(id))present++;else missingSnapshot.push(id);
  const ext=extractions.get(id);
  if(ext){extracted++;records+=JSON.parse(readFileSync(ext.path,'utf8')).records.length;}
  else if(snapshots.has(id))noExtraction.push(id);}

const cut={registered,present,extracted,records};
if(process.argv.includes('--json'))console.log(JSON.stringify({cut,missingSnapshot:noExtraction.length?[...missingSnapshot].sort():[...missingSnapshot].sort(),noExtraction:[...noExtraction].sort()},null,2));
else{console.log(`ids registrados: ${registered}`);console.log(`documentos presentes: ${present}`);
console.log(`extracciones validas: ${extracted}`);console.log(`registros: ${records}`);
console.log(`registrados sin snapshot (${missingSnapshot.length}): ${missingSnapshot.sort().join(', ')}`);
console.log(`presentes sin extraccion (${noExtraction.length}): ${noExtraction.sort().join(', ')}`);}

// Isolated DOF HTML review adapter. Not imported by server/main or public-library.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const PURPOSE='dof-html-development-review-only';
const sha=x=>createHash('sha256').update(x).digest('hex');
const TYPES=new Set(['provision','changed-table-row']);
const REQUIRED={
 'rgce-2026-3.1.43':{kind:'provision',flags:{notUniversalOperationalProof:true,operationNotice:'anam-avc-bulletin3-20261120.pdf',noticeDate:'2026-11-20',scope:"five operation categories in notice; enabled functions and applicable law; contingency rule3.1.33"}},
 'rgce-2026-transitory-eleventh-amendment':{kind:'provision',flags:{containsSixExpressDates:true,preFinalDatesRequireAnticipadaContext:true,notAutomaticRetroactivity:true,partialAmendmentOnly:true,isConsolidatedText:false,omittedRetainedParagraphsNotReconstructed:true}},
 ...Object.fromEntries(['general-next-day-and-anticipadas','maritime-activation-unverified','avc-operations-announced-by-anam','doda-reference-only-in-applicable-avc-operations','estimated-vutce-calendar-new-vs-existing-proceedings'].map((type,i)=>['third-resolution-transitory-'+(i+1),{kind:'provision',flags:{type}}])),
 ...Object.fromEntries(['annex22-appendix1-tulum','annex22-appendix9-cl'].map(id=>[id,{kind:'changed-table-row',flags:{notCompleteAppendix:true,notStandaloneSubstantiveCertificateObligation:true}}]))
};
for(const spec of Object.values(REQUIRED)){Object.freeze(spec.flags);Object.freeze(spec);}
Object.freeze(REQUIRED);
export const REQUIRED_RECORDS=REQUIRED;
export function validRecordConditions(r){
 const spec=REQUIRED[r.id],c=r.conditions;
 return !!spec&&r.kind===spec.kind&&!!c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).length===Object.keys(spec.flags).length&&Object.entries(spec.flags).every(([k,v])=>Object.hasOwn(c,k)&&c[k]===v);
}
function safeOut(file){if(!path.resolve(file).split(path.sep).includes('dev-index')||!file.endsWith('.sqlite'))throw Error('Requires separate dev-index SQLite destination');}
function sourceUrl(s){const u=new URL(s);if(u.protocol!=='https:'||u.hostname!=='dof.gob.mx'||u.pathname!=='/nota_detalle.php'||u.searchParams.get('codigo')!=='5804604'||u.searchParams.get('fecha')!=='23/11/2026'||u.searchParams.get('print')!=='true'||u.username||u.password||u.port||u.hash||[...u.searchParams].length!==3)throw Error('Unexpected bounded DOF source');return u.href;}
export function validateCandidate({candidateBytes,htmlBytes,cleanText}){
 const c=JSON.parse(candidateBytes);sourceUrl(c.sourceUrl);
 if(c.contract!=='isolated-third-final-content-candidate-v1'||c.adoptable!==false||c.activeCorpusChanged!==false||c.sourceHtmlSha256!==sha(htmlBytes)||c.records?.length!==9)throw Error('Candidate provenance/state mismatch');
 const ids=new Set();
 for(const r of c.records){
  const a=r.sourceAnchor;const spec=REQUIRED[r.id];
  if(!validRecordConditions(r))throw Error('Required record conditions missing or changed');
  if(!r.id||ids.has(r.id)||!TYPES.has(r.kind)||r.state!=='quarantined-content-candidate'||r.legalSearchEnabled!==false||!r.conditions||!a||a.sourceHtmlSha256!==sha(htmlBytes)||a.derivedTextSha256!==sha(cleanText)||!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<0||a.end<=a.start||Array.from(cleanText).slice(a.start,a.end).join('')!==r.text||sha(r.text)!==r.textSha256)throw Error('Invalid candidate record/anchor');
  ids.add(r.id);
 }
 return c;
}
// outFile path check is an accidental-write guard, not a security boundary.
export function buildDofReviewIndex({candidateFile,htmlFile,cleanFile,outFile}){
 safeOut(outFile);const bytes=readFileSync(candidateFile),html=readFileSync(htmlFile),clean=readFileSync(cleanFile,'utf8');const c=validateCandidate({candidateBytes:bytes,htmlBytes:html,cleanText:clean});
 mkdirSync(path.dirname(outFile),{recursive:true});const tmp=outFile+'.tmp';rmSync(tmp,{force:true});let db;
 try{
  db=new DatabaseSync(tmp);db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE records(id TEXT PRIMARY KEY,payload TEXT NOT NULL);CREATE VIRTUAL TABLE fts USING fts5(id UNINDEXED,text);BEGIN;');
  for(const r of c.records){db.prepare('INSERT INTO records VALUES(?,?)').run(r.id,JSON.stringify(r));db.prepare('INSERT INTO fts VALUES(?,?)').run(r.id,r.text);}
  const meta={purpose:PURPOSE,candidateSha256:sha(bytes),htmlSha256:sha(html),sourceUrl:c.sourceUrl,records:9,published:false,productionIndexed:false,legalSearchEnabled:false};
  db.prepare('INSERT INTO meta VALUES(?,?)').run('review',JSON.stringify(meta));db.exec('COMMIT');db.close();db=null;renameSync(tmp,outFile);return {...meta,indexSha256:sha(readFileSync(outFile))};
 }finally{db?.close();rmSync(tmp,{force:true});}
}
export function openDofReviewIndex({file,expectedIndexSha256}){
 // expectedIndexSha256 must come from a separately reviewed artifact for persisted deployment.
 // A same-process build/open roundtrip checks disk continuity only, not independent approval.
 safeOut(file);if(sha(readFileSync(file))!==expectedIndexSha256)throw Error('Index integrity mismatch');const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA query_only=ON;PRAGMA trusted_schema=OFF');
 const meta=JSON.parse(db.prepare("SELECT value FROM meta WHERE key='review'").get().value);if(meta.purpose!==PURPOSE||meta.published!==false||meta.productionIndexed!==false){db.close();throw Error('Not a review index');}
 const persisted=db.prepare('SELECT payload FROM records').all().map(row=>JSON.parse(row.payload));
 if(persisted.length!==9||new Set(persisted.map(r=>r.id)).size!==9||persisted.some(r=>!validRecordConditions(r))){db.close();throw Error('Persisted review conditions mismatch');}
 function check(purpose){if(purpose!=='source-review')throw Error('Review only, no legal search or consolidated output');}
 return {meta,search({query,purpose}){check(purpose);if(typeof query!=='string'||query.length>200)throw Error('Invalid query');const words=query.match(/[\p{L}\p{N}]+/gu)?.slice(0,12);if(!words?.length)return[];return db.prepare('SELECT r.payload FROM fts JOIN records r ON r.id=fts.id WHERE fts MATCH ? LIMIT 9').all(words.map(w=>'"'+w+'"').join(' AND ')).map(x=>JSON.parse(x.payload));},get({id,purpose}){check(purpose);const r=db.prepare('SELECT payload FROM records WHERE id=?').get(id);return r?{...JSON.parse(r.payload),sourceUrl:meta.sourceUrl,warning:'Fuente para revisión. No es texto consolidado ni aplicabilidad certificada.'}:null;},close(){db.close();}};
}

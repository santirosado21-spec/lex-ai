#!/usr/bin/env node
// Read-only audit of quarantined public-corpus extractions. Verifies the integrity
// chain with the pipeline's own checker, recomputes record hashes, checks record
// structure (non-empty text, unique article ids, monotonic numbering) and runs
// canonical-text spot checks declared per document. Produces a JSON report.
// This audits extraction mechanics; it is not legal/current-law validation.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {KINDS} from '../server/dev-corpus-index.mjs';
import {verifyPublicAcquisitionIntegrity} from '../server/corpus/acquisition.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');

// Canonical fragments transcribed from the official source pages/documents.
// A miss means extraction drift for that document; a match is evidence, not full fidelity.
const PREFACE_REASONS=new Set(['decree-transitory','quoted-article','restart-before-art1','dictamen-quoted-article-restart-at-1','art1-restart','art1-restart-v37']);
const SPOT_CHECKS={
  cpeum:['todas las personas gozarán de los derechos humanos reconocidos en esta Constitución'],
  lfda:['Los textos legislativos, reglamentarios, administrativos o judiciales','no conferirán derecho exclusivo de edición'],
  lft:['rige las relaciones de trabajo'],
  cff:['obligadas a contribuir para los gastos públicos conforme a las leyes fiscales'],
};

export async function auditExtractionDir(outputDir){
  const findings=[];const fail=(msg)=>findings.push(msg);
  let report=null;
  try{report=await verifyPublicAcquisitionIntegrity({outputDir});}
  catch(error){fail(`integrity-chain: ${error.code||error.message}`);}
  const documents=new Map();
  // Audit only report-selected extractions, already bound to the checked ledger.
  const files=report?report.documents.filter(document=>document.state==='quarantined').map(document=>path.join(outputDir,document.extractionPath)):[];
  const latest=new Map();
  for(const file of files){
    let doc;try{doc=JSON.parse(await readFile(file,'utf8'));}catch{fail(`unparseable extraction ${file}`);continue;}
    const id=doc.documentId??path.basename(file);
    const prev=latest.get(id);
    if(!prev||(doc.capturedAt??'')>=(prev.doc.capturedAt??''))latest.set(id,{file,doc});
  }
  for(const {file,doc} of latest.values()){
    const id=doc.documentId??path.basename(file);
    const recs=Array.isArray(doc.records)?doc.records:[];
    let badHash=0,empty=0,dupe=0,nonMono=0,chars=0;
    const seen=new Set();let prev=-1;let operativeCount=0,transitoryCount=0,prefaceCount=0;
    const coverage=doc.coverage;
    for(const r of recs){
      if(typeof r.text!=='string'||!r.text.trim())empty++;
      else{chars+=r.text.length;if(sha256(r.text)!==r.textSha256)badHash++;}
      // Classification is checked against the extractor's structural metadata, not trusted as a free label.
      const kind=r.recordKind??'articulo';
      if(!KINDS.includes(kind)){fail(`${id}: unsupported record kind`);continue;}
      if(kind==='transitorio'){
        transitoryCount++;
        if(r.articleId!==null||typeof r.ordinalLabel!=='string'||!r.ordinalLabel.trim()||typeof r.headingTitle!=='string'||!r.headingTitle.trim())fail(`${id}: invalid transitory structure`);
        if(!Number.isInteger(coverage?.transitoryStartPage)||!Array.isArray(r.sourcePages)||!r.sourcePages.length||r.sourcePages.some(page=>!Number.isInteger(page)||page<coverage.transitoryStartPage))fail(`${id}: transitory boundary unavailable or inconsistent`);
      }
      if(kind==='prefacio-articulo-citado')prefaceCount++;
      if(kind==='prefacio-articulo-citado'&&(typeof r.articleId!=='string'||!r.articleId.trim()||!PREFACE_REASONS.has(r.headingTitle)))fail(`${id}: invalid quoted-preface structure`);
      if(kind==='articulo'){
        operativeCount++;
        if(typeof r.articleId!=='string'||!r.articleId.trim()){fail(`${id}: operative article id missing`);continue;}
        const n=Number(r.articleId);
        if(seen.has(r.articleId))dupe++;seen.add(r.articleId);
        if(Number.isFinite(n)){if(n<=prev)nonMono++;prev=Math.max(prev,n);}
      }
    }
    if(!Number.isInteger(coverage?.operativeArticleCandidates)||coverage.operativeArticleCandidates!==operativeCount)fail(`${id}: operative classification count mismatch or unavailable`);
    if((coverage?.transitoryRecords??0)!==transitoryCount)fail(`${id}: transitory classification count mismatch`);
    if((coverage?.prefaceRecordsPreserved??0)!==prefaceCount)fail(`${id}: preface classification count mismatch`);
    let spot='not-declared';
    const checks=SPOT_CHECKS[id];
    if(checks){
      const hay=recs.map(r=>r.text).join('\n');
      const missing=checks.filter(c=>!hay.includes(c));
      spot=missing.length?`MISS:${missing.length}`:'ok';
      if(missing.length)fail(`${id}: canonical fragment missing (${missing[0].slice(0,60)}…)`);
    }
    if(badHash)fail(`${id}: ${badHash} record hash mismatch`);
    if(empty)fail(`${id}: ${empty} empty records`);
    if(dupe)fail(`${id}: ${dupe} duplicate article ids`);
    if(nonMono)fail(`${id}: ${nonMono} non-monotonic article numbers`);
    documents.set(id,{records:recs.length,chars,badHash,empty,dupe,nonMono,spot,declaredAmendedAt:doc.declaredAmendedAt??null,anomalies:(doc.documentAnomalies??[]).length});
  }
  return {outputDir,reportState:report?.state??null,documents:Object.fromEntries(documents),findings,ok:findings.length===0};
}

if(process.argv[1]&&process.argv[1].endsWith('public-corpus-extraction-audit.mjs')){
  const dirs=process.argv.slice(2);
  if(!dirs.length){console.error('usage: node scripts/public-corpus-extraction-audit.mjs DIR [DIR…]');process.exit(2);}
  let ok=true;
  for(const dir of dirs){
    const result=await auditExtractionDir(dir);
    ok=ok&&result.ok;
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }
  process.exitCode=ok?0:1;
}

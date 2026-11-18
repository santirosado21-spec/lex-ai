// Lists the barriers that stand between a legal-corpus CANDIDATE and independent QA for adoption.
// It never approves anything: the only positive verdict is 'ready-for-independent-QA', which is not adoption.
// Usage: node scripts/candidate-promotion-barriers.mjs [--today YYYY-MM-DD] <register.json> <source.pdf>
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const RESIDUAL_NOTE=/(?:\b(?:Multas?|Cantidad(?:es)?|Montos?)\b[^.]{0,60}\bactualizad[ao]s?\b[^.]{0,40}\bDOF \d{2}-\d{2}-\d{4})|(?:\b(?:Art[ií]culo|P[aá]rrafo|Fracci[oó]n)\s+(?:reformad[oa]|adicionad[oa]|derogad[oa])\s+DOF \d{2}-\d{2}-\d{4})/i;

export function evaluateCandidate({register,parsed,pdfSha256,today=new Date().toISOString().slice(0,10)}){
  const barriers=[],info=[];
  const add=(id,why)=>barriers.push({id,why});
  if(register.status!=='candidate-not-adopted-pending-QA')add('register-status','register does not say candidate-not-adopted-pending-QA');
  if(!register.pdfSha256)add('provenance-hash-missing','no PDF sha256 in the register');
  else if(pdfSha256&&register.pdfSha256!==pdfSha256)add('provenance-hash-mismatch','register sha256 differs from the PDF given');
  if(!register.officialUrl)add('provenance-url-missing','no official URL');
  if(!register.publisherDeclaredLastReform)add('version-declared-reform-missing','publisher-declared last reform not recorded');
  const pending=register.pendingReform;
  if(pending){
    const inForce=pending.entryIntoForce||'';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(inForce))add('pending-reform-date-unparsed','a pending reform is recorded without a machine-readable entry-into-force date');
    else if(inForce<=today)add('reform-in-force-not-integrated',`reform in force ${inForce} but the PDF text predates it`);
    else info.push(`pending reform enters force ${inForce}: text is current today only until then; a validity window must be recorded before adoption`);
  } else if(!register.currentnessCheck||/not (?:been )?(?:checked|verified)|unverified|unchecked|no verificad|sin verificar/i.test(register.currentnessCheck))add('currentness-unchecked','no currentness evidence or pending-reform check recorded');
  const v=register.validation||{};
  const dof=v.dofComparison;
  if(!dof||dof.status!=='complete'||!dof.source||!dof.comparedAt)add('dof-comparison-not-evidenced','no completed DOF text comparison with source and date is recorded (validation.dofComparison.status must be complete with source and comparedAt)');
  if(!parsed){add('parse-missing','no importer output provided');return verdict(barriers,info);}
  const recs=parsed.records||[];
  if(!recs.length)add('no-records','importer produced no records');
  if(recs.some(r=>!r.quality||r.quality.status!=='quarantined'))add('quarantine-bypassed','a record is missing quality or is not quarantined');
  const cov=parsed.coverage||{};
  if(cov.transitoryStartPage!=null){
    if(cov.transitoryPagesNotStructured==null)add('transitory-coverage-missing','transitory boundary found but pages not structured is not reported');
    else info.push(`transitory block starts page ${cov.transitoryStartPage}; ${cov.transitoryPagesNotStructured} page(s) not structured (by design, must be reviewed, not promoted)`);
  } else if(cov.pages>1)add('transitory-boundary-not-found','no transitory boundary detected: last article may absorb decree text');
  const longest=[...recs].sort((a,b)=>b.text.length-a.text.length)[0];
  if(longest&&longest.text.length>9000)info.push(`longest record ${longest.articleId} has ${longest.text.length} chars: confirm it is not absorbing other text`);
  const TRANS=/(?:^|[.;:] )(?:Art[ií]culos? )?T\s*r\s*a\s*n\s*s\s*i\s*t\s*o\s*r\s*i\s*o\s*s?\b(?:\.|:|\s+(?:Primero|Primera|[ÚU]nico))/;
  const withTrans=recs.filter(r=>TRANS.test(r.text));
  if(withTrans.length)add('record-contains-transitory-text',`${withTrans.length} record(s) contain a transitory heading: ${withTrans.slice(0,10).map(r=>r.articleId).join(', ')}`);
  const resid=recs.filter(r=>RESIDUAL_NOTE.test(r.text));
  if(resid.length)add('residual-editorial-notes',`${resid.length} record(s) keep amendment or amounts-update notes: ${resid.slice(0,10).map(r=>r.articleId).join(', ')}`);
  const ids=recs.map(r=>r.articleId),dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
  if(dup.length)add('duplicate-ids',`duplicate article ids: ${[...new Set(dup)].slice(0,10).join(', ')}`);
  return verdict(barriers,info);
}
function verdict(barriers,info){
  return {verdict:barriers.length?'blocked':'ready-for-independent-QA',note:barriers.length?'Barriers listed; not adoptable.':'Mechanical checks only. This is not adoption: independent QA and DOF comparison still decide.',barriers,info};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const args=process.argv.slice(2),ti=args.indexOf('--today');const today=ti>=0?args.splice(ti,2)[1]:undefined;const [registerPath,pdfPath]=args;
  if(!registerPath||!pdfPath){console.error('usage: node scripts/candidate-promotion-barriers.mjs <register.json> <source.pdf>');process.exit(2);}
  const {parsePdfInWorker}=await import('../server/legal-library.mjs');
  const register=JSON.parse(readFileSync(registerPath,'utf8'));
  const pdfSha256=createHash('sha256').update(readFileSync(pdfPath)).digest('hex');
  const parsed=await parsePdfInWorker(pdfPath,{lawId:register.lawId,url:register.officialUrl||'unknown',title:register.title||register.lawId},{pdfSha256,retrievedAt:new Date().toISOString()});
  console.log(JSON.stringify(evaluateCandidate({register,parsed,pdfSha256,...(today?{today}:{})}),null,1));
}

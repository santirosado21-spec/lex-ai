#!/usr/bin/env node
// Offline prediction scorer. No detector, inference, network, oracle or transport approval.
import {readFile,realpath,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const C_FIELDS=['id','split','templateGroup','synthetic','scope','segments','entities','expectedStatus','blockReason','preserve'];
const D_FIELDS=['segmentId','start','end','category'];
const SCOPE_FIELDS=['workspaceId','matterId','threadId'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new Error(message);};
const exact=(value,fields,label)=>{if(!object(value)||Object.keys(value).length!==fields.length||fields.some(field=>!Object.hasOwn(value,field)))fail(`Invalid ${label} fields.`);};
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const unique=values=>new Set(values).size===values.length;
const sameScope=(a,b)=>SCOPE_FIELDS.every(field=>a[field]===b[field]);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const scope=value=>{exact(value,SCOPE_FIELDS,'scope');if(SCOPE_FIELDS.some(field=>!opaque(value[field])||value[field].length>80))fail('Invalid scope identifiers.');};
const list=(value,label)=>{if(!Array.isArray(value))fail(`Invalid ${label} list.`);return value;};

export function validateProtocol(protocol) {
 if(!object(protocol)||protocol.version!==1||!opaque(protocol.id)||!hash(protocol.annotationGuideSha256))fail('Unsupported protocol/annotation guide.');
 for(const field of ['categories','mandatoryCategories','blockReasons']) {
  if(!Array.isArray(protocol[field])||!protocol[field].length||!unique(protocol[field])||protocol[field].some(value=>!opaque(value)))fail(`Invalid protocol ${field}.`);
 }
 if(protocol.mandatoryCategories.some(category=>!protocol.categories.includes(category)))fail('Unknown mandatory category.');
 if(!object(protocol.corpusRules)||!object(protocol.experimentalGates)||!object(protocol.resourceProtocol))fail('Missing protocol rules.');
 for(const field of ['heldoutMinEntitiesPerCategory','heldoutMinCleanCases','heldoutMinBlockedPerReason'])if(!Number.isInteger(protocol.corpusRules[field])||protocol.corpusRules[field]<1)fail('Invalid minimum denominator.');
 for(const field of ['disjointIds','disjointTemplateGroups','disjointSegmentTexts','syntheticOnly'])if(protocol.corpusRules[field]!==true)fail('Unsafe corpus protocol.');
 for(const field of ['mandatoryExactRecall','otherCategoryExactRecallMinimum','exactPrecisionMinimumPerCategory','cleanCompleteRateMinimum','requiredBlockedStatusRate'])if(!Number.isFinite(protocol.experimentalGates[field])||protocol.experimentalGates[field]<0||protocol.experimentalGates[field]>1)fail('Invalid experimental threshold.');
 if(protocol.experimentalGates.minimumDenominatorsMustPass!==true||protocol.experimentalGates.blockedEntityCasesStillCountAsMisses!==true)fail('Unsupported gate semantics.');
 if(!Number.isInteger(protocol.resourceProtocol.inputEnvelopeMaximumUtf16)||protocol.resourceProtocol.inputEnvelopeMaximumUtf16<1)fail('Invalid envelope limit.');
 return protocol;
}

function validRange(value,segments) {
 const segment=segments.find(segment=>segment.id===value.segmentId);
 if(!segment||!Number.isInteger(value.start)||!Number.isInteger(value.end)||value.start<0||value.end<=value.start||value.end>segment.text.length)fail('Invalid UTF16 range.');
 for(const offset of [value.start,value.end]) {
  const before=segment.text.charCodeAt(offset-1),after=segment.text.charCodeAt(offset);
  if(before>=0xD800&&before<=0xDBFF&&after>=0xDC00&&after<=0xDFFF)fail('Range splits a surrogate pair.');
 }
}

function validateDetections(values,segments,protocol) {
 const seen=new Set();
 for(const detection of list(values,'detections')) {
  exact(detection,D_FIELDS,'detection');validRange(detection,segments);
  if(!protocol.categories.includes(detection.category))fail('Unknown entity category.');
  const key=JSON.stringify(D_FIELDS.map(field=>detection[field]));if(seen.has(key))fail('Duplicate detection.');seen.add(key);
 }
}

export function validateCases(cases,{protocol,split}) {
 validateProtocol(protocol);if(!['dev','heldout'].includes(split))fail('Invalid split.');
 if(!Array.isArray(cases)||!cases.length)fail('Empty corpus split.');
 const ids=new Set(),texts=new Set();
 const coverage={cases:cases.length,entities:Object.fromEntries(protocol.categories.map(category=>[category,0])),cleanCases:0,blocked:Object.fromEntries(protocol.blockReasons.map(reason=>[reason,0]))};
 for(const row of cases) {
  exact(row,C_FIELDS,'case');
  if(!opaque(row.id)||ids.has(row.id)||row.split!==split||!opaque(row.templateGroup)||row.synthetic!==true)fail('Invalid/duplicate case identity or synthetic provenance.');ids.add(row.id);scope(row.scope);
  if(!Array.isArray(row.segments)||!row.segments.length||!unique(row.segments.map(segment=>segment?.id)))fail('Invalid segments.');
  let length=0,scopeMismatch=false,unknown=false;
  for(const segment of row.segments) {
   exact(segment,['id','path','text','originScope','classification'],'segment');
   if(segment.originScope===null) {
    if(segment.classification!=='unknown'||row.expectedStatus!=='blocked'||row.blockReason!=='unknown_provenance')fail('Null origin requires blocked unknown provenance.');
   } else scope(segment.originScope);
   if(!opaque(segment.id)||typeof segment.path!=='string'||!segment.path.trim()||typeof segment.text!=='string'||!segment.text.length||!['synthetic','public','unknown'].includes(segment.classification))fail('Invalid segment content/classification.');
   length+=segment.text.length;texts.add(segment.text);
   scopeMismatch ||= segment.originScope!==null&&!sameScope(segment.originScope,row.scope);unknown ||= segment.classification==='unknown';
  }
  if(length>protocol.resourceProtocol.inputEnvelopeMaximumUtf16)fail('Envelope exceeds protocol UTF16 budget.');
  validateDetections(row.entities,row.segments,protocol);
  if(!['complete','blocked'].includes(row.expectedStatus)||row.expectedStatus==='complete'&&row.blockReason!==null||row.expectedStatus==='blocked'&&!protocol.blockReasons.includes(row.blockReason))fail('Invalid expected status/block reason.');
  if((scopeMismatch||unknown)&&row.expectedStatus!=='blocked')fail('Unsafe complete status contradicts provenance.');
  if(row.blockReason==='scope_mismatch'&&!scopeMismatch||row.blockReason==='unknown_provenance'&&!unknown)fail('Block reason contradicts provenance.');
  const preservation=new Set();
  for(const preserve of list(row.preserve,'preservation')) {
   exact(preserve,['segmentId','start','end','kind'],'preservation');validRange(preserve,row.segments);
   if(!['date','amount','citation'].includes(preserve.kind))fail('Unknown preservation annotation.');
   const key=JSON.stringify([preserve.segmentId,preserve.start,preserve.end,preserve.kind]);if(preservation.has(key))fail('Duplicate preservation range.');preservation.add(key);
  }
  for(const entity of row.entities)coverage.entities[entity.category]++;
  if(row.expectedStatus==='blocked')coverage.blocked[row.blockReason]++;
  else if(!row.entities.length)coverage.cleanCases++;
 }
 return {coverage,ids,texts,templateGroups:new Set(cases.map(row=>row.templateGroup))};
}

function minimumFailures(coverage,protocol) {
 const rules=protocol.corpusRules,failures=[];
 for(const category of protocol.categories)if(coverage.entities[category]<rules.heldoutMinEntitiesPerCategory)failures.push(`entities:${category}`);
 if(coverage.cleanCases<rules.heldoutMinCleanCases)failures.push('cleanCases');
 for(const reason of protocol.blockReasons)if(coverage.blocked[reason]<rules.heldoutMinBlockedPerReason)failures.push(`blocked:${reason}`);
 return failures;
}

export function validateCorpus({protocol,splits}) {
 exact(splits,['dev','heldout'],'splits');
 const dev=validateCases(splits.dev,{protocol,split:'dev'}),heldout=validateCases(splits.heldout,{protocol,split:'heldout'});
 for(const field of ['ids','templateGroups','texts'])if([...dev[field]].some(value=>heldout[field].has(value)))fail(`Contaminated split ${field}.`);
 return {dev:dev.coverage,heldout:heldout.coverage,heldoutMinimumFailures:minimumFailures(heldout.coverage,protocol)};
}

export function validatePredictionArtifact(artifact,{protocol,cases,split,protocolSha256,corpusSha256}) {
 validateCases(cases,{protocol,split});
 exact(artifact,['candidateId','protocolSha256','corpusSha256','predictions'],'prediction artifact');
 if(!opaque(artifact.candidateId)||!hash(protocolSha256)||!hash(corpusSha256)||artifact.protocolSha256!==protocolSha256||artifact.corpusSha256!==corpusSha256)fail('Missing candidate or stale artifact hashes.');
 const byId=new Map(cases.map(row=>[row.id,row])),seen=new Set();
 for(const prediction of list(artifact.predictions,'predictions')) {
  exact(prediction,['id','status','detections'],'prediction');
  if(!byId.has(prediction.id)||seen.has(prediction.id))fail('Unknown/duplicate prediction case ID.');seen.add(prediction.id);
  if(!['complete','blocked'].includes(prediction.status))fail('Invalid prediction status.');
  validateDetections(prediction.detections,byId.get(prediction.id).segments,protocol);
 }
 if(seen.size!==cases.length)fail('Missing case predictions.');
 return artifact;
}

// Independent augmenting-path maximum matchings; overlap is never derived from exact pairs.
export function maximumMatches(gold,predictions,overlap=false) {
 const assigned=new Map();
 const edges=predictions.map(prediction=>gold.flatMap((entity,index)=>entity.segmentId===prediction.segmentId&&entity.category===prediction.category&&
  (overlap?Math.max(entity.start,prediction.start)<Math.min(entity.end,prediction.end):entity.start===prediction.start&&entity.end===prediction.end)?[index]:[]));
 const augment=(index,visited)=>{
  for(const target of edges[index]) {
   if(visited.has(target))continue;visited.add(target);
   if(!assigned.has(target)||augment(assigned.get(target),visited)){assigned.set(target,index);return true;}
  }
  return false;
 };
 for(let index=0;index<predictions.length;index++)augment(index,new Set());
 return assigned.size;
}

export function wilson95(successes,total) {
 if(!Number.isInteger(successes)||!Number.isInteger(total)||successes<0||total<successes)fail('Invalid binomial counts.');
 if(!total)return null;
 const z=1.959963984540054,p=successes/total,denominator=1+z*z/total;
 const centre=(p+z*z/(2*total))/denominator,margin=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denominator;
 return {lower:Math.max(0,centre-margin),upper:Math.min(1,centre+margin)};
}
function binomial(successes,total) {return {rate:total?successes/total:null,numerator:successes,denominator:total,insufficient:total===0,wilson95:wilson95(successes,total)};}
function counts(tp,fp,fn) {
 const precision=binomial(tp,tp+fp),recall=binomial(tp,tp+fn);
 return {tp,fp,fn,precision:precision.rate,recall:recall.rate,precisionInsufficient:precision.insufficient,recallInsufficient:recall.insufficient,
  precisionWilson95:precision.wilson95,recallWilson95:recall.wilson95,zeroMissUpper95:fn===0&&tp>0?1-Math.pow(0.05,1/tp):null};
}

export function scorePredictions({protocol,cases,split,artifact,protocolSha256,corpusSha256}) {
 validatePredictionArtifact(artifact,{protocol,cases,split,protocolSha256,corpusSha256});
 const predictions=new Map(artifact.predictions.map(prediction=>[prediction.id,prediction]));
 const coverage=validateCases(cases,{protocol,split}).coverage,metrics={};
 for(const mode of ['exact','overlap']) {
  const perCategory={};
  for(const category of protocol.categories) {
   let tp=0,fp=0,fn=0;
   for(const row of cases) {
    const gold=row.entities.filter(entity=>entity.category===category),detected=predictions.get(row.id).detections.filter(entity=>entity.category===category);
    const matched=maximumMatches(gold,detected,mode==='overlap');tp+=matched;fp+=detected.length-matched;fn+=gold.length-matched;
   }
   perCategory[category]=counts(tp,fp,fn);
  }
  const values=Object.values(perCategory),micro=counts(...['tp','fp','fn'].map(field=>values.reduce((sum,value)=>sum+value[field],0)));
  const macro={};
  for(const field of ['precision','recall']) {
   const defined=values.map(value=>value[field]).filter(value=>value!==null);
   macro[field]=defined.length?defined.reduce((sum,value)=>sum+value,0)/defined.length:null;macro[`${field}Categories`]=defined.length;
  }
  macro.insufficient=macro.precisionCategories!==protocol.categories.length||macro.recallCategories!==protocol.categories.length;
  metrics[mode]={perCategory,micro,macro};
 }
 const clean=cases.filter(row=>row.expectedStatus==='complete'&&!row.entities.length),blocked=cases.filter(row=>row.expectedStatus==='blocked');
 const cleanComplete=binomial(clean.filter(row=>predictions.get(row.id).status==='complete').length,clean.length);
 const blockedStatus=binomial(blocked.filter(row=>predictions.get(row.id).status==='blocked').length,blocked.length);
 blockedStatus.perReason=Object.fromEntries(protocol.blockReasons.map(reason=>{
  const rows=blocked.filter(row=>row.blockReason===reason);return [reason,binomial(rows.filter(row=>predictions.get(row.id).status==='blocked').length,rows.length)];
 }));
 const thresholds=protocol.experimentalGates,failures=[];
 for(const category of protocol.categories) {
  const value=metrics.exact.perCategory[category],requiredRecall=protocol.mandatoryCategories.includes(category)?thresholds.mandatoryExactRecall:thresholds.otherCategoryExactRecallMinimum;
  if(value.recall===null||value.recall<requiredRecall)failures.push(`recall:${category}`);
  if(value.precision===null||value.precision<thresholds.exactPrecisionMinimumPerCategory)failures.push(`precision:${category}`);
 }
 if(cleanComplete.rate===null||cleanComplete.rate<thresholds.cleanCompleteRateMinimum)failures.push('cleanCompleteRate');
 if(blockedStatus.rate===null||blockedStatus.rate<thresholds.requiredBlockedStatusRate)failures.push('blockedStatusRate');
 const minimums=minimumFailures(coverage,protocol);
 const status=split==='dev'?'diagnostic-only':minimums.length?'incomplete':failures.length?'failed':'eligible-for-integration-evaluation';
 return {version:1,candidateId:artifact.candidateId,protocolSha256,corpusSha256,split,metrics,cleanComplete,blockedStatus,coverage,
  experimentalGate:{status,failures,minimumFailures:split==='heldout'?minimums:[],minimumsApplied:split==='heldout',meaning:'eligible-for-integration-evaluation only; never safe-egress or pilot-ready'},
  routingSafety:'not-evaluated',preservation:'not-evaluated'};
}

async function confinedFile(root,entry) {
 exact(entry,['file','sha256'],'manifest file');
 if(typeof entry.file!=='string'||!entry.file||path.isAbsolute(entry.file)||entry.file.split(/[\\/]/).includes('..')||!hash(entry.sha256))fail('Invalid manifest path/hash.');
 const file=await realpath(path.resolve(root,entry.file)),relative=path.relative(root,file);
 if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))fail('Manifest file escapes its directory.');
 const bytes=await readFile(file);if(sha256(bytes)!==entry.sha256)fail('Manifest hash mismatch.');return {file,bytes};
}
const json=(bytes,label)=>{try{return JSON.parse(bytes.toString('utf8'));}catch{fail(`Invalid ${label} JSON.`);}};
const jsonl=bytes=>{
 const text=bytes.toString('utf8');if(!text.trim())fail('Empty JSONL.');
 const lines=text.endsWith('\n')?text.slice(0,-1).split('\n'):text.split('\n');
 return lines.map(line=>{if(!line.trim())fail('Blank JSONL row.');return json(Buffer.from(line),'corpus');});
};

export async function loadManifest(manifestPath) {
 const manifestFile=await realpath(manifestPath),root=path.dirname(manifestFile),manifest=json(await readFile(manifestFile),'manifest');
 exact(manifest,['version','protocol','splits','provenance'],'manifest');if(manifest.version!==1||!object(manifest.provenance))fail('Invalid manifest version/provenance.');exact(manifest.splits,['dev','heldout'],'manifest splits');
 exact(manifest.provenance,['protocolFrozenBeforeHeldout','syntheticOnly','candidateEvaluated','heldoutAuthor','heldoutProvenance','annotationGuide'],'manifest provenance');
 if(manifest.provenance.protocolFrozenBeforeHeldout!==true||manifest.provenance.syntheticOnly!==true||manifest.provenance.candidateEvaluated!==false||!opaque(manifest.provenance.heldoutAuthor))fail('Invalid corpus provenance assertions.');
 const protocolFile=await confinedFile(root,manifest.protocol),dev=await confinedFile(root,manifest.splits.dev),heldout=await confinedFile(root,manifest.splits.heldout);
 const guideFile=await confinedFile(root,manifest.provenance.annotationGuide);
 const provenanceFile=await confinedFile(root,manifest.provenance.heldoutProvenance),provenance=json(provenanceFile.bytes,'heldout provenance');
 if(!object(provenance)||provenance.protocolSha256!==manifest.protocol.sha256||provenance.corpusSha256!==manifest.splits.heldout.sha256||provenance.syntheticOnly!==true||provenance.noDevRead!==true||provenance.candidateOutputsSeen!==false||
  provenance.annotationGuideSha256!==manifest.provenance.annotationGuide.sha256||provenance.annotationGuideRead!==true||
  typeof provenance.configuredModel!=='string'||!provenance.configuredModel.trim()||provenance.observedModelId!==null&&(typeof provenance.observedModelId!=='string'||!provenance.observedModelId.trim()))fail('Invalid heldout provenance assertions.');
 const protocol=json(protocolFile.bytes,'protocol'),splits={dev:jsonl(dev.bytes),heldout:jsonl(heldout.bytes)};
 if(protocol.annotationGuideSha256!==manifest.provenance.annotationGuide.sha256)fail('Protocol annotation guide hash mismatch.');
 const validation=validateCorpus({protocol,splits});
 return {manifest,protocol,splits,validation,inputFiles:[manifestFile,protocolFile.file,dev.file,heldout.file,provenanceFile.file,guideFile.file]};
}

export async function main(args=process.argv.slice(2)) {
 const [command,...rest]=args;if(!['validate','score'].includes(command))fail('Use validate --manifest FILE or score --manifest FILE --split dev|heldout --predictions FILE --output FILE.');
 const options={};for(let index=0;index<rest.length;index+=2) {
  const key=rest[index];if(!['--manifest','--split','--predictions','--output'].includes(key)||Object.hasOwn(options,key)||!rest[index+1]||rest[index+1].startsWith('--'))fail('Invalid CLI arguments.');options[key]=rest[index+1];
 }
 if(!options['--manifest']||command==='validate'&&Object.keys(options).length!==1)fail('Invalid validate arguments.');
 const loaded=await loadManifest(options['--manifest']);
 if(command==='validate') {
  const incomplete=loaded.validation.heldoutMinimumFailures.length>0;
  console.log(JSON.stringify({status:incomplete?'corpus-incomplete':'corpus-valid',candidateEvaluation:'not-performed',routingSafety:'not-evaluated',preservation:'not-evaluated',...loaded.validation},null,2));return incomplete?1:0;
 }
 if(Object.keys(options).length!==4||!['dev','heldout'].includes(options['--split']))fail('Missing score arguments.');
 const predictionFile=await realpath(options['--predictions']),artifact=json(await readFile(predictionFile),'prediction');
 const split=options['--split'],report=scorePredictions({protocol:loaded.protocol,cases:loaded.splits[split],split,artifact,protocolSha256:loaded.manifest.protocol.sha256,corpusSha256:loaded.manifest.splits[split].sha256});
 const output=path.resolve(options['--output']);let actualOutput=output;try{actualOutput=await realpath(output);}catch(error){if(error.code!=='ENOENT')throw error;actualOutput=path.join(await realpath(path.dirname(output)),path.basename(output));}
 if([...loaded.inputFiles,predictionFile].includes(actualOutput))fail('Output must not overwrite an evaluation input.');
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.experimentalGate.status,output}));
 return report.experimentalGate.status==='eligible-for-integration-evaluation'?0:report.experimentalGate.status==='failed'?1:3;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try{process.exitCode=await main();}catch(error){console.error(`Privacy evaluation error: ${error.message}`);process.exitCode=2;}
}

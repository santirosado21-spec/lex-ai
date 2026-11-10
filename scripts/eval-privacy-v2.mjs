// Offline v2 validation/scoring only. No candidate, inference, corpus loading or network.
import {validateProtocol as validateV1Protocol,validateCases as validateV1Cases,scorePredictions as scoreV1,validateCorpus as validateV1Corpus} from './eval-privacy.mjs';
import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';
import {copyPrivacyJson,contractFailure,exactFields,projectPrivacyCase,evaluateOperationalPreparation,REASON_PRIORITY} from '../server/privacy/operational-v2.mjs';
export {projectPrivacyCase,evaluateOperationalPreparation};
const fields=['id','split','templateGroup','synthetic','scope','segments','entities','expectedStatus','blockReason','preserve','operational'];
const normalizeProtocol=p=>({...p,version:1});
// V1 imposed a gold-dependent null-origin restriction. After v2 validates actual
// stimuli and precedence, use equivalent unknown classification for metrics only.
const normalizeCases=rows=>rows.map(({operational,...row})=>({...row,segments:row.segments.map(segment=>({...segment,originScope:segment.originScope??row.scope}))}));
export function validateProtocol(input){
 try{
  const p=copyPrivacyJson(input);
  exactFields(p,['id','version','frozenAt','purpose','offsetUnit','categories','mandatoryCategories','blockReasons','corpusRules','caseContract','predictionContract','metrics','experimentalGates','resourceProtocol','contaminationPolicy','annotationGuideSha256','status']);
  if(p.version!==2||p.caseContract?.reasonPriority?.join('|')!==REASON_PRIORITY.join('|')||p.caseContract?.allowedMediaTypes?.join('|')!=='text/plain|text/markdown'||p.resourceProtocol?.inputEnvelopeMaximumUtf16!==7000||p.resourceProtocol?.maximumSegments!==256||p.resourceProtocol?.candidateInputMaximumUtf8Bytes!==32768||p.experimentalGates?.requiredCorrectBlockReasonRate!==1)contractFailure();
  validateV1Protocol(normalizeProtocol(p));return p;
 }catch{contractFailure();}
}
export function validateCases(input,options){
 try{
  const {protocol,split}=copyPrivacyJson(options);
  const p=validateProtocol(protocol),rows=copyPrivacyJson(input);
  if(!Array.isArray(rows))contractFailure();
  for(const row of rows){exactFields(row,fields);const prepared=evaluateOperationalPreparation(projectPrivacyCase(row));if(row.expectedStatus!==prepared.status||row.blockReason!==prepared.reasonCategory)contractFailure();}
  return validateV1Cases(normalizeCases(rows),{protocol:normalizeProtocol(p),split});
 }catch{contractFailure();}
}
export function validatePredictionArtifact(input,options){
 try{
  options=copyPrivacyJson(options);
  const p=validateProtocol(options.protocol),rows=copyPrivacyJson(options.cases),artifact=copyPrivacyJson(input);validateCases(rows,{protocol:p,split:options.split});
  exactFields(artifact,['candidateId','protocolSha256','corpusSha256','predictions']);
  if(!Array.isArray(artifact.predictions))contractFailure();
  for(const prediction of artifact.predictions){exactFields(prediction,['id','status','detections','reasonCategory']);if(prediction.status==='complete'?prediction.reasonCategory!==null:prediction.status!=='blocked'||!REASON_PRIORITY.includes(prediction.reasonCategory))contractFailure();}
  // Frozen v1 validates ranges, duplicates, IDs, hashes and category membership.
  scoreV1({...options,protocol:normalizeProtocol(p),cases:normalizeCases(rows),artifact:{...artifact,predictions:artifact.predictions.map(({reasonCategory,...prediction})=>prediction)}});
  return artifact;
 }catch{contractFailure();}
}
export function scorePredictions(options){
 try{
  options=copyPrivacyJson(options);
  const p=validateProtocol(options.protocol),rows=copyPrivacyJson(options.cases),artifact=validatePredictionArtifact(options.artifact,{...options,protocol:p,cases:rows});
  const report=scoreV1({...options,protocol:normalizeProtocol(p),cases:normalizeCases(rows),artifact:{...artifact,predictions:artifact.predictions.map(({reasonCategory,...prediction})=>prediction)}});
  const predictions=new Map(artifact.predictions.map(row=>[row.id,row])),blocked=rows.filter(row=>row.expectedStatus==='blocked');
  const metric=items=>{const numerator=items.filter(row=>predictions.get(row.id).status==='blocked'&&predictions.get(row.id).reasonCategory===row.blockReason).length;return {numerator,denominator:items.length,rate:items.length?numerator/items.length:null};};
  report.version=2;report.correctBlockReason=metric(blocked);report.correctBlockReason.perReason=Object.fromEntries(REASON_PRIORITY.map(reason=>[reason,metric(blocked.filter(row=>row.blockReason===reason))]));
  if(report.correctBlockReason.rate!==1){report.experimentalGate.failures.push('correctBlockReasonRate');if(report.experimentalGate.status==='eligible-for-integration-evaluation')report.experimentalGate.status='failed';}
  if(options.split==='heldout'&&Object.hasOwn(p.corpusRules,'heldoutCaseCount')){
   const required=p.corpusRules.heldoutCaseCount;
   if(!Number.isInteger(required)||required<1)contractFailure();
   if(rows.length!==required){report.experimentalGate.minimumFailures.push('heldoutCaseCount');report.experimentalGate.status='incomplete';}
  }
  return report;
 }catch{contractFailure();}
}

// Pure corpus integrity/coverage; neither minimums nor hashes attest independence.
export function validateCorpus(input){
 try{
  const value=copyPrivacyJson(input);exactFields(value,['protocol','splits']);
  const protocol=validateProtocol(value.protocol);exactFields(value.splits,['dev','heldout']);
  for(const split of ['dev','heldout'])validateCases(value.splits[split],{protocol,split});
  const result=validateV1Corpus({protocol:normalizeProtocol(protocol),splits:{dev:normalizeCases(value.splits.dev),heldout:normalizeCases(value.splits.heldout)}});
  if(Object.hasOwn(protocol.corpusRules,'heldoutCaseCount')){
   if(!Number.isInteger(protocol.corpusRules.heldoutCaseCount)||protocol.corpusRules.heldoutCaseCount<1)contractFailure();
   if(value.splits.heldout.length!==protocol.corpusRules.heldoutCaseCount)result.heldoutMinimumFailures.push('heldoutCaseCount');
  }
  if(Object.hasOwn(protocol.corpusRules,'splitNames')&&JSON.stringify(protocol.corpusRules.splitNames)!==JSON.stringify(['dev','heldout']))contractFailure();
  return result;
 }catch{contractFailure();}
}
// All content is supplied explicitly by a caller; no filesystem paths are opened.
// Exact filenames are inert manifest identities, never paths to resolve.
export function validateManifestBytes(input){
 try{
  // Do not JSON-copy binary arrays: inspect descriptors before reading each value.
  exactFields(input,['manifest','protocolBytes','annotationGuideBytes','splits']);
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Object.getOwnPropertySymbols(input).length||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Object.values(descriptors).some(d=>!Object.hasOwn(d,'value')))contractFailure();
  const manifest=copyPrivacyJson(descriptors.manifest.value);exactFields(manifest,['version','protocol','annotationGuide','splits']);
  if(manifest.version!==2)contractFailure();exactFields(manifest.splits,['dev','heldout']);
  const splitInput=descriptors.splits.value;exactFields(splitInput,['dev','heldout']);
  const splitDescriptors=Object.getOwnPropertyDescriptors(splitInput);
  if(Object.getOwnPropertySymbols(splitInput).length||![Object.prototype,null].includes(Object.getPrototypeOf(splitInput))||Object.values(splitDescriptors).some(d=>!Object.hasOwn(d,'value')))contractFailure();
  const bytes=value=>{
   if(typeof value==='string'){const raw=Buffer.from(value,'utf8');if(raw.toString('utf8')!==value)contractFailure();return raw;}
   if(value===null||typeof value!=='object'||![Buffer.prototype,Uint8Array.prototype].includes(Object.getPrototypeOf(value)))contractFailure();
   if(Object.getOwnPropertySymbols(value).length)contractFailure();
   // Typed array indexed values are data properties; reject custom fields/getters.
   const ds=Object.getOwnPropertyDescriptors(value);
   if(Object.keys(ds).some(key=>!/^(0|[1-9]\d*)$/.test(key)||!Object.hasOwn(ds[key],'value')))contractFailure();
   return Buffer.from(value);
  };
  const entries=[['protocol.json',manifest.protocol,descriptors.protocolBytes.value],['annotation-guide.md',manifest.annotationGuide,descriptors.annotationGuideBytes.value],['dev.jsonl',manifest.splits.dev,splitDescriptors.dev.value],['heldout.jsonl',manifest.splits.heldout,splitDescriptors.heldout.value]];
  const contents=entries.map(([file,reference,value])=>{
   exactFields(reference,['file','sha256']);if(reference.file!==file||typeof reference.sha256!=='string'||! /^[a-f0-9]{64}$/.test(reference.sha256))contractFailure();
   const raw=bytes(value);if(createHash('sha256').update(raw).digest('hex')!==reference.sha256)contractFailure();
   if(raw.length>=3&&raw[0]===0xef&&raw[1]===0xbb&&raw[2]===0xbf)contractFailure();
   return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
  });
  const protocol=validateProtocol(JSON.parse(contents[0]));if(protocol.annotationGuideSha256!==manifest.annotationGuide.sha256)contractFailure();
  const parseRows=text=>{const lines=(text.endsWith('\n')?text.slice(0,-1):text).split('\n');if(lines.some(line=>!line.trim()))contractFailure();return lines.map(line=>JSON.parse(line));};
  const splits={dev:parseRows(contents[2]),heldout:parseRows(contents[3])};
  const validation=validateCorpus({protocol,splits});
  return {protocol,splits,validation,status:validation.heldoutMinimumFailures.length?'corpus-incomplete':'corpus-valid',candidateEvaluation:'not-performed',independence:'not-attested',routingSafety:'not-evaluated',preservation:'not-evaluated'};
 }catch{contractFailure();}
}

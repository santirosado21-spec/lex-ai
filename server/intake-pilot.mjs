import {remedyCatalog,remedyPeriod} from './corpus/remedy-index.mjs';
import {questionLines} from './corpus/intake-question-lines.mjs';
import {availableQuestionFacts,selectQuestionFacts} from './corpus/intake-question-facts.mjs';
import {caseSources,sourceSummary,knownParties,addCaseSource,readCaseFile,openedCaseSources,openedComparisonSources} from './intake-sources.mjs';
import {mentionedConcepts} from './corpus/question-concepts.mjs';
import {questionCandidates} from './corpus/intake-question.mjs';
import {operationDate,permitQuestionHint,documentPermitFields,permitFieldCitations} from './corpus/permit-question.mjs';
import {searchPermits,permitNote} from './corpus/pedimento-index.mjs';
import {searchNico,nicoRow,nicoReference,nicoEdition} from './corpus/nico-index.mjs';
import {searchTariff,labeledTariffCodes,tariffResult,tariffReference} from './corpus/tariff-index.mjs';
import {focusFromInstruction,isFollowupForm,quotedRanges,prepareFollowup,followupEnvelope,renderFollowup} from './corpus/intake-followup.mjs';
import {comparisonSource,comparisonsFor,comparisonEnvelope,readComparisonReply,renderComparison} from './corpus/intake-comparison.mjs';
import {hasTradeWorksheet,tradeWorksheet,revisedWorksheetRow,worksheetSummary,worksheetProposals} from './intake-trade-worksheet.mjs';
import {suggestTradeReadings,loadTradeReading,tradeReadingEnvelope,renderTradeReading} from './corpus/intake-trade-reading.mjs';
import {newPracticeSeed,practiceDocument,prepareProtectedCase,protectedCaseEnvelope,renderProtectedCase} from './corpus/pilot-protected-case.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {addReviewSelection} from './privacy/intake-document-review.mjs';
import {inspectLocalDocument} from './intake-import.mjs';
import {bindReviewedDocument,documentTokens,openReviewedDocument} from './privacy/intake-document-map.mjs';
import {angles,questionPassage,remedyResearch,nicoResearch,tariffResearch,loadResearchPassage, researchEnvelope, renderResearchNote} from './corpus/intake-research.mjs';
import {exportIntakeDocument} from './intake-office-export.mjs';
import {tradeArticles, supportingReferences, tradeInstruction, renderTradeDraft} from './corpus/trade-pilot-grounding.mjs';
import {getPilotTradeScenario} from './pilot-trade-scenario.mjs';
import {canonicalJson} from './canonical-json.mjs';
import {createEgressPolicy} from './egress-policy.mjs';
import {createOpenAiKeychain} from './providers/openai-keychain.mjs';
import {createOpenAiProvider} from './providers/openai.mjs';

const frozenArticles = tradeArticles();
const tasks = Object.freeze({
 trade:{title:'Preparación de una importación'},
 opening:{title:'Acuse de apertura',instruction:'Redacta un acuse de apertura de expediente de dos frases.'},
 documents:{title:'Solicitud de documentos',instruction:'Redacta una solicitud breve para pedir al cliente documentos y una cronología. No pidas números de identificación.'},
});
const scope = Object.freeze({workspaceId:'intake-pilot',matterId:'synthetic-template',threadId:'draft'});
const destination = 'openai';
const documentKinds = ['pedimento','factura','contrato','otro'];
function envelopeFor(task, kind, articles=frozenArticles, scenarioId) {
 if (!Object.hasOwn(tasks,task) || (kind != null && !documentKinds.includes(kind))) {
  throw new Error('Tarea o clase documental inválida.');
 }
 const trade = task === 'trade';
 const document = trade && kind ? ` Tipo de documento confirmado en el ejercicio: ${kind}.` : '';
 const scenario = scenarioId == null ? null : getPilotTradeScenario(scenarioId);
 if (scenarioId != null && (!scenario || kind !== 'factura')) throw new Error('Ejemplo documental inválido.');
 const example = trade && scenario ? '\nEjemplo ficticio reconocido y confirmado:\n' + scenario.preview : '';
 const content = trade ? tradeInstruction(articles) + document + example :
  tasks[task].instruction + ' Usa los marcadores literales [[CLIENTE]] y [[ASUNTO]]. Devuelve solo el texto en español. Evita datos inventados, citas, efectos jurídicos y plazos.';
 return {version:1,responseFormat:trade?'json':'text',messages:[{role:'user',content}]};
}

const allowedEnvelopes = new Set();
for (const task of Object.keys(tasks)) {
 for (const kind of task==='trade' ? [null,...documentKinds] : [null]) {
  allowedEnvelopes.add(canonicalJson(envelopeFor(task,kind)));
 }
}

allowedEnvelopes.add(canonicalJson(envelopeFor('trade','factura',frozenArticles,'factura-origen-v1')));

function exactFields(payload, fields) {
 if (!payload || typeof payload!=='object' || Array.isArray(payload) ||
     Object.keys(payload).length!==fields.length || !fields.every(field=>Object.hasOwn(payload,field))) {
  throw new Error('Campos del piloto inválidos.');
 }
}

function exportCitations(references){
 return references.map(ref=>({...ref,title:ref.id+' · '+ref.title,version:ref.locator,retrievedAt:ref.checkedOn,
  status:'Referencia de consulta, aplicación al asunto pendiente de revisión'}));
}

function localOperationControl(intake,task){
 const follow=intake.followups?.[task];
 const basis=follow?.form==='control'?(follow.basisTask??follow.parent):task;
 return intake.permits?.[basis]??(intake.remedies?.[basis]?.date?intake.remedies[basis]:intake.research?.[basis]?.remedyReview);
}
function localQuestion(intake,task){
 if(intake.questions?.[task])return intake.questions[task];
 const follow=intake.followups?.[task];
 const basis=follow?.basisTask??follow?.parent;
 return follow?.form==='control'&&(intake.permits?.[basis]||intake.research?.[basis]?.sourceId?.startsWith('ad29-'))?intake.questions?.[basis]:null;
}
function draftText(value,doc,evidence,question,permit) {
 const allowed=new Set(['[[CLIENTE]]','[[ASUNTO]]',...(Array.isArray(doc)?doc:[doc]).flatMap(documentTokens).map(item=>item.token)]);
 if(permit)allowed.add('[[COTEJO]]');
 if(question)allowed.add('[[CONSULTA]]');
 if(evidence)allowed.add('[[SOPORTE]]');
 const unrecognized=typeof value==='string' ? value.replace(/\[\[[^\[\]]+\]\]/g,token=>allowed.has(token)?'':token) : '';
 if (typeof value!=='string' || value.length>1800 || !value.includes('[[CLIENTE]]') ||
     !value.includes('[[ASUNTO]]') || /\[\[|\]\]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(unrecognized)) {
  throw new Error('El borrador debe conservar [[CLIENTE]] y [[ASUNTO]], con los marcadores de este expediente, con un máximo de 1800 caracteres.');
 }
 return value;
}

export function createIntakeGenerator({
 getApiKey=createOpenAiKeychain({enabled:true}).getApiKey,
 fetchImpl,onReceipt,onAttempt,usageStatus,
}={}) {
 let active=false, previousKey, retry=false, confirmedRefusal=false;
 const provider=createOpenAiProvider({
  onAttempt:async attempt=>{
   confirmedRefusal=Boolean(attempt.rejection);
   if(onAttempt)await onAttempt(attempt);
  },
  getApiKey:async()=>{
   if(retry)return getApiKey.afterRejection(previousKey);
   previousKey=await getApiKey();return previousKey;
  },
  enabled:true,fetchImpl,model:'gpt-6-luna',
  maxCalls:3,maxOutputTokens:320,maxTotalTokens:4000,reasoningEffort:'none',
 });
 const gateFor=(approvedDynamic,dynamicCategory)=>createEgressPolicy({
  destinations:{[destination]:provider},
  getPolicy:()=>({version:'intake-v1',grants:[{scope,destination,allowedCategories:['synthetic','public']}]}),
  classify:({serialized,scope,destination,policyVersion})=>{
   const dynamic=approvedDynamic===serialized;
   const exact=dynamic || allowedEnvelopes.has(serialized);
   return {serialized,scope,destination,policyVersion,reliable:exact,scopeVerified:exact,category:dynamic?dynamicCategory:'synthetic'};
  },
 });
 const generate=async (task,{signal,documentKind,articles,scenarioId,research,practice,reading,comparison,followup}={}) => {
  const envelope=followup?followupEnvelope(followup):comparison?comparisonEnvelope(comparison):reading ? tradeReadingEnvelope(reading) : practice ? protectedCaseEnvelope(practice) : research ? researchEnvelope(research) : envelopeFor(task,documentKind,articles,scenarioId);
  const gate=gateFor(practice||research||reading||comparison||followup ? canonicalJson(envelope) : null,(research&&!research.caseFacts?.texts.length)||reading||comparison||(followup&&!followup.synthetic)?'public':'synthetic');
  // Only the prebuilt envelopes may cross this boundary. No caller can supply
  // intake data, metadata, history, files, or a custom request.
  if(active)throw Error('Hay una consulta en curso.');
  active=true;
  const dispatch=async()=>{
   let answer='';
   for await (const chunk of gate.generate(envelope.messages,{scope,destination,responseFormat:envelope.responseFormat,signal})) answer+=chunk;
   return answer.trim();
  };
  try {
   let answer;
   try {answer=await dispatch();}
   catch(error){
    if(!confirmedRefusal || !getApiKey.afterRejection || signal?.aborted)throw error;
    // Reauthorize the same immutable request and reserve a second physical dispatch under the same provider budget.
    retry=true;
    answer=await dispatch();
   }
   if(onReceipt && provider.lastReceipt){
    try{await onReceipt(provider.lastReceipt);}catch{ /* Keep the draft if local accounting fails. */ }
   }
   return answer;
  } finally {active=false;previousKey=undefined;confirmedRefusal=false;retry=false;}
 };
 if(usageStatus)generate.usageStatus=()=>({...usageStatus(),remaining:provider.status().callsRemaining});
 return generate;
}

export function createIntakePilot({store,workspace,matter,createWorkspace,createMatter,generate,publicLibrary,explicitArticleReference}) {
 let articles;
 try { articles=tradeArticles(publicLibrary); } catch { articles=null; }
 const tradeReferences=articles?[...articles,...supportingReferences]:[];
 let pending=false;
 let latestReview=null;
 let inspectionRevision=0;
 const pendingQuestions=new Map();
 const current = () => {
  const firm=workspace();
  const intake=firm && store.get('intake-pilot',`intake-${firm.id}`);
  if (!intake) return null;
  const entry=matter(intake.matterId);
  if (entry.workspaceId!==intake.workspaceId) throw new Error('El asunto no corresponde al piloto.');
  return {firm,entry,intake};
 };
 const sourceFor = (selection,saved) => selection.angle?questionPassage(publicLibrary,selection,selection.factIds?selectQuestionFacts(saved,selection.factIds):null):loadResearchPassage(publicLibrary,selection.sourceId,selection.part);
 const noteFor = (saved,task) => {
  const intake=saved?.intake;
  const selection=intake?.research?.[task];
  return selection && Object.hasOwn(intake.research,task) ? sourceFor(selection,saved) : null;
 };
 const practiceFor = saved=>prepareProtectedCase(saved.intake.practiceSeed,saved.intake.document,saved.firm.id,saved.entry.id,publicLibrary);
 const practiceTask = saved=>{
  if(!saved?.intake.practiceSeed)return null;
  const archived=saved.intake.researchHistory?.['case-note'];
  if(archived)return {id:'case-note',...archived};
  try {
   const note=practiceFor(saved);
   return {id:'case-note',title:note.title,preview:note.prompt,references:[note.ref]};
  } catch {return {id:'case-note',title:'Nota del expediente protegido',preview:null,references:[]};}
 };
 const readingCache=new Map();
 const readingFor=task=>{
  if(!readingCache.has(task))readingCache.set(task,loadTradeReading(publicLibrary,task));
  return readingCache.get(task);
 };
 const readingChoices=saved=>{
  if(!saved?.intake.document)return [];
  const choices=new Map();
  for(const document of openedCaseSources(saved)){
   for(const {id,title,line,excerpt} of suggestTradeReadings(document.original)){
    const row={line,excerpt,...document.attribution};
    const prior=choices.get(id);
    if(prior)(prior.evidence.additional??=[]).push(row);
    else choices.set(id,{id,title,evidence:row});
   }
  }
  for(const [id,record] of Object.entries(saved.intake.researchHistory??{})){
   if(id.startsWith('lectura-')&&record.evidence)choices.set(id,{id,title:record.title,evidence:record.evidence});
  }
  return [...choices.values()];
 };
 const readingTasks=saved=>readingChoices(saved).map(({id,title,evidence})=>{
  const archived=saved.intake.researchHistory?.[id];
  if(archived)return {id,...archived};
  try{
   const reading=readingFor(id);
   return {id,title,preview:reading.prompt,references:reading.refs,evidence};
  }catch{return {id,title,preview:null,references:[],evidence};}
 });
 const comparisonNotes=saved=>{
  if(!saved?.intake.document||!store.protectedRecords)return [];
  return comparisonsFor(openedComparisonSources(saved));
 };
 const comparisonInfo=note=>({subject:note.subject,group:note.group,title:note.packet.title,label:note.variant.label,
  suggested:note.suggested,suggestedLabel:note.suggestedLabel,conflicting:note.conflicting});
 const comparisonTasks=saved=>{
  if(!saved)return [];
  const notes=new Map(comparisonNotes(saved).map(note=>{
   const {id,title,subject,packet,evidence}=note;
   const archived=saved.intake.researchHistory?.[id];
   return [id,{id,title,preview:packet.prompt,references:packet.refs,evidence,...archived,
    comparison:{...comparisonInfo(note),cached:saved.intake.comparisonReplies?.[subject]?.digest===packet.digest}}];
  }));
  for(const [id,archived] of Object.entries(saved.intake.researchHistory??{})){
   if(id.startsWith('contraste-')&&archived.comparison&&!notes.has(id))notes.set(id,{id,...archived,comparison:{...archived.comparison,archived:true,cached:false}});
  }
  return [...notes.values()];
 };
 const tariffEvidence=saved=>openedCaseSources(saved).flatMap(doc=>labeledTariffCodes(doc.original).map(item=>({...item,...doc.attribution})));
 const followupSource=(saved,parent)=>{
  const archived=saved.intake.researchHistory?.[parent]?.comparison;
  if(archived)return comparisonSource(archived.subject);
  const permit=saved.intake.permits?.[parent];
  if(permit){
   const note=permitNote(permit);
   if(note.id!==(saved.intake.researchHistory?.[parent]?.permitSourceId??parent))throw Error('La ficha procede de otra edición del Anexo 22.');
   return note;
  }
  const remedy=saved.intake.remedies?.[parent];
  if(remedy)return remedyResearch(remedy.sourceId,remedy.point);
  const nico=saved.intake.nicos?.[parent];
  if(nico){
   if(nico.edition!==nicoEdition)throw Error('La ficha pertenece a otra edición del NICO.');
   return nicoResearch(nico.code,nico.nico);
  }
  const selection=saved.intake.tariffs?.[parent];
  if(selection){
   const source=tariffResearch(selection.code,selection.page);
   if(source.ref.pdfSha256!==selection.pdfSha256)throw Error('La ficha pertenece a otra edición de la tarifa.');
   return source;
  }
  if(parent==='case-note')return practiceFor(saved);
  if(parent.startsWith('lectura-'))return readingFor(parent);
  return noteFor(saved,parent);
 };
 const followupFor=(saved,selection)=>{
  const prior=saved.intake.followups?.[selection.parent];
  return prepareFollowup(followupSource(saved,selection.basisTask??selection.parent),selection.ranges,selection.form,selection.focus,prior);
 };
 const firstBasis=(saved,task)=>{
  const {intake}=saved;
  if(Object.hasOwn(intake.followupBasis??{},task))return intake.followupBasis[task];
  if(store.protectedRecords&&Object.hasOwn(intake.drafts,task)&&Object.hasOwn(intake.followups??{},task)&&!intake.editedTasks?.includes(task)){
   const old=intake.followups[task];
   try{return quotedRanges(followupSource(saved,old.basisTask??old.parent),intake.drafts[task]);}catch{return [];}
  }
  if(!store.protectedRecords||!Object.hasOwn(intake.drafts,task)||intake.editedTasks?.includes(task)||
     !(task==='case-note'||task.startsWith('lectura-')||intake.researchHistory?.[task]?.comparison||Object.hasOwn(intake.research??{},task)))return [];
  try{return quotedRanges(followupSource(saved,task),intake.drafts[task]);}catch{return [];}
 };
 const followupTasks=saved=>Object.entries(saved?.intake.followups??{}).map(([id,selection])=>{
  const archived=saved.intake.researchHistory?.[id];
  if(archived)return {id,...archived,parent:selection.parent};
  try{
   const note=followupFor(saved,selection);
   return {id,title:note.title+' · '+selection.parentTitle,preview:note.prompt,references:note.refs,parent:selection.parent};
  }catch{return {id,title:'Seguimiento pendiente de cotejo',preview:null,parent:selection.parent};}
 });
 const status = () => {
  const saved=current();
  return {
   saved:Boolean(saved),
   ...(generate.usageStatus?{cloudUsage:generate.usageStatus()}:{}),
   protectedRecords:store.protectedRecords===true,
   hasDocument:Boolean(saved?.intake.document),
   sources:caseSources(saved?.intake).map(sourceSummary),comparisonPair:saved?.intake.comparisonPair??null,
   drafts:saved?.intake.drafts??{},
   followupParents:saved?Object.keys(saved.intake.drafts).filter(task=>firstBasis(saved,task).length):[],
   editedTasks:saved?.intake.editedTasks??[],
   tasks:[practiceTask(saved)].filter(Boolean).concat(readingTasks(saved),Object.entries(tasks).filter(([id])=>id!=='trade'||articles).map(([id,{title}])=>({id,title,preview:envelopeFor(id,saved?.intake.documentKind,articles,saved?.intake.scenarioId).messages[0].content,references:id==='trade'?tradeReferences:[]}))).concat(comparisonTasks(saved)).concat(Object.entries(saved?.intake.research??{}).map(([id,selection])=>{
    const archived=saved.intake.researchHistory?.[id];
    if (archived) return {id,...archived};
    try {
     const note=sourceFor(selection,saved);
     return {id,title:note.title,preview:note.prompt,references:[note.ref],...(note.caseFacts?{evidence:note.caseFacts.evidence,usesFacts:!!note.caseFacts.texts.length,localLines:note.caseFacts.localCount}:{})};
    } catch {return {id,title:'Fuente pendiente de comprobación',preview:null,references:[]};}
   })).concat([...Object.keys(saved?.intake.tariffs??{}),...Object.keys(saved?.intake.nicos??{}),...Object.keys(saved?.intake.permits??{}),...Object.keys(saved?.intake.remedies??{})].map(id=>({id,...saved.intake.researchHistory[id]}))).concat(followupTasks(saved)),
  };
 };

 return async (action,payload,{signal}={}) => {
  switch (action) {
   case 'intake.createPractice':
   case 'intake.inspectSource':
   case 'intake.inspectLocal': {
    const saved=current(),attach=action==='intake.inspectSource';
    if(attach&&(!saved||!store.protectedRecords||payload.review!==true))throw Error('Abre un expediente cifrado y revisa el documento.');
    let practiceSeed;
    if(action==='intake.createPractice'){
     exactFields(payload,[]);
     if(workspace()||!store.protectedRecords)throw Error('Abre un ejercicio cifrado nuevo para preparar el caso.');
     practiceSeed=newPracticeSeed();
     const {text}=practiceDocument(practiceSeed);
     payload={extension:'txt',base64:Buffer.from(text).toString('base64'),review:true};
    }
    const revision=++inspectionRevision;
    latestReview=null;
    const data=await inspectLocalDocument(payload,{signal,knownIdentities:attach?knownParties(saved):[]});
    if(revision===inspectionRevision&&(attach?current()?.entry.id===saved.entry.id:!workspace())&&store.protectedRecords&&data.protection?.available){
     const id=randomUUID();
     latestReview={id,protection:data.protection,practiceSeed,history:[],...(attach?{matterId:saved.entry.id,base64:payload.base64,extension:payload.extension,documentKind:data.documentKind}:{})};
     return {...data,reviewId:id};
    }
    return data;
   }
   case 'intake.protectSelection':
   case 'intake.undoSelection': {
    const add=action==='intake.protectSelection';
    exactFields(payload,add?['reviewId','start','end']:['reviewId']);
    if(!store.protectedRecords||!latestReview||(latestReview.matterId?current()?.entry.id!==latestReview.matterId:workspace()))throw Error('Abre de nuevo el documento antes de corregirlo.');
    const prior=latestReview.retry;
    const result=()=>({reviewId:latestReview.id,protection:latestReview.protection,canUndo:latestReview.history.length>0});
    if(prior&&prior.id===payload.reviewId&&prior.action===action&&prior.start===payload.start&&prior.end===payload.end)return result();
    if(latestReview.id!==payload.reviewId)throw Error('La revisión del documento cambió.');
    const history=latestReview.history;
    if(add&&history.length>=24)throw Error('La revisión admite hasta 24 correcciones.');
    if(!add&&!history.length)throw Error('No hay una corrección pendiente para deshacer.');
    const protection=add?addReviewSelection(latestReview.protection,payload.start,payload.end):history.at(-1);
    latestReview={...latestReview,protection,id:randomUUID(),history:add?[...history,latestReview.protection]:history.slice(0,-1),
     retry:{id:payload.reviewId,action,start:payload.start,end:payload.end}};
    return result();
   }
   case 'intake.readWorksheet':
   case 'intake.saveWorksheetRow': {
    const save=action==='intake.saveWorksheetRow';
    const copy=save&&payload&&Object.hasOwn(payload,'copyId');
    exactFields(payload,save?['task','id','values','revision',...(copy?['copyId']:[])]:['task']);
    if(copy&&(typeof payload.copyId!=='string'||!/^[-a-f0-9]{36}$/.test(payload.copyId)))throw Error('Identificador de renglón inválido.');
    const {task}=payload;
    return store.transaction(()=>{
     const saved=current();
     if(!store.protectedRecords||!hasTradeWorksheet(task)||!readingChoices(saved).some(choice=>choice.id===task))
      throw Error('Selecciona un expediente cifrado que contenga el tema de revisión.');
     const stored=saved.intake.worksheets?.[task]??{};
     const sheet=tradeWorksheet(task,stored);
     const proposals={};
     for(const source of openedCaseSources(saved)){
      for(const [id,rows] of Object.entries(worksheetProposals(task,source.original))){
       (proposals[id]??=[]).push(...rows.map(row=>({...row,...source.attribution,
        reference:source.attribution.sourceId?(source.label+' · '+row.reference).slice(0,140).replace(/[\uD800-\uDBFF]$/u,''):row.reference})));
      }
     }
     if(!save)return {...sheet,proposals};
     const base=sheet.rows.find(row=>row.id===payload.id)?.base;
     if(!base)throw Error('Concepto de control inválido.');
     const target=copy?base+'~'+payload.copyId:payload.id;
     if(copy&&Object.hasOwn(stored,target)){
      const previous=stored[target],retry=revisedWorksheetRow(sheet,target,payload.values,previous.revision);
      if(Object.keys(payload.values).some(key=>previous[key]!==retry[key]))throw Error('El renglón duplicado ya se guardó con otros datos. Recarga el control.');
      return {...sheet,proposals};
     }
     if(copy&&sheet.rows.length>=80)throw Error('El control admite hasta 80 renglones.');
     const item=revisedWorksheetRow(sheet,payload.id,payload.values,payload.revision);
     const rows={...stored,[target]:copy?{...item,revision:1}:item};
     store.put('intake-pilot',{...saved.intake,worksheets:{...saved.intake.worksheets,[task]:rows}});
     store.audit('intake.local.worksheet',saved.entry.id);
     return {...tradeWorksheet(task,rows),proposals};
    });
   }
   case 'intake.exportWorksheet': {
    exactFields(payload,['task']);
    const {task}=payload,saved=current();
    if(!store.protectedRecords||!hasTradeWorksheet(task)||!readingChoices(saved).some(choice=>choice.id===task))
     throw Error('Abre un expediente con ese control documental.');
    const sheet=tradeWorksheet(task,saved.intake.worksheets?.[task]);
    let refs=saved.intake.researchHistory?.[task]?.references;
    if(!refs){try{refs=readingFor(task).refs;}catch{refs=[];}}
    const answer={question:sheet.title,text:'Hoja de trabajo local para el cotejo documental. Revisar los soportes y la edición aplicable.',citations:exportCitations(refs),createdAt:new Date().toISOString()};
    const file=await exportIntakeDocument('xlsx',task,{firm:saved.firm,matter:saved.entry,answer,worksheet:sheet});
    store.audit('intake.local.exportWorksheet',saved.entry.id);
    return {...file,name:'Rejon-control-'+task.slice(8)+'.xlsx'};
   }
   case 'intake.addSource': {
    exactFields(payload,['reviewId','label']);
    const answer=store.transaction(()=>{
     const saved=current(),prior=saved?.intake.lastSourceReceipt;
     if(prior&&prior.reviewId===payload.reviewId&&prior.label===payload.label)return {id:prior.id,duplicate:prior.duplicate,status:status()};
     if(!saved||!store.protectedRecords||!latestReview||latestReview.id!==payload.reviewId||latestReview.matterId!==saved.entry.id)
      throw Error('Vuelve a revisar el documento en este expediente.');
     const result=addCaseSource(store,saved,latestReview,payload.label);
     const {intake}=current();
     store.put('intake-pilot',{...intake,lastSourceReceipt:{...result,reviewId:payload.reviewId,label:payload.label}});
     return {...result,status:status()};
    });
    if(latestReview?.id===payload.reviewId)latestReview=null;
    return answer;
   }
   case 'intake.compareSources': {
    exactFields(payload,['ids']);
    return store.transaction(()=>{
     const saved=current(),ids=payload.ids;
     const all=caseSources(saved?.intake);
     if(!saved||!store.protectedRecords||!Array.isArray(ids)||![0,2].includes(ids.length)||new Set(ids).size!==ids.length||
        !ids.every(id=>all.some(row=>row.id===id)))throw Error('Selecciona dos documentos distintos del mismo expediente.');
     store.put('intake-pilot',{...saved.intake,comparisonPair:ids.length?all.filter(row=>ids.includes(row.id)).map(row=>row.id):null});
     return status();
    });
   }
   case 'intake.exportSourceComparison': {
    exactFields(payload,[]);
    const saved=current();
    if(!saved?.intake.comparisonPair||!store.protectedRecords)throw Error('Selecciona dos documentos del expediente.');
    const notes=comparisonNotes(saved).filter(note=>note.suggested);
    if(!notes.length)throw Error('Los documentos seleccionados no tienen un tema de cotejo en común.');
    const support=notes.flatMap(note=>[note.evidence,...note.evidence.additional].map(row=>({...row,topic:note.packet.title})));
    const answer={question:'Cotejo de dos documentos de la operación',text:notes.map(note=>note.packet.title+' · '+
     (note.conflicting?'Afirmaciones incompatibles. Revisar los dos soportes.':note.suggestedLabel)).join('\n'),
     citations:[],createdAt:new Date().toISOString()};
    const file=await exportIntakeDocument('xlsx','cotejo-documental',{firm:saved.firm,matter:saved.entry,answer,support});
    store.audit('intake.local.exportComparison',saved.entry.id);return file;
   }
   case 'intake.downloadSource':
    exactFields(payload,['id']);
    if(!store.protectedRecords||!current())throw Error('Abre un expediente cifrado.');
    return readCaseFile(store,current(),payload.id);
   case 'intake.readDocument': {
    const selected=Object.hasOwn(payload??{},'id');
    exactFields(payload,selected?['id']:[]);
    const saved=current();
    const doc=selected?caseSources(saved?.intake).find(row=>row.id===payload.id)?.document:saved?.intake.document;
    return openReviewedDocument(doc,saved?.firm.id,saved?.entry.id);
   }
   case 'intake.status':
    exactFields(payload,[]);
    return status();
   case 'intake.inspectQuestion': {
    exactFields(payload,['text']);
    const saved=current(),text=payload.text;
    if(!saved||!store.protectedRecords)throw Error('Abre un expediente cifrado.');
    if(typeof text!=='string'||text.trim().length<10||text.length>800||/[\p{Cc}\[\]]/u.test(text.replace(/\r\n|\n|\t/gu,'')))
     throw Error('Escribe una pregunta de 10 a 800 caracteres sin marcadores.');
    const knownIdentities=knownParties(saved);
    const data=await inspectLocalDocument({extension:'txt',base64:Buffer.from(text).toString('base64'),review:true},{signal,knownIdentities});
    if(!data.protection?.available||data.protection.contextUnavailable)throw Error('No se completó la revisión local de la pregunta.');
    if(current()?.intake.id!==saved.intake.id)throw Error('Cambió el expediente.');
    const review=data.protection,document=bindReviewedDocument(review,saved.firm.id,saved.entry.id);
    const restored=openReviewedDocument(document,saved.firm.id,saved.entry.id);
    if(restored.original!==text.replace(/\r\n/gu,'\n').trim())throw Error('La pregunta no se pudo restituir.');
    const candidates=questionCandidates(publicLibrary,restored.original,review.parts,explicitArticleReference?.(restored.original,'MX-FED'));
    const permit=permitQuestionHint(restored.original,[saved.firm.name,saved.entry.client,saved.entry.title,saved.intake.supplier]);
    if(permit)permit.supports=documentPermitFields(openedCaseSources(saved));
    if(!candidates.length&&!permit)throw Error('No se encontró un pasaje. Añade el concepto jurídico o consulta la biblioteca federal.');
    const id=randomUUID();
    if(pendingQuestions.size>=8)pendingQuestions.delete(pendingQuestions.keys().next().value);
    const facts=availableQuestionFacts(saved).map(({id,text,evidence})=>({id,text,label:evidence.sourceLabel,line:evidence.line}));
    const defenseDate=candidates.some(row=>row.source.startsWith('ad29-'))?operationDate(restored.original.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()):'';
    pendingQuestions.set(id,{matter:saved.entry.id,document,candidates,permit,defenseDate,factIds:facts.map(f=>f.id),concepts:mentionedConcepts(restored.original).map(c=>c.id)});
    const suggestedAngle=/excepci[oó]n|excepciones|salvo|exent[oa]/iu.test(text)?'excepciones':
      /document|prueba|soporte|comprob|acredit/iu.test(text)?'documentos':'requisitos';

    return {id,masked:restored.masked,count:review.count,suggestedAngle,facts,permit,sources:caseSources(saved.intake).map(sourceSummary),
     candidates:candidates.map(({key,label,locator,text,partial})=>({key,label,locator,text,partial}))};
   }
   case 'intake.questionLines': {
    exactFields(payload,['reviewId','sourceId']);
    const saved=current(),review=pendingQuestions.get(payload.reviewId);
    if(!saved||!store.protectedRecords||!review||review.matter!==saved.entry.id)throw Error('Vuelve a revisar la pregunta en el expediente.');
    const rows=questionLines(saved,payload.sourceId);
    review.factIds=[...new Set([...review.factIds,...rows.map(row=>row.id)])];
    return rows.map(({id,masked,cloud,evidence})=>({id,text:masked,cloud,label:evidence.sourceLabel,line:evidence.line}));
   }
   case 'intake.addQuestion': {
    const usesFacts=Object.hasOwn(payload??{},'factIds');
    exactFields(payload,usesFacts?['reviewId','key','angle','factIds']:['reviewId','key','angle']);
    const {reviewId,key,angle}=payload,saved=current(),review=pendingQuestions.get(reviewId);
    if(!saved||!store.protectedRecords||!review||review.matter!==saved.entry.id||typeof angle!=='string'||!Object.hasOwn(angles,angle))
     throw Error('Vuelve a revisar la pregunta en este expediente.');
    const choice=review.candidates.find(row=>row.key===key);
    if(!choice)throw Error('Selecciona uno de los pasajes revisados.');
    const {intake}=saved,selection={sourceId:choice.source,part:choice.part,angle,concepts:review.concepts,...(choice.source.startsWith('ad29-')&&review.defenseDate?{remedyReview:'Fecha consultada · '+review.defenseDate+'\n'+remedyPeriod(review.defenseDate).message}:{}),...(usesFacts?{factIds:payload.factIds}:{})};
    if(usesFacts&&(!Array.isArray(payload.factIds)||!payload.factIds.length||payload.factIds.length>4||new Set(payload.factIds).size!==payload.factIds.length||
       !payload.factIds.every(id=>review.factIds.includes(id))))throw Error('Elige los hechos que aparecen en la revisión de esta pregunta.');
    const task='research-'+reviewId+'-'+angle+'-'+choice.source+'-'+choice.part+(usesFacts?'-'+createHash('sha256').update(JSON.stringify(payload.factIds.slice().sort())).digest('hex').slice(0,20):'');
    if(!Object.hasOwn(intake.research??{},task)){
     if(Object.keys(intake.research??{}).length>=48)throw Error('El expediente admite 48 pasajes de trabajo.');
     sourceFor(selection,saved);
     store.put('intake-pilot',{...intake,research:{...intake.research,[task]:selection},
      questions:{...intake.questions,[task]:review.document}});
    }
    return {task,status:status()};
   }
   case 'intake.readPassage':
   case 'intake.addPassage': {
    exactFields(payload,['sourceId','part']);
    if (typeof payload.sourceId!=='string') throw Error('Fuente inválida.');
    const saved=current();
    if (!saved) throw Error('Abre primero un expediente.');
    const note=sourceFor(payload);
    if (action==='intake.readPassage') return {text:note.ref.text,part:note.part,count:note.count};
    const {intake}=saved;
    if (!Object.hasOwn(intake.research??{},note.task)) {
     if (Object.keys(intake.research??{}).length>=48) throw Error('El expediente admite 48 pasajes de trabajo.');
     store.put('intake-pilot',{...intake,research:{...intake.research,[note.task]:{sourceId:payload.sourceId,part:payload.part}}});
    }
    return {task:note.task,status:status()};
   }
   case 'intake.save': {
    const hasKind = payload && Object.hasOwn(payload,'documentKind');
    const fields = ['firm','client','title','jurisdiction'];
    const hasScenario = payload && Object.hasOwn(payload,'scenarioId');
    const hasSupplier = payload && Object.hasOwn(payload,'supplier');
    const keepDocument=payload&&Object.hasOwn(payload,'reviewId');
    if (keepDocument) fields.push('reviewId');
    if (hasKind) fields.push('documentKind');
    if (hasScenario) fields.push('scenarioId');
    if (hasSupplier) fields.push('supplier');
    exactFields(payload,fields);
    if(keepDocument&&(!store.protectedRecords||!latestReview||latestReview.id!==payload.reviewId))throw Error('Vuelve a leer el documento que quieres guardar.');
    if (hasScenario && (!getPilotTradeScenario(payload.scenarioId) || payload.documentKind !== 'factura')) throw new Error('Ejemplo documental inválido.');
    if (hasSupplier && (!hasScenario || typeof payload.supplier !== 'string' || !payload.supplier.trim() ||
        payload.supplier.length>200 || /[\p{C}\[\]]/u.test(payload.supplier))) throw new Error('Proveedor inválido para este ejemplo.');
    if (hasKind && !documentKinds.includes(payload.documentKind)) throw new Error('Clase documental inválida.');
    const savedStatus=store.transaction(()=>{
     if (workspace()) throw new Error('Este espacio ya tiene un alta. Vuelve a cargar la página para continuar.');
     const fields=[payload.firm,payload.client,payload.title];
     if (fields.some(value=>typeof value!=='string' || /[\p{Cc}\[\]]/u.test(value))) {
      throw new Error('Usa texto simple para el despacho, el cliente y el asunto.');
     }
     const firm=createWorkspace({name:payload.firm,practiceAreas:['Mercantil']});
     const entry=createMatter({client:payload.client,title:payload.title,jurisdiction:payload.jurisdiction});
     const id=`intake-${firm.id}`;
     const document=keepDocument?bindReviewedDocument(latestReview.protection,firm.id,entry.id):null;
     store.put('intake-pilot',{id,...(document?{document,practiceSeed:latestReview.practiceSeed??null}:{}),workspaceId:firm.id,matterId:entry.id,documentKind:payload.documentKind??null,scenarioId:latestReview?.history.length?null:payload.scenarioId??null,supplier:hasSupplier&&!latestReview?.history.length?payload.supplier.trim():null,drafts:{}});
     store.audit('intake.local.save',entry.id);
     return status();
    });
    latestReview=null;
    return savedStatus;
   }
   case 'intake.remedyPeriod':
    exactFields(payload,['date']);return remedyPeriod(payload.date);
   case 'intake.remedyCatalog':
    exactFields(payload,[]);return remedyCatalog();
   case 'intake.saveRemedy': {
    const dated=Object.hasOwn(payload??{},'date');
    exactFields(payload,dated?['sourceId','point','date']:['sourceId','point']);
    const period=dated?remedyPeriod(payload.date):null;
    const {sourceId,point}=payload,note=remedyResearch(sourceId,point),{ref}=note;
    const id=sourceId+'-'+point+(dated?'-'+payload.date:'');
    return store.transaction(()=>{
     const saved=current();
     if(!saved||!store.protectedRecords)throw Error('Abre un expediente cifrado para guardar la fuente.');
     const {intake}=saved;
     if(!Object.hasOwn(intake.drafts,id)){
      const text=draftText(['Defensa comercial para [[CLIENTE]] · [[ASUNTO]]',ref.title,ref.locator+' ['+ref.id+']\n'+ref.text,ref.summary,...(dated?['Cotejo local de la operación\n[[COTEJO]]']:[])].join('\n\n'),null,null,null,dated);
      store.put('intake-pilot',{...intake,remedies:{...intake.remedies,[id]:{sourceId,point,...(dated?{date:payload.date}:{})}},drafts:{...intake.drafts,[id]:text},
       researchHistory:{...intake.researchHistory,[id]:{title:ref.title+(dated?' · '+payload.date:''),localOnly:true,references:[ref],...(dated?{localReview:'Fecha consultada · '+payload.date+'\n'+period.message}:{})}},
       followupBasis:{...intake.followupBasis,[id]:quotedRanges(note,text)}});
      store.audit('intake.local.remedy',saved.entry.id);
     }
     return {task:id,status:status()};
    });
   }
   case 'intake.searchPermits':
    exactFields(payload,['query','date']);
    return searchPermits(payload.query,payload.date);
   case 'intake.inspectPermit':
   case 'intake.savePermit': {
    const fromQuestion=action==='intake.savePermit'&&Object.hasOwn(payload??{},'reviewId');
    exactFields(payload,['code','agency','date','classification','regime',...(Object.hasOwn(payload??{},'scope')?['scope']:[]),...(fromQuestion?['reviewId',...(Object.hasOwn(payload,'picks')?['picks']:[])]:[])]);
    const note=permitNote(payload);
    if(action==='intake.inspectPermit')return {stage:note.stage,detail:note.detail,references:note.references};
    return store.transaction(()=>{
     const saved=current();
     if(!saved||!store.protectedRecords)throw Error('Abre un expediente cifrado para guardar la ficha.');
     const review=fromQuestion?pendingQuestions.get(payload.reviewId):null;
     if(fromQuestion&&(!review?.permit||review.matter!==saved.entry.id))throw Error('Vuelve a revisar la pregunta en este expediente.');
     const citations=review?permitFieldCitations(review.permit.supports,payload.picks??[],note.selection):[];
     const evidenceId=citations.length?'-'+createHash('sha256').update(JSON.stringify(citations)).digest('hex').slice(0,20):'';
     const {intake}=saved,id=review?note.id+'-'+payload.reviewId+evidenceId:note.id;
     if(!Object.hasOwn(intake.drafts,id)){
      const text=draftText((review?'Pregunta del expediente\n[[CONSULTA]]\n\n':'')+note.text,null,null,review?.document,note.selection);
      const ranges=quotedRanges(note,text);
      store.put('intake-pilot',{...intake,...(review?{questions:{...intake.questions,[id]:review.document}}:{}),permits:{...intake.permits,[id]:note.selection},drafts:{...intake.drafts,[id]:text},
       researchHistory:{...intake.researchHistory,[id]:{title:note.title,localOnly:true,references:note.references,...(review?{permitSourceId:note.id}:{}),localReview:['Fecha de la operación · '+payload.date,note.stage,note.detail,...citations].filter(Boolean).join('\n')}},
       followupBasis:{...intake.followupBasis,[id]:ranges}});
      store.audit('intake.local.permit',saved.entry.id);
     }
     return {task:id,status:status()};
    });
   }
   case 'intake.searchNico':
    exactFields(payload,['query','offset']);
    return searchNico(payload.query,payload.offset);
   case 'intake.addNico': {
    exactFields(payload,['code','nico']);
    const saved=current();
    if(!saved||!store.protectedRecords)throw Error('Abre un ejercicio cifrado para guardar la referencia.');
    const {intake}=saved,row=nicoRow(payload.code,payload.nico),ref=nicoReference(row);
    const id='nico-'+row.code+'-'+row.nico+'-'+row.edition.slice(0,12);
    if(Object.hasOwn(intake.drafts,id))return {task:id,status:status()};
    const text=draftText(['Ficha NICO para [[CLIENTE]] · [[ASUNTO]]',ref.locator,
     'Descripción ['+ref.id+']\n'+ref.text,ref.summary].join('\n\n'),null);
    const ranges=row.literal?quotedRanges(nicoResearch(row.code,row.nico),text):[];
    store.transaction(()=>{
     store.put('intake-pilot',{...intake,nicos:{...intake.nicos,[id]:row},drafts:{...intake.drafts,[id]:text},
      researchHistory:{...intake.researchHistory,[id]:{title:ref.title,localOnly:true,references:[ref]}},
      ...(ranges.length?{followupBasis:{...intake.followupBasis,[id]:ranges}}:{})});
     store.audit('intake.local.nico',saved.entry.id);
    });
    return {task:id,status:status()};
   }
   case 'intake.searchTariff':
    exactFields(payload,['query','offset']);
    return searchTariff(payload.query,payload.offset);
   case 'intake.tariffSuggestions':
    exactFields(payload,[]);
    return [...new Set(tariffEvidence(current()).map(({code})=>code))];
   case 'intake.addTariff': {
    exactFields(payload,['code','page']);
    const saved=current();
    if(!saved||!store.protectedRecords)throw Error('Abre un ejercicio cifrado para guardar la referencia.');
    const hit=tariffResult(payload.code,payload.page),{intake}=saved;
    const {code,page,row}=hit,ref=tariffReference(code,page);
    const id='tarifa-'+code+'-'+page+'-'+ref.pdfSha256.slice(0,12);
    if(Object.hasOwn(intake.drafts,id))return {task:id,status:status()};
    const matches=tariffEvidence(saved).filter(item=>item.code===code).map(({code,...row})=>row);
    const evidence=matches.length?{...matches[0],additional:matches.slice(1)}:null;
    const copy=row?'Descripción impresa ['+ref.id+']\n'+row.description+
     '\nUnidad · '+row.unit+'\nImportación, columna impresa · '+row.import+'\nExportación, columna impresa · '+row.export:
     'Mención del código en la página seleccionada. Cotejar el texto y la función de esta referencia en el original.';
    const adjacent=(row?.adjacent??[]).filter(p=>!row.continued?.includes(p));
    const edge=adjacent.length?'Cotejar el límite del renglón con la página '+adjacent.join(' y ')+'.':'';
    const text=draftText(['Ficha arancelaria para [[CLIENTE]] · [[ASUNTO]]',ref.locator,copy,...(edge?[edge]:[]),
     ...(evidence?['Soporte del expediente\n[[SOPORTE]]']:[]),ref.summary].join('\n\n'),null,evidence);
    const ranges=hit.canFollow?quotedRanges(tariffResearch(code,page),text):[];
    const note={title:ref.title+' · p. '+page,localOnly:true,references:[ref],...(evidence?{evidence}:{})};
    store.transaction(()=>{
     store.put('intake-pilot',{...intake,tariffs:{...intake.tariffs,[id]:{code,page,pdfSha256:ref.pdfSha256,row,locator:ref.locator,url:ref.url}},
      researchHistory:{...intake.researchHistory,[id]:note},drafts:{...intake.drafts,[id]:text},
      ...(ranges.length?{followupBasis:{...intake.followupBasis,[id]:ranges}}:{})});
     store.audit('intake.local.tariff',saved.entry.id);
    });
    return {task:id,status:status()};
   }
   case 'intake.exportTariffBook': {
    exactFields(payload,[]);
    const saved=current(),tariffs=Object.values(saved?.intake.tariffs??{});
    const nicos=Object.values(saved?.intake.nicos??{});
    if(!saved||(!tariffs.length&&!nicos.length))throw Error('Guarda primero una ficha de la tarifa.');
    const {firm,entry}=saved;
    const answer={question:'Comparativo de fracciones arancelarias',text:'Fichas documentales del expediente. Cotejar las columnas impresas, las notas y la edición aplicable a la operación.',
     citations:[],createdAt:new Date().toISOString()};
    const file=await exportIntakeDocument('xlsx','comparativo-arancelario',{firm,matter:entry,answer,tariffs,nicos});
    store.audit('intake.local.exportTariffs',entry.id);
    return file;
   }
   case 'intake.addFollowup': {
    const scoped=Object.hasOwn(payload??{},'instruction');
    exactFields(payload,scoped?['task','form','instruction']:['task','form']);
    const {task,form}=payload,saved=current();
    if(typeof task!=='string'||!isFollowupForm(form)||!saved||!store.protectedRecords||
       !firstBasis(saved,task).length)throw Error('Elige una nota con un fundamento cotejado.');
    const {intake}=saved;
    const focus=scoped?focusFromInstruction(payload.instruction):[];
    const prior=intake.followups?.[task],basisTask=prior?.basisTask??prior?.parent??task;
    const identity=[form,...focus,task].join('-');
    const id='revision-'+(prior?form+'-'+createHash('sha256').update(identity).digest('hex').slice(0,32):identity);
    if(!Object.hasOwn(intake.followups??{},id)){
     if(Object.keys(intake.followups??{}).length>=96)throw Error('Este expediente ya contiene 96 documentos de seguimiento.');
     const selection={parent:task,form,focus,ranges:firstBasis(saved,task),parentTitle:intake.researchHistory[basisTask].title,...(prior?{basisTask}:{})};
     followupFor(saved,selection);
     store.put('intake-pilot',{...intake,followups:{...intake.followups,[id]:selection}});
    }
    return {task:id,status:status()};
   }
   case 'intake.draft': {
    exactFields(payload,['task']);
    const {task}=payload;
    const saved=current();
    const selection=typeof task==='string'&&task.startsWith('lectura-')?readingChoices(saved).find(item=>item.id===task):null;
    const comparison=typeof task==='string'&&task.startsWith('contraste-')?comparisonNotes(saved).find(note=>note.id===task):null;
    const continuation=typeof task==='string'&&Object.hasOwn(saved?.intake.followups??{},task)?saved.intake.followups[task]:null;
    const known=typeof task==='string' && (Object.hasOwn(saved?.intake.drafts??{},task)||continuation||comparison||selection||Object.hasOwn(tasks,task)||Object.hasOwn(saved?.intake.research??{},task)||(task==='case-note'&&saved?.intake.practiceSeed));
    if (!known) throw new Error('Selecciona una tarea del piloto.');
    if (!saved) throw new Error('Completa primero el alta del cliente.');
    if (Object.hasOwn(saved.intake.drafts,task)) return status();
    if (pending) throw new Error('Hay un borrador en preparación.');
    pending=true;
    try {
     if (task==='trade' && !articles) throw new Error('La edición de los artículos necesita una revisión.');
     const research=noteFor(saved,task);
     const practice=task==='case-note'?practiceFor(saved):null;
     const reading=selection?readingFor(task):null;
     let matrix=comparison?saved.intake.comparisonReplies?.[comparison.subject]:null;
     const reuse=comparison&&matrix?.digest===comparison.packet.digest;
     const followup=continuation?followupFor(saved,continuation):null;
     const followEvidence=continuation?.form==='control'?saved.intake.researchHistory?.[continuation.basisTask??continuation.parent]?.evidence:null;
     const raw=reuse?null:await generate(task,{followup,comparison:comparison?.packet,reading,practice,research,signal,documentKind:saved.intake.documentKind,articles,scenarioId:saved.intake.scenarioId});
     if(comparison&&!reuse)matrix=readComparisonReply(raw,comparison.packet);
     let text=raw;
     if(followup)text=renderFollowup(raw,followup,{evidence:Boolean(followEvidence)});
     else if(comparison)text=renderComparison(comparison,matrix);
     else if(reading)text=renderTradeReading(raw,reading);
     else if(practice)text=renderProtectedCase(raw,practice);
     else if(research)text=renderResearchNote(raw,research);
     else if(task==='trade')text=renderTradeDraft(raw,articles);
     const permit=localOperationControl(saved.intake,task);
     const question=localQuestion(saved.intake,task);
     if(continuation?.form==='control'&&question)text+='\n\nPregunta del expediente\n[[CONSULTA]]';
     if(permit)text+='\n\nCotejo local de la operación\n[[COTEJO]]';
     const answer=draftText(text,research?.caseFacts?.aliases.length?caseSources(saved.intake).map(s=>s.document):(practice||followup?.synthetic)?saved.intake.document:null,selection||comparison||followEvidence||research?.caseFacts,question,permit);
     const parentSource=continuation?followupSource(saved,continuation.basisTask??continuation.parent):comparison?.packet||reading||practice||research;
     const ranges=store.protectedRecords&&parentSource?quotedRanges(parentSource,answer):[];
     signal?.throwIfAborted();
     store.transaction(()=>{
      const {intake}=current();
      if (intake.id!==saved.intake.id) throw new Error('Cambió el asunto del piloto.');
      const source=followup??comparison?.packet??reading??practice??research;
      let snapshot={};
      if(source){
       const title=followup?followup.title+' · '+continuation.parentTitle:comparison?.title??source.title;
       const references=source.refs??[source.ref];
       const evidence=followEvidence??comparison?.evidence??selection?.evidence??research?.caseFacts?.evidence;
       const note={title,preview:source.prompt,references,...(research?.caseFacts?{usesFacts:!!research.caseFacts.texts.length,localLines:research.caseFacts.localCount}:{}),...(evidence?{evidence}:{}),
        ...(comparison?{comparison:comparisonInfo(comparison)}:{})};
       snapshot={researchHistory:{...intake.researchHistory,[task]:note}};
      }
      store.put('intake-pilot',{...intake,...snapshot,...(ranges.length?{followupBasis:{...intake.followupBasis,[task]:ranges}}:{}),...(comparison&&!reuse?{comparisonReplies:{...intake.comparisonReplies,[comparison.subject]:matrix}}:{}),drafts:{...intake.drafts,[task]:answer}});
      store.audit(reuse?'intake.local.comparison':'intake.cloud.draft',intake.matterId);
     });
     return status();
    } finally { pending=false; }
   }
   case 'intake.edit': {
    exactFields(payload,['task','text']);
    const {task,text}=payload;
    if (typeof task!=='string') throw new Error('Tarea inválida.');
    return store.transaction(()=>{
     const saved=current();
     if (!saved || !Object.hasOwn(saved.intake.drafts,task)) throw new Error('Genera primero el borrador.');
     const {intake,entry}=saved;
     const basis=firstBasis(saved,task);
     const drafts={...intake.drafts,[task]:draftText(text,caseSources(intake).map(s=>s.document),intake.researchHistory?.[task]?.evidence,localQuestion(intake,task),localOperationControl(intake,task))};
     const editedTasks=Array.from(new Set([...(intake.editedTasks??[]),task]));
     store.put('intake-pilot',{...intake,drafts,editedTasks,...(basis.length?{followupBasis:{...intake.followupBasis,[task]:basis}}:{})});
     store.audit('intake.local.edit',entry.id);
     return status();
    });
   }
   case 'intake.preview':
   case 'intake.export': {
    const hasFormat=action==='intake.export' && payload && Object.hasOwn(payload,'format');
    exactFields(payload,hasFormat?['task','format']:['task']);
    const {task}=payload;
    const saved=current();
    if (typeof task!=='string' || !saved || !Object.hasOwn(saved.intake.drafts,task)) {
     throw new Error('Genera primero un borrador para exportar.');
    }
    const {firm,entry,intake}=saved;
    const values={CLIENTE:entry.client,ASUNTO:entry.title};
    const evidence=intake.researchHistory?.[task]?.evidence;
    const question=localQuestion(intake,task);
    const permit=localOperationControl(intake,task);
    const text=draftText(intake.drafts[task],caseSources(intake).map(s=>s.document),evidence,question,permit);
    const originals=new Map([['[[CLIENTE]]',values.CLIENTE],['[[ASUNTO]]',values.ASUNTO]]);
    if(permit&&text.includes('[[COTEJO]]')){
     const origin=intake.followups?.[task];
     const basis=origin?.basisTask??origin?.parent??task;
     const archived=intake.researchHistory?.[basis]?.localReview??intake.research?.[basis]?.remedyReview;
     if(typeof archived!=='string')throw Error('Falta el cotejo guardado de la operación.');
     originals.set('[[COTEJO]]',archived);
    }
    if(question&&text.includes('[[CONSULTA]]'))originals.set('[[CONSULTA]]',openReviewedDocument(question,firm.id,entry.id).original);
    if(evidence)originals.set('[[SOPORTE]]',[evidence,...(evidence.additional??[])].map(row=>(row.sourceLabel?row.sourceLabel+' · ':'')+'Línea '+row.line+' del texto extraído · '+row.excerpt).join('\n'));
    if(text.includes('[[DATO_')){
     for(const {document} of caseSources(intake))for(const item of openReviewedDocument(document,firm.id,entry.id).tokens)originals.set(item.token,item.value);
    }
    const draft=text.replace(/\[\[[^\[\]]+\]\]/g,token=>originals.get(token));
    const hasSupplier=task==='trade' && intake.scenarioId==='factura-origen-v1' && intake.supplier;
    const restored=hasSupplier?draft+'\n\nProveedor registrado: '+intake.supplier:draft;
    const origin=intake.followups?.[task];
    const controlTask=origin?.form==='control'?(origin.basisTask??origin.parent):task;
    const sheet=hasTradeWorksheet(controlTask)?tradeWorksheet(controlTask,intake.worksheets?.[controlTask]):null;
    const appendix=sheet?worksheetSummary(sheet):'';
    const withWorksheet=appendix?restored+'\n\n'+appendix:restored;
    if (action==='intake.preview') return {text:withWorksheet};
    const storedNote=intake.researchHistory?.[task];
    const references=storedNote?.references??(task==='trade'?tradeReferences:[]);
    const citations=exportCitations(references);
    const answer={question:storedNote?.title??tasks[task].title,text:payload.format==='xlsx'||payload.format==='pptx'?restored:withWorksheet,citations,createdAt:new Date().toISOString()};
    const file=await exportIntakeDocument(hasFormat?payload.format:'docx',task,{firm,matter:entry,answer,worksheet:sheet,support:text.includes('[[SOPORTE]]')&&evidence?.sourceId?[evidence,...evidence.additional??[]]:[],nicos:intake.nicos?.[task]?[intake.nicos[task]]:[],tariffs:intake.tariffs?.[task]?[intake.tariffs[task]]:[]});
    store.audit('intake.local.export',entry.id);
    return file;
   }
   default: throw new Error('Acción del piloto inválida.');
  }
 };
}

import {comparisonsFor,comparisonEnvelope,readComparisonReply,renderComparison} from './corpus/intake-comparison.mjs';
import {hasTradeWorksheet,tradeWorksheet,revisedWorksheetRow,worksheetSummary,worksheetProposals} from './intake-trade-worksheet.mjs';
import {suggestTradeReadings,loadTradeReading,tradeReadingEnvelope,renderTradeReading} from './corpus/intake-trade-reading.mjs';
import {newPracticeSeed,practiceDocument,prepareProtectedCase,protectedCaseEnvelope,renderProtectedCase} from './corpus/pilot-protected-case.mjs';
import {randomUUID} from 'node:crypto';
import {addReviewSelection} from './privacy/intake-document-review.mjs';
import {inspectLocalDocument} from './intake-import.mjs';
import {bindReviewedDocument,documentTokens,openReviewedDocument} from './privacy/intake-document-map.mjs';
import {loadResearchPassage, researchEnvelope, renderResearchNote} from './corpus/intake-research.mjs';
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

function draftText(value,doc,evidence) {
 const allowed=new Set(['[[CLIENTE]]','[[ASUNTO]]',...documentTokens(doc).map(item=>item.token)]);
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
 const generate=async (task,{signal,documentKind,articles,scenarioId,research,practice,reading,comparison}={}) => {
  const envelope=comparison?comparisonEnvelope(comparison):reading ? tradeReadingEnvelope(reading) : practice ? protectedCaseEnvelope(practice) : research ? researchEnvelope(research) : envelopeFor(task,documentKind,articles,scenarioId);
  const gate=gateFor(practice||research||reading||comparison ? canonicalJson(envelope) : null,research||reading||comparison?'public':'synthetic');
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

export function createIntakePilot({store,workspace,matter,createWorkspace,createMatter,generate,publicLibrary}) {
 let articles;
 try { articles=tradeArticles(publicLibrary); } catch { articles=null; }
 const tradeReferences=articles?[...articles,...supportingReferences]:[];
 let pending=false;
 let latestReview=null;
 let inspectionRevision=0;
 const current = () => {
  const firm=workspace();
  const intake=firm && store.get('intake-pilot',`intake-${firm.id}`);
  if (!intake) return null;
  const entry=matter(intake.matterId);
  if (entry.workspaceId!==intake.workspaceId) throw new Error('El asunto no corresponde al piloto.');
  return {firm,entry,intake};
 };
 const sourceFor = selection => loadResearchPassage(publicLibrary,selection.sourceId,selection.part);
 const noteFor = (intake,task) => {
  const selection=intake?.research?.[task];
  return selection && Object.hasOwn(intake.research,task) ? sourceFor(selection) : null;
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
  const original=openReviewedDocument(saved.intake.document,saved.firm.id,saved.entry.id).original;
  const choices=new Map(suggestTradeReadings(original).map(item=>[item.id,item]));
  for(const [id,record] of Object.entries(saved.intake.researchHistory??{})){
   if(id.startsWith('lectura-')&&record.evidence)choices.set(id,{id,title:record.title,...record.evidence});
  }
  return [...choices.values()];
 };
 const readingTasks=saved=>readingChoices(saved).map(({id,title,line,excerpt})=>{
  const evidence={line,excerpt};
  const archived=saved.intake.researchHistory?.[id];
  if(archived)return {id,...archived};
  try{
   const reading=readingFor(id);
   return {id,title,preview:reading.prompt,references:reading.refs,evidence};
  }catch{return {id,title,preview:null,references:[],evidence};}
 });
 const comparisonNotes=saved=>{
  if(!saved?.intake.document||!store.protectedRecords)return [];
  const doc=openReviewedDocument(saved.intake.document,saved.firm.id,saved.entry.id);
  return comparisonsFor(doc.original);
 };
 const comparisonInfo=note=>({subject:note.subject,title:note.packet.title,label:note.variant.label,
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
   if(id.startsWith('contraste-')&&archived.comparison&&!notes.has(id))notes.set(id,{id,...archived,comparison:{...archived.comparison,cached:false}});
  }
  return [...notes.values()];
 };
 const status = () => {
  const saved=current();
  return {
   saved:Boolean(saved),
   ...(generate.usageStatus?{cloudUsage:generate.usageStatus()}:{}),
   protectedRecords:store.protectedRecords===true,
   hasDocument:Boolean(saved?.intake.document),
   drafts:saved?.intake.drafts??{},
   editedTasks:saved?.intake.editedTasks??[],
   tasks:[practiceTask(saved)].filter(Boolean).concat(readingTasks(saved),Object.entries(tasks).filter(([id])=>id!=='trade'||articles).map(([id,{title}])=>({id,title,preview:envelopeFor(id,saved?.intake.documentKind,articles,saved?.intake.scenarioId).messages[0].content,references:id==='trade'?tradeReferences:[]}))).concat(comparisonTasks(saved)).concat(Object.entries(saved?.intake.research??{}).map(([id,selection])=>{
    const archived=saved.intake.researchHistory?.[id];
    if (archived) return {id,...archived};
    try {
     const note=sourceFor(selection);
     return {id,title:note.title,preview:note.prompt,references:[note.ref]};
    } catch {return {id,title:'Fuente pendiente de comprobación',preview:null,references:[]};}
   })),
  };
 };

 return async (action,payload,{signal}={}) => {
  switch (action) {
   case 'intake.createPractice':
   case 'intake.inspectLocal': {
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
    const data=await inspectLocalDocument(payload,{signal});
    if(revision===inspectionRevision&&!workspace()&&store.protectedRecords&&data.protection?.available){
     const id=randomUUID();
     latestReview={id,protection:data.protection,practiceSeed,history:[]};
     return {...data,reviewId:id};
    }
    return data;
   }
   case 'intake.protectSelection':
   case 'intake.undoSelection': {
    const add=action==='intake.protectSelection';
    exactFields(payload,add?['reviewId','start','end']:['reviewId']);
    if(!store.protectedRecords||workspace()||!latestReview)throw Error('Abre de nuevo el documento antes de corregirlo.');
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
     const original=openReviewedDocument(saved.intake.document,saved.firm.id,saved.entry.id).original;
     const proposals=worksheetProposals(task,original);
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
   case 'intake.readDocument': {
    exactFields(payload,[]);
    const saved=current();
    return openReviewedDocument(saved?.intake.document,saved?.firm.id,saved?.entry.id);
   }
   case 'intake.status':
    exactFields(payload,[]);
    return status();
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
   case 'intake.draft': {
    exactFields(payload,['task']);
    const {task}=payload;
    const saved=current();
    const selection=typeof task==='string'&&task.startsWith('lectura-')?readingChoices(saved).find(item=>item.id===task):null;
    const comparison=typeof task==='string'&&task.startsWith('contraste-')?comparisonNotes(saved).find(note=>note.id===task):null;
    const known=typeof task==='string' && (comparison||selection||Object.hasOwn(tasks,task)||Object.hasOwn(saved?.intake.research??{},task)||(task==='case-note'&&saved?.intake.practiceSeed));
    if (!known) throw new Error('Selecciona una tarea del piloto.');
    if (!saved) throw new Error('Completa primero el alta del cliente.');
    if (Object.hasOwn(saved.intake.drafts,task)) return status();
    if (pending) throw new Error('Hay un borrador en preparación.');
    pending=true;
    try {
     if (task==='trade' && !articles) throw new Error('La edición de los artículos necesita una revisión.');
     const research=noteFor(saved.intake,task);
     const practice=task==='case-note'?practiceFor(saved):null;
     const reading=selection?readingFor(task):null;
     let matrix=comparison?saved.intake.comparisonReplies?.[comparison.subject]:null;
     const reuse=comparison&&matrix?.digest===comparison.packet.digest;
     const raw=reuse?null:await generate(task,{comparison:comparison?.packet,reading,practice,research,signal,documentKind:saved.intake.documentKind,articles,scenarioId:saved.intake.scenarioId});
     if(comparison&&!reuse)matrix=readComparisonReply(raw,comparison.packet);
     const answer=draftText(comparison?renderComparison(comparison,matrix):reading?renderTradeReading(raw,reading):practice?renderProtectedCase(raw,practice):research?renderResearchNote(raw,research):task==='trade'?renderTradeDraft(raw,articles):raw,practice?saved.intake.document:null,selection||comparison);
     signal?.throwIfAborted();
     store.transaction(()=>{
      const {intake}=current();
      if (intake.id!==saved.intake.id) throw new Error('Cambió el asunto del piloto.');
      const source=comparison?.packet??reading??practice??research;
      const snapshot=source ? {researchHistory:{...intake.researchHistory,[task]:{title:comparison?.title??source.title,preview:source.prompt,references:comparison?source.refs:reading?reading.refs:[source.ref],...(comparison?{evidence:comparison.evidence,comparison:comparisonInfo(comparison)}:{}),...(selection?{evidence:{line:selection.line,excerpt:selection.excerpt}}:{})}}} : {};
      store.put('intake-pilot',{...intake,...snapshot,...(comparison&&!reuse?{comparisonReplies:{...intake.comparisonReplies,[comparison.subject]:matrix}}:{}),drafts:{...intake.drafts,[task]:answer}});
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
     const drafts={...intake.drafts,[task]:draftText(text,intake.document,intake.researchHistory?.[task]?.evidence)};
     const editedTasks=Array.from(new Set([...(intake.editedTasks??[]),task]));
     store.put('intake-pilot',{...intake,drafts,editedTasks});
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
    const text=draftText(intake.drafts[task],intake.document,evidence);
    const originals=new Map([['[[CLIENTE]]',values.CLIENTE],['[[ASUNTO]]',values.ASUNTO]]);
    if(evidence)originals.set('[[SOPORTE]]',[evidence,...(evidence.additional??[])].map(row=>'Línea '+row.line+' del texto extraído · '+row.excerpt).join('\n'));
    if(text.includes('[[DATO_')){
     for(const item of openReviewedDocument(intake.document,firm.id,entry.id).tokens)originals.set(item.token,item.value);
    }
    const draft=text.replace(/\[\[[^\[\]]+\]\]/g,token=>originals.get(token));
    const hasSupplier=task==='trade' && intake.scenarioId==='factura-origen-v1' && intake.supplier;
    const restored=hasSupplier?draft+'\n\nProveedor registrado: '+intake.supplier:draft;
    const sheet=hasTradeWorksheet(task)?tradeWorksheet(task,intake.worksheets?.[task]):null;
    const appendix=sheet?worksheetSummary(sheet):'';
    const withWorksheet=appendix?restored+'\n\n'+appendix:restored;
    if (action==='intake.preview') return {text:withWorksheet};
    const storedNote=intake.researchHistory?.[task];
    const references=storedNote?.references??(task==='trade'?tradeReferences:[]);
    const citations=exportCitations(references);
    const answer={question:storedNote?.title??tasks[task].title,text:payload.format==='xlsx'||payload.format==='pptx'?restored:withWorksheet,citations,createdAt:new Date().toISOString()};
    const file=await exportIntakeDocument(hasFormat?payload.format:'docx',task,{firm,matter:entry,answer,worksheet:sheet});
    store.audit('intake.local.export',entry.id);
    return file;
   }
   default: throw new Error('Acción del piloto inválida.');
  }
 };
}

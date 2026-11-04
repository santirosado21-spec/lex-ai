import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const OJN_ORIGIN='https://www.ordenjuridico.gob.mx/';
const stateFile=/^estatal-edo([1-9]|[12][0-9]|3[0-2])\.htm$/i;

const namedEntities={amp:'&',apos:"'",quot:'"',nbsp:' ',lt:'<',gt:'>',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',ntilde:'ñ',Ntilde:'Ñ',uuml:'ü',Uuml:'Ü',iexcl:'¡',iquest:'¿',ordm:'º',deg:'°',copy:'©',reg:'®',laquo:'«',raquo:'»',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’'};
const collapse=value=>String(value??'').replace(/\s+/gu,' ').trim();
const folded=value=>collapse(value).normalize('NFD').replace(/\p{M}/gu,'').toUpperCase();

export function decodeHtmlEntities(value){
  return String(value??'').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/giu,(whole,entity)=>{
    if(entity[0]==='#'){const number=entity[1].toLowerCase()==='x'?Number.parseInt(entity.slice(2),16):Number.parseInt(entity.slice(1),10);return Number.isSafeInteger(number)&&number>=0&&number<=0x10ffff?String.fromCodePoint(number):whole;}
    return namedEntities[entity]??namedEntities[entity.toLowerCase()]??whole;
  });
}

export function htmlText(value){return collapse(decodeHtmlEntities(String(value??'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu,' ').replace(/<!--[\s\S]*?-->/gu,' ').replace(/<[^>]*>/gu,' ')));}

export function decodeOjnHtml(bytes){
  const ascii=Buffer.from(bytes).toString('latin1');
  const declared=ascii.match(/<meta\b[^>]*charset\s*=\s*["']?\s*([a-z0-9_-]+)/iu)?.[1]?.toLowerCase();
  const isUtf8=declared?.includes('utf-8')||declared==='utf8'||Buffer.from(bytes).subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]));
  return {text:Buffer.from(bytes).toString(isUtf8?'utf8':'latin1'),encoding:isUtf8?'utf8':'latin1',declaredCharset:declared??null};
}

function attributes(tag){
  const result={};
  for(const match of String(tag).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu)){
    const key=match[1].toLowerCase();
    if(key==='form'||key==='input'||key==='select'||key==='option')continue;
    result[key]=decodeHtmlEntities(match[2]??match[3]??match[4]??'');
  }
  return result;
}
function controls(markup){
  const fields=[];
  for(const match of markup.matchAll(/<input\b[^>]*>/giu)){const attrs=attributes(match[0]);if(attrs.name)fields.push({name:attrs.name,value:attrs.value??'',kind:attrs.type??'text'});}
  for(const match of markup.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select\s*>/giu)){
    const attrs=attributes(match[0].slice(0,match[0].indexOf('>')+1));
    const options=[];
    for(const option of match[1].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option\s*>/giu)){const optionTag=option[0].slice(0,option[0].indexOf('>')+1);const optionAttrs=attributes(optionTag);options.push({value:optionAttrs.value??'',label:htmlText(option[1]),title:optionAttrs.title??null,selected:/\bselected\b/iu.test(optionTag)});}
    if(attrs.name)fields.push({name:attrs.name,value:options.find(option=>option.selected)?.value??'',kind:'select',options});
  }
  return fields;
}
function parseForms(html,baseUrl){
  const forms=[];
  for(const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/giu)){
    const attrs=attributes(`<form ${match[1]}>`);const action=attrs.action??'';
    forms.push({name:attrs.name??null,id:attrs.id??null,method:(attrs.method??'get').toUpperCase(),action,actionUrl:action?new URL(action,baseUrl).href:null,fields:controls(match[2])});
  }
  return forms;
}
function typeEntries(form,anomalies){
  const select=form?.fields.find(field=>field.kind==='select'&&field.name==='catTipo');
  if(!select){anomalies.push('No se encontró select[name="catTipo"] en el formulario de tipos.');return [];}
  const entries=[];const seen=new Map();
  for(const option of select.options){
    const countMatch=option.label.match(/^(.*?)\s*\((\d+)\)\s*$/u);if(!countMatch)continue;
    const label=collapse(option.title??countMatch[1]);const count=Number.parseInt(countMatch[2],10);const key=`${option.value}|${folded(label)}`;
    const entry={id:option.value,label,count};const prior=seen.get(key);
    if(prior){if(prior.count!==count)anomalies.push(`El tipo ${label} (id ${option.value}) aparece con conteos distintos: ${prior.count} y ${count}.`);else anomalies.push(`El tipo ${label} (id ${option.value}) aparece duplicado con conteo ${count}; se registró una sola vez.`);continue;}
    seen.set(key,entry);entries.push(entry);
  }
  return entries;
}
function explicitPageDate(text){
  const match=text.match(/(?:(?:última|ultima)\s+(?:actualización|actualizacion|modificación|modificacion)|fecha\s+de\s+(?:actualización|actualizacion|consulta))\s*[:\-]?\s*([0-3]?\d[\/-][01]?\d[\/-](?:19|20)\d{2}|(?:19|20)\d{2}[\/-][01]?\d[\/-][0-3]?\d)/iu);
  return match?.[1]??null;
}
function pageDateInfo(html){
  const labelled=explicitPageDate(htmlText(html));const candidates=[];
  if(labelled)candidates.push({date:labelled,evidence:'explicit update/consultation label in rendered page text',labelled:true});
  for(const match of html.matchAll(/<!--\s*Cambio\s+\d*\s*([0-3]?\d\/[01]?\d\/(?:19|20)\d{2})[\s\S]*?-->/giu))candidates.push({date:match[1],evidence:'HTML comment headed “Cambio”; context does not identify it as the page retrieval or update date',labelled:false});
  return {pageUpdateDate:labelled,pageDateCandidates:candidates};
}
function typeByLabel(entries,label){return entries.find(entry=>folded(entry.label)===folded(label))??null;}

export function parseOjnStatePage(html,{filename='estatal-edo?.htm',sourceUrl}={}){
  const anomalies=[];const expectedEdo=filename.match(stateFile)?.[1]??null;
  const forms=parseForms(html,sourceUrl);const typeForm=forms.find(form=>form.name==='form2'||form.id==='form2')??null;
  const searchForm=forms.find(form=>form.name==='busqueda')??null;
  const edoFromForm=typeForm?.fields.find(field=>field.name==='edo')?.value??searchForm?.fields.find(field=>field.name==='edo')?.value??null;
  const titleMatch=html.match(/<td\b[^>]*class=["'][^"']*td_titulo_federal[^"']*["'][^>]*>[\s\S]{0,500}?<b\b[^>]*>([\s\S]*?)<\/b\s*>/iu)??html.match(/<b\b[^>]*>\s*([^<]{2,100})\s*<\/b\s*>/iu);
  const stateName=titleMatch?htmlText(titleMatch[1]):null;
  if(!stateName)anomalies.push('No se pudo extraer el nombre de la entidad del encabezado.');
  if(!edoFromForm)anomalies.push('No se pudo extraer el parámetro edo de los formularios.');
  if(expectedEdo&&edoFromForm&&expectedEdo!==edoFromForm)anomalies.push(`El nombre del archivo indica edo=${expectedEdo}, pero el formulario indica edo=${edoFromForm}.`);
  const stateId=edoFromForm??expectedEdo;
  const types=typeEntries(typeForm,anomalies);
  const scriptAction=html.match(/document\.form2\.action\s*=\s*["']([^"']+)["']/iu)?.[1]??null;
  if(!scriptAction)anomalies.push('No se encontró la sobrescritura JavaScript document.form2.action; el endpoint filtrado debe verificarse.');
  const filterAction=scriptAction??typeForm?.action??null;
  const filterActionUrl=filterAction?new URL(filterAction,sourceUrl).href:null;
  const ley=typeByLabel(types,'Ley');const codigo=typeByLabel(types,'Código');const reglamento=typeByLabel(types,'Reglamento');
  if(!ley)anomalies.push('No se publicó un tipo Ley con conteo en el selector.');
  if(!codigo)anomalies.push('No se publicó un tipo Código con conteo en el selector.');
  if(!reglamento)anomalies.push('No se publicó un tipo Reglamento con conteo en el selector.');
  const decentralizedIframe=html.match(/<iframe\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]*compilacion\.ordenjuridico\.gob\.mx[^"'\s>]*)/iu)?.[1]??null;
  if(decentralizedIframe)anomalies.push(`La captura delega el contenido a un iframe de compilación desconcentrada (${decodeHtmlEntities(decentralizedIframe)}); no se capturó ni se consultó ese iframe.`);
  const filterFields=typeForm?.fields.filter(field=>field.kind!=='select').map(field=>({name:field.name,value:field.value}))??[];
  const filterPlan={method:typeForm?.method??null,observedFormAction:typeForm?.actionUrl??null,clientSideAction:filterActionUrl,fields:filterFields,selector:{name:'catTipo',optionsForAcquisition:[ley,codigo].filter(Boolean).map(entry=>({label:entry.label,typeId:entry.id,count:entry.count}))},requestTemplate:filterActionUrl?`${filterActionUrl}${filterActionUrl.includes('?')?'&':'?'}ordenar={typeId}&edo=${encodeURIComponent(stateId??'{edo}')}&idi=&catTipo={typeId}`:null,verification:'La plantilla reproduce los campos y la sobrescritura JavaScript observados; no se ejecutó ninguna solicitud ni se verificaron paginación o parámetros opcionales.'};
  const phrase=searchForm?.fields.find(field=>field.name==='frase');
  const phrasePlan={method:searchForm?.method??null,action:searchForm?.actionUrl??null,fields:searchForm?.fields.filter(field=>field.kind!=='select').map(field=>({name:field.name,value:field.value}))??[],requestTemplate:searchForm?.actionUrl?`${searchForm.actionUrl}${searchForm.actionUrl.includes('?')?'&':'?'}frase={urlEncodedQuery}&edo=${encodeURIComponent(stateId??'{edo}')}`:null,verification:phrase?'El campo frase y el campo oculto edo se observaron en la captura; no se ejecutó ninguna búsqueda.':'No se encontró el campo frase; verificar antes de usar.'};
  return {edoId:stateId?Number.parseInt(stateId,10):null,stateName,typeCounts:types,practiceTypeCounts:{leyes:ley?.count??null,codigos:codigo?.count??null,reglamentos:reglamento?.count??null},search:{phrase:phrasePlan,byType:filterPlan},...pageDateInfo(html),parseAnomalies:anomalies};
}

function summarizeAuxiliary(html,name){
  const summary={kind:name,title:htmlText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu)?.[1]??''),structure:null,parseAnomalies:[]};
  if(name==='ambest'){
    const ids=[...html.matchAll(/estatal\.php\?[^"'\s>]*\bedo=(\d+)/giu)].map(match=>Number.parseInt(match[1],10));const unique=[...new Set(ids)].sort((a,b)=>a-b);
    summary.structure={description:'Página de navegación del ámbito estatal y de la Ciudad de México.',stateEdoIds:unique,stateLinkCount:unique.length};if(unique.length!==32)summary.parseAnomalies.push(`Se esperaban 32 ids de entidad; se encontraron ${unique.length}.`);
  }else if(name==='ambmun'){
    const select=html.match(/<select\b[^>]*name=["']idEstado["'][^>]*>([\s\S]*?)<\/select\s*>/iu);const ids=select?[...select[1].matchAll(/<option\b[^>]*value=["']?(\d+)/giu)].map(match=>Number.parseInt(match[1],10)).filter(id=>id>0):[];summary.structure={description:'Selector de entidad para el ámbito municipal.',stateEdoIds:[...new Set(ids)].sort((a,b)=>a-b),stateOptionCount:new Set(ids).size};
  }else if(name==='ambinter'){
    const destinations=[...html.matchAll(/href=["']?([^"'\s>]*(?:tratados|derechos_humanos|jurisdicciones)\.php[^"'\s>]*)/giu)].map(match=>match[1]);summary.structure={description:'Página de entrada a instrumentos internacionales.',destinations:[...new Set(destinations)]};
  }else if(name==='ambfed')summary.structure={description:'Página de entrada al ámbito federal con navegación por poder/órgano y búsqueda por dependencia.',containsDependenceSearch:/B[úu]squeda por Dependencia/iu.test(htmlText(html))};
  return summary;
}

function stateNamesFromAmbest(html){
  const names=new Map();
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']?([^"'\s>]*estatal\.php\?[^"'\s>]*)[^>]*>([\s\S]*?)<\/a\s*>/giu)){
    try{const edo=new URL(decodeHtmlEntities(match[1]),OJN_ORIGIN).searchParams.get('edo');const name=htmlText(match[2]).replace(/^\*/u,'').trim();if(edo&&name&&!names.has(Number.parseInt(edo,10)))names.set(Number.parseInt(edo,10),name);}catch{/* malformed navigation link is not evidence */}
  }
  return names;
}

async function provenance(file,sourceUrl){const [bytes,info]=await Promise.all([readFile(file),stat(file)]);const decoded=decodeOjnHtml(bytes);return {bytes,html:decoded.text,provenance:{file:path.basename(file),sourceUrl,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAtFromFileMtime:info.mtime.toISOString(),encoding:decoded.encoding,declaredCharset:decoded.declaredCharset}};}

export async function discoverOjnCatalog({inputDir=path.join(root,'artifacts/legal-library/discovery-2026-11-02/ojn'),catalogPath=path.join(root,'resources/legal-library-catalog-ojn-index.json'),generatedAt=new Date().toISOString()}={}){
  const names=(await readdir(inputDir)).filter(name=>stateFile.test(name)).sort((a,b)=>Number.parseInt(a.match(stateFile)[1],10)-Number.parseInt(b.match(stateFile)[1],10));
  const catalogAnomalies=[];if(names.length!==32)catalogAnomalies.push(`Se esperaban 32 capturas estatales; se encontraron ${names.length}.`);
  const auxiliary=[];
  let stateNames=new Map();
  for(const name of ['ambest','ambfed','ambmun','ambinter']){const filename=`${name}.htm`;try{const captured=await provenance(path.join(inputDir,filename),new URL(`${name}.php`,OJN_ORIGIN).href);if(name==='ambest')stateNames=stateNamesFromAmbest(captured.html);auxiliary.push({name,...captured.provenance,...summarizeAuxiliary(captured.html,name)});}catch(error){if(error.code==='ENOENT'){catalogAnomalies.push(`Falta la captura auxiliar ${filename}.`);continue;}throw error;}}
  const states=[];
  for(const name of names){const edoId=name.match(stateFile)[1];const sourceUrl=new URL(`estatal.php?liberado=si&edo=${edoId}`,OJN_ORIGIN).href;const captured=await provenance(path.join(inputDir,name),sourceUrl);const parsed=parseOjnStatePage(captured.html,{filename:name,sourceUrl});const fallbackName=stateNames.get(Number.parseInt(edoId,10));if(!parsed.stateName&&fallbackName){parsed.stateName=fallbackName;parsed.stateNameSource='ambest navigation capture';parsed.parseAnomalies=parsed.parseAnomalies.map(anomaly=>anomaly==='No se pudo extraer el nombre de la entidad del encabezado.'?`${anomaly} Se usó ${fallbackName} desde la navegación ambest capturada.`:anomaly);}else parsed.stateNameSource=parsed.stateName?'state page heading':'unavailable';states.push({...parsed,provenance:captured.provenance});}
  const totals={states:states.length,leyes:states.reduce((sum,state)=>sum+(state.practiceTypeCounts.leyes??0),0),codigos:states.reduce((sum,state)=>sum+(state.practiceTypeCounts.codigos??0),0),reglamentos:states.reduce((sum,state)=>sum+(state.practiceTypeCounts.reglamentos??0),0),statesWithoutLeyCount:states.filter(state=>state.practiceTypeCounts.leyes===null).length,statesWithoutCodigoCount:states.filter(state=>state.practiceTypeCounts.codigos===null).length,statesWithoutReglamentoCount:states.filter(state=>state.practiceTypeCounts.reglamentos===null).length};
  const catalog={schemaVersion:1,generatedAt,kind:'index-of-published-type-counts-not-law-texts',scope:'Índice offline de conteos publicados por el Orden Jurídico Nacional (SEGOB) en capturas guardadas. No contiene textos de leyes y no verifica completitud, vigencia, autenticidad documental ni cobertura de códigos concretos.',source:{publisher:'Orden Jurídico Nacional (SEGOB)',origin:OJN_ORIGIN,captureDirectory:path.relative(root,inputDir),networkAccess:'No se ejecutaron solicitudes de red durante este descubrimiento.'},totals,parseAnomalies:catalogAnomalies,states,auxiliary};
  await mkdir(path.dirname(catalogPath),{recursive:true});await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n',{mode:0o600});return catalog;
}

function option(args,name,fallback){const position=args.indexOf(name);if(position<0)return fallback;const value=args[position+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a path`);return path.resolve(value);}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked)try{const args=process.argv.slice(2);const catalog=await discoverOjnCatalog({inputDir:option(args,'--input-dir',undefined),catalogPath:option(args,'--catalog',undefined)});console.log(JSON.stringify({state:'complete',states:catalog.totals.states,leyes:catalog.totals.leyes,codigos:catalog.totals.codigos,reglamentos:catalog.totals.reglamentos,anomalies:catalog.parseAnomalies.length+catalog.states.reduce((sum,state)=>sum+state.parseAnomalies.length,0)}));}catch(error){console.error(JSON.stringify({state:'failed',error:error.message}));process.exitCode=1;}

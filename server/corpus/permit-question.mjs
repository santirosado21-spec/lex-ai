// Hints for a local form. Ambiguous values stay empty for the lawyer to resolve.
import {requestedLegalJurisdiction} from '../assistant-router.mjs';
const months='enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(' ');
const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const unique=values=>{const items=[...new Set(values)];return items.length===1?items[0]:'';};
const calendar=(year,month,day)=>{
 const value=[year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
 const timestamp=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===value?value:'';
};
const regimes=['Importación temporal','Importación definitiva','Depósito fiscal','Elaboración, transformación o reparación en recinto fiscalizado','Recinto fiscalizado estratégico'];
function dates(text){
 const pattern=/\b(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2}) (?:de )?(\p{L}+) (?:de |del )?(\d{4})|(\d{1,2})\/(\d{1,2})\/(\d{4}))\b/gu;
 const choices=[];
 for(const match of text.matchAll(pattern)){
  const [,year,month,day,d,m,y,slashDay,slashMonth,slashYear]=match;
  const iso=year?calendar(year,month,day):y?calendar(y,months.indexOf(m)+1,d):
   Number(slashDay)>12||slashDay===slashMonth?calendar(slashYear,slashMonth,slashDay):'';
  const before=text.slice(Math.max(0,match.index-70),match.index),after=text.slice(match.index+match[0].length);
  const operation=/\b(?:operacion|importacion|embarque|despacho|importamos|se importo|se despacho)(?:\s+(?:se realizo|realizad[oa]|efectuad[oa]|del dia|el dia|del|el|de|fue el|ocurrio el))?\s*[:,-]?\s*$/u.test(before)||
   /^\s+(?:se importo|se despacho|importamos|se realizo la operacion)\b/u.test(after);
  choices.push({iso,operation});
 }
 const anchored=choices.filter(d=>d.operation);
 return unique(anchored.map(d=>d.iso));
}
function classificationIn(text){
 const found=[];
 for(const m of text.matchAll(/\b(?:fraccion(?: arancelaria)?|clasificacion|codigo arancelario)\s*[:#]?\s*(\d{4})[. ]?(\d{2})[. ]?(\d{2})(?:\s*[,;/·-]?\s*(?:con\s+)?nico\s*[:#]?\s*|[. -]?)(\d{2})\b/gu))
  found.push(m.slice(1).join(''));
 return unique(found);
}
export function permitQuestionHint(question,known=[]){
 let original=question.normalize('NFD').replace(/\p{M}/gu,'');
 const names=known.filter(v=>typeof v==='string'&&v.trim()).map(v=>fold(v.trim())).sort((a,b)=>b.length-a.length);
 for(const name of new Set(names)){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  original=original.replace(new RegExp(escaped,'giu'),' ');
 }
 const text=original.toLowerCase(),jurisdiction=requestedLegalJurisdiction(text);
 if(jurisdiction&&jurisdiction.id!=='MX-FED'&&/\b(?:codigo|constitucion|ley (?:estatal|local|del estado|de hacienda))\b/u.test(text))return null;
 const annex=/\banexo\s+22\b|\bapendice\s+9\b/u.test(text);
 if(/\b(?:rmf|resolucion miscelanea fiscal)\b/u.test(text)&&!/(?:\brgce\b|pedimento)/u.test(text))return null;
 if(!annex&&/\b(?:articulos?|arts?[.]?)\s+\d/u.test(text))return null;
 const customs=/\b(?:pedimentos?|aduan\w*|(?:im|ex)port(?:acion(?:es)?|ar|amos|o|ad[oa]s?|ador(?:a|es|as)?)|despacho(?:s)? aduaner\w*|vucem|vutce|rgce)\b/u.test(text);
 if(/\b(?:apendice (?:2|16)\b|clave (?:del? |de )pedimento\b|cve[.]? pedimento\b)/u.test(text)&&!/apendice 9|permiso|aviso|no arancelaria/u.test(text))return null;
 const asksPermit=customs&&/\b(?:permisos?|avisos?|rrna|regulacion(?:es)? no arancelarias?)\b/u.test(text);
 const metals=/\baluminio\b/u.test(text),sugar=/\bazucar\b/u.test(text);
 const codes=[];
 for(const m of original.matchAll(/\bclaves?(?:\s+(?:de permiso|del pedimento|de regulacion))?\s*[:#]?\s*[«"“]?([a-z][a-z0-9])\b(?:\s+(?:y|o)\s+([a-z][a-z0-9])\b)?/giu)){
  for(const token of m.slice(1).filter(Boolean)){
   if((token===token.toUpperCase()||/\d/u.test(token))&&!['DE','EN','EL','LA','SE'].includes(token.toUpperCase()))codes.push(token.toUpperCase());
  }
 }
 if(!asksPermit&&!(annex&&(customs||metals||sugar||/apendice\s+9/u.test(text)))&&!(customs&&(codes.length||((metals||sugar)&&/\b(?:aviso|permiso|declar\w*|pedimento|requisito\w*)\b/u.test(text)))))return null;
 const negated=/\b(?:sin|excepto|excluye|excluyendo|no (?:es|contiene|incluye))\s+(?:el |la |piezas de )?(?:aluminio|azucar)\b/u.test(text);
 const commodity=!negated&&metals!==sugar?(metals?'AL':'C1'):'';
 const query=codes.length?unique(codes):commodity;
 const alternative=/\b(?:temporal|definitiva)\s+(?:o|y)\s+(?:(?:importacion|la)\s+)?(?:temporal|definitiva)\b/u.test(text);
 const regime=alternative?'':unique(regimes.filter(s=>text.includes(fold(s))));
 return {date:dates(text),query,classification:classificationIn(text),regime,sugar:sugar&&!metals&&query==='C1'};
}

// Only named fields are candidates. Keep conflicting values visible for review.
export function documentPermitFields(sources){
 const results=[];
 for(const source of sources){
  const fields=[];
  const lines=source.original.split('\n');
  for(const [index,line] of lines.entries()){
   const m=/^\s*([^:]{2,45}):\s*(.{1,240})\s*$/u.exec(line);
   if(!m)continue;
   const name=fold(m[1].trim()),value=m[2].trim();
   let field,parsed,endLine;
   if(/^(?:fecha (?:de |del |de la )(?:operacion|despacho|importacion))$/u.test(name)){
    field='date';parsed=dates('operacion: '+fold(value));
   }else if(/^(?:clave (?:del? |de )?(?:permiso|aviso|regulacion|rrna)|rrna)$/u.test(name)){
    field='query';parsed=/^[a-z][a-z0-9]$/iu.test(value)?value.toUpperCase():'';
   }else if(/^(?:fraccion(?: arancelaria)?(?: (?:y|con) nico)?)$/u.test(name)){
    field='classification';parsed=classificationIn('fraccion '+fold(value));
    if(!parsed&&/^\d{4}[.]?\d{2}[.]?\d{2}$/u.test(value)){
     const next=/^\s*NICO\s*:\s*(\d{2})\s*$/iu.exec(lines[index+1]??'');
     if(next){parsed=value.replaceAll('.','')+next[1];endLine=index+2;}
    }
   }else if(/^(?:regimen(?: aduanero)?)$/u.test(name)){
    field='regime';parsed=regimes.find(r=>fold(r)===fold(value));
   }
   if(parsed)fields.push({field,value:parsed,line:index+1,...(endLine?{endLine}:{})});
  }
  if(fields.length)results.push({id:source.id,label:source.label,fields});
 }
 return results;
}

export function permitFieldCitations(supports,picks,selection){
 if(!Array.isArray(picks)||picks.length>4)throw Error('Selección documental inválida.');
 const cited=[],used=new Set();
 for(const pick of picks){
  if(!pick||Object.keys(pick).length!==3||!['field','sourceId','line'].every(k=>Object.hasOwn(pick,k))||used.has(pick.field))throw Error('Selecciona una línea por campo.');
  const source=supports.find(s=>s.id===pick.sourceId);
  const row=source?.fields.find(r=>r.line===pick.line&&r.field===pick.field);
  const expected=pick.field==='query'?selection.code:selection[pick.field];
  if(!row||row.value!==expected)throw Error('El campo cambió. Vuelve a cotejarlo con su documento.');
  used.add(pick.field);
  const label={query:'Clave',date:'Fecha de operación',classification:'Fracción y NICO',regime:'Régimen'}[pick.field];
  cited.push(source.label+(row.endLine?' · líneas '+row.line+'–'+row.endLine:' · línea '+row.line)+' · '+label+' · '+row.value);
 }
 if(used.has('date')&&new Set(supports.flatMap(s=>s.fields.filter(r=>r.field==='date').map(r=>r.value))).size>1){
  cited.push('Los soportes contienen fechas distintas. El cotejo usa la fecha de la línea seleccionada.');
 }
 return cited;
}

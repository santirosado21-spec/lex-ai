// Attest the complete extracted exercise before offering any sentence to a provider.
// Only the displayed sentence is eligible. Filenames, local labels and line evidence stay local.
import {createHash} from 'node:crypto';
import {aliasedDocumentQuestion} from './intake-aliased-question.mjs';
import {questionLines} from './intake-question-lines.mjs';
import {caseSources} from '../intake-sources.mjs';
import {openReviewedDocument} from '../privacy/intake-document-map.mjs';
import {protectedPracticeFacts} from './pilot-practice-document.mjs';

const verified=new WeakSet();
const published=new Map([
 // factura-cotejo-ficticia.txt
 ['fb822abed507d5f45a2727f76b1cd9e24ee43f2c3998d15418e0d98dfadca132',['El precio pagado incluye el flete.']],
 // contrato-cotejo-ficticio.txt
 ['7d3412785a8cfbdb94641162106716dbd908fe2034fd66911fa2d6bd23b8b499',['El precio pagado no incluye el flete.']],
 // contraste-ficticio.txt
 ['3661f3daf4d49857b9941c6be2e82a170628a6ca4167d9b4bf48395629f4e39e',['El pago de regalías es condición de venta.','El precio pagado no incluye el flete.','Falta el acuse de los anexos del pedimento.']],
 // factura-ficticia.txt
 ['29bf435b61d73703a51f0d7d228e14da09b8e9903bac6dfa61a5067eb1afcb7b',['La empresa pide revisar qué documentación falta para analizar el origen preferencial.']],
 // fraccion-limpiaparabrisas-ficticia.txt
 ['37c1f95e7ceeee444f6622252257549ae41d471dad94206563790d84c64b5423',['La ficha técnica está pendiente de cotejo con el catálogo de componentes.']],
 // consulta-fraccion-ficticia.txt
 ['8fcd5a1eda5930ef01f634ce34c82d041cefd2ab9d54ce21e11a45f6e6d6ab4d',['Documentación recibida: catálogo de componentes.']],
]);
const digest=text=>createHash('sha256').update(text).digest('hex');
const canonical=text=>text.split('\n').filter(line=>line.trim().length).join('\n');

export function availableQuestionFacts(saved,sourceIds){
 const rows=[];
 for(const [index,source] of caseSources(saved?.intake).entries()){
  const {document,id,label}=source;
  if(sourceIds&&!sourceIds.has(id))continue;
  const view=openReviewedDocument(document,saved.firm.id,saved.entry.id);
  const lines=view.original.split('\n');
  const add=(line,text)=>{
   rows.push({id:id+'/'+(line+1),text,evidence:{sourceId:id,sourceLabel:'Documento '+(index+1)+' · '+label,line:line+1,excerpt:lines[line].trim()}});
  };
  if(index===0&&saved.intake.practiceSeed){
   try{
    const practice=protectedPracticeFacts(saved.intake.practiceSeed,document,saved.firm.id,saved.entry.id);
    practice.facts.forEach((fact,i)=>{
     // Substitution may hide the country or product, but must preserve the evidentiary polarity.
     if(i===1&&fact!==practice.example.facts[i])return;
     if(i===0&&!/^(?:El ejercicio trata de la importación de |Se solicita revisar un cupo para importar )/u.test(fact))return;
     add(i+4,fact.replace(/\[\[PARTE_\d+\]\]/gu,'[dato protegido]'));
    });
   }catch{ /* The public-only question remains available if a practice fact cannot be verified. */ }
   continue;
  }
  const clauses=published.get(digest(canonical(view.original)));
  if(!clauses)continue;
  // A substitution sometimes crosses a line break. Preserve original positions
  // when checking that all characters of a candidate remained visible.
  const hidden=new Map(document.snapshot.entries.map(entry=>[entry.marker,entry.text.replace(/[^\n]/g,'\u0000')]));
  const masked=document.protectedText.replace(/\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]/gu,marker=>hidden.get(marker)).split('\n');
  for(const clause of clauses){
   const i=lines.findIndex(line=>line.startsWith(clause));
   if(i>=0&&masked[i].startsWith(clause))add(i,clause);
  }
 }
 return rows;
}

export function selectQuestionFacts(saved,ids,question){
 if(!Array.isArray(ids)||ids.length<1||ids.length>4||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))
  throw Error('Selecciona entre uno y cuatro hechos distintos del ejercicio.');
 const ordinary=ids.filter(id=>!id.startsWith('line:'));
 const items=ordinary.length?availableQuestionFacts(saved,new Set(ordinary.map(id=>id.split('/')[0]))).filter(row=>ordinary.includes(row.id)):[];
 const lineIds=ids.filter(id=>id.startsWith('line:'));
 const values=new Map();
 let localCount=0;
 const lineSources=new Set(lineIds.map(id=>id.slice(5).split('/')[0]));
 for(const {id:sourceId} of caseSources(saved.intake)){
  if(!lineSources.has(sourceId))continue;
  for(const row of questionLines(saved,sourceId).filter(row=>lineIds.includes(row.id))){
   let text;
   if(row.cloud)text=row.parts.map(part=>{
    if(part.text!==undefined)return part.text;
    if(!part.token)return '[dato protegido]';
    if(!values.has(part.value))values.set(part.value,Object.freeze({out:'[[PARTE_'+(values.size+1)+']]',local:part.token}));
    return values.get(part.value).out;
   }).join('');
   else localCount++;
   items.push({id:row.id,text,evidence:row.evidence});
  }
 }
 if(items.length!==ids.length)throw Error('Las sustituciones o las líneas seleccionadas cambiaron. Vuelve a revisar la pregunta.');
 if(new Set(items.map(item=>item.evidence.sourceId+'/'+item.evidence.line)).size!==items.length)
  throw Error('Selecciona una sola versión de cada línea.');
 const inquiry=aliasedDocumentQuestion(saved,question,values);
 let number=0;
 const sources=items.map(item=>Object.freeze(inquiry&&item.text?{...item.evidence,factNumber:++number}:item.evidence));
 const evidence=Object.freeze({...sources[0],additional:Object.freeze(sources.slice(1))});
 const texts=Object.freeze(items.map(item=>item.text).filter(Boolean));
 const discrepancy=texts.includes('El precio pagado incluye el flete.')&&texts.includes('El precio pagado no incluye el flete.')?
  'Si los soportes corresponden a la misma operación, discrepan sobre si el flete ya forma parte del precio pagado. Coteja ambas afirmaciones con los comprobantes.':'';
 const pack=Object.freeze({texts,evidence,...(inquiry?{inquiry}:{}),discrepancy,aliases:Object.freeze([...values.values()]),localCount});
 verified.add(pack);return pack;
}
export function questionFactTexts(pack){
 if(!verified.has(pack))throw Error('No se pudo verificar el origen de los hechos.');
 return pack.texts;
}

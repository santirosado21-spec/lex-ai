import {useState,type FormEvent} from 'react';
import {ArrowRight,ChevronDown,FileSearch,HardDrive,LoaderCircle} from 'lucide-react';
import IntakePermit,{type PermitHint,type PermitSelection} from './IntakePermit';
import IntakeQuestionLines from './IntakeQuestionLines';
import {api} from './api';

type Review={id:string;permit?:PermitHint;sources?:{id:string;label:string}[];facts?:{id:string;text:string;label:string;line:number}[];masked:string;count:number;suggestedAngle:string;candidates:{key:string;citationId:string;label:string;locator:string;text:string;partial:boolean}[]};
export type QuestionSelection={reviewId:string;key:string;angle:string;secondKey?:string;factIds?:string[]};

export default function IntakeQuestion({disabled,onSelect,onPermit}:{disabled:boolean;onPermit:(selection:PermitSelection,reviewId:string)=>Promise<void>;onSelect:(selection:QuestionSelection)=>Promise<void>}){
 const [open,setOpen]=useState(false),[question,setQuestion]=useState('');
 const [review,setReview]=useState<Review|null>(null),[key,setKey]=useState(''),[angle,setAngle]=useState('requisitos');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [route,setRoute]=useState<'permit'|'passage'>('passage');
 const [factIds,setFactIds]=useState<string[]>([]);
 const [secondKey,setSecondKey]=useState('');
 const comparison=review?.candidates.find(row=>row.key===secondKey);
 const candidate=review?.candidates.find(row=>row.key===key);
 const alternatives=review?.candidates.filter(row=>row.citationId!==candidate?.citationId)??[];
 async function inspect(event:FormEvent){
  event.preventDefault();setBusy(true);setReview(null);setSecondKey('');setFactIds([]);setError('');
  try{
   const result=await api<Review>('intake.inspectQuestion',{text:question.trim()});
   setReview(result);setKey(result.candidates[0]?.key??'');setRoute(result.permit&&!result.candidates[0]?.key.startsWith('ad29-')?'permit':'passage');setAngle(result.suggestedAngle);
  }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo revisar la consulta local.');}
  finally{setBusy(false);}
 }
 async function choose(){
  if(!review)return;
  setBusy(true);setError('');
  try{await onSelect({reviewId:review.id,key,angle,...(secondKey?{secondKey}:{}),...(factIds.length?{factIds}:{})});setOpen(false);setQuestion('');setReview(null);}
  catch(cause){setError(cause instanceof Error?cause.message:'No se pudo preparar el mensaje.');}
  finally{setBusy(false);}
 }
 return <section className="rp-question">
  <button className="rp-quiet" type="button" disabled={busy||disabled} aria-expanded={open} aria-controls="rp-question-panel" onClick={()=>setOpen(!open)}><FileSearch size={17}/>Consultar con una pregunta propia<ChevronDown size={15}/></button>
  {open&&<div id="rp-question-panel" className="rp-reveal"><form onSubmit={inspect}>
   <label htmlFor="rp-question-text">Pregunta del expediente</label>
   <textarea id="rp-question-text" rows={3} maxLength={800} disabled={busy||disabled} placeholder="¿Qué documentos acreditan el flete y el seguro en el valor en aduana?" value={question} onChange={e=>{setQuestion(e.target.value);setReview(null);setError('');}}/>
   <p>La pregunta se revisa en tu equipo. Podrás cotejar los fundamentos antes de preparar un mensaje para OpenAI.</p>
   <button className="rp-quiet" disabled={busy||disabled||question.trim().length<10}>{busy?<LoaderCircle className="rp-spin" size={16}/>:<HardDrive size={16}/>}Buscar fundamentos en este equipo</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {review&&<div className="rp-reveal"><details className="rp-details"><summary>Pregunta con sustituciones locales · {review.count}</summary><p>{review.masked}</p></details>
   {review.permit&&review.candidates.length>0&&<div className="rp-actions" role="group" aria-label="Tipo de consulta">
    <button type="button" className="rp-quiet" aria-pressed={route==='permit'} disabled={busy||disabled} onClick={()=>setRoute('permit')}>Cotejar pedimento</button>
    <button type="button" className="rp-quiet" aria-pressed={route==='passage'} disabled={busy||disabled} onClick={()=>setRoute('passage')}>Consultar pasaje jurídico</button></div>}
   {route==='permit'&&review.permit?<IntakePermit key={review.id} hint={review.permit} disabled={busy||disabled} onSave={async selection=>{
    await onPermit(selection,review.id);setQuestion('');setReview(null);setOpen(false);
   }}/>:<>
   <div className="rp-question-sources"><div>
   <label htmlFor="rp-question-source">Pasaje que quieres consultar<select id="rp-question-source" disabled={busy||disabled} value={key} onChange={e=>{setKey(e.target.value);setSecondKey('');}}>{review.candidates.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label>
   {candidate?.partial&&<p>Este pasaje coincide con un término aislado. Comprueba si también aborda el resto de tu pregunta.</p>}
   {candidate&&<details className="rp-details" key={key}><summary>Leer el pasaje seleccionado</summary><p>{candidate.locator}</p><p>{candidate.text}</p></details>}
   </div>{alternatives.length>0&&<div><label>Segundo fundamento<select value={secondKey} disabled={busy||disabled} onChange={e=>setSecondKey(e.target.value)}><option value="">Consultar un solo pasaje</option>{alternatives.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label>
   {comparison&&<details key={'second-'+secondKey} className="rp-details rp-reveal"><summary>Leer el segundo fundamento</summary><p>{comparison.locator}</p><p>{comparison.text}</p>{comparison.partial&&<p>Comprueba si el pasaje aborda el resto de la pregunta.</p>}</details>}</div>}</div>
   {Boolean(review.facts?.length)&&<fieldset className="rp-question-facts"><legend>Hechos para incluir en la consulta</legend>
    <p>Elige afirmaciones de la misma operación para que OpenAI las considere. Los nombres de los documentos y sus líneas se conservan en tu equipo.</p>
    {review.facts?.map(fact=><label key={fact.id}><input type="checkbox" checked={factIds.includes(fact.id)} disabled={disabled||busy||(!factIds.includes(fact.id)&&factIds.length>=4)} onChange={e=>setFactIds(e.target.checked?[...factIds,fact.id]:factIds.filter(id=>id!==fact.id))}/><span>{fact.text}<small>{fact.label} · línea {fact.line}</small></span></label>)}
   </fieldset>}
   <IntakeQuestionLines key={review.id} reviewId={review.id} sources={review.sources??[]} selected={factIds} disabled={busy||disabled} onChange={setFactIds}/>
   <label htmlFor="rp-question-angle">Enfoque jurídico<select id="rp-question-angle" disabled={busy||disabled} value={angle} onChange={e=>setAngle(e.target.value)}><option value="requisitos">Requisitos para aplicar la disposición</option><option value="excepciones">Excepciones y condiciones de aplicación</option><option value="documentos">Documentos para acreditar los hechos</option></select></label>
   <button type="button" className="rp-primary" disabled={busy||disabled} onClick={()=>void choose()}>Preparar mensaje para revisión<ArrowRight size={16}/></button></>}
  </div>}</div>}
 </section>;
}

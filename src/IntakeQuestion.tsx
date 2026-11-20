import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,ChevronDown,FileSearch,HardDrive,LoaderCircle,ShieldPlus,X} from 'lucide-react';
import IntakePermit,{type PermitHint,type PermitSelection} from './IntakePermit';
import IntakeQuestionLines from './IntakeQuestionLines';
import {api} from './api';

type Context={state:'unlinked'|'ambiguous'|'direction'|'work'|'domestic'|'supported';lines:{id:string;label:string;line:number;text:string}[]};
const contextText:Record<Context['state'],string>={
 supported:'Los soportes mencionan una salida al extranjero y una intervención técnica. Comprueba si ambos se refieren al mismo bien antes de usar el artículo sugerido.',
 unlinked:'Para ubicar la operación, indica su folio o elige las líneas de los documentos que quieres cotejar.',
 ambiguous:'Las referencias pueden corresponder a más de una operación o equipo. Elige las líneas del bien que quieres revisar.',
 direction:'Falta identificar la salida al extranjero. Busca el documento de salida antes de atribuir un régimen aduanero.',
 work:'El soporte menciona la salida. Falta comprobar qué trabajo se hizo en el extranjero.',
 domestic:'Hay una mención de trabajo nacional o de una salida que no se realizó. Comprueba el lugar de la intervención.',
};
type Review={id:string;context?:Context|null;permit?:PermitHint;sources?:{id:string;label:string}[];facts?:{id:string;text:string;label:string;line:number}[];masked:string;count:number;suggestedAngle:string;candidates:{key:string;citationId:string;label:string;locator:string;text:string;partial:boolean}[]};
export type QuestionSelection={reviewId:string;key:string;angle:string;secondKey?:string;factIds?:string[]};

export default function IntakeQuestion({disabled,onSelect,onPermit,reservationRevision}:{disabled:boolean;reservationRevision:number;onPermit:(selection:PermitSelection,reviewId:string)=>Promise<void>;onSelect:(selection:QuestionSelection)=>Promise<void>}){
 const [open,setOpen]=useState(false),[question,setQuestion]=useState('');
 const [reserved,setReserved]=useState<string[]>([]);
 const [selection,setSelection]=useState('');
 const [review,setReview]=useState<Review|null>(null),[key,setKey]=useState(''),[angle,setAngle]=useState('requisitos');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [route,setRoute]=useState<'permit'|'passage'>('passage');
 const [factIds,setFactIds]=useState<string[]>([]);
 const [secondKey,setSecondKey]=useState('');
 const [originals,setOriginals]=useState<Record<string,string>|null>(null);
 async function toggleOriginals(){
  if(originals){setOriginals(null);return;}
  if(!review)return;
  setBusy(true);setError('');
  try{
   const rows=await api<{id:string;text:string}[]>('intake.readContextLines',{reviewId:review.id});
   setOriginals(Object.fromEntries(rows.map(row=>[row.id,row.text])));
  }catch(e){setError(e instanceof Error?e.message:'No se pudieron abrir las líneas originales.');}
  finally{setBusy(false);}
 }
 const [refined,setRefined]=useState<string[]>([]);
 useEffect(()=>{
  setReview(null);setOriginals(null);setRefined([]);setFactIds([]);setSecondKey('');setError('');
 },[reservationRevision]);
 const lineIds=factIds.filter(id=>id.startsWith('line:'));
 const stale=refined.length>0&&(lineIds.length!==refined.length||refined.some(id=>!lineIds.includes(id)));
 const comparison=review?.candidates.find(row=>row.key===secondKey);
 const candidate=review?.candidates.find(row=>row.key===key);
 const alternatives=review?.candidates.filter(row=>row.citationId!==candidate?.citationId)??[];
 async function inspect(event:FormEvent){
  event.preventDefault();setOriginals(null);setBusy(true);setReview(null);setSecondKey('');setRefined([]);setFactIds([]);setError('');
  try{
   const result=await api<Review>('intake.inspectQuestion',{text:question.trim(),...(reserved.length?{reserved}:{})});
   setReview(result);setKey(result.candidates[0]?.key??'');setRoute(result.permit&&!result.candidates[0]?.key.startsWith('ad29-')?'permit':'passage');setAngle(result.suggestedAngle);
  }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo revisar la consulta local.');}
  finally{setBusy(false);}
 }
 async function refine(){
  if(!review||!lineIds.length)return;
  setBusy(true);setError('');
  try{
   const update=await api<Pick<Review,'id'|'context'|'candidates'>>('intake.refineQuestion',{reviewId:review.id,lines:lineIds});
   setOriginals(null);setReview({...review,...update});setRefined(lineIds);setKey(update.candidates[0]?.key??'');setSecondKey('');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo buscar con los soportes.');}
  finally{setBusy(false);}
 }
 async function choose(){
  if(!review)return;
  setBusy(true);setError('');
  try{await onSelect({reviewId:review.id,key,angle,...(secondKey?{secondKey}:{}),...(factIds.length?{factIds}:{})});setOpen(false);setQuestion('');setReserved([]);setSelection('');setReview(null);}
  catch(cause){setError(cause instanceof Error?cause.message:'No se pudo preparar el mensaje.');}
  finally{setBusy(false);}
 }
 return <section className="rp-question">
  <button className="rp-quiet" type="button" disabled={busy||disabled} aria-expanded={open} aria-controls="rp-question-panel" onClick={()=>setOpen(!open)}><FileSearch size={17}/>Consultar con una pregunta propia<ChevronDown size={15}/></button>
  {open&&<div id="rp-question-panel" className="rp-reveal"><form onSubmit={inspect}>
   <label htmlFor="rp-question-text">Pregunta del expediente</label>
   <textarea onSelect={e=>setSelection(e.currentTarget.value.slice(e.currentTarget.selectionStart,e.currentTarget.selectionEnd).trim())} id="rp-question-text" rows={3} maxLength={800} disabled={busy||disabled} placeholder="¿Qué documentos acreditan el flete y el seguro en el valor en aduana?" value={question} onChange={e=>{setQuestion(e.target.value);setSelection('');setReview(null);setError('');}}/>
   <details className="rp-details rp-reserved"><summary>Reservar datos de esta pregunta</summary>
    <p>Selecciona una expresión en la pregunta. Rejon ocultará todas sus coincidencias exactas en la vista con sustituciones.</p>
    <button type="button" className="rp-quiet" disabled={busy||disabled||selection.length<2||selection.length>256||reserved.includes(selection)||reserved.length>=24}
     onClick={()=>{setReserved([...reserved,selection]);setSelection('');setReview(null);setError('');}}><ShieldPlus size={15}/>Reservar selección</button>
    {reserved.length>0&&<ul aria-label="Datos reservados">{reserved.map(term=><li key={term}><span>{term}</span><button type="button" className="rp-quiet" disabled={busy||disabled} aria-label={'Quitar '+term}
     onClick={()=>{setReserved(reserved.filter(s=>s!==term));setReview(null);setError('');}}><X size={15}/></button></li>)}</ul>}
    {reserved.some(s=>!question.trim().includes(s))&&<p role="status">La pregunta cambió. Quita la expresión que ya no aparece o vuelve a escribirla.</p>}
   </details>
   <p>La pregunta se revisa en tu equipo. Podrás cotejar los fundamentos antes de preparar un mensaje para OpenAI.</p>
   <button className="rp-quiet" disabled={busy||disabled||question.trim().length<10||reserved.some(s=>!question.trim().includes(s))}>{busy?<LoaderCircle className="rp-spin" size={16}/>:<HardDrive size={16}/>}Buscar fundamentos en este equipo</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {review&&<div className="rp-reveal"><details className="rp-details"><summary>Pregunta con sustituciones locales · {review.count}</summary><p>{review.masked}</p>{Boolean(review.sources?.length)&&<p>Los números de los datos coinciden con los de las líneas del expediente.</p>}</details>
   {review.permit&&review.candidates.length>0&&<div className="rp-actions" role="group" aria-label="Tipo de consulta">
    <button type="button" className="rp-quiet" aria-pressed={route==='permit'} disabled={busy||disabled} onClick={()=>setRoute('permit')}>Cotejar pedimento</button>
    <button type="button" className="rp-quiet" aria-pressed={route==='passage'} disabled={busy||disabled} onClick={()=>setRoute('passage')}>Consultar pasaje jurídico</button></div>}
   {route==='permit'&&review.permit?<IntakePermit key={review.id} hint={review.permit} disabled={busy||disabled} onSave={async selection=>{
    await onPermit(selection,review.id);setQuestion('');setReserved([]);setSelection('');setReview(null);setOpen(false);
   }}/>:<>
   {review.context&&<section className="rp-details rp-context-links" aria-label="Contexto del expediente"><h3>Contexto del expediente</h3>
    <p>{contextText[review.context.state]}</p>
    {review.context.lines.map(row=><label key={row.id}><input type="checkbox" checked={factIds.includes(row.id)} disabled={busy||disabled||(!factIds.includes(row.id)&&factIds.length>=4)}
      onChange={e=>setFactIds(e.target.checked?[...factIds,row.id]:factIds.filter(id=>id!==row.id))}/>
     <span>{row.label} · línea {row.line}<small>{originals?.[row.id]??row.text}</small></span></label>)}
    {review.context.lines.length>0&&<button type="button" className="rp-quiet" disabled={busy||disabled} aria-pressed={Boolean(originals)} onClick={()=>void toggleOriginals()}>
     {originals?'Volver a ver las sustituciones':'Ver líneas originales en este equipo'}</button>}
    {review.context.lines.length>0&&<p>Marca las líneas que quieras incluir como soporte del borrador.</p>}
   </section>}
   {!review.candidates.length&&<p role="status">Elige líneas del expediente para buscar un fundamento o precisa la ley en tu pregunta.</p>}
   {review.candidates.length>0&&<div className="rp-question-sources"><div>
   <label htmlFor="rp-question-source">Pasaje que quieres consultar<select id="rp-question-source" disabled={busy||disabled} value={key} onChange={e=>{setKey(e.target.value);setSecondKey('');}}>{review.candidates.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label>
   {candidate?.partial&&<p>Este pasaje coincide con un término aislado. Comprueba si también aborda el resto de tu pregunta.</p>}
   {candidate&&<details className="rp-details" key={key}><summary>Leer el pasaje seleccionado</summary><p>{candidate.locator}</p><p>{candidate.text}</p></details>}
   </div>{alternatives.length>0&&<div><label>Segundo fundamento<select value={secondKey} disabled={busy||disabled} onChange={e=>setSecondKey(e.target.value)}><option value="">Consultar un solo pasaje</option>{alternatives.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label>
   {comparison&&<details key={'second-'+secondKey} className="rp-details rp-reveal"><summary>Leer el segundo fundamento</summary><p>{comparison.locator}</p><p>{comparison.text}</p>{comparison.partial&&<p>Comprueba si el pasaje aborda el resto de la pregunta.</p>}</details>}</div>}</div>}
   {Boolean(review.facts?.length)&&<fieldset className="rp-question-facts"><legend>Hechos para incluir en la consulta</legend>
    <p>Elige afirmaciones de la misma operación para que OpenAI las considere. Los nombres de los documentos y sus líneas se conservan en tu equipo.</p>
    {review.facts?.map(fact=><label key={fact.id}><input type="checkbox" checked={factIds.includes(fact.id)} disabled={disabled||busy||(!factIds.includes(fact.id)&&factIds.length>=4)} onChange={e=>setFactIds(e.target.checked?[...factIds,fact.id]:factIds.filter(id=>id!==fact.id))}/><span>{fact.text}<small>{fact.label} · línea {fact.line}</small></span></label>)}
   </fieldset>}
   <IntakeQuestionLines reviewId={review.id} sources={review.sources??[]} selected={factIds} disabled={busy||disabled} onChange={setFactIds}/>
   {lineIds.length>0&&<button type="button" className="rp-quiet" disabled={busy||disabled} onClick={()=>void refine()}><FileSearch size={15}/>Buscar fundamentos con las líneas elegidas</button>}
   {stale&&<p role="status">Cambiaste los soportes. Repite la búsqueda con las líneas actuales o con la pregunta sola.</p>}
   <label htmlFor="rp-question-angle">Enfoque jurídico<select id="rp-question-angle" disabled={busy||disabled} value={angle} onChange={e=>setAngle(e.target.value)}><option value="requisitos">Requisitos para aplicar la disposición</option><option value="excepciones">Excepciones y condiciones de aplicación</option><option value="documentos">Documentos para acreditar los hechos</option></select></label>
   <button type="button" className="rp-primary" disabled={busy||disabled||!candidate||stale} onClick={()=>void choose()}>Preparar mensaje para revisión<ArrowRight size={16}/></button></>}
  </div>}</div>}
 </section>;
}

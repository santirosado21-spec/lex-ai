import {useRef, useState} from 'react';
import {FileInput} from 'lucide-react';
import {api, fileBase64} from './api';

type Protection = {available:false;reason:string}|{available:true;count:number;needsReview:boolean;contextualCount?:number;contextUnavailable?:boolean;parts:({text:string}|{label:string;start:number;end:number})[];restored:string};
type Extract = {reviewId?:string;protection?:Protection;scenarioId?:string;supplier?:string;scenarioPreview?:string;client:string;title:string;documentKind:'pedimento'|'factura'|'contrato'|'otro'};
export default function LocalIntakeImport({onExtract,onBusyChange,onReviewChange,onReplace,ciphered}:{ciphered?:boolean;onReplace:()=>void;onReviewChange:(id:string,hasCorrections:boolean)=>void;onExtract:(data:Extract)=>void;onBusyChange?:(busy:boolean)=>void}) {
 const picker=useRef<HTMLInputElement>(null);
 const [preview,setPreview]=useState('');
 const [protection,setProtection]=useState<Protection>();
 const [showOriginal,setShowOriginal]=useState(false);
 const [reviewId,setReviewId]=useState<string>();
 const [correcting,setCorrecting]=useState(false);
 const [canUndo,setCanUndo]=useState(false);
 const [literal,setLiteral]=useState('');
 const rangeBox=useRef<HTMLTextAreaElement>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function inspect(file?:File) {
  setLiteral('');onReplace();setReviewId(undefined);setCanUndo(false);setCorrecting(false);
  setPreview('');setProtection(undefined);setShowOriginal(false);onBusyChange?.(true);setBusy(true);setMessage('Leyendo en este equipo…');
  try {
   const data=file?await api<Extract>('intake.inspectLocal',{
    extension:file.name.split('.').pop()?.toLowerCase(),base64:await fileBase64(file),review:true,
   }):await api<Extract>('intake.createPractice');
   setReviewId(data.reviewId);setProtection(data.protection);setPreview(data.scenarioPreview??'');onExtract(data);setMessage('Revisa los campos y completa los que quedaron vacíos.');
  } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo leer el documento.');}
  finally {onBusyChange?.(false);setBusy(false);if(picker.current)picker.current.value='';}
 }
 async function revise(undo=false){
  if(!reviewId||busy)return;
  const original=rangeBox.current;
  const position=original&&literal?original.value.indexOf(literal):-1;
  if(!undo&&literal&&position<0){setMessage('El fragmento debe coincidir exactamente con el original.');return;}
  const selection=literal?{start:position,end:position+literal.length}:{start:original?.selectionStart??0,end:original?.selectionEnd??0};
  if(!undo&&(selection.end-selection.start<2||selection.end-selection.start>256)){
   setMessage('Selecciona entre 2 y 256 caracteres del texto original.');rangeBox.current?.focus();return;
  }
  setBusy(true);onBusyChange?.(true);
  try{
   const result=await api<{reviewId:string;protection:Protection;canUndo:boolean}>(undo?'intake.undoSelection':'intake.protectSelection',undo?{reviewId}:{reviewId,...selection});
   setProtection(result.protection);setCanUndo(result.canUndo);setReviewId(result.reviewId);onReviewChange(result.reviewId,result.canUndo);
   setLiteral('');setCorrecting(false);setShowOriginal(false);
   setMessage(undo?'Se deshizo la última corrección.':'Las coincidencias exactas del fragmento están ocultas.');
  }catch(error){setMessage(error instanceof Error?error.message:'No se pudo comprobar la corrección.');}
  finally{setBusy(false);onBusyChange?.(false);}
 }
 return <section aria-label="Lectura local de documentos" className="local-import">
  <input ref={picker} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>{const f=e.target.files?.[0];if(f)void inspect(f);}}/>
  <button type="button" className="secondary" disabled={busy} onClick={()=>picker.current?.click()}><FileInput size={16} aria-hidden="true"/> Leer documento ficticio en este equipo</button>
  {ciphered&&<button type="button" className="rp-quiet" disabled={busy} onClick={()=>void inspect()}>Crear documento de práctica</button>}
  <small>PDF, Word o texto · hasta 8 000 caracteres · requiere Ollama local</small>
  {protection?.available&&<details className="rp-private-review"><summary>Revisar protección local · {protection.count} sustituciones</summary>
   <p>Comprueba nombres, direcciones e identificadores que sigan visibles. Puedes conservar el texto en el expediente cifrado al guardar el alta.</p>
   {protection.contextUnavailable&&<p role="status">La segunda lectura local quedó incompleta. Revisa también turnos, lugares y acontecimientos que identifiquen el asunto.</p>}
   {protection.needsReview&&<p role="status">{protection.contextualCount?'Comprueba las descripciones de personas o lugares que podrían identificar la operación. Se ocultó el contexto de esas descripciones.':'Hay datos ambiguos que requieren revisión.'}</p>}
   <button type="button" className="secondary" aria-pressed={showOriginal} onClick={()=>setShowOriginal(!showOriginal)}>{showOriginal?'Ver sustituciones':'Ver texto restituido'}</button>
   {reviewId&&<div className="rp-correction">
    <button type="button" className="secondary" disabled={busy} aria-expanded={correcting} onClick={()=>{setLiteral('');setCorrecting(!correcting);}}>{correcting?'Cerrar selección':'Ocultar otro dato'}</button>
    {canUndo&&<button type="button" className="rp-quiet" disabled={busy} onClick={()=>void revise(true)}>Deshacer última corrección</button>}
    {correcting&&<div><label>Selecciona el dato en el texto original<textarea ref={rangeBox} readOnly rows={5} value={protection.restored}/></label>
     <label>O escribe el fragmento exacto<input type="text" autoComplete="off" spellCheck={false} value={literal} maxLength={256} onChange={e=>setLiteral(e.target.value)}/></label>
     <button type="button" className="secondary" disabled={busy} onClick={()=>void revise()}>Ocultar coincidencias exactas</button></div>}
   </div>}
   <pre className={showOriginal?undefined:'rp-masked'}>{protection.parts.map((part,i)=>'label' in part?<mark key={i}>{showOriginal?protection.restored.slice(part.start,part.end):part.label}</mark>:part.text)}</pre>
  </details>}
  {protection&&!protection.available&&<p role="status">{protection.reason}</p>}
  {preview&&!canUndo&&<details><summary>Ver el caso ficticio con identidades sustituidas</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{preview}</pre></details>}
  {message&&<p role="status">{message}</p>}
 </section>;
}

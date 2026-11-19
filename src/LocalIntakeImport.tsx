import {useRef, useState} from 'react';
import {FileInput} from 'lucide-react';
import {api, fileBase64} from './api';

type Protection = {available:false;reason:string}|{available:true;count:number;needsReview:boolean;parts:({text:string}|{label:string;start:number;end:number})[];restored:string};
type Extract = {protection?:Protection;scenarioId?:string;supplier?:string;scenarioPreview?:string;client:string;title:string;documentKind:'pedimento'|'factura'|'contrato'|'otro'};
export default function LocalIntakeImport({onExtract,onBusyChange}:{onExtract:(data:Extract)=>void;onBusyChange?:(busy:boolean)=>void}) {
 const picker=useRef<HTMLInputElement>(null);
 const [preview,setPreview]=useState('');
 const [protection,setProtection]=useState<Protection>();
 const [showOriginal,setShowOriginal]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function inspect(file:File) {
  setPreview('');setProtection(undefined);setShowOriginal(false);onBusyChange?.(true);setBusy(true);setMessage('Leyendo en este equipo…');
  try {
   const data=await api<Extract>('intake.inspectLocal',{
    extension:file.name.split('.').pop()?.toLowerCase(),base64:await fileBase64(file),review:true,
   });
   setProtection(data.protection);setPreview(data.scenarioPreview??'');onExtract(data);setMessage('Revisa los campos y completa los que quedaron vacíos.');
  } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo leer el documento.');}
  finally {onBusyChange?.(false);setBusy(false);if(picker.current)picker.current.value='';}
 }
 return <section aria-label="Lectura local de documentos" className="local-import">
  <input ref={picker} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>{const f=e.target.files?.[0];if(f)void inspect(f);}}/>
  <button type="button" className="secondary" disabled={busy} onClick={()=>picker.current?.click()}><FileInput size={16} aria-hidden="true"/> Leer documento ficticio en este equipo</button>
  <small>PDF, Word o texto · hasta 8 000 caracteres · requiere Ollama local</small>
  {protection?.available&&<details className="rp-private-review"><summary>Revisar protección local · {protection.count} sustituciones</summary>
   <p>Comprueba nombres, direcciones e identificadores que sigan visibles. Esta vista se conserva sólo durante el alta.</p>
   {protection.needsReview&&<p role="status">Hay datos ambiguos que requieren revisión.</p>}
   <button type="button" className="secondary" aria-pressed={showOriginal} onClick={()=>setShowOriginal(!showOriginal)}>{showOriginal?'Ver sustituciones':'Ver texto restituido'}</button>
   <pre>{protection.parts.map((part,i)=>'label' in part?<mark key={i}>{showOriginal?protection.restored.slice(part.start,part.end):part.label}</mark>:part.text)}</pre>
  </details>}
  {protection&&!protection.available&&<p role="status">{protection.reason}</p>}
  {preview&&<details><summary>Ver el caso ficticio con identidades sustituidas</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{preview}</pre></details>}
  {message&&<p role="status">{message}</p>}
 </section>;
}

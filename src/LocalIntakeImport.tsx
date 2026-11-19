import {useRef, useState} from 'react';
import {FileInput} from 'lucide-react';
import {api, fileBase64} from './api';

type Extract = {scenarioId?:string;supplier?:string;scenarioPreview?:string;client:string;title:string;documentKind:'pedimento'|'factura'|'contrato'|'otro'};
export default function LocalIntakeImport({onExtract,onBusyChange}:{onExtract:(data:Extract)=>void;onBusyChange?:(busy:boolean)=>void}) {
 const picker=useRef<HTMLInputElement>(null);
 const [preview,setPreview]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function inspect(file:File) {
  setPreview('');onBusyChange?.(true);setBusy(true);setMessage('Leyendo en este equipo…');
  try {
   const data=await api<Extract>('intake.inspectLocal',{
    extension:file.name.split('.').pop()?.toLowerCase(),base64:await fileBase64(file),
   });
   setPreview(data.scenarioPreview??'');onExtract(data);setMessage('Revisa los campos y completa los que quedaron vacíos.');
  } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo leer el documento.');}
  finally {onBusyChange?.(false);setBusy(false);if(picker.current)picker.current.value='';}
 }
 return <section aria-label="Lectura local de documentos" className="local-import">
  <input ref={picker} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>{const f=e.target.files?.[0];if(f)void inspect(f);}}/>
  <button type="button" className="secondary" disabled={busy} onClick={()=>picker.current?.click()}><FileInput size={16} aria-hidden="true"/> Leer documento ficticio en este equipo</button>
  <small>PDF, Word o texto · hasta 8 000 caracteres · requiere Ollama local</small>
  {preview&&<details><summary>Ver el caso ficticio con identidades sustituidas</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{preview}</pre></details>}
  {message&&<p role="status">{message}</p>}
 </section>;
}

import {useState} from 'react';
import {ShieldPlus} from 'lucide-react';
import {api} from './api';

type Row={id:string;text:string};
type Props={count:number;disabled:boolean;onSave:(action:string,payload:Record<string,unknown>)=>Promise<void>};
export default function IntakeReservations({count,disabled,onSave}:Props){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [rows,setRows]=useState<Row[]>([]),[revision,setRevision]=useState(0),[entry,setEntry]=useState('');
 async function load(){
  const data=await api<{rows:Row[];revision:number}>('intake.getReservations',{});
  setRows(data.rows);setRevision(data.revision);
 }
 async function toggle(){
  if(open){setOpen(false);setRows([]);setEntry('');return;}
  setBusy(true);setError('');
  try{await load();setOpen(true);}catch(e){setError(e instanceof Error?e.message:'No se pudo abrir la lista.');}
  finally{setBusy(false);}
 }
 async function change(id?:string){
  setBusy(true);setError('');
  try{
   await onSave(id?'intake.removeReservation':'intake.reserveTerm',id?{id,revision}:{text:entry.trim(),revision});
   setEntry('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Revisa la expresión.');}
  finally{setBusy(false);}
 }
 return <section className="rp-source-files">
  <button type="button" className="rp-quiet" aria-expanded={open} disabled={busy||disabled} onClick={()=>void toggle()}><ShieldPlus size={16}/>Reservas del expediente ({count})</button>
  {open&&<div className="rp-reveal"><p>Reserva una expresión que pueda identificar el asunto. Rejon la oculta en las líneas de consulta y comprueba cada mensaje antes de enviarlo. Reconoce variantes de mayúsculas, acentos y espacios.</p>
   <label>Expresión que quieres reservar<input maxLength={256} value={entry} disabled={busy||disabled} onChange={e=>setEntry(e.target.value)}/></label>
   <button type="button" className="rp-quiet" disabled={busy||disabled||entry.trim().length<2} onClick={()=>void change()}>Guardar reserva</button>
   {!!rows.length&&<ul>{rows.map(row=><li key={row.id}>{row.text} <button type="button" className="rp-quiet" disabled={busy||disabled} aria-label={'Quitar reserva de '+row.text} onClick={()=>void change(row.id)}>Quitar</button></li>)}</ul>}
  </div>}{error&&<p role="alert">{error}</p>}
 </section>;
}

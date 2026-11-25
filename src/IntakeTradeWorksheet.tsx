import {useRef,useState} from 'react';
import {ClipboardList} from 'lucide-react';
import {api,downloadFile} from './api';
import {worksheetProgress} from './worksheet-progress';

type Values={status:string;amount:string;currency:string;reference:string;note:string};
type Row=Values&{id:string;base:string;revision:number;label:string;check:string;source:string};
type Proposal={line:number;sourceId?:string;sourceLabel?:string;excerpt:string;reference:string;amount?:string;currency?:string};
type Sheet={proposals:Record<string,Proposal[]>;title:string;monetary:boolean;statuses:string[];rows:Row[]};
const valuesOf=({status,amount,currency,reference,note}:Row):Values=>({status,amount,currency,reference,note});

export default function IntakeTradeWorksheet({task,disabled,onDirty,onSave}:{
 task:string;disabled:boolean;onDirty:(dirty:boolean)=>void;onSave:()=>void;
}){
 const [sheet,setSheet]=useState<Sheet|null>(null);
 const [selected,setSelected]=useState('');
 const [candidate,setCandidate]=useState(0);
 const [editing,setEditing]=useState<Values|null>(null);
 const [open,setOpen]=useState(false);
 const [pending,setPending]=useState(false);
 const copyKey=useRef('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const row=sheet?.rows.find(item=>item.id===selected);
 const values=editing??row;
 const candidates=sheet?.proposals[row?.base??selected]??[];
 const proposal=candidates[candidate];
 const progress=sheet?worksheetProgress(sheet.rows):null;
 const title=task==='lectura-valoracion'?'Control de valoración':'Control del pedimento';

 async function load(){
  setPending(true);setError('');
  try{
   const next=await api<Sheet>('intake.readWorksheet',{task});
   setSheet(next);setSelected(next.rows.some(r=>r.id===selected)?selected:next.rows[0].id);
   copyKey.current='';setEditing(null);onDirty(false);setOpen(true);setMessage('');
  }catch{setError('No se pudo abrir el control local.');}
  finally{setPending(false);}
 }
 function revise(changes:Partial<Values>){
  if(!row)return;
  const next={...valuesOf(row),...editing,...changes};
  const dirty=(Object.keys(next) as (keyof Values)[]).some(key=>next[key]!==row[key]);
  setEditing(dirty?next:null);onDirty(dirty);setMessage('');setError('');
 }
 const change=(field:keyof Values,value:string)=>revise({[field]:value});
 async function save(copy=false){
  if(!editing||!row)return;
  setPending(true);setError('');
  try{
   if(copy&&!copyKey.current)copyKey.current=crypto.randomUUID();
   const next=await api<Sheet>('intake.saveWorksheetRow',{task,id:row.id,revision:row.revision,values:editing,...(copy?{copyId:copyKey.current}:{})});
   if(copy)setSelected(row.base+'~'+copyKey.current);
   copyKey.current='';
   setSheet(next);setEditing(null);onDirty(false);setMessage('Renglón guardado en el expediente.');onSave();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
  finally{setPending(false);}
 }
 async function download(){
  setPending(true);setError('');
  try{downloadFile(await api<{name:string;base64:string;mime:string}>('intake.exportWorksheet',{task}));setMessage('Control exportado a Excel.');}
  catch{setError('No se pudo exportar el control.');}
  finally{setPending(false);}
 }
 return <section className="rp-worksheet" aria-label={title}>
  <button className="rp-quiet" type="button" disabled={pending||disabled||!!editing} aria-expanded={open}
   onClick={()=>{if(open){setOpen(false);setError('');}else void load();}}><ClipboardList size={16}/> {title}</button>
  {open&&sheet&&row&&values&&<fieldset disabled={pending||disabled}>
   <legend>Datos locales para la exportación</legend>
   {progress&&<section aria-label="Seguimiento documental">
    <h3>Seguimiento documental</h3>
    <p role="status">Por atender: {progress.pending.length} de {progress.total} renglones · Cotejados: {progress.checked} · No aplica: {progress.notApplicable}.</p>
    <small>Estados guardados por el usuario. No acreditan cumplimiento jurídico ni validación automática.</small>
    {editing&&<p>Hay cambios sin guardar. El resumen muestra la última versión guardada.</p>}
    {progress.unknown>0&&<p role="alert">{progress.unknown} renglones tienen un estado no reconocido. Revisa el control antes de exportar.</p>}
    {progress.pending.length>0?<details><summary>Ver renglones por atender</summary><ul>
     {progress.pending.map(item=><li key={item.id}><button type="button" className="rp-quiet" disabled={!!editing} onClick={()=>{setSelected(item.id);setCandidate(0);setMessage('');setError('');}}>{item.label} · {item.status}</button></li>)}
    </ul></details>:progress.total>0&&progress.unknown===0?<p>Sin renglones por atender según los estados guardados.</p>:null}
   </section>}
   <label>Concepto<select value={selected} disabled={!!editing} onChange={e=>{setSelected(e.target.value);setCandidate(0);setMessage('');setError('');}}>
    {sheet.rows.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
   </select></label>
   <p>{row.check} <small>{row.source}</small></p>
   {proposal&&<div className="rp-proposal">
    {candidates.length>1&&<label>Coincidencia del documento<select value={candidate} onChange={e=>setCandidate(Number(e.target.value))}>
     {candidates.map((p,i)=><option key={(p.sourceId??'')+'-'+p.line} value={i}>{p.sourceLabel&&p.sourceLabel+' · '}Línea {p.line}</option>)}
    </select></label>}
    <small>{proposal.sourceLabel??'Texto extraído'} · línea {proposal.line}</small><blockquote>{proposal.excerpt}</blockquote>
    <button type="button" className="rp-quiet" onClick={()=>revise({reference:proposal.reference,...(proposal.amount?{amount:proposal.amount,currency:proposal.currency}:{})})}>Usar dato del soporte</button>
   </div>}
   <div className="rp-sheet-fields">
    <label>Estado<select value={values.status} onChange={e=>change('status',e.target.value)}>{sheet.statuses.map(s=><option key={s}>{s}</option>)}</select></label>
    {sheet.monetary&&<><label>Importe<input inputMode="decimal" value={values.amount} placeholder="0.00" maxLength={16} onChange={e=>change('amount',e.target.value)}/></label>
     <label>Moneda<input value={values.currency} placeholder="MXN" maxLength={3} onChange={e=>change('currency',e.target.value.toUpperCase())}/></label></>}
   </div>
   <label>Referencia local<input maxLength={140} value={values.reference} onChange={e=>change('reference',e.target.value)}/></label>
   <label>Observación<input maxLength={300} value={values.note} onChange={e=>change('note',e.target.value)}/></label>
   <div className="rp-actions"><button className="secondary" type="button" disabled={!editing} onClick={()=>void save()}>Guardar renglón</button>
    {editing&&row.revision>0&&<button type="button" className="secondary" onClick={()=>void save(true)}>Guardar como otro renglón</button>}
    {editing&&<button type="button" className="rp-quiet" onClick={()=>void load()}>Descartar y recargar</button>}</div>
   <button className="rp-quiet" type="button" disabled={!!editing} onClick={()=>void download()}>Exportar control a Excel</button>
   {message&&<small role="status">{message}</small>}
  </fieldset>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}

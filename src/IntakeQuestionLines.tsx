import {useState} from 'react';
import {FileText} from 'lucide-react';
import {api} from './api';

type Source={id:string;label:string};
type Row={id:string;text:string;cloud:boolean;label:string;line:number};
type Props={reviewId:string;sources:Source[];selected:string[];disabled:boolean;onChange:(ids:string[])=>void};
export default function IntakeQuestionLines({reviewId,sources,selected,disabled,onChange}:Props){
 const [open,setOpen]=useState(false),[source,setSource]=useState(sources[0]?.id??'');
 const [page,setPage]=useState(0);
 const [cache,setCache]=useState<Record<string,Row[]>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(id:string){
  setSource(id);setPage(0);setError('');if(cache[id])return;
  setBusy(true);
  try{const rows=await api<Row[]>('intake.questionLines',{reviewId,sourceId:id});setCache(current=>({...current,[id]:rows}));}
  catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron revisar las líneas.');}
  finally{setBusy(false);}
 }
 if(!sources.length)return null;
 const rows=cache[source]??[],pageSize=12,start=page*pageSize;
 const visible=rows.slice(start,start+pageSize),onPage=new Set(visible.map(row=>row.id));
 const hiddenSelected=Object.values(cache).flat().filter(row=>!onPage.has(row.id)&&selected.includes(row.id));
 return <section className="rp-question-lines">
  <button type="button" className="rp-quiet" aria-expanded={open} disabled={disabled||busy} onClick={()=>{setOpen(!open);if(!open)void load(source);}}><FileText size={15}/>Elegir líneas de mis documentos</button>
  {open&&<fieldset className="rp-question-facts rp-reveal"><legend>Soportes para esta nota</legend>
   <label>Documento<select value={source} disabled={busy||disabled} onChange={e=>void load(e.target.value)}>{sources.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <p>Las líneas de tus archivos se añaden al recuperar los datos originales. En los documentos de práctica verificados también puedes elegir líneas para OpenAI.</p>
   {busy&&<p role="status">Revisando las sustituciones…</p>}
   {error&&<p role="alert">{error}</p>}
   <div className="rp-line-options">{[...visible,...hiddenSelected].map(row=><label key={row.id}>
    <input type="checkbox" checked={selected.includes(row.id)} disabled={busy||disabled||(!selected.includes(row.id)&&selected.length>=4)} onChange={e=>onChange(e.target.checked?[...selected,row.id]:selected.filter(id=>id!==row.id))}/>
    <span>{row.text}<small>{row.label} · línea {row.line} · {row.cloud?'OpenAI con sustituciones':'Sólo en este equipo'}</small></span>
   </label>)}</div>
   {rows.length>pageSize&&<nav className="rp-actions" aria-label="Páginas de líneas documentales">
    <button type="button" className="rp-quiet" disabled={busy||disabled||page===0} onClick={()=>setPage(page-1)}>Anteriores</button>
    <small>{start+1}–{Math.min(start+pageSize,rows.length)} de {rows.length}</small>
    <button type="button" className="rp-quiet" disabled={busy||disabled||start+pageSize>=rows.length} onClick={()=>setPage(page+1)}>Siguientes</button>
   </nav>}
  </fieldset>}
 </section>;
}

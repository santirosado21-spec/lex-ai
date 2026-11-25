import {useEffect,useRef,useState} from 'react';
import {FileText} from 'lucide-react';
import {api} from './api';

const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
type Source={id:string;label:string};
type Row={id:string;text:string;cloud:boolean;label:string;line:number};
type Props={onCompareProducers?:(ids:string[])=>void;reviewId:string;sources:Source[];selected:string[];disabled:boolean;onChange:(ids:string[])=>void};
// A cached row belongs to one reviewed snapshot, never just a reusable source ID.
export default function IntakeQuestionLines(props:Props){
 return <ReviewQuestionLines key={JSON.stringify([props.reviewId,props.sources.map(source=>source.id)])} {...props}/>;
}
function ReviewQuestionLines({reviewId,sources,selected,disabled,onChange,onCompareProducers}:Props){
 const active=useRef(true);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;request.current?.abort();};},[]);
 const [open,setOpen]=useState(false),[source,setSource]=useState(sources[0]?.id??'');
 const [certification,setCertification]=useState('');
 const [page,setPage]=useState(0),[filter,setFilter]=useState('');
 const [cache,setCache]=useState<Record<string,Row[]>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(id:string){
  setSource(id);setPage(0);setFilter('');setError('');if(cache[id])return;
  const controller=new AbortController();request.current=controller;
  setBusy(true);
  try{const rows=await api<Row[]>('intake.questionLines',{reviewId,sourceId:id},controller.signal);if(active.current)setCache(current=>({...current,[id]:rows}));}
  catch(cause){if(active.current)setError(cause instanceof Error?cause.message:'No se pudieron revisar las líneas.');}
  finally{if(active.current)setBusy(false);}
 }
 if(!sources.length)return null;
 const rows=cache[source]??[],pageSize=12,start=page*pageSize;
 const term=fold(filter.trim()),num=/^(?:linea\s+|#)?(\d+)$/u.exec(term);
 const matches=term?rows.filter(r=>num?r.line===Number(num[1]):fold(r.text).includes(term)):rows;
 const visible=matches.slice(start,start+pageSize),onPage=new Set(visible.map(row=>row.id));
 const hiddenSelected=Object.values(cache).flat().filter(row=>!onPage.has(row.id)&&selected.includes(row.id));
 const chosen=Object.values(cache).flat().filter(row=>selected.includes(row.id));
 const certificate=chosen.find(row=>row.id===certification);
 const register=chosen.find(row=>row.id!==certification);
 const describe=(row:Row)=>row.label+' · línea '+row.line+' · '+row.text;
 return <section className="rp-question-lines">
  <button type="button" className="rp-quiet" aria-expanded={open} disabled={disabled||busy} onClick={()=>{setOpen(!open);if(!open)void load(source);}}><FileText size={15}/>Elegir líneas de mis documentos</button>
  {open&&<fieldset className="rp-question-facts rp-reveal"><legend>Soportes para esta nota</legend>
   <label>Documento<select value={source} disabled={busy||disabled} onChange={e=>void load(e.target.value)}>{sources.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <p>Las líneas de tus archivos se añaden al recuperar los datos originales. En los documentos de práctica verificados también puedes elegir líneas para OpenAI.</p>
   {busy&&<p role="status">Revisando las sustituciones…</p>}
   {error&&<p role="alert">{error}</p>}
   {rows.length>pageSize&&<label>Buscar en el soporte<input type="search" value={filter} maxLength={128} disabled={busy||disabled} placeholder="Palabra visible o número de línea" onChange={e=>{setFilter(e.target.value);setPage(0);}}/></label>}
   {term&&<p role="status">{matches.length===1?'Una línea coincide':matches.length+' líneas coinciden'}</p>}
   <div className="rp-line-options">{[...visible,...hiddenSelected].map(row=><label key={row.id}>
    <input type="checkbox" checked={selected.includes(row.id)} disabled={busy||disabled||(!selected.includes(row.id)&&selected.length>=4)} onChange={e=>onChange(e.target.checked?[...selected,row.id]:selected.filter(id=>id!==row.id))}/>
    <span>{row.text}<small>{row.label} · línea {row.line} · {row.cloud?'OpenAI con sustituciones':'Sólo en este equipo'}</small></span>
   </label>)}</div>
   {matches.length>pageSize&&<nav className="rp-actions" aria-label="Páginas de líneas documentales">
    <button type="button" className="rp-quiet" disabled={busy||disabled||page===0} onClick={()=>setPage(page-1)}>Anteriores</button>
    <small>{start+1}–{Math.min(start+pageSize,matches.length)} de {matches.length}</small>
    <button type="button" className="rp-quiet" disabled={busy||disabled||start+pageSize>=matches.length} onClick={()=>setPage(page+1)}>Siguientes</button>
   </nav>}
   {onCompareProducers&&selected.length===2&&chosen.length===2&&<div className="rp-producer-comparison">
    <h4>Cotejar productores en este equipo</h4>
    <p>Elige dos líneas de la misma operación con la cantidad declarada. Las dos líneas permanecen en tu equipo. OpenAI prepara tres recomendaciones y Rejon selecciona la que corresponde a las cantidades.</p>
    <label htmlFor="rp-certification-line">Línea de la certificación</label><select id="rp-certification-line" value={certificate?.id??''} disabled={disabled||busy} onChange={e=>setCertification(e.target.value)}>
     <option value="">Elige la certificación</option>{chosen.map(row=><option key={row.id} value={row.id}>{describe(row)}</option>)}</select>
    {certificate&&register&&<p>Línea del registro · {describe(register)}</p>}
    <button type="button" className="rp-quiet" disabled={!certificate||!register||busy||disabled} onClick={()=>{if(certificate&&register)onCompareProducers([certificate.id,register.id]);}}>Preparar cotejo de cantidades</button>
   </div>}
  </fieldset>}
 </section>;
}

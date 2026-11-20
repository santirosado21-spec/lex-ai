import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,BookmarkPlus,FileText,Search,Table2} from 'lucide-react';
import {api} from './api';

type Row={code:string;nico:string;description:string;date:string;page:number;excelRow:number;localUrl:string;localBook:string};
type Result={total:number;results:Row[]};
const lookup=(query:string,offset:number)=>api<Result>('intake.searchNico',{query,offset});
const message=(error:unknown)=>error instanceof Error?error.message:'No se pudo consultar el catálogo local.';

export default function IntakeNico({initial,onSave}:{initial:string;onSave?:(code:string,nico:string)=>Promise<void>}){
 const [query,setQuery]=useState(initial),[submitted,setSubmitted]=useState(initial);
 const [result,setResult]=useState<Result|null>(null),[offset,setOffset]=useState(0);
 const [busy,setBusy]=useState(Boolean(initial)),[error,setError]=useState('');
 useEffect(()=>{
  if(!initial)return;
  let active=true;
  lookup(initial,0).then(rows=>{if(active)setResult(rows);})
   .catch(cause=>{if(active)setError(message(cause));}).finally(()=>{if(active)setBusy(false);});
  return ()=>{active=false;};
 },[initial]);
 async function search(value:string,start:number){
  setBusy(true);setError('');
  try{setResult(await lookup(value,start));setSubmitted(value);setOffset(start);}
  catch(cause){setError(message(cause));setResult(null);}
  finally{setBusy(false);}
 }
 async function save(row:Row){
  setBusy(true);setError('');
  try{await onSave?.(row.code,row.nico);}catch(cause){setError(message(cause));}
  finally{setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();void search(query,0);}
 return <section className="rp-tariff rp-reveal" aria-labelledby="rp-nico-title">
  <h2 id="rp-nico-title">Identificación comercial</h2>
  <p>Consulta los dos dígitos del NICO en la edición informativa del SNICE de abril de 2024. Para aplicarlos a una operación, revisa sus anotaciones y la publicación vigente en esa fecha.</p>
  <form onSubmit={submit}><label htmlFor="rp-nico-query">Fracción, clave de diez dígitos o descripción<input id="rp-nico-query" value={query} maxLength={90} disabled={busy} placeholder="0901.21.99 o café" autoComplete="off" onChange={e=>setQuery(e.target.value)}/></label>
   <button className="rp-primary" disabled={busy||query.trim().length<2}><Search size={16}/>Buscar NICO</button></form>
  {error&&<p role="alert">{error}</p>}
  {result&&<><p role="status">{result.total? (offset+1)+'–'+(offset+result.results.length)+' de '+result.total+' en esta edición':'Sin coincidencias para «'+submitted+'» en abril de 2024.'}</p>
   {result.results.map(row=><article key={row.code+row.nico}>
    <h3>{row.code}<small>NICO {row.nico}</small></h3><p>{row.description}</p>
    <div className="rp-actions"><a href={row.localUrl} target="_blank" rel="noreferrer"><FileText size={15}/>DOF {row.date} · página {row.page}</a>
     <a href={row.localBook} download><Table2 size={15}/>Libro SNICE · fila {row.excelRow}</a>
     {onSave&&<button className="rp-quiet" disabled={busy} onClick={()=>void save(row)}><BookmarkPlus size={15}/>Guardar NICO {row.nico}</button>}</div>
   </article>)}
   {result.total>12&&<div className="rp-actions"><button className="rp-quiet" disabled={busy||offset===0} onClick={()=>void search(submitted,offset-12)}><ArrowLeft size={15}/>Anterior</button>
    <button className="rp-quiet" disabled={busy||offset+12>=result.total} onClick={()=>void search(submitted,offset+12)}>Siguiente<ArrowRight size={15}/></button></div>}
  </>}
 </section>;
}

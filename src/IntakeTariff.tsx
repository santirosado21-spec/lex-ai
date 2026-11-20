import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,BookmarkPlus,FileText,Search} from 'lucide-react';
import {api} from './api';

type Hit={code:string;page:number;row:null|{description:string;unit:string;import:string;export:string;continued?:number[];adjacent?:number[]};pages:number[];localUrl:string;historyUrl:string};
type Result={total:number;results:Hit[]};

export default function IntakeTariff({saved,onSave,onNico,onOrigin}:{saved:boolean;onOrigin:(code:string)=>void;onNico:(code:string)=>void;onSave:(code:string,page:number)=>Promise<void>}){
 const [query,setQuery]=useState(''),[submitted,setSubmitted]=useState('');
 const [hits,setHits]=useState<Result|null>(null),[offset,setOffset]=useState(0);
 const [suggestions,setSuggestions]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  if(saved)api<string[]>('intake.tariffSuggestions',{}).then(s=>{if(active)setSuggestions(s);}).catch(()=>{});
  return ()=>{active=false;};
 },[saved]);
 async function search(value:string,start=0){
  setBusy(true);setError('');
  try{
   const found=await api<Result>('intake.searchTariff',{query:value,offset:start});
   setHits(found);setQuery(value);setSubmitted(value);setOffset(start);
  }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo abrir el índice local.');setHits(null);}
  finally{setBusy(false);}
 }
 async function save(hit:Hit){
  setBusy(true);setError('');
  try{await onSave(hit.code,hit.page);}catch{setError('No se pudo guardar la ficha en el expediente.');}
  finally{setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();void search(query);}
 return <section className="rp-tariff" aria-labelledby="rp-tariff-title">
  <h2 id="rp-tariff-title">Tarifa arancelaria</h2>
  <p>Consulta la fracción en la copia local de la LIGIE. El ejemplar incorpora modificaciones al 13 de octubre de 2026.</p>
  <form onSubmit={submit}><label htmlFor="rp-tariff-input">Fracción o descripción impresa<input id="rp-tariff-input" disabled={busy} value={query} maxLength={90} onChange={e=>setQuery(e.target.value)} placeholder="8413.70.07 o limpiaparabrisas" autoComplete="off"/></label>
   <button className="rp-primary" disabled={busy||query.trim().length<2}><Search size={16}/>Buscar en la tarifa</button></form>
  {suggestions.length>0&&<div className="rp-tariff-codes"><span>Fracciones mencionadas en el expediente</span>{suggestions.map(code=><button type="button" className="rp-quiet" disabled={busy} key={code} onClick={()=>void search(code)}>{code}</button>)}</div>}
  {error&&<p role="alert">{error}</p>}
  {hits&&<><p role="status">{hits.total===1?'1 coincidencia':hits.total?`${offset+1}–${offset+hits.results.length} de ${hits.total} coincidencias`:'Sin coincidencias en esta edición para «'+submitted+'».'}</p>
  {hits.results.map(hit=><article key={hit.code+'@'+hit.page}>
   <h3>{hit.code}<small>Página {hit.page}</small></h3>
   <p>{hit.row?.description??'El código aparece en esta página. Abre el PDF para cotejar la mención.'}</p>
   {hit.row&&<dl>{[['Unidad',hit.row.unit],['Importación impresa',hit.row.import],['Exportación impresa',hit.row.export]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
   <div className="rp-actions"><a href={hit.localUrl} target="_blank" rel="noreferrer"><FileText size={15}/>Abrir página {hit.page}</a>
    {(hit.row?.adjacent??[]).map(page=><a key={page} href={hit.localUrl.split('#')[0]+'#page='+page} target="_blank" rel="noreferrer">{hit.row?.continued?.includes(page)?'Continuación':'Cotejar límite'} · página {page}</a>)}
    <button type="button" className="rp-quiet" disabled={busy} onClick={()=>onNico(hit.code)}>Consultar NICO</button>
    <button type="button" className="rp-quiet" disabled={busy} onClick={()=>onOrigin(hit.code)}>Buscar regla de origen T-MEC</button>
    {saved&&<button className="rp-quiet" disabled={busy} onClick={()=>void save(hit)}><BookmarkPlus size={15}/>Guardar ficha</button>}
    {hit.pages.length>1&&submitted!==hit.code&&submitted!==hit.code.replaceAll('.','')&&<button className="rp-quiet" disabled={busy} onClick={()=>void search(hit.code)}>Ver las {hit.pages.length} páginas</button>}</div>
  </article>)}
  {hits.total>0&&<p>Las columnas reproducen el texto de la edición consultada. Coteja las notas, la fecha de la operación y los transitorios. <a href={hits.results[0]?.historyUrl} target="_blank" rel="noreferrer">Historial de reformas</a></p>}
  {hits.total>12&&<div className="rp-actions"><button className="rp-quiet" disabled={busy||offset===0} onClick={()=>void search(submitted,offset-12)}><ArrowLeft size={15}/>Anterior</button><button className="rp-quiet" disabled={busy||offset+12>=hits.total} onClick={()=>void search(submitted,offset+12)}>Siguiente<ArrowRight size={15}/></button></div>}</>}
 </section>;
}

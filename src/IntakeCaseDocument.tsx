import {useEffect,useRef,useState} from 'react';
import {FileText} from 'lucide-react';
import type {CaseSource} from './IntakeSourceFiles';
import {api} from './api';
import {supportTextMatches} from './support-text-search';

export type CaseDatum={token:string;label:string;value:string};
type StoredDocument={masked:string;original:string;needsReview:boolean;tokens:CaseDatum[]};

export default function IntakeCaseDocument({insert,sources=[]}:{sources?:CaseSource[];insert?:(datum:CaseDatum)=>void}) {
 const [doc,setDoc]=useState<StoredDocument|null>(null);
 const [open,setOpen]=useState(false);
 const [original,setOriginal]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState('');
 const [source,setSource]=useState('');
 const [query,setQuery]=useState(''),[submitted,setSubmitted]=useState(''),[match,setMatch]=useState(0);
 const activeMatch=useRef<HTMLElement|null>(null);
 const text=doc?(original?doc.original:doc.masked):'';
 const matches=supportTextMatches(text,submitted);
 useEffect(()=>{activeMatch.current?.scrollIntoView({block:'center'});},[match,submitted]);
 function clearSearch(){setQuery('');setSubmitted('');setMatch(0);}
 function search(){setSubmitted(query);setMatch(0);}
 function documentText(){
  if(!matches.length)return text;
  const parts=[];let end=0;
  for(const [index,start] of matches.entries()){
   parts.push(text.slice(end,start));
   parts.push(<mark key={start} ref={index===match?activeMatch:undefined} aria-current={index===match?'true':undefined}>{text.slice(start,start+submitted.length)}</mark>);
   end=start+submitted.length;
  }
  parts.push(text.slice(end));return parts;
 }
 async function load(id:string){
  clearSearch();setBusy(true);setError('');setDoc(null);setOriginal(false);setSelected('');
  try{const data=await api<StoredDocument>('intake.readDocument',id?{id}:{});setDoc(data);setSelected(data.tokens[0]?.token??'');setOpen(true);setSource(id);}
  catch{setError('El soporte guardado no se pudo verificar en este equipo.');}
  finally{setBusy(false);}
 }
 async function toggle(){
  if(open){clearSearch();setOpen(false);setOriginal(false);setDoc(null);setSelected('');return;}
  await load(sources[0]?.id??'');
 }
 return <section className="rp-case-document">
  <button type="button" className="rp-quiet" aria-expanded={open} disabled={busy} onClick={()=>void toggle()}><FileText size={16}/>{busy?'Abriendo soporte…':open?'Cerrar soporte':'Consultar soporte local'}</button>
  {error&&<p role="alert">{error}</p>}
  {open&&sources.length>1&&<label>Soporte que quieres leer<select value={source} disabled={busy} onChange={e=>void load(e.target.value)}>{sources.map((s,i)=><option value={s.id} key={s.id}>{i+1} · {s.label}</option>)}</select></label>}
  {open&&doc&&<div className="rp-private-review">
   <button type="button" className="secondary" aria-pressed={original} onClick={()=>{clearSearch();setOriginal(!original);}}>{original?'Ver sustituciones':'Ver texto restituido'}</button>
   <div className="rp-support-search">
    <label>Buscar texto exacto en este soporte<input type="search" value={query} maxLength={200} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();search();}}}/></label>
    <button type="button" className="rp-quiet" disabled={!query.trim()} onClick={search}>Buscar en el soporte</button>
    <small>Búsqueda local en el texto visible. Distingue mayúsculas y acentos; no busca en otros documentos ni interpreta el contenido. Muestra hasta 200 coincidencias por búsqueda.</small>
    {submitted&&<p role="status">{matches.length?'Coincidencia '+(match+1)+' de '+matches.length: 'Sin coincidencias exactas en esta vista.'}</p>}
    {matches.length>1&&<div className="rp-actions"><button type="button" className="rp-quiet" disabled={match===0} onClick={()=>setMatch(match-1)}>Coincidencia anterior</button><button type="button" className="rp-quiet" disabled={match===matches.length-1} onClick={()=>setMatch(match+1)}>Siguiente coincidencia</button></div>}
    {submitted&&<button type="button" className="rp-quiet" onClick={clearSearch}>Limpiar búsqueda</button>}
   </div>
   <pre aria-label="Texto del soporte">{documentText()}</pre>
   {insert&&doc.tokens.length>0&&<div className="rp-data-insert">
    <label>Dato para el borrador<select value={selected} onChange={event=>setSelected(event.target.value)}>{doc.tokens.map(item=><option key={item.token} value={item.token}>{item.label} · {item.value.slice(0,80)}</option>)}</select></label>
    <button type="button" className="secondary" onClick={()=>{const item=doc.tokens.find(d=>d.token===selected);if(item)insert(item);}}>Insertar marcador</button>
   </div>}
  </div>}
 </section>;
}

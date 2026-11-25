import {useEffect,useState} from 'react';
import {FileText} from 'lucide-react';
import {api} from './api';
import {locateDirectoryArticle} from './article-locator';

type Entry={article:string;page:number;repealed?:boolean;localUrl:string;passages:{page:number;endPage?:number;pageTexts?:{page:number;paragraphs:string[]}[];locator:string;text:string}[]};

export default function IntakeCustomsLaw({regulation=false,onAsk}:{regulation?:boolean;onAsk?:(article:string,topic:string)=>void}){
 const title=regulation?'Reglamento de la Ley Aduanera':'Ley Aduanera';
 const [entries,setEntries]=useState<Entry[]>([]);
 const [article,setArticle]=useState(regulation?'174':'97');
 const [error,setError]=useState(''),[searchError,setSearchError]=useState('');
 const [topic,setTopic]=useState('');
 const [articleQuery,setArticleQuery]=useState(''),[locatorNotice,setLocatorNotice]=useState('');
 function locate(){
  const result=locateDirectoryArticle(articleQuery,entries);
  if(result.status==='invalid'){setLocatorNotice('Escribe un número de artículo, por ejemplo 97 o 36-A.');return;}
  if(result.status==='missing'){setLocatorNotice('Artículo '+result.article+' no localizado en este índice. No se concluye que no exista en otra edición.');return;}
  setArticle(result.article);setLocatorNotice('Artículo '+result.article+' localizado en la copia local. Comprueba la edición aplicable.');
 }
 const [term,setTerm]=useState(''),[ids,setIds]=useState<string[]|null>(null),[busy,setBusy]=useState(false);
 async function search(){
  setSearchError('');
  if(!term.trim()){setIds(null);setTopic('');return;}
  setBusy(true);
  try{
   const found=await api<string[]>('intake.searchRegulation',{text:term.trim()});
   setIds(found);setTopic(term.trim());setArticle(found[0]??'');
  }catch(e){setSearchError(e instanceof Error?e.message:'La búsqueda local no se completó.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  let active=true;
  api<Entry[]>(regulation?'intake.regulationDirectory':'intake.customsDirectory',{}).then(rows=>{if(active)setEntries(rows);})
   .catch(()=>{if(active)setError('No se pudo verificar la copia local de esta fuente.');});
  return ()=>{active=false;};
 },[regulation]);
 const byId=new Map(entries.map(row=>[row.article,row]));
 const visible=ids===null?entries:ids.flatMap(id=>byId.get(id)??[]);
 const current=entries.find(item=>item.article===article);
 return <section className="rp-tariff rp-reveal" aria-labelledby="rp-customs-title">
  <h2 id="rp-customs-title">{title}</h2>
  <p>Consulta el inicio de cada artículo en el PDF de la Cámara de Diputados. {regulation?'La copia incorpora la reforma del 23 de febrero de 2026.':'Edición del 19 de noviembre de 2025 con cantidades actualizadas el 27 de diciembre de 2025.'}</p>
  {error?<p role="alert">{error}</p>:!entries.length?<p role="status">Leyendo el índice local…</p>:<>
   {!regulation&&<form className="rp-regulation-search" onSubmit={e=>{e.preventDefault();locate();}}>
    <label>Ir al artículo de la Ley Aduanera<input type="search" value={articleQuery} maxLength={60} onChange={e=>setArticleQuery(e.target.value)} placeholder="Ej. 97, 36-A o 15 bis"/></label>
    <button type="submit" className="rp-quiet">Localizar artículo</button>
    <small>Busca por número en el índice de esta copia. No busca palabras en el texto íntegro.</small>
    {locatorNotice&&<p role="status">{locatorNotice}</p>}
   </form>}
   {regulation&&<form className="rp-regulation-search" onSubmit={e=>{e.preventDefault();void search();}}>
    <label>Buscar en el Reglamento<input type="search" value={term} maxLength={180} disabled={busy} onChange={e=>setTerm(e.target.value)} placeholder="Tema, término o número de artículo"/></label>
    <div className="rp-actions"><button className="rp-quiet" disabled={busy} type="submit">Buscar artículos</button>
    {ids!==null&&<button type="button" className="rp-quiet" disabled={busy} onClick={()=>{setIds(null);setTopic('');setTerm('');if(!article)setArticle('174');}}>Ver todo el Reglamento</button>}</div>
    {ids!==null&&<p role="status">{ids.length?ids.length+' artículos con coincidencias.':'Sin coincidencias. Prueba otro término o el número de artículo.'}</p>}
    {searchError&&<p role="alert">{searchError}</p>}
   </form>}
   {visible.length>0&&<label>{regulation?'Artículo del Reglamento de la Ley Aduanera':'Artículo de la Ley Aduanera'}<select value={article} onChange={e=>setArticle(e.target.value)}>
    {visible.map(row=><option value={row.article} key={row.article}>{row.article.replaceAll('-BIS',' bis').replaceAll('-TER',' ter').replace(/(bis)-(\d+)/,'$1 $2')} · página {row.page}</option>)}
   </select></label>}
   {current&&<article key={article} className="rp-reveal"><h3>Artículo {article}</h3>{current.repealed&&<p>Derogado en esta edición.</p>}
    <a href={current.localUrl} target="_blank" rel="noreferrer"><FileText size={16}/>Abrir página {current.page} en la copia local</a>
    {current.passages.map(p=><details className="rp-details" key={p.locator}><summary>{p.locator} · {p.endPage?'pp. '+p.page+'–'+p.endPage:'p. '+p.page}</summary>{p.pageTexts?<div className="rp-regulation-text">{p.pageTexts.map(block=><section key={block.page} aria-label={'Página '+block.page}>
      <a href={current.localUrl.split('#')[0]+'#page='+block.page} target="_blank" rel="noreferrer">Página {block.page}</a>
      {block.paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>)}</div>:<p>{p.text}</p>}</details>)}
    {!current.passages.length&&<p>No hay pasajes cotejados para preparar una consulta de este artículo. Puedes abrir su página en la copia local.</p>}
    {onAsk&&current.passages.length>0&&<button className="rp-quiet" onClick={()=>onAsk(article,topic)}>Preparar consulta de este artículo</button>}
   </article>}
   {regulation?<p>Para aplicar el Reglamento, comprueba la fecha de la operación y los transitorios en el PDF local.</p>:<p>Para determinar la versión aplicable a la operación, consulta las fechas y los transitorios en el <a href="https://www.diputados.gob.mx/LeyesBiblio/ref/ladua.htm" target="_blank" rel="noreferrer">historial de reformas</a>.</p>}
  </>}
 </section>;
}

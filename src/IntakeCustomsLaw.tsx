import {useEffect,useState} from 'react';
import {FileText} from 'lucide-react';
import {api} from './api';

type Entry={article:string;page:number;localUrl:string;passages:{page:number;endPage?:number;locator:string;text:string}[]};

export default function IntakeCustomsLaw(){
 const [entries,setEntries]=useState<Entry[]>([]);
 const [article,setArticle]=useState('97');
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  api<Entry[]>('intake.customsDirectory',{}).then(rows=>{if(active)setEntries(rows);})
   .catch(()=>{if(active)setError('No se pudo verificar la copia local de la Ley Aduanera.');});
  return ()=>{active=false;};
 },[]);
 const current=entries.find(item=>item.article===article);
 return <section className="rp-tariff rp-reveal" aria-labelledby="rp-customs-title">
  <h2 id="rp-customs-title">Ley Aduanera</h2>
  <p>Consulta el inicio de cada artículo en el PDF de la Cámara de Diputados. Edición del 19 de noviembre de 2025 con cantidades actualizadas el 27 de diciembre de 2025.</p>
  {error?<p role="alert">{error}</p>:!entries.length?<p role="status">Leyendo el índice local…</p>:<>
   <label>Artículo de la Ley Aduanera<select value={article} onChange={e=>setArticle(e.target.value)}>
    {entries.map(row=><option value={row.article} key={row.article}>{row.article.replaceAll('-BIS',' bis').replaceAll('-TER',' ter').replace(/(bis)-(\d+)/,'$1 $2')} · página {row.page}</option>)}
   </select></label>
   {current&&<article key={article} className="rp-reveal"><h3>Artículo {article}</h3>
    <a href={current.localUrl} target="_blank" rel="noreferrer"><FileText size={16}/>Abrir página {current.page} en la copia local</a>
    {current.passages.map(p=><details className="rp-details" key={p.locator}><summary>{p.locator} · {p.endPage?'pp. '+p.page+'–'+p.endPage:'p. '+p.page}</summary><p>{p.text}</p></details>)}
   </article>}
   <p>Para determinar la versión aplicable a la operación, consulta las fechas y los transitorios en el <a href="https://www.diputados.gob.mx/LeyesBiblio/ref/ladua.htm" target="_blank" rel="noreferrer">historial de reformas</a>.</p>
  </>}
 </section>;
}

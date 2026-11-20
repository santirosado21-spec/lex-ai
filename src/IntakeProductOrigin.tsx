import {useEffect, useState} from 'react';
import {ArrowRight, FileText, Search} from 'lucide-react';
import {api} from './api';

type Link = {label:string; localUrl:string; page:number};
type Chapter = Link & {number:number; section:Link; rows:(Link & {footnote?:number; quote?:string})[]};
type Lookup = {groups:Chapter[]; chapters:{number:number;title:string}[]; references:Link[]; cocoa:{text:string}|null};
const question = '¿Qué documentos permiten distinguir la regla de origen específica de la regla general para la subpartida 1806.10 del Anexo 4-B del T-MEC?';

function SourceLink({item}:{item:Link}) {
  return <a href={item.localUrl} target="_blank" rel="noreferrer">{item.label} · p. {item.page}</a>;
}

export default function IntakeProductOrigin({initial='',onAsk}:{initial?:string;onAsk?:(text:string)=>void}) {
  const [query,setQuery] = useState(initial), [search,setSearch] = useState(initial);
  const [catalog,setCatalog] = useState<Lookup['chapters']>([]), [result,setResult] = useState<Lookup|null>(null);
  const [error,setError] = useState('');
  useEffect(()=>{
    const controller = new AbortController();
    setResult(null); setError('');
    api<Lookup>('intake.productOrigin',{query:search},controller.signal).then(data=>{
      if(controller.signal.aborted)return;
      setCatalog(data.chapters);
      setResult(data);
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error ? reason.message : 'No se pudo abrir el índice.');});
    return ()=>controller.abort();
  },[search]);

  return <section className="rp-tariff rp-origin-rules rp-reveal" aria-label="Reglas de origen por producto">
    <h2>Reglas de origen por producto</h2>
    <p>Anexo 4-B del T-MEC · DOF del 29 de junio de 2020</p>
    <form onSubmit={event=>{event.preventDefault();setSearch(query.trim());}}>
      <label>Mercancía, capítulo o código<input value={query} maxLength={120} onChange={event=>setQuery(event.target.value)} placeholder="Cacao, 18 o 1806.10"/></label>
      <button type="submit" className="rp-quiet"><Search size={16}/>Buscar en esta edición</button>
    </form>
    <label>Ir a un capítulo<select value={/^\d{1,2}$/.test(search)?Number(search):''} onChange={event=>{setQuery(event.target.value);setSearch(event.target.value);}}>
      <option value="">Elegir capítulo</option>{catalog.map(c=><option key={c.number} value={c.number}>{c.number} · {c.title}</option>)}
    </select></label>
    {error?<p role="alert">{error}</p>:!result?<p role="status">Abriendo el índice local…</p>:<>
      {search&&<div aria-live="polite">
        {!result.groups.length&&<p>Sin coincidencias en los títulos de los capítulos ni en los códigos de esta edición.</p>}
        {result.groups.map(group=><div className="rp-origin-group" key={group.number}>
          <h3>Capítulo {group.number} · {group.label}</h3>
          <p><SourceLink item={{...group,label:'Abrir el capítulo'}}/> · <SourceLink item={group.section}/></p>
          {group.rows.length?<ul className="rp-origin-codes">{group.rows.map(item=><li key={item.label+'/'+item.page}><SourceLink item={item}/>{item.footnote&&<small> · nota {item.footnote}</small>}
            {item.quote&&<details><summary>Leer renglón {item.label}</summary><p>{item.quote}</p>
              {onAsk&&<button type="button" className="rp-quiet" onClick={()=>onAsk('¿Qué documentos permiten cotejar el renglón '+item.label+' de la página '+item.page+' del Anexo 4-B del T-MEC?')}>Consultar {item.label}</button>}
            </details>}</li>)}</ul>:<p>Sin renglón localizado. Puedes cotejar el capítulo en el PDF.</p>}
        </div>)}
      </div>}
      {result.cocoa&&<div>
        <details className="rp-origin-provisions"><summary>Leer las disposiciones para 1806.10</summary>
          {result.cocoa.text.split('\n\n').map(block=>{
            const [heading,...lines]=block.split('\n');
            return <div key={heading}><h4>{heading}</h4>{lines.map(line=><p key={line}>{line}</p>)}</div>;
          })}
        </details>
        {onAsk&&<button type="button" className="rp-primary" onClick={()=>onAsk(question)}>Consultar la subpartida 1806.10<ArrowRight size={16}/></button>}
      </div>}
      <details><summary><FileText size={16}/>Notas y correspondencias de esta edición</summary>
        <ul>{result.references.map(item=><li key={item.page}><SourceLink item={item}/></li>)}</ul>
      </details>
      <small>Los códigos localizan renglones por partida o subpartida. Coteja la fracción nacional, las notas y las modificaciones aplicables en la fecha de la operación.</small>
    </>}
  </section>;
}

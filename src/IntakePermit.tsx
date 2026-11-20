import {useState,type FormEvent} from 'react';
import {BookmarkPlus,FileText,Search} from 'lucide-react';
import {api} from './api';

export type PermitSelection={code:string;agency:string;date:string;classification:string;regime:string};
type Edition={date:string;page:number;text:string;localUrl:string};
type Row=Edition&{code:string;agency:string;agencyName:string;later:boolean;prior:Edition|null};
type Results={rows:Row[];regimes:string[]};
type Preview={stage:string;detail:string;references:{id:string;title:string;url:string;localUrl?:string;locator:string}[]};

export default function IntakePermit({onSave}:{onSave?:(selection:PermitSelection)=>Promise<void>}){
 const [date,setDate]=useState(''),[query,setQuery]=useState('');
 const [found,setFound]=useState<Results|null>(null),[selected,setSelected]=useState<Row|null>(null);
 const [classification,setClassification]=useState(''),[regime,setRegime]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');
 const clear=()=>{setFound(null);setSelected(null);setPreview(null);setClassification('');setRegime('');setError('');};
 async function run(action:()=>Promise<void>){
  setPending(true);setError('');
  try{await action();}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar la edición.');}
  finally{setPending(false);}
 }
 function search(e:FormEvent){
  e.preventDefault();clear();void run(async()=>setFound(await api<Results>('intake.searchPermits',{date,query})));
 }
 const selection=(row:Row,c:string,r:string):PermitSelection=>({date,code:row.code,agency:row.agency,classification:c,regime:r});
 function inspect(row:Row,c='',r=''){
  setSelected(row);setClassification(c);setRegime(r);setPreview(null);
  void run(async()=>setPreview(await api<Preview>('intake.inspectPermit',selection(row,c,r))));
 }
 return <section className="rp-tariff rp-permit rp-reveal" aria-labelledby="rp-permit-title">
  <h2 id="rp-permit-title">Regulaciones y restricciones no arancelarias</h2>
  <p>Busca en el apéndice 9 del Anexo 22. Elige la autoridad que corresponde a tu operación. La captura cubre del 15 de enero al 19 de noviembre de 2026.</p>
  <form onSubmit={search}><label>Fecha de la operación<input type="date" required min="2026-01-15" max="2026-11-19" value={date} disabled={pending} onChange={e=>{clear();setDate(e.target.value);}}/></label>
   <label>Clave, autoridad o descripción<input placeholder="AL, C1 o certificado" value={query} maxLength={90} required disabled={pending} onChange={e=>{clear();setQuery(e.target.value);}}/></label>
   <button className="rp-primary" disabled={pending||!date||!query.trim()}><Search size={16}/>Buscar clave</button></form>
  {error&&<p role="alert">{error}</p>}
  {found&&<p role="status">{found.rows.length?found.rows.length+' coincidencia'+(found.rows.length===1?'':'s'):'Sin coincidencias en esta captura. Revisa otra descripción o la publicación del DOF.'}</p>}
  {found?.rows.map(row=><article key={row.agency+row.code}>
   <h3>{row.code}<small>{row.agencyName}</small></h3><p>{row.text}</p>
   <a href={row.localUrl} target="_blank" rel="noreferrer"><FileText size={15}/>{row.later?'Publicación posterior a la operación':'Publicación consultada'} · {row.date} · página {row.page}</a>
   {row.prior&&<details><summary>Comparar con la descripción anterior</summary><p>{row.prior.text}</p><a href={row.prior.localUrl} target="_blank" rel="noreferrer">PDF {row.prior.date} · página {row.prior.page}</a></details>}
   {selected!==row?<button type="button" className="rp-quiet" disabled={pending} onClick={()=>inspect(row)}>Revisar {row.agency} {row.code}</button>:<>
    {row.agency==='SE'&&(row.code==='AL'||(row.code==='C1'&&date>='2026-05-28'))&&<fieldset className="rp-sheet-fields" disabled={pending}><legend>{row.code==='AL'?'Alcance del aviso de aluminio':'Alcance para azúcar y preparaciones del numeral 8 TER'}</legend>
     <label>Fracción y NICO (10 dígitos)<input inputMode="numeric" maxLength={10} value={classification} onChange={e=>{setClassification(e.target.value);setPreview(null);}}/></label>
     <label>Régimen<select aria-label="Régimen" value={regime} onChange={e=>{setRegime(e.target.value);setPreview(null);}}><option value="">Por identificar</option>{found.regimes.map(r=><option key={r}>{r}</option>)}</select></label>
     <button className="rp-quiet" type="button" disabled={!!classification&&!/^\d{10}$/.test(classification)} onClick={()=>inspect(row,classification,regime)}>Cotejar alcance</button></fieldset>}
    {preview&&<div className="rp-permit-verdict rp-reveal"><p className="rp-permit-timing">{preview.stage}</p>{preview.detail.split('\n').filter(Boolean).map(line=><p key={line}>{line}</p>)}
     <details><summary>Fundamentos del cotejo</summary>{preview.references.map(r=><p key={r.id}><a href={r.localUrl??r.url} target="_blank" rel="noreferrer">{r.title} · {r.locator}</a></p>)}</details>
     {onSave&&<button className="rp-quiet" disabled={pending} onClick={()=>void run(()=>onSave(selection(row,classification,regime)))}><BookmarkPlus size={15}/>Guardar ficha del pedimento</button>}
    </div>}
   </>}
  </article>)}
 </section>;
}

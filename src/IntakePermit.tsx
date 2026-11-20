import {useId,useState,type FormEvent} from 'react';
import {BookmarkPlus,FileText,Search} from 'lucide-react';
import {api} from './api';

export type PermitSelection={code:string;agency:string;date:string;classification:string;regime:string;scope?:Scope;picks?:Pick[]};
type Scope='general'|'azucar';
type Field='date'|'query'|'classification'|'regime';
type Pick={field:Field;sourceId:string;line:number};
type Support={id:string;label:string;fields:{field:Field;value:string;line:number;endLine?:number}[]};
const labels:Record<Field,string>={date:'Fecha de operación',query:'Clave de permiso',classification:'Fracción y NICO',regime:'Régimen aduanero'};
export type PermitHint={date:string;query:string;classification:string;regime:string;sugar:boolean;supports:Support[]};
type Edition={date:string;page:number;text:string;localUrl:string};
type Row=Edition&{code:string;agency:string;agencyName:string;later:boolean;prior:Edition|null};
type Results={rows:Row[];regimes:string[]};
type Preview={stage:string;detail:string;references:{id:string;title:string;url:string;localUrl?:string;locator:string}[]};

export default function IntakePermit({onSave,hint,disabled=false}:{hint?:PermitHint;disabled?:boolean;onSave?:(selection:PermitSelection)=>Promise<void>}){
 const titleId=useId();
 const [date,setDate]=useState(hint?.date??''),[query,setQuery]=useState(hint?.query??'');
 const [scope,setScope]=useState<Scope>('general');
 const [found,setFound]=useState<Results|null>(null),[selected,setSelected]=useState<Row|null>(null);
 const [classification,setClassification]=useState(hint?.classification??''),[regime,setRegime]=useState(hint?.regime??'');
 const [picks,setPicks]=useState<Partial<Record<Field,Pick>>>({});
 const [preview,setPreview]=useState<Preview|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');
 const clear=()=>{setFound(null);setSelected(null);setPreview(null);setError('');};
 async function run(action:()=>Promise<void>){
  setPending(true);setError('');
  try{await action();}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar la edición.');}
  finally{setPending(false);}
 }
 function search(e:FormEvent){
  e.preventDefault();clear();void run(async()=>setFound(await api<Results>('intake.searchPermits',{date,query})));
 }
 const hasSugar=(row:Row)=>row.agency==='SE'&&row.code==='C1'&&date>='2026-05-28';
 const hasMaterial=(row:Row,choice:Scope)=>(row.agency==='SE'&&row.code==='AL')||(hasSugar(row)&&choice==='azucar');
 const selection=(row:Row,c:string,r:string,choice:Scope):PermitSelection=>({date,code:row.code,agency:row.agency,
  classification:hasMaterial(row,choice)?c:'',regime:hasMaterial(row,choice)?r:'',...(hasSugar(row)?{scope:choice}:{})});
 function inspect(row:Row,choice:Scope,c:string,r:string){
  setSelected(row);setScope(choice);setClassification(c);setRegime(r);setPreview(null);
  void run(async()=>setPreview(await api<Preview>('intake.inspectPermit',selection(row,c,r,choice))));
 }
 function change(field:Field,value:string,pick?:Pick){
  setPicks(prev=>({...prev,[field]:pick}));
  if(field==='date'||field==='query')clear();else if(selected&&hasMaterial(selected,scope))setPreview(null);
  ({date:setDate,query:setQuery,classification:setClassification,regime:setRegime})[field](value);
 }
 function chosen(row:Row){
  const data=selection(row,classification,regime,scope);
  const verified=Object.values(picks).filter((p):p is Pick=>!!p).filter(p=>{
   const stored=hint?.supports.find(s=>s.id===p.sourceId)?.fields.find(f=>f.field===p.field&&f.line===p.line);
   return stored?.value===(p.field==='query'?data.code:data[p.field]);
  });
  return verified.length?{...data,picks:verified}:data;
 }
 const blocked=disabled||pending;
 return <section className="rp-tariff rp-permit rp-reveal" aria-labelledby={titleId}>
  <h2 id={titleId}>{hint?'Cotejo del pedimento':'Regulaciones y restricciones no arancelarias'}</h2>
  <p>{hint?'Confirma la fecha de la operación y la clave. Puedes corregir los datos que Rejon encontró en la pregunta.':'Busca en el apéndice 9 del Anexo 22. Elige la autoridad que corresponde a tu operación. La captura cubre del 15 de enero al 19 de noviembre de 2026.'}</p>
  {!!hint?.supports.length&&<details className="rp-permit-support"><summary>Usar campos de los documentos del expediente</summary>
   <p>Elige la línea que corresponde a la operación. La ficha conservará el documento y el número de línea de los valores que uses.</p>
   {(Object.keys(labels) as Field[]).map(field=>{
    const options=hint.supports.flatMap(source=>source.fields.filter(f=>f.field===field).map(f=>({source,...f})));
    if(!options.length)return null;
    const pick=picks[field];
    const datesDiffer=field==='date'&&new Set(options.map(o=>o.value)).size>1;
    return <label key={field}>{labels[field]} del soporte{datesDiffer&&<small>Los soportes contienen fechas distintas. Comprueba qué operación ampara cada documento.</small>}<select aria-label={labels[field]+' del soporte'} disabled={blocked} value={pick?pick.sourceId+'/'+pick.line:''} onChange={e=>{
     const option=options.find(o=>o.source.id+'/'+o.line===e.target.value);
     if(option)change(field,option.value,{field,sourceId:option.source.id,line:option.line});else change(field,'');
    }}><option value="">Elegir una línea</option>{options.map(o=><option key={o.source.id+'/'+o.line} value={o.source.id+'/'+o.line}>{o.value} · {o.source.label} · {o.endLine?'líneas '+o.line+'–'+o.endLine:'línea '+o.line}</option>)}</select></label>;
   })}</details>}
  <form onSubmit={search}><label>Fecha de la operación<input type="date" required min="2026-01-15" max="2026-11-19" value={date} disabled={blocked} onChange={e=>change('date',e.target.value)}/></label>
   <label>Clave, autoridad o descripción<input placeholder="AL, C1 o certificado" value={query} maxLength={90} required disabled={blocked} onChange={e=>change('query',e.target.value)}/></label>
   <button className="rp-primary" disabled={blocked||!date||!query.trim()}><Search size={16}/>Buscar clave</button></form>
  {error&&<p role="alert">{error}</p>}
  {found&&<p role="status">{found.rows.length?found.rows.length+' coincidencia'+(found.rows.length===1?'':'s'):'Sin coincidencias en esta captura. Revisa otra descripción o la publicación del DOF.'}</p>}
  {found?.rows.map(row=><article key={row.agency+row.code}>
   <h3>{row.code}<small>{row.agencyName}</small></h3><p>{row.text}</p>
   <a href={row.localUrl} target="_blank" rel="noreferrer"><FileText size={15}/>{row.later?'Publicación posterior a la operación':'Publicación consultada'} · {row.date} · página {row.page}</a>
   {row.prior&&<details><summary>Comparar con la descripción anterior</summary><p>{row.prior.text}</p><a href={row.prior.localUrl} target="_blank" rel="noreferrer">PDF {row.prior.date} · página {row.prior.page}</a></details>}
   {selected!==row?<button type="button" className="rp-quiet" disabled={blocked} onClick={()=>inspect(row,'general',classification,regime)}>Revisar {row.agency} {row.code}</button>:<>
    {hasSugar(row)&&hint?.sugar&&scope==='general'&&<p>La pregunta menciona azúcar. Elige el numeral 8 TER para cotejar esa mercancía.</p>}
    {hasSugar(row)&&<label>Supuesto que quieres cotejar<select aria-label="Supuesto que quieres cotejar" value={scope} disabled={blocked} onChange={e=>inspect(row,e.target.value as Scope,classification,regime)}>
     <option value="general">Descripción general de C1 de Economía</option><option value="azucar">Azúcar y preparaciones del numeral 8 TER</option></select></label>}
    {hasMaterial(row,scope)&&<fieldset className="rp-sheet-fields" disabled={blocked}><legend>{row.code==='AL'?'Alcance del aviso de aluminio':'Alcance para azúcar y preparaciones del numeral 8 TER'}</legend>
     <label>Fracción y NICO (10 dígitos)<input inputMode="numeric" maxLength={10} value={classification} onChange={e=>change('classification',e.target.value)}/></label>
     <label>Régimen<select aria-label="Régimen" value={regime} onChange={e=>change('regime',e.target.value)}><option value="">Por identificar</option>{found.regimes.map(r=><option key={r}>{r}</option>)}</select></label>
     <button className="rp-quiet" type="button" disabled={!!classification&&!/^\d{10}$/.test(classification)} onClick={()=>inspect(row,scope,classification,regime)}>Cotejar alcance</button></fieldset>}
    {preview&&<div className="rp-permit-verdict rp-reveal"><p className="rp-permit-timing">{preview.stage}</p>{preview.detail.split('\n').filter(Boolean).map(line=><p key={line}>{line}</p>)}
     <details><summary>Fundamentos del cotejo</summary>{preview.references.map(r=><p key={r.id}><a href={r.localUrl??r.url} target="_blank" rel="noreferrer">{r.title} · {r.locator}</a></p>)}</details>
     {onSave&&<button className="rp-quiet" disabled={blocked} onClick={()=>void run(()=>onSave(chosen(row)))}><BookmarkPlus size={15}/>Guardar ficha del pedimento</button>}
    </div>}
   </>}
  </article>)}
 </section>;
}

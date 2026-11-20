import {useState} from 'react';
import {FileText} from 'lucide-react';
import type {CaseSource} from './IntakeSourceFiles';
import {api} from './api';

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
 async function load(id:string){
  setBusy(true);setError('');setDoc(null);setOriginal(false);setSelected('');
  try{const data=await api<StoredDocument>('intake.readDocument',id?{id}:{});setDoc(data);setSelected(data.tokens[0]?.token??'');setOpen(true);setSource(id);}
  catch{setError('El soporte guardado no se pudo verificar en este equipo.');}
  finally{setBusy(false);}
 }
 async function toggle(){
  if(open){setOpen(false);setOriginal(false);setDoc(null);setSelected('');return;}
  await load(sources[0]?.id??'');
 }
 return <section className="rp-case-document">
  <button type="button" className="rp-quiet" aria-expanded={open} disabled={busy} onClick={()=>void toggle()}><FileText size={16}/>{busy?'Abriendo soporte…':open?'Cerrar soporte':'Consultar soporte local'}</button>
  {error&&<p role="alert">{error}</p>}
  {open&&sources.length>1&&<label>Soporte que quieres leer<select value={source} disabled={busy} onChange={e=>void load(e.target.value)}>{sources.map((s,i)=><option value={s.id} key={s.id}>{i+1} · {s.label}</option>)}</select></label>}
  {open&&doc&&<div className="rp-private-review">
   <button type="button" className="secondary" aria-pressed={original} onClick={()=>setOriginal(!original)}>{original?'Ver sustituciones':'Ver texto restituido'}</button>
   <pre>{original?doc.original:doc.masked}</pre>
   {insert&&doc.tokens.length>0&&<div className="rp-data-insert">
    <label>Dato para el borrador<select value={selected} onChange={event=>setSelected(event.target.value)}>{doc.tokens.map(item=><option key={item.token} value={item.token}>{item.label} · {item.value.slice(0,80)}</option>)}</select></label>
    <button type="button" className="secondary" onClick={()=>{const item=doc.tokens.find(d=>d.token===selected);if(item)insert(item);}}>Insertar marcador</button>
   </div>}
  </div>}
 </section>;
}

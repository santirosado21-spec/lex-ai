import {useEffect,useState} from 'react';
import {ArrowRight,FileText} from 'lucide-react';
import {api} from './api';

type Elemento={point:number;label:string;text:string;locator:string;localUrl:string};
export default function IntakeOriginAnnex({onAsk}:{onAsk?:(point:number,label:string)=>void}){
 const [rows,setRows]=useState<Elemento[]>([]),[point,setPoint]=useState(1),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  api<Elemento[]>('intake.originAnnex',{},controller.signal).then(setRows).catch(e=>{
   if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No se pudo abrir el anexo.');
  });
  return ()=>controller.abort();
 },[]);
 const row=rows.find(item=>item.point===point);
 return <section className="rp-tariff rp-origin-annex rp-reveal" aria-label="Certificación de origen del T-MEC">
  <h2>Certificación de origen del T-MEC</h2>
  <p>Anexo 5-A · Elementos mínimos de información</p>
  {error?<p role="alert">{error}</p>:!row?<p role="status">Abriendo la edición local…</p>:<>
   <label>Elemento de la certificación<select value={point} onChange={event=>setPoint(Number(event.target.value))}>{rows.map(item=><option key={item.point} value={item.point}>{item.point}. {item.label}</option>)}</select></label>
   <figure><figcaption>{row.locator}</figcaption><blockquote>{row.text}</blockquote></figure>
   <div className="rp-actions"><a href={row.localUrl} target="_blank" rel="noreferrer"><FileText size={16}/>Abrir página en la copia local</a>
   {onAsk&&<button type="button" className="rp-primary" onClick={()=>onAsk(point,row.label)}>Consultar este numeral<ArrowRight size={16}/></button>}</div>
   <small>Para determinar el origen, coteja la regla del producto y las disposiciones aplicables en la fecha de la operación.</small>
  </>}
 </section>;
}

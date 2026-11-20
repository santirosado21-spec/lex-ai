import {useEffect,useState} from 'react';
import {BookmarkPlus,FileText} from 'lucide-react';
import {api} from './api';

type Point={number:number;label:string;locator:string;text:string;localUrl:string;url:string};
type Stage={sourceId:string;title:string;published:string;effective:string;summary:string;points:Point[]};
type Period={id:string;message:string};

export default function IntakeRemedy({onSave}:{onSave?:(sourceId:string,point:number,date?:string)=>Promise<void>}){
 const [stages,setStages]=useState<Stage[]>([]),[stageId,setStageId]=useState('');
 const [date,setDate]=useState(''),[period,setPeriod]=useState<Period|null>(null);
 const [point,setPoint]=useState<number|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{
  let active=true;
  api<Stage[]>('intake.remedyCatalog',{}).then(result=>{if(active){setStages(result);setStageId(result[0].sourceId);}})
   .catch(()=>{if(active)setError('No se pudieron leer las resoluciones del equipo.');});
  return ()=>{active=false;};
 },[]);
 useEffect(()=>{
  let active=true;
  if(date)api<Period>('intake.remedyPeriod',{date}).then(result=>{if(active)setPeriod(result);})
   .catch(()=>{if(active)setError('No se pudo cotejar la fecha.');});
  return ()=>{active=false;};
 },[date]);
 const stage=stages.find(s=>s.sourceId===stageId),passage=stage?.points.find(p=>p.number===point)??stage?.points[0];
 async function save(){
  if(!stage||!passage||!onSave)return;
  setPending(true);setError('');
  try{await onSave(stage.sourceId,passage.number,date||undefined);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el punto.');}
  finally{setPending(false);}
 }
 return <section className="rp-tariff rp-remedy rp-reveal" aria-labelledby="rp-remedy-title">
  <h2 id="rp-remedy-title">Defensa comercial</h2><h3>Perfiles y barras de aluminio de origen chino</h3>
  <p>Expediente AD_29-24 de la Secretaría de Economía. Compara las resoluciones y abre la página publicada en el Diario Oficial.</p>
  <label>Fecha de operación para comparar<input type="date" value={date} onChange={e=>{setDate(e.target.value);setPeriod(null);setError('');}}/></label>
  {period&&<p role="status" className="rp-permit-verdict">{period.message}</p>}
  <div className="rp-stage-list" role="group" aria-label="Etapas de la investigación">{stages.map(s=>
   <button type="button" key={s.sourceId} aria-pressed={stageId===s.sourceId} onClick={()=>{setStageId(s.sourceId);setPoint(null);}}><strong>{s.title}</strong><time dateTime={s.published}>{s.published}</time></button>)}</div>
  {stage&&passage&&<article key={stage.sourceId} className="rp-reveal"><h3>Resolución {stage.title==='Inicio'?'de inicio':stage.title.toLowerCase()}</h3>
   <p>Entrada en vigor según su transitorio · {stage.effective}</p>
   <label>Punto de la resolución<select value={passage.number} onChange={e=>setPoint(Number(e.target.value))}>{stage.points.map(p=><option key={p.number} value={p.number}>{p.number} · {p.label}</option>)}</select></label>
   <blockquote key={passage.number}>{passage.text}</blockquote>
   <a href={passage.localUrl} target="_blank" rel="noreferrer"><FileText size={15}/>{passage.locator}</a>
   <a href={passage.url} target="_blank" rel="noreferrer">Resolución completa en el DOF</a>
   {passage.number===3&&<p>Para un perfil hueco, consulta también el <a href="https://sidof.segob.gob.mx/notas/5750992" target="_blank" rel="noreferrer">inicio del expediente AD_28-24</a>.</p>}
   <p>{stage.summary}</p>{onSave&&<button type="button" className="rp-quiet" disabled={pending} onClick={()=>void save()}><BookmarkPlus size={15}/>Guardar punto en el expediente</button>}
  </article>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}

import {useEffect,useState} from 'react';
import {Activity,FlaskConical,RefreshCw} from 'lucide-react';
import {api} from './api';
import {fullDate} from './workspace-utils';
interface TrainingStatus {state:string;updatedAt?:string;progress?:{step:number;totalSteps:number};dataset?:Record<string,number>;evaluation?:{passed?:boolean};releaseStatus:string}
const labels:Record<string,string>={not_started:'Sin mejoras registradas',downloading:'Descargando componentes',preparing_data:'Preparando ejemplos',loading:'Preparando evaluación',baseline:'Evaluando la versión actual',training:'Preparando una mejora',evaluating:'Evaluando una mejora',completed:'Ciclo completado',failed:'El ciclo falló'};
const releases:Record<string,string>={'not-trained':'Sin preparar',experimental:'Experimental',rejected:'Rechazado',ready:'Listo'};
const datasets:Record<string,string>={train:'Ejemplos de preparación',validation:'Ejemplos de validación',test:'Ejemplos de prueba',laws:'Instrumentos jurídicos'};
export default function TrainingView(){
 const [status,setStatus]=useState<TrainingStatus|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const refresh=()=>{if(document.hidden)return;void api<TrainingStatus>('training.status').then(value=>{if(active){setStatus(value);setError('');}}).catch(()=>{if(active)setError('No se pudo consultar la evaluación de Rejon.AI. Inténtalo de nuevo más tarde.');});};refresh();const timer=setInterval(refresh,8000);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[]);
 const progress=status?.progress;
 const hasProgress=progress&&Number.isFinite(progress.step)&&Number.isFinite(progress.totalSteps)&&progress.totalSteps>0&&progress.step>=0&&progress.step<=progress.totalSteps;
 return <section className="page training-page"><div className="page-heading"><div><div className="eyebrow">Mejora supervisada</div><h1>Evaluación de Rejon.AI</h1><p>Seguimiento de las mejoras registradas en este equipo.</p></div><FlaskConical size={24}/></div>{error&&<div className="banner error" role="alert">{error}</div>}{!status?<p>Consultando estado…</p>:<>
  <div className="training-status"><Activity size={22}/><div><h2>{labels[status.state]||'Estado no disponible'}</h2><p>Las pruebas y la revisión determinan si una mejora puede incorporarse. Ninguna se activa automáticamente.</p><small>Último registro: {status.updatedAt?fullDate(status.updatedAt):'Sin fecha registrada'}</small></div><span className="badge">{releases[status.releaseStatus]||'Sin clasificación'}</span></div>
  {hasProgress&&<div className="training-progress"><label htmlFor="training-progress">Paso {progress.step} de {progress.totalSteps}</label><progress id="training-progress" value={progress.step} max={progress.totalSteps}/></div>}
  <div className="training-details"><section><h2>Contexto y habilidades</h2><p>Rejon.AI reúne las instrucciones de cada tarea, los documentos del asunto y las fuentes recuperadas para preparar una respuesta.</p><p>Las habilidades orientan el trabajo; las citas permiten contrastarlo con la evidencia.</p></section><section><h2>Datos de evaluación</h2>{Object.entries(datasets).some(([key])=>Number.isFinite(status.dataset?.[key]))?<dl>{Object.entries(datasets).map(([key,label])=>Number.isFinite(status.dataset?.[key])?<div key={key}><dt>{label}</dt><dd>{status.dataset![key].toLocaleString('es-MX')}</dd></div>:null)}</dl>:<p className="muted">Aún no hay un conjunto de evaluación registrado.</p>}</section></div>
  {status.evaluation&&<section className="training-evaluation"><h2>Resultado técnico</h2><p>{status.evaluation.passed===true?'Las comprobaciones técnicas registradas se superaron.':status.evaluation.passed===false?'La mejora no superó las comprobaciones técnicas registradas.':'No hay un resultado técnico concluyente registrado.'}</p><p>Este resultado no acredita exactitud jurídica ni sustituye la revisión profesional.</p></section>}
  <p className="scope-note"><RefreshCw size={15}/> Vista de solo lectura. Completar un ciclo no acredita calidad jurídica ni activa una mejora en el asistente.</p>
 </>}</section>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, ChevronDown, Clock3, Database, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, type SourceSyncEntry, type SourcesStatus } from './api';

const dateTime = (value?: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return 'Sin registro';
  return new Intl.DateTimeFormat('es-MX', {dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(value));
};
const sourceStateLabels: Record<string,string> = {
  downloaded:'Descargada', unchanged:'Sin cambios', failed:'Falló la consulta', error:'Falló la consulta',
  quarantined:'Requiere revisión', blocked:'Acceso bloqueado', pending:'Pendiente', skipped:'Omitida', downloading:'Descargando', fetching:'Consultando',
};
const monitorStateLabels: Record<string,string> = {
  unresponsive:'Sin señal reciente', running:'En ejecución', waiting:'En espera', sleeping:'En espera', idle:'En espera', stopped:'Detenido',
  error:'Con errores', failed:'Con errores', completed:'Ciclo terminado', starting:'Iniciando', paused:'Pausado',
};
const syncStateLabels: Record<string,string> = {
  running:'Consulta en curso', complete:'Consulta terminada', completed:'Consulta terminada', success:'Consulta terminada',
  partial:'Consulta parcial', partial_failure:'Consulta parcial', failed:'Consulta fallida', error:'Consulta fallida',
};
function isFailure(state?: string) { return ['failed','error','blocked'].includes(state || ''); }
function byteLabel(bytes?: number) {
  if (bytes == null) return 'Sin archivo';
  return new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(bytes/1024/1024)+' MB';
}
function SourceDetail({source}: {source:SourceSyncEntry}) {
  return <details className="source-monitor-detail"><summary>Detalles de la copia <ChevronDown size={13}/></summary><dl>
    <dt>Última consulta</dt><dd>{dateTime(source.checkedAt)}</dd>
    <dt>Última comprobación correcta</dt><dd>{dateTime(source.lastSuccessAt)}</dd>
    <dt>Revisión</dt><dd>{source.reviewStatus === 'approved' ? 'Aprobada para el corpus' : source.reviewStatus ? 'Pendiente de revisión editorial' : 'Sin revisión registrada'}</dd>
    <dt>Archivo</dt><dd>{byteLabel(source.bytes)}{source.httpStatus ? ` · HTTP ${source.httpStatus}` : ''}</dd>
    {source.versionId && <><dt>Versión de la copia</dt><dd className="technical-id">{source.versionId}</dd></>}
    {source.sha256 && <><dt>Huella SHA-256</dt><dd className="technical-id">{source.sha256}</dd></>}
  </dl></details>;
}
export default function SourcesView() {
  const [status,setStatus]=useState<SourcesStatus|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [readAt,setReadAt]=useState<string>();
  const [filter,setFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const alive=useRef(false);
  const pending=useRef(false);
  const load=useCallback(async()=>{
    if(pending.current)return;
    pending.current=true;
    try {
      const next=await api<SourcesStatus>('sources.status');
      if(alive.current){setStatus(next);setError('');setReadAt(new Date().toISOString());}
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'No se pudo leer el estado local de las fuentes.');}
    finally{pending.current=false;if(alive.current)setLoading(false);}
  },[]);
  useEffect(()=>{alive.current=true;void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},15_000);return()=>{alive.current=false;clearInterval(timer);};},[load]);
  const entries=status?.catalog.filter(entry=>{
    if(filter!=='all'&&entry.jurisdiction!==filter)return false;
    const record=status.sync?.sources.find(source=>source.id===entry.id);
    return statusFilter==='all'||(statusFilter==='review'&&record?.reviewStatus==='quarantined')||(statusFilter==='error'&&isFailure(record?.state))||(statusFilter==='pending'&&(!record||['pending','downloading','fetching'].includes(record.state)));
  })||[];
  const monitor=status?.monitor;
  const heartbeatOld=Boolean(monitor?.heartbeatAt && Date.now()-Date.parse(monitor.heartbeatAt)>120_000 && ['running','starting'].includes(monitor.state));
  return <section className="page sources-page">
    <div className="page-heading"><div><h1>Fuentes jurídicas</h1><p>Procedencia y estado de las copias oficiales almacenadas en este equipo.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Actualizar estado</button></div>
    <div className="sources-scope"><ShieldCheck size={17}/><p><strong>Una copia consultada no confirma vigencia.</strong> Los cambios descargados requieren revisión antes de incorporarse al corpus de análisis. Los documentos de tus asuntos permanecen locales.</p></div>
    {error && <div className="sources-error" role="alert"><AlertCircle size={16}/><p>{error}{status && <small>Se conserva el último estado leído; puede estar desactualizado.</small>}</p><button className="text-button" onClick={()=>void load()}>Reintentar lectura</button></div>}
    {loading ? <div className="empty-state"><RefreshCw size={25}/><h3>Leyendo el registro local…</h3></div> : status && <>
      <div className="source-overview">
        <section><div className="source-overview-title"><Database size={16}/><h2>Corpus disponible para análisis</h2></div><p><strong>{status.corpus.articles}</strong> fragmentos de <strong>{status.corpus.laws}</strong> leyes.</p><span>Este es el corpus incorporado, no el total de archivos descargados.</span></section>
        <section><div className="source-overview-title"><Clock3 size={16}/><h2>Monitor local</h2><span className={`monitor-badge ${heartbeatOld || monitor?.state==='unresponsive' || isFailure(monitor?.state)?'warning':''}`}>{monitor ? heartbeatOld?'Sin señal reciente':monitorStateLabels[monitor.state] || monitor.state : 'No configurado'}</span></div>
          {monitor ? <dl className="monitor-facts"><dt>Última señal</dt><dd>{dateTime(monitor.heartbeatAt)}</dd><dt>Próximo ciclo previsto</dt><dd>{monitor.nextRunAt?dateTime(monitor.nextRunAt):'Sin programación registrada'}</dd><dt>Ciclos completados</dt><dd>{monitor.cyclesCompleted ?? 0}{monitor.consecutiveFailures ? ` · ${monitor.consecutiveFailures} fallos consecutivos` : ''}</dd></dl> : <p className="muted">No hay un registro del monitor en este equipo. El corpus local disponible se puede seguir consultando.</p>}
        </section>
      </div>
      <div className="sync-summary"><div><h2>Última consulta de fuentes</h2><span>{status.sync ? syncStateLabels[status.sync.state] || status.sync.state : 'Sin consultas registradas'}</span></div>{status.sync ? <><p>Inicio: {dateTime(status.sync.startedAt)} <span>Final: {status.sync.finishedAt ? dateTime(status.sync.finishedAt) : 'No registrado'}</span></p><ul><li>{status.sync.summary.downloaded} descargadas</li><li>{status.sync.summary.unchanged} sin cambios</li><li className={status.sync.summary.failed?'warning-text':''}>{status.sync.summary.failed} fallidas</li><li className={status.sync.summary.quarantined?'warning-text':''}>{status.sync.summary.quarantined} por revisar</li></ul></> : <p>El supervisor todavía no ha escrito un resultado. No se presupone que las fuentes estén actualizadas.</p>}</div>
      <div className="source-list-heading"><h2>Catálogo de fuentes</h2><label>Jurisdicción<select aria-label="Filtrar fuentes por jurisdicción" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas</option><option value="MX-FED">Federal</option><option value="MX-CMX">Ciudad de México</option></select></label><span>{entries.length} fuentes</span></div>
      <div className="source-filter-tabs" aria-label="Filtrar por estado">{[{id:'all',label:'Todas'},{id:'review',label:'Pendientes de revisión'},{id:'error',label:'Con errores'},{id:'pending',label:'Sin completar'}].map(tab=><button key={tab.id} aria-pressed={statusFilter===tab.id} onClick={()=>setStatusFilter(tab.id)}>{tab.label}</button>)}</div>
      <div className="source-monitor-list">{entries.map(entry=>{
        const record=status.sync?.sources.find(source=>source.id===entry.id);
        const url=/^https:\/\//i.test(entry.url)?entry.url:undefined;
        return <article className="source-monitor-row" key={entry.id}>
          <BookOpen size={19}/><div className="source-monitor-main"><div className="source-monitor-heading"><h3>{entry.title}</h3><span className={`monitor-badge ${isFailure(record?.state)||record?.reviewStatus==='quarantined'?'warning':''}`}>{record ? record.reviewStatus==='quarantined'&&!isFailure(record.state)?'Pendiente de revisión':sourceStateLabels[record.state] || record.state : 'Sin consultar'}</span></div>
          <p>{entry.jurisdiction==='MX-FED'?'Federal':entry.jurisdiction==='MX-CMX'?'Ciudad de México':entry.jurisdiction}{url && <a href={url} target="_blank" rel="noopener noreferrer">Fuente oficial <ExternalLink size={12}/></a>}</p>
          {record&&<div className="source-row-meta"><span>Comprobada: {dateTime(record.checkedAt)}</span><span>{sourceStateLabels[record.state]||record.state}</span></div>}
          {record?.error && <p className="source-record-error">{record.error}</p>}
          {record ? <SourceDetail source={record}/> : <small>No hay evidencia de consulta para esta fuente.</small>}
          </div>
        </article>;
      })}{!entries.length && <div className="empty-state"><BookOpen size={25}/><h3>No hay fuentes en esta selección</h3><p>Prueba otra jurisdicción o revisa el catálogo configurado.</p></div>}</div>
    </>}
    <footer className="sources-footer"><span>Estado leído: {dateTime(readAt)}</span><span>Se consulta el registro local cada 15 segundos mientras esta vista está visible.</span><p>La aplicación no inicia descargas desde esta pantalla. El supervisor local consulta únicamente las fuentes públicas configuradas.</p></footer>
  </section>;
}

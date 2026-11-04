import {FormEvent, useEffect, useId, useMemo, useState} from 'react';
import {CircleStop, Clock3, Download, Pause, Play, RotateCcw, Save, TimerReset} from 'lucide-react';
import {api as defaultApi, downloadFile, type Matter} from './api';
import './workflow.css';

type ApiCall=<T=unknown>(action:string,payload?:unknown)=>Promise<T>;
type Timer={matterId:string;state:'running'|'paused';runningMinutes:number;stale:boolean;description:string;billable:boolean};
type Entry={id:string;matterId:string;matterTitle:string;client:string;description:string;durationMinutes:number;billedMinutes:number;amountCentavos:number;rateCentavos:number;currency:string;billingStatus:'unbilled'|'billed';createdAt:string;source:'timer'|'manual'};
type Arrangement={arrangement:'hourly'|'fixed'|'retainer'|'contingency'|'pro-bono';hourlyRateCentavos:number|null;contingencyBasisPoints:number|null;billingIncrementMinutes:1|6|15};
type Resolution={status:'abierto'|'en-espera'|'resuelto'|'archivado';outcome:'favorable'|'desfavorable'|'acuerdo'|'desistimiento'|'otro'|null;resolutionDate:string|null;notes:string|null};
type ReportRow={key:string;period:string;matterId:string|null;matterTitle:string|null;client:string;minutes:number;billableMinutes:number;amountCentavos:number;unbilledCentavos:number;billedCentavos:number;entryCount:number};
type Report={rows:ReportRow[];totals:{minutes:number;amountCentavos:number;unbilledCentavos:number;billedCentavos:number}};
type Stats={byStatus:Record<string,number>;byOutcome:Record<string,number>;averageDurationDays:number|null;pendingOpen:number;pendingTasks:number;pendingReminders:number};
type Exported={name:string;base64:string;mime:string};

const money=(centavos:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(centavos/100);
const hours=(minutes:number)=>`${Math.floor(minutes/60)} h ${minutes%60} min`;
const fmtDate=(value:string)=>new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(value));
const emptyReport:Report={rows:[],totals:{minutes:0,amountCentavos:0,unbilledCentavos:0,billedCentavos:0}};

export default function TimeBillingView({matter,matters=[],api=defaultApi}:{matter?:Matter;matters?:Matter[];api?:ApiCall}) {
  const titleId=useId(),descriptionId=useId(),minutesId=useId(),outcomeId=useId(),notesId=useId();
  const availableMatters=useMemo(()=>matters.length?matters:(matter?[matter]:[]),[matter,matters]);
  const [selectedMatterId,setSelectedMatterId]=useState(matter?.id??'');
  const [timer,setTimer]=useState<Timer|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [byMatter,setByMatter]=useState<Report>(emptyReport);
  const [byClient,setByClient]=useState<Report>(emptyReport);
  const [stats,setStats]=useState<Stats|null>(null);
  const [arrangement,setArrangement]=useState<Arrangement|null>(null);
  const [resolution,setResolution]=useState<Resolution|null>(null);
  const [description,setDescription]=useState('');
  const [minutes,setMinutes]=useState('6');
  const [billable,setBillable]=useState(true);
  const [outcome,setOutcome]=useState<NonNullable<Resolution['outcome']>>('otro');
  const [resolutionDate,setResolutionDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [notes,setNotes]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{setSelectedMatterId(matter?.id??'');},[matter?.id]);
  const selectedMatter=availableMatters.find(candidate=>candidate.id===selectedMatterId);
  async function load() {
    const base=await Promise.all([
      api<Timer|null>('time.active'),api<Entry[]>('time.list'),api<Report>('billing.report',{groupBy:'matter',range:'all'}),api<Report>('billing.report',{groupBy:'client',range:'all'}),api<Stats>('statistics.get'),
    ]);
    setTimer(base[0]);setEntries(base[1]);setByMatter(base[2]);setByClient(base[3]);setStats(base[4]);
    if(selectedMatterId){const [nextArrangement,nextResolution]=await Promise.all([api<Arrangement>('billing.arrangement.get',{matterId:selectedMatterId}),api<Resolution>('resolution.get',{matterId:selectedMatterId})]);setArrangement(nextArrangement);setResolution(nextResolution);}else{setArrangement(null);setResolution(null);}
  }
  useEffect(()=>{let live=true;setError('');void load().catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'No se pudieron cargar tiempo y honorarios.');});return ()=>{live=false;};},[selectedMatterId]);
  async function perform(label:string,work:()=>Promise<void>) {setBusy(label);setError('');try{await work();await load();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo actualizar el registro.');}finally{setBusy('');}}
  const requireMatter=()=>{if(!selectedMatterId)throw new Error('Selecciona un asunto antes de registrar tiempo.');return selectedMatterId;};
  function start(){void perform('start',async()=>{await api('time.start',{matterId:requireMatter(),description:description.trim(),billable});setNotice('Temporizador iniciado en este asunto.');});}
  function stop(){if(!timer)return;void perform('stop',async()=>{await api('time.stop',{matterId:timer.matterId,description:description.trim()||undefined});setDescription('');setNotice('Tiempo guardado como entrada sin cobrar.');});}
  function pauseOrResume(){if(!timer)return;void perform(timer.state==='running'?'pause':'resume',async()=>{await api(timer.state==='running'?'time.pause':'time.resume',{matterId:timer.matterId});});}
  function manual(event:FormEvent<HTMLFormElement>){event.preventDefault();void perform('manual',async()=>{await api('time.create',{matterId:requireMatter(),description:description.trim(),minutes:Number(minutes),billable});setDescription('');setMinutes('6');setNotice('Entrada manual guardada localmente.');});}
  function closeMatter(event:FormEvent<HTMLFormElement>){event.preventDefault();void perform('close',async()=>{await api('resolution.close',{matterId:requireMatter(),outcome,date:resolutionDate,notes:notes.trim()});setNotice('Resolución registrada. El cierre quedó en la bitácora del asunto.');});}
  function exportCsv(){void perform('export',async()=>{const file=await api<Exported>('billing.exportCsv',selectedMatterId?{matterId:selectedMatterId}:{});downloadFile(file);setNotice('Se preparó el CSV local.');});}
  function markBilled(){if(!selectedMatterId)return;const ids=entries.filter(entry=>entry.matterId===selectedMatterId&&entry.billingStatus==='unbilled').map(entry=>entry.id);if(!ids.length)return;void perform('billed',async()=>{await api('billing.markBilled',{matterId:selectedMatterId,entryIds:ids});setNotice('Las entradas pendientes se marcaron como cobradas.');});}

  return <section className="page time-billing-page" aria-labelledby={titleId}>
    <div className="page-heading"><div><h1 id={titleId}>Tiempo y honorarios</h1><p>Registra el trabajo por cliente y asunto con minutos y centavos exactos.</p></div><button className="secondary" type="button" onClick={exportCsv} disabled={Boolean(busy)}><Download size={15}/>Exportar CSV</button></div>
    <p role="note" className="tb-note">Este registro ayuda a administrar honorarios. No es una factura fiscal y no calcula CFDI ni IVA.</p>
    {error?<div role="alert" className="tb-error"><span>{error}</span><button className="text-button" type="button" onClick={()=>setError('')}>Cerrar</button></div>:null}
    <div className="summary-strip tb-stats" aria-label="Estadísticas de asuntos">
      <Stat label="Pendientes abiertos" value={stats?String(stats.pendingOpen):'—'} detail={stats?`${stats.pendingTasks} tareas · ${stats.pendingReminders} recordatorios`:''}/>
      <Stat label="Asuntos abiertos" value={stats?String(stats.byStatus.abierto):'—'} detail={stats?`${stats.byStatus['en-espera']} en espera`:''}/>
      <Stat label="Resueltos" value={stats?String(stats.byStatus.resuelto):'—'} detail={stats?`${stats.byOutcome.acuerdo} por acuerdo`:''}/>
      <Stat label="Duración media" value={stats?.averageDurationDays===null?'—':`${stats?.averageDurationDays} días`} detail="Apertura a resolución"/>
    </div>
    <div className="tb-work">
      <section className={`tb-timer${timer?` is-${timer.state}`:''}`} aria-labelledby={`${titleId}-timer`}>
        <div className="tb-timer-head"><h2 id={`${titleId}-timer`}>Temporizador</h2><span className="tb-timer-state"><span className="status-dot" aria-hidden="true"/>{timer?(timer.state==='running'?'En curso':'En pausa'):'Sin temporizador activo'}</span></div>
        <p className="tb-clock" aria-live="off"><Clock3 size={20} aria-hidden="true"/><span>{timer?hours(timer.runningMinutes):'0 h 00 min'}</span></p>
        <div className="tb-fields">
          <label>Asunto<select value={selectedMatterId} onChange={event=>setSelectedMatterId(event.target.value)} disabled={Boolean(timer)||Boolean(busy)}><option value="">Selecciona un asunto</option>{availableMatters.map(item=><option key={item.id} value={item.id}>{item.title} · {item.client}</option>)}</select></label>
          <label htmlFor={descriptionId}>Descripción breve<input id={descriptionId} value={description} onChange={event=>setDescription(event.target.value)} maxLength={600} placeholder="Ej. Revisión de estrategia"/></label>
        </div>
        {timer?.stale?<p role="alert" className="tb-warning">El temporizador supera 12 horas. Recupera o descarta el registro antes de continuar.</p>:null}
        <div className="button-row">{!timer?<button className="primary" type="button" onClick={start} disabled={!selectedMatterId||Boolean(busy)}><Play size={15}/>Iniciar</button>:<><button className="secondary" type="button" onClick={pauseOrResume} disabled={Boolean(busy)}>{timer.state==='running'?<Pause size={15}/>:<Play size={15}/>} {timer.state==='running'?'Pausar':'Reanudar'}</button><button className="primary" type="button" onClick={stop} disabled={Boolean(busy)||timer.stale}><CircleStop size={15}/>Detener y guardar</button>{timer.stale?<><button className="primary" type="button" onClick={()=>void perform('recover',async()=>{await api('time.recover',{matterId:timer.matterId,action:'stop'});})}><TimerReset size={15}/>Recuperar y guardar</button><button className="text-button" type="button" onClick={()=>void perform('discard',async()=>{await api('time.recover',{matterId:timer.matterId,action:'discard'});})}>Descartar</button></>:null}</>}</div>
      </section>
      <section className="tb-manual" aria-labelledby={`${titleId}-manual`}>
        <h2 id={`${titleId}-manual`}>Entrada manual</h2><p>Usa el asunto y la descripción de la izquierda. El importe se calcula con la tarifa vigente al guardar.</p>
        <form onSubmit={manual} className="tb-fields"><label htmlFor={minutesId}>Minutos<input id={minutesId} type="number" min="0" max="10080" step="1" required value={minutes} onChange={event=>setMinutes(event.target.value)}/></label><label className="tb-check"><input type="checkbox" checked={billable} onChange={event=>setBillable(event.target.checked)}/>Facturable</label><button className="secondary" type="submit" disabled={!selectedMatterId||!description.trim()||Boolean(busy)}><Save size={15}/>Guardar entrada</button></form>
      </section>
    </div>
    {selectedMatter?<section className="tb-section" aria-labelledby={`${titleId}-fee`}><div className="tb-section-head"><div><h2 id={`${titleId}-fee`}>Acuerdo y resolución de {selectedMatter.title}</h2><p>{arrangement?feeText(arrangement):'Cargando acuerdo…'}</p></div>{resolution?<span className="badge">{resolution.status}</span>:null}</div><div className="tb-fee-grid"><div><p className="tb-unbilled">Sin cobrar <strong>{money(byMatter.rows.find(row=>row.matterId===selectedMatter.id)?.unbilledCentavos??0)}</strong></p><button className="secondary" type="button" onClick={markBilled} disabled={Boolean(busy)}>Marcar pendientes como cobradas</button></div>{resolution?.status==='resuelto'?<div><strong>Resultado: {resolution.outcome}</strong><p className="tb-muted">{resolution.resolutionDate?fmtDate(resolution.resolutionDate):''}{resolution.notes?` · ${resolution.notes}`:''}</p><button className="text-button" type="button" onClick={()=>void perform('reopen',async()=>{await api('resolution.reopen',{matterId:selectedMatter.id});})} disabled={Boolean(busy)}><RotateCcw size={15}/>Reabrir asunto</button></div>:<form onSubmit={closeMatter} className="tb-fields"><h3>Resolver asunto</h3><label htmlFor={outcomeId}>Resultado<select id={outcomeId} value={outcome} onChange={event=>setOutcome(event.target.value as NonNullable<Resolution['outcome']>)}>{['favorable','desfavorable','acuerdo','desistimiento','otro'].map(item=><option key={item} value={item}>{item}</option>)}</select></label><label>Fecha<input type="date" value={resolutionDate} onChange={event=>setResolutionDate(event.target.value)} required/></label><label htmlFor={notesId}>Notas (opcionales)<textarea id={notesId} value={notes} onChange={event=>setNotes(event.target.value)} maxLength={2000} rows={2}/></label><div><button className="primary" type="submit" disabled={Boolean(busy)}>Registrar resolución</button></div></form>}</div></section>:null}
    <section className="tb-section" aria-labelledby={`${titleId}-matter-totals`}><div className="tb-section-head"><div><h2 id={`${titleId}-matter-totals`}>Totales por asunto</h2><p>{hours(byMatter.totals.minutes)} registrados · {money(byMatter.totals.amountCentavos)} facturables</p></div></div><TotalsTable rows={byMatter.rows} label="Totales por asunto" primary="matterTitle"/></section>
    <section className="tb-section" aria-labelledby={`${titleId}-client-totals`}><div className="tb-section-head"><div><h2 id={`${titleId}-client-totals`}>Totales por cliente</h2><p>Incluye tiempo facturable, cobrado y pendiente.</p></div></div><TotalsTable rows={byClient.rows} label="Totales por cliente" primary="client"/></section>
    <section className="tb-section" aria-labelledby={`${titleId}-entries`}><div className="tb-section-head"><div><h2 id={`${titleId}-entries`}>Entradas recientes</h2><p>{notice||'Solo se muestran registros de tiempo; el texto de documentos nunca se incorpora aquí.'}</p></div></div><div className="tb-table"><table><thead><tr><th>Fecha</th><th>Asunto</th><th>Descripción</th><th className="num">Tiempo</th><th className="num">Importe</th><th>Estado</th></tr></thead><tbody>{entries.slice(0,50).map(entry=><tr key={entry.id}><td>{fmtDate(entry.createdAt)}</td><td>{entry.matterTitle}</td><td>{entry.description}</td><td className="num">{hours(entry.durationMinutes)}</td><td className="num">{money(entry.amountCentavos)}</td><td>{entry.billingStatus==='billed'?'Cobrado':'Sin cobrar'}</td></tr>)}</tbody></table>{!entries.length?<p className="tb-muted">Aún no hay entradas de tiempo.</p>:null}</div></section>
  </section>;
}

function Stat({label,value,detail}:{label:string;value:string;detail:string}) {return <div className="tb-stat"><span className="tb-stat-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>;}
function TotalsTable({rows,label,primary}:{rows:ReportRow[];label:string;primary:'matterTitle'|'client'}) {return <div className="tb-table"><table aria-label={label}><thead><tr><th>{primary==='client'?'Cliente':'Asunto'}</th><th className="num">Tiempo</th><th className="num">Facturable</th><th className="num">Sin cobrar</th><th className="num">Cobrado</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td>{row[primary]??'—'}</td><td className="num">{hours(row.minutes)}</td><td className="num">{money(row.amountCentavos)}</td><td className="num">{money(row.unbilledCentavos)}</td><td className="num">{money(row.billedCentavos)}</td></tr>)}</tbody></table>{!rows.length?<p className="tb-muted">Sin tiempo registrado.</p>:null}</div>;}
function feeText(arrangement:Arrangement) {if(arrangement.arrangement==='hourly')return `Por hora · ${arrangement.hourlyRateCentavos===null?'usa tarifa predeterminada del cliente':money(arrangement.hourlyRateCentavos)} · redondeo a ${arrangement.billingIncrementMinutes} min.`;if(arrangement.arrangement==='contingency')return `Porcentaje de contingencia · ${(arrangement.contingencyBasisPoints??0)/100}%`;return arrangement.arrangement==='pro-bono'?'Pro bono':'Acuerdo sin cálculo automático por hora';}

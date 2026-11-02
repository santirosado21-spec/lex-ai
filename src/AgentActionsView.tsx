import {Check, ChevronDown, ChevronUp, Clock3, FileText, ShieldCheck, X} from 'lucide-react';
import {useEffect, useId, useMemo, useState} from 'react';
import {api, type Matter} from './api';

type AgentProposal={id:string;matterId:string|null;action:string;args:Record<string,unknown>;argsHash:string;origin:'agent'|'user';status:string;createdAt:string;expiresAt:string};
type AgentLog={proposalId?:string;matterId:string|null;origin:'agent'|'user';action:string;argsHash:string;decision:string;createdAt:string};

const actionLabels:Record<string,string>={
  'reminder.create':'Crear recordatorio',
  'matter.create':'Crear asunto',
  'document.import':'Importar documento',
  'answer.export':'Generar documento DOCX',
  'planner.propose':'Preparar sugerencias de pendientes',
};
const decisionLabels:Record<string,string>={pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada',expired:'Caducada','auto-allowed':'Permitida automáticamente'};
const dateTime=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'});

function actionLabel(action:string){return actionLabels[action] || action;}
function originLabel(origin:string){return origin==='agent'?'Agente':'Persona';}
function formatBytes(value:unknown){
  if(typeof value!=='number'||!Number.isFinite(value))return 'Tamaño no disponible';
  if(value<1024)return `${value} bytes`;
  return `${new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(value/1024)} KB`;
}
function argumentSummary(proposal:AgentProposal){
  const args=proposal.args;
  switch(proposal.action) {
    case 'reminder.create':return <><strong>{String(args.title || 'Recordatorio')}</strong>{args.dueAt?<span> · {String(args.dueAt)}</span>:null}</>;
    case 'matter.create':return <><strong>{String(args.title || 'Asunto')}</strong>{args.client?<span> · {String(args.client)}</span>:null}</>;
    case 'document.import':return <><strong>{String(args.name || 'Documento')}</strong><span> · {formatBytes(args.contentBytes)} · SHA-256 {String(args.contentSha256 || '').slice(0,12) || '—'}</span></>;
    case 'answer.export':return <>Se generará un archivo DOCX de la respuesta seleccionada.</>;
    case 'planner.propose':return <>Se prepararán sugerencias de pendientes para este asunto.</>;
    default:return <>Argumentos registrados con hash {proposal.argsHash.slice(0,12)}.</>;
  }
}
function confirmationText(proposal:AgentProposal){
  switch(proposal.action) {
    case 'reminder.create':return `Se creará el recordatorio “${String(proposal.args.title || 'sin título')}” en este asunto.`;
    case 'matter.create':return `Se creará el asunto “${String(proposal.args.title || 'sin título')}” en este equipo.`;
    case 'document.import':return `Se importará “${String(proposal.args.name || 'el documento')}” en este asunto.`;
    case 'answer.export':return 'Se generará un archivo DOCX de la respuesta seleccionada.';
    case 'planner.propose':return 'Se crearán sugerencias de pendientes para este asunto.';
    default:return `Se ejecutará la acción propuesta: ${actionLabel(proposal.action)}.`;
  }
}
function remainingLabel(expiresAt:string,now:number){
  const seconds=Math.ceil((new Date(expiresAt).getTime()-now)/1000);
  if(!Number.isFinite(seconds)||seconds<=0)return {expired:true,label:'Caducada'};
  if(seconds<60)return {expired:false,label:`Caduca en ${seconds} s`};
  const minutes=Math.ceil(seconds/60);
  if(minutes<60)return {expired:false,label:`Caduca en ${minutes} min`};
  return {expired:false,label:`Caduca en ${Math.ceil(minutes/60)} h`};
}

export default function AgentActionsView({matter,onRefresh}:{matter?:Matter;onRefresh:()=>Promise<unknown>}) {
  const titleId=useId();
  const [proposals,setProposals]=useState<AgentProposal[]>([]);
  const [entries,setEntries]=useState<AgentLog[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const [confirming,setConfirming]=useState<AgentProposal|null>(null);
  const [logOpen,setLogOpen]=useState(false);
  const [now,setNow]=useState(Date.now());

  const scope=useMemo(()=>({
    proposal:(item:AgentProposal)=>item.matterId===null||item.matterId===undefined||item.matterId===matter?.id,
    log:(item:AgentLog)=>item.matterId===null||item.matterId===undefined||item.matterId===matter?.id,
  }),[matter?.id]);
  async function reload(){
    const [nextProposals,nextEntries]=await Promise.all([api<AgentProposal[]>('agent.pending',{}),api<AgentLog[]>('agent.log',{limit:30})]);
    setProposals(nextProposals.filter(scope.proposal));setEntries(nextEntries.filter(scope.log));
  }
  useEffect(()=>{let current=true;setLoading(true);setError('');setNotice('');void reload().catch(reason=>{if(current)setError(reason instanceof Error?reason.message:'No se pudieron cargar las acciones propuestas.');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[scope]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);

  async function decide(proposal:AgentProposal,decision:'approve'|'reject'){
    setBusy(`${decision}-${proposal.id}`);setError('');setNotice('');
    try {
      await api(`agent.${decision}`,{proposalId:proposal.id});
      await reload();
      if(decision==='approve') {await onRefresh();setNotice('Acción aprobada y actualizada en este equipo.');}
      else setNotice('Propuesta rechazada. No se ejecutó ninguna acción.');
    } catch(reason) {setError(reason instanceof Error?reason.message:'No se pudo actualizar la propuesta.');}
    finally {setBusy('');setConfirming(null);}
  }

  return <section className="page agent-actions-page" aria-labelledby={titleId}>
    <div className="page-heading agent-actions-heading"><div><p className="eyebrow">Revisión humana</p><h1 id={titleId}>Acciones propuestas</h1><p>{matter?`Propuestas para ${matter.title} y para el despacho.`:'Propuestas del despacho.'}</p></div><ShieldCheck size={28} aria-hidden="true"/></div>
    <p className="agent-actions-note"><ShieldCheck size={16}/>El agente solo puede proponer. Nada se ejecuta sin tu aprobación y todo ocurre en este equipo.</p>
    {loading?<p className="agent-actions-loading" role="status">Cargando acciones propuestas…</p>:null}
    {error?<div className="agent-actions-error" role="alert"><span>{error}</span><button className="text-button" type="button" onClick={()=>setError('')}>Cerrar</button></div>:null}
    {notice?<p className="agent-actions-notice" role="status"><Check size={16}/>{notice}</p>:null}

    <section aria-labelledby={`${titleId}-list`}>
      <div className="section-heading"><div><h2 id={`${titleId}-list`}>Por revisar</h2><p>Las propuestas caducan si no se aprueban a tiempo.</p></div><span>{proposals.length}</span></div>
      {!loading&&!proposals.length?<p className="agent-actions-empty">No hay acciones propuestas para revisar.</p>:null}
      <div className="agent-actions-list">{proposals.map(proposal=>{
        const expiry=remainingLabel(proposal.expiresAt,now);const disabled=expiry.expired||Boolean(busy);
        return <article className={`agent-action-card ${expiry.expired?'expired':''}`} key={proposal.id}>
          <div className="agent-action-main"><div className="agent-action-meta"><span className={`agent-origin ${proposal.origin==='agent'?'agent':''}`}>{originLabel(proposal.origin)}</span><span><Clock3 size={13}/>{expiry.label}</span>{proposal.matterId===null?<span>Despacho</span>:null}</div><h3>{actionLabel(proposal.action)}</h3><p className="agent-arguments">{argumentSummary(proposal)}</p><small>Propuesta {dateTime.format(new Date(proposal.createdAt))}</small></div>
          <div className="agent-action-buttons">{expiry.expired?<span className="agent-expired-label">Caducada</span>:<><button className="secondary" type="button" disabled={disabled} onClick={()=>setConfirming(proposal)}>Aprobar</button><button className="text-button" type="button" disabled={disabled} onClick={()=>void decide(proposal,'reject')}>Rechazar</button></>}</div>
        </article>;
      })}</div>
    </section>

    <section className="agent-log" aria-labelledby={`${titleId}-log`}>
      <button className="agent-log-trigger" type="button" aria-expanded={logOpen} aria-controls={`${titleId}-log-panel`} onClick={()=>setLogOpen(open=>!open)}><span><h2 id={`${titleId}-log`}>Bitácora</h2><small>Decisiones y propuestas recientes</small></span>{logOpen?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
      <div id={`${titleId}-log-panel`} hidden={!logOpen}>{entries.length?<ol className="agent-log-list">{entries.map((entry,index)=><li key={`${entry.proposalId || entry.argsHash}-${entry.createdAt}-${index}`}><div><strong>{actionLabel(entry.action)}</strong><span className={`agent-origin ${entry.origin==='agent'?'agent':''}`}>{originLabel(entry.origin)}</span></div><p>{decisionLabels[entry.decision] || entry.decision} · {dateTime.format(new Date(entry.createdAt))}</p><small>Hash de argumentos: {entry.argsHash.slice(0,12)}</small></li>)}</ol>:<p className="agent-actions-empty">Aún no hay entradas para este ámbito.</p>}</div>
    </section>

    {confirming&&<div className="agent-confirm-backdrop" role="presentation"><section className="agent-confirm" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-confirm-title`}><div className="agent-confirm-heading"><h2 id={`${titleId}-confirm-title`}>Confirmar aprobación</h2><button className="icon-button" type="button" aria-label="Cerrar confirmación" onClick={()=>setConfirming(null)} disabled={Boolean(busy)}><X size={18}/></button></div><p>{confirmationText(confirming)}</p><p className="muted small">Esta acción se ejecutará localmente al confirmar.</p><div className="button-row"><button className="secondary" type="button" onClick={()=>setConfirming(null)} disabled={Boolean(busy)}>Cancelar</button><button className="primary" type="button" onClick={()=>void decide(confirming,'approve')} disabled={Boolean(busy)}>Confirmar aprobación</button></div></section></div>}
  </section>;
}

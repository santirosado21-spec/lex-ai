import {CalendarDays, Check, Lightbulb, Plus, Trash2} from 'lucide-react';
import {useEffect, useId, useState, type FormEvent, type ReactNode} from 'react';
import {api, type Matter} from './api';

type ReminderKind = 'deadline'|'followup'|'draft-suggestion';
interface Reminder {
  id:string;
  matterId:string;
  kind:ReminderKind;
  title:string;
  dueAt:string|null;
  note:string;
}
interface Buckets {overdue:Reminder[]; dueToday:Reminder[]; dueIn7Days:Reminder[]}

const emptyBuckets:Buckets={overdue:[],dueToday:[],dueIn7Days:[]};
const kindLabel:Record<ReminderKind,string>={deadline:'Fecha límite',followup:'Seguimiento','draft-suggestion':'Sugerencia de escrito'};
const dueLabel=(value:string|null)=>value?new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(`${value.slice(0,10)}T12:00:00`)):'Sin fecha';

export default function PendingView({matter}:{matter:Matter}) {
  const titleId=useId();
  const [buckets,setBuckets]=useState<Buckets>(emptyBuckets);
  const [proposed,setProposed]=useState<Reminder[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [title,setTitle]=useState('');
  const [kind,setKind]=useState<'deadline'|'followup'>('deadline');
  const [dueAt,setDueAt]=useState('');
  const [note,setNote]=useState('');

  async function reload() {
    const [today,suggestions]=await Promise.all([
      api<Buckets>('planner.today',{matterId:matter.id}),
      api<Reminder[]>('reminder.list',{matterId:matter.id,status:'proposed'}),
    ]);
    setBuckets(today);setProposed(suggestions);
  }
  useEffect(()=>{
    let current=true;
    setLoading(true);setError('');setBuckets(emptyBuckets);setProposed([]);
    void reload().catch(reason=>{if(current)setError(reason instanceof Error?reason.message:'No se pudieron cargar los pendientes.');}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[matter.id]);
  async function perform(label:string,work:()=>Promise<void>) {
    setBusy(label);setError('');
    try {await work();await reload();}
    catch(reason) {setError(reason instanceof Error?reason.message:'No se pudo actualizar el pendiente.');}
    finally {setBusy('');}
  }
  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform('create',async()=>{await api('reminder.create',{matterId:matter.id,kind,title:title.trim(),dueAt,note:note.trim()});setTitle('');setDueAt('');setNote('');});
  }
  const update=(id:string,status:'approved'|'done'|'dismissed')=>perform(`${status}-${id}`,async()=>{await api('reminder.update',{matterId:matter.id,reminderId:id,status});});
  const propose=()=>perform('propose',async()=>{await api('planner.propose',{matterId:matter.id});});
  const activeCount=buckets.overdue.length+buckets.dueToday.length+buckets.dueIn7Days.length;

  return <section className="page pending-page" aria-labelledby={titleId}>
    <div className="page-heading pending-heading"><div><p className="eyebrow">Expediente activo</p><h1 id={titleId}>Pendientes</h1><p>Recordatorios organizativos de {matter.title}.</p></div><button className="secondary" type="button" onClick={()=>void propose()} disabled={Boolean(busy)}><Lightbulb size={16}/>{busy==='propose'?'Revisando…':'Revisar pendientes'}</button></div>
    {loading?<p className="pending-loading" role="status">Cargando pendientes…</p>:null}
    {error?<div className="pending-error" role="alert"><span>{error}</span><button className="text-button" type="button" onClick={()=>setError('')}>Cerrar</button></div>:null}

    <section className="pending-suggestions" aria-labelledby={`${titleId}-suggestions`}>
      <div className="section-heading"><div><h2 id={`${titleId}-suggestions`}>Sugerencias de Rejon.AI</h2><p>Estas sugerencias permanecen en este equipo; nada se envía fuera de esta computadora.</p></div><span>{proposed.length}</span></div>
      {proposed.length?<div className="pending-list">{proposed.map(item=><ReminderCard key={item.id} item={item} matter={matter} actions={<><button className="secondary" type="button" disabled={Boolean(busy)} onClick={()=>void update(item.id,'approved')}>Aprobar</button><button className="text-button" type="button" disabled={Boolean(busy)} onClick={()=>void update(item.id,'dismissed')}>Descartar</button></>}/>)}</div>:<p className="pending-empty">No hay sugerencias por revisar. Puedes revisar pendientes cuando quieras; las sugerencias requieren aprobación explícita.</p>}
    </section>

    <section className="pending-buckets" aria-label="Pendientes por fecha">
      <PendingBucket title="Atrasados" items={buckets.overdue} matter={matter} busy={Boolean(busy)} onUpdate={update}/>
      <PendingBucket title="Hoy" items={buckets.dueToday} matter={matter} busy={Boolean(busy)} onUpdate={update}/>
      <PendingBucket title="Próximos 7 días" items={buckets.dueIn7Days} matter={matter} busy={Boolean(busy)} onUpdate={update}/>
    </section>
    {!loading&&!activeCount?<p className="pending-all-clear">No hay pendientes con fecha en este asunto.</p>:null}

    <section className="pending-create" aria-labelledby={`${titleId}-create`}>
      <div><h2 id={`${titleId}-create`}>Agregar pendiente</h2><p>Registra una fecha límite o un seguimiento que hayas determinado.</p></div>
      <form onSubmit={event=>void create(event)}>
        <label htmlFor="pending-title">Pendiente</label><input id="pending-title" value={title} onChange={event=>setTitle(event.target.value)} maxLength={200} required placeholder="Preparar respuesta"/>
        <div className="pending-form-row"><div><label htmlFor="pending-kind">Tipo</label><select id="pending-kind" value={kind} onChange={event=>setKind(event.target.value as 'deadline'|'followup')}><option value="deadline">Fecha límite</option><option value="followup">Seguimiento</option></select></div><div><label htmlFor="pending-date">Fecha</label><input id="pending-date" type="date" value={dueAt} onChange={event=>setDueAt(event.target.value)} required/></div></div>
        <label htmlFor="pending-note">Nota opcional</label><textarea id="pending-note" value={note} onChange={event=>setNote(event.target.value)} maxLength={3600} rows={3} placeholder="Contexto para tu seguimiento"/>
        <p className="pending-legal-note">Rejon.AI no calcula términos legales; captura la fecha que tú determines.</p>
        <button className="primary" type="submit" disabled={Boolean(busy)||!title.trim()||!dueAt}><Plus size={16}/>{busy==='create'?'Guardando…':'Agregar pendiente'}</button>
      </form>
    </section>
  </section>;
}

function PendingBucket({title,items,matter,busy,onUpdate}:{title:string;items:Reminder[];matter:Matter;busy:boolean;onUpdate:(id:string,status:'done'|'dismissed')=>Promise<void>}) {
  return <section className="pending-bucket"><div className="section-heading"><h2>{title}</h2><span>{items.length}</span></div>{items.length?<div className="pending-list">{items.map(item=><ReminderCard key={item.id} item={item} matter={matter} actions={<><button className="secondary" type="button" disabled={busy} onClick={()=>void onUpdate(item.id,'done')}><Check size={15}/>Completar</button><button className="text-button" type="button" disabled={busy} onClick={()=>void onUpdate(item.id,'dismissed')}><Trash2 size={15}/>Descartar</button></>}/>)}</div>:<p className="pending-empty">No hay pendientes en este periodo.</p>}</section>;
}

function ReminderCard({item,matter,actions}:{item:Reminder;matter:Matter;actions:ReactNode}) {
  return <article className="pending-card"><div className="pending-card-main"><div className="pending-card-labels"><span>{kindLabel[item.kind]}</span><span><CalendarDays size={13}/>{dueLabel(item.dueAt)}</span></div><h3>{item.title}</h3>{item.note?<p>{item.note}</p>:null}<small>Asunto: {matter.title}</small></div><div className="pending-actions">{actions}</div></article>;
}

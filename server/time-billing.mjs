import { randomUUID } from 'node:crypto';

export const CURRENCY='MXN';
export const BILLING_INCREMENTS=[1,6,15];
export const STALE_TIMER_MS=12*60*60*1000;

const identifiers=/^[a-zA-Z0-9-]{1,100}$/;
const statuses=['abierto','en-espera','resuelto','archivado'];
const outcomes=['favorable','desfavorable','acuerdo','desistimiento','otro'];
const arrangements=['hourly','fixed','retainer','contingency','pro-bono'];

export function roundHalfUp(numerator,denominator) {
  if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||numerator<0||denominator<=0)throw new Error('No se puede redondear este importe.');
  return Math.floor((numerator+Math.floor(denominator/2))/denominator);
}

/** Rounds an integer number of minutes to an allowed billing increment. */
export function roundBillingMinutes(minutes,increment) {
  if(!Number.isSafeInteger(minutes)||minutes<0||!BILLING_INCREMENTS.includes(increment))throw new Error('Minutos o incremento de facturación inválidos.');
  return roundHalfUp(minutes,increment)*increment;
}

/** Uses integer centavos only. The half-cent, if any, rounds up. */
export function amountCentavos(minutes,rateCentavos) {
  if(!Number.isSafeInteger(minutes)||minutes<0||!Number.isSafeInteger(rateCentavos)||rateCentavos<0)throw new Error('Minutos o tarifa inválidos.');
  return roundHalfUp(minutes*rateCentavos,60);
}

export function elapsedWholeMinutes(start,end) {
  const startMs=instant(start).getTime(),endMs=instant(end).getTime();
  if(endMs<startMs)throw new Error('El temporizador no puede terminar antes de iniciar.');
  return roundHalfUp(endMs-startMs,60_000);
}

export function csvSafeCell(value) {
  const raw=String(value??'');
  const safe=/^[=+\-@]/.test(raw)?`'${raw}`:raw;
  return /[",\r\n]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;
}

export function toCsv(rows) {
  const columns=['Fecha','Asunto','Cliente','Descripción','Minutos','Minutos facturables','Tarifa (centavos)','Importe (centavos)','Moneda','Cobro'];
  const body=rows.map(row=>[
    row.createdAt.slice(0,10),row.matterTitle,row.client,row.description,row.durationMinutes,row.billedMinutes,row.rateCentavos,row.amountCentavos,row.currency,row.billingStatus,
  ].map(csvSafeCell).join(','));
  return `\ufeff${[columns.map(csvSafeCell).join(','),...body].join('\r\n')}\r\n`;
}

function instant(value) {
  const date=value instanceof Date?new Date(value.getTime()):new Date(value);
  if(Number.isNaN(date.getTime()))throw new Error('Fecha y hora inválida.');
  return date;
}
function stamp(clock){return instant(clock()).toISOString();}
function plain(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function fields(value,allowed,label='Parámetros'){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`${label} inválidos.`);}
function id(value,label='Identificador'){if(typeof value!=='string'||!identifiers.test(value))throw new Error(`${label} inválido.`);return value;}
function optionalUser(value){if(value===undefined)return 'local-user';return id(value,'Usuario');}
function text(value,label,max,{required=false}={}) {if(value===undefined&&!required)return '';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`${label}: longitud inválida.`);return value.trim();}
function minute(value,label='Minutos'){if(!Number.isSafeInteger(value)||value<0||value>10_080)throw new Error(`${label} inválidos.`);return value;}
function cents(value,label='Tarifa'){if(!Number.isSafeInteger(value)||value<0||value>1_000_000_000)throw new Error(`${label} en centavos inválida.`);return value;}
function isoDate(value,label='Fecha') {if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))throw new Error(`${label} inválida.`);const parsed=new Date(`${value}T12:00:00.000Z`);if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new Error(`${label} inválida.`);return value;}
function time(value,label='Fecha y hora'){if(typeof value!=='string'||value.length>40)throw new Error(`${label} inválida.`);return instant(value).toISOString();}
function increment(value){if(!BILLING_INCREMENTS.includes(value))throw new Error('Incremento de facturación inválido. Usa 1, 6 o 15 minutos.');return value;}
function dateKey(value,range){const day=value.slice(0,10);if(range==='all')return 'all';if(range==='month')return day.slice(0,7);const date=new Date(`${day}T12:00:00.000Z`),weekday=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-weekday);return date.toISOString().slice(0,10);}
function sum(entries) {return entries.reduce((total,entry)=>({
  minutes:total.minutes+entry.durationMinutes,
  billableMinutes:total.billableMinutes+entry.billedMinutes,
  amountCentavos:total.amountCentavos+entry.amountCentavos,
  unbilledCentavos:total.unbilledCentavos+(entry.billingStatus==='unbilled'?entry.amountCentavos:0),
  billedCentavos:total.billedCentavos+(entry.billingStatus==='billed'?entry.amountCentavos:0),
}),{minutes:0,billableMinutes:0,amountCentavos:0,unbilledCentavos:0,billedCentavos:0});}

/**
 * Local time/billing capability. `service` is deliberately a small internal capability,
 * not the public service object: requireWorkspace(), matter(), listMatters(), and clock().
 */
export function registerTimeBilling(service,store) {
  if(!service||!store)throw new Error('No se pudo iniciar tiempo y honorarios.');
  const workspace=()=>service.requireWorkspace();
  const matter=matterId=>service.matter(matterId);
  const matters=()=>service.listMatters();
  const clock=()=>instant(service.clock?.()??new Date());
  const audit=(action,entityId)=>store.audit(action,entityId);
  function resolutionFor(m) {
    return store.getMatterResolution(m.workspaceId,m.id)??{workspaceId:m.workspaceId,matterId:m.id,status:'abierto',outcome:null,resolutionDate:null,notes:null,resolvedAt:null,updatedAt:m.createdAt};
  }
  function arrangementFor(m) {
    return store.getFeeArrangement(m.workspaceId,m.id)??{workspaceId:m.workspaceId,matterId:m.id,arrangement:'hourly',hourlyRateCentavos:null,contingencyBasisPoints:null,billingIncrementMinutes:6,currency:CURRENCY,updatedAt:null};
  }
  function rateFor(m,arrangement=arrangementFor(m)) {
    if(arrangement.arrangement!=='hourly')return 0;
    if(Number.isInteger(arrangement.hourlyRateCentavos))return arrangement.hourlyRateCentavos;
    return store.getClientHourlyRate(m.workspaceId,m.client)?.hourlyRateCentavos??0;
  }
  function timerView(timer) {
    if(!timer)return null;
    const current=clock(),started=instant(timer.startedAt),elapsed=timer.state==='running'?elapsedWholeMinutes(started,current):0;
    return {...timer,billable:Boolean(timer.billable),runningMinutes:timer.accumulatedMinutes+elapsed,stale:timer.state==='running'&&current.getTime()-started.getTime()>STALE_TIMER_MS};
  }
  function entryFor({m,userId,source,description,billable,durationMinutes,startedAt=null,endedAt=null,manualMinutes=null,rateCentavos}) {
    const arrangement=arrangementFor(m),billedMinutes=billable?roundBillingMinutes(durationMinutes,arrangement.billingIncrementMinutes):0;
    return {id:randomUUID(),workspaceId:m.workspaceId,matterId:m.id,userId,startedAt,endedAt,manualMinutes,durationMinutes,billedMinutes,description,billable,rateCentavos:billable?rateCentavos:0,amountCentavos:billable?amountCentavos(billedMinutes,rateCentavos):0,currency:CURRENCY,source,billingStatus:'unbilled',createdAt:stamp(clock)};
  }
  function assertTimerScope(timer,m,userId) {
    if(!timer||timer.matterId!==m.id||timer.workspaceId!==m.workspaceId||timer.userId!==userId)throw new Error('No hay un temporizador para este asunto.');
    return timer;
  }
  function stopTimer(m,userId,descriptionOverride,{recovery=false}={}) {
    const timer=assertTimerScope(store.getActiveTimer(m.workspaceId,userId),m,userId);
    const end=clock(),extra=timer.state==='running'?elapsedWholeMinutes(timer.startedAt,end):0;
    const stale=timer.state==='running'&&end.getTime()-instant(timer.startedAt).getTime()>STALE_TIMER_MS;
    if(stale&&!recovery)throw new Error('El temporizador requiere recuperación explícita antes de guardarse.');
    const cappedExtra=recovery?Math.min(extra,elapsedWholeMinutes(timer.startedAt,new Date(instant(timer.startedAt).getTime()+STALE_TIMER_MS))):extra;
    const duration=timer.accumulatedMinutes+cappedExtra;
    const description=descriptionOverride===undefined?timer.description:text(descriptionOverride,'Descripción',600);
    const entry=entryFor({m,userId,source:'timer',description,billable:Boolean(timer.billable),durationMinutes:duration,startedAt:timer.startedAt,endedAt:end.toISOString(),rateCentavos:timer.rateCentavos});
    return store.transaction(()=>{store.deleteActiveTimer(m.workspaceId,userId);store.createTimeEntry(entry);audit('time.stop',entry.id);return entry;});
  }
  function scopedEntries(p,{allowNoMatter=false}={}) {
    const w=workspace();
    if(p.matterId!==undefined)matter(p.matterId);else if(!allowNoMatter)throw new Error('Asunto requerido.');
    const list=store.listTimeEntries(w.id,{matterId:p.matterId??null,billingStatus:p.billingStatus??null});
    const allMatters=new Map(matters().map(item=>[item.id,item]));
    return list.filter(entry=>allMatters.has(entry.matterId)).map(entry=>({...entry,matterTitle:allMatters.get(entry.matterId).title,client:allMatters.get(entry.matterId).client}));
  }
  function report(p) {
    fields(p,['matterId','groupBy','range','billingStatus'],'Filtros de reporte');
    const groupBy=p.groupBy??'matter',range=p.range??'all';
    if(!['matter','client'].includes(groupBy)||!['all','week','month'].includes(range))throw new Error('Filtro de reporte inválido.');
    if(p.billingStatus!==undefined&&!['unbilled','billed'].includes(p.billingStatus))throw new Error('Estado de cobro inválido.');
    const entries=scopedEntries(p,{allowNoMatter:true});const groups=new Map();
    for(const entry of entries){const subject=groupBy==='matter'?entry.matterId:entry.client,key=`${dateKey(entry.createdAt,range)}:${subject}`;const current=groups.get(key)??{key,period:dateKey(entry.createdAt,range),matterId:groupBy==='matter'?entry.matterId:null,matterTitle:groupBy==='matter'?entry.matterTitle:null,client:entry.client,entries:[]};current.entries.push(entry);groups.set(key,current);}
    const rows=[...groups.values()].map(group=>({...group,...sum(group.entries),entryCount:group.entries.length,entries:undefined}));
    return {currency:CURRENCY,groupBy,range,rows:rows.sort((a,b)=>a.period.localeCompare(b.period)||String(a.client).localeCompare(String(b.client))||String(a.matterTitle).localeCompare(String(b.matterTitle))),totals:sum(entries)};
  }
  function statistics() {
    const w=workspace(),allMatters=matters(),entries=scopedEntries({},{allowNoMatter:true});
    const resolutions=allMatters.map(m=>({matter:m,resolution:resolutionFor(m)}));
    const byStatus=Object.fromEntries(statuses.map(status=>[status,resolutions.filter(item=>item.resolution.status===status).length]));
    const byOutcome=Object.fromEntries(outcomes.map(outcome=>[outcome,resolutions.filter(item=>item.resolution.outcome===outcome).length]));
    const durations=resolutions.filter(({matter:m,resolution:r})=>r.status==='resuelto'&&r.resolutionDate).map(({matter:m,resolution:r})=>Math.max(0,Math.round((new Date(`${r.resolutionDate}T12:00:00Z`).getTime()-instant(m.createdAt).getTime())/86_400_000)));
    const hoursByMatter=allMatters.map(m=>({matterId:m.id,title:m.title,client:m.client,...sum(entries.filter(entry=>entry.matterId===m.id))}));
    const pendingTasks=store.list('task').filter(task=>task.workspaceId===w.id&&task.status==='pending').length;
    const pendingReminders=allMatters.reduce((count,m)=>count+store.listReminders(w.id,m.id).filter(item=>item.status==='proposed'||item.status==='approved').length,0);
    return {currency:CURRENCY,byStatus,byOutcome,averageDurationDays:durations.length?roundHalfUp(durations.reduce((a,b)=>a+b,0),durations.length):null,hoursByMatter,pendingOpen:pendingTasks+pendingReminders,pendingTasks,pendingReminders};
  }
  function dispatch(action,p={}) {
    if(!plain(p))throw new Error('Parámetros inválidos.');
    switch(action) {
      case 'time.active': {fields(p,['userId'],'Parámetros de temporizador');const w=workspace();return timerView(store.getActiveTimer(w.id,optionalUser(p.userId)));}
      case 'time.start': {
        fields(p,['matterId','userId','description','billable'],'Parámetros de temporizador');const m=matter(id(p.matterId,'Asunto')),userId=optionalUser(p.userId),w=workspace();
        if(p.billable!==undefined&&typeof p.billable!=='boolean')throw new Error('Indicador facturable inválido.');if(store.getActiveTimer(w.id,userId))throw new Error('Ya hay un temporizador activo o pausado. Recupéralo antes de iniciar otro.');
        const timer={workspaceId:w.id,userId,matterId:m.id,startedAt:stamp(clock),accumulatedMinutes:0,pausedAt:null,state:'running',rateCentavos:rateFor(m),billable:p.billable??true,description:text(p.description,'Descripción',600),currency:CURRENCY};
        return store.transaction(()=>{store.putActiveTimer(timer);audit('time.start',m.id);return timerView(timer);});
      }
      case 'time.pause': {
        fields(p,['matterId','userId'],'Parámetros de temporizador');const m=matter(id(p.matterId,'Asunto')),userId=optionalUser(p.userId),timer=assertTimerScope(store.getActiveTimer(m.workspaceId,userId),m,userId);if(timer.state==='paused')return timerView(timer);
        const paused={...timer,accumulatedMinutes:timer.accumulatedMinutes+elapsedWholeMinutes(timer.startedAt,clock()),pausedAt:stamp(clock),state:'paused'};return store.transaction(()=>{store.putActiveTimer(paused);audit('time.pause',m.id);return timerView(paused);});
      }
      case 'time.resume': {
        fields(p,['matterId','userId'],'Parámetros de temporizador');const m=matter(id(p.matterId,'Asunto')),userId=optionalUser(p.userId),timer=assertTimerScope(store.getActiveTimer(m.workspaceId,userId),m,userId);if(timer.state==='running')return timerView(timer);
        const resumed={...timer,startedAt:stamp(clock),pausedAt:null,state:'running'};return store.transaction(()=>{store.putActiveTimer(resumed);audit('time.resume',m.id);return timerView(resumed);});
      }
      case 'time.stop': {fields(p,['matterId','userId','description'],'Parámetros de temporizador');return stopTimer(matter(id(p.matterId,'Asunto')),optionalUser(p.userId),p.description);}
      case 'time.recover': {
        fields(p,['matterId','userId','action'],'Parámetros de recuperación');const m=matter(id(p.matterId,'Asunto')),userId=optionalUser(p.userId),timer=assertTimerScope(store.getActiveTimer(m.workspaceId,userId),m,userId);if(!timerView(timer).stale)throw new Error('El temporizador aún no requiere recuperación.');if(!['stop','discard'].includes(p.action))throw new Error('Acción de recuperación inválida.');
        if(p.action==='stop')return stopTimer(m,userId,undefined,{recovery:true});return store.transaction(()=>{store.deleteActiveTimer(m.workspaceId,userId);audit('time.recover.discard',m.id);return {discarded:true};});
      }
      case 'time.create': {
        fields(p,['matterId','userId','minutes','description','billable','createdAt'],'Entrada manual');const m=matter(id(p.matterId,'Asunto'));if(typeof p.billable!=='boolean')throw new Error('Indica si la entrada es facturable.');const createdAt=p.createdAt===undefined?stamp(clock):time(p.createdAt,'Fecha y hora');const duration=minute(p.minutes);
        const entry=entryFor({m,userId:optionalUser(p.userId),source:'manual',description:text(p.description,'Descripción',600,{required:true}),billable:p.billable,durationMinutes:duration,manualMinutes:duration,rateCentavos:rateFor(m)});entry.createdAt=createdAt;
        return store.transaction(()=>{store.createTimeEntry(entry);audit('time.create',entry.id);return entry;});
      }
      case 'time.list': {
        fields(p,['matterId','billingStatus'],'Filtros de tiempo');if(p.matterId!==undefined)id(p.matterId,'Asunto');if(p.billingStatus!==undefined&&!['unbilled','billed'].includes(p.billingStatus))throw new Error('Estado de cobro inválido.');return scopedEntries(p,{allowNoMatter:true});
      }
      case 'billing.arrangement.get': {fields(p,['matterId'],'Parámetros de honorarios');return arrangementFor(matter(id(p.matterId,'Asunto')));}
      case 'billing.arrangement.set': {
        fields(p,['matterId','arrangement','hourlyRateCentavos','contingencyBasisPoints','billingIncrementMinutes'],'Configuración de honorarios');const m=matter(id(p.matterId,'Asunto'));if(!arrangements.includes(p.arrangement))throw new Error('Esquema de honorarios inválido.');if(p.arrangement==='hourly'&&p.hourlyRateCentavos!==undefined)cents(p.hourlyRateCentavos);if(p.hourlyRateCentavos!==undefined&&p.arrangement!=='hourly')throw new Error('La tarifa por hora solo aplica al esquema por hora.');if(p.arrangement==='contingency'){if(!Number.isInteger(p.contingencyBasisPoints)||p.contingencyBasisPoints<0||p.contingencyBasisPoints>10_000)throw new Error('Porcentaje de contingencia inválido.');}else if(p.contingencyBasisPoints!==undefined)throw new Error('El porcentaje solo aplica al esquema de contingencia.');
        const item={workspaceId:m.workspaceId,matterId:m.id,arrangement:p.arrangement,hourlyRateCentavos:p.hourlyRateCentavos??null,contingencyBasisPoints:p.contingencyBasisPoints??null,billingIncrementMinutes:increment(p.billingIncrementMinutes??6),currency:CURRENCY,updatedAt:stamp(clock)};return store.transaction(()=>{store.putFeeArrangement(item);audit('billing.arrangement.set',m.id);return item;});
      }
      case 'billing.clientRate.get': {fields(p,['matterId'],'Parámetros de tarifa de cliente');const m=matter(id(p.matterId,'Asunto'));return store.getClientHourlyRate(m.workspaceId,m.client);}
      case 'billing.clientRate.set': {fields(p,['matterId','hourlyRateCentavos'],'Tarifa de cliente');const m=matter(id(p.matterId,'Asunto'));const item={workspaceId:m.workspaceId,clientName:m.client,hourlyRateCentavos:cents(p.hourlyRateCentavos),currency:CURRENCY,updatedAt:stamp(clock)};return store.transaction(()=>{store.putClientHourlyRate(item);audit('billing.clientRate.set',m.id);return item;});}
      case 'billing.report':return report(p);
      case 'billing.markBilled': {
        fields(p,['matterId','entryIds'],'Cobro de tiempo');const m=matter(id(p.matterId,'Asunto'));if(!Array.isArray(p.entryIds)||!p.entryIds.length||p.entryIds.length>500||p.entryIds.some(value=>!identifiers.test(value)))throw new Error('Entradas de tiempo inválidas.');const unique=[...new Set(p.entryIds)],owned=new Set(store.listTimeEntries(m.workspaceId,{matterId:m.id}).map(entry=>entry.id));if(unique.some(entryId=>!owned.has(entryId)))throw new Error('Una entrada no pertenece a este asunto.');return store.transaction(()=>{const updated=store.setTimeEntriesBillingStatus(m.workspaceId,m.id,unique,'billed');audit('billing.markBilled',m.id);return {updated};});
      }
      case 'billing.exportCsv': {
        fields(p,['matterId','billingStatus'],'Exportación');if(p.matterId!==undefined)id(p.matterId,'Asunto');if(p.billingStatus!==undefined&&!['unbilled','billed'].includes(p.billingStatus))throw new Error('Estado de cobro inválido.');const entries=scopedEntries(p,{allowNoMatter:true}),csv=toCsv(entries);return {name:`LEX-tiempo-honorarios-${stamp(clock).slice(0,10)}.csv`,base64:Buffer.from(csv,'utf8').toString('base64'),mime:'text/csv;charset=utf-8'};
      }
      case 'resolution.get': {fields(p,['matterId'],'Parámetros de resolución');return resolutionFor(matter(id(p.matterId,'Asunto')));}
      case 'resolution.setStatus': {
        fields(p,['matterId','status'],'Estado de asunto');const m=matter(id(p.matterId,'Asunto'));if(!statuses.includes(p.status)||p.status==='resuelto')throw new Error('Usa el cierre explícito para marcar un asunto como resuelto.');const prior=resolutionFor(m);if(prior.status==='resuelto')throw new Error('Reabre el asunto antes de cambiar su estado.');const next={...prior,status:p.status,updatedAt:stamp(clock)};return store.transaction(()=>{store.putMatterResolution(next);audit('resolution.status.set',m.id);return next;});
      }
      case 'resolution.close': {
        fields(p,['matterId','outcome','date','notes'],'Cierre de asunto');const m=matter(id(p.matterId,'Asunto')),prior=resolutionFor(m);if(prior.status==='archivado')throw new Error('Reabre el asunto antes de registrarlo como resuelto.');if(!outcomes.includes(p.outcome))throw new Error('Resultado de asunto inválido.');const next={...prior,status:'resuelto',outcome:p.outcome,resolutionDate:isoDate(p.date,'Fecha de resolución'),notes:text(p.notes,'Notas',2_000),resolvedAt:stamp(clock),updatedAt:stamp(clock)};return store.transaction(()=>{store.putMatterResolution(next);audit('resolution.close',m.id);return next;});
      }
      case 'resolution.reopen': {
        fields(p,['matterId'],'Reapertura de asunto');const m=matter(id(p.matterId,'Asunto')),prior=resolutionFor(m);if(prior.status!=='resuelto')throw new Error('Solo puedes reabrir un asunto resuelto.');const next={...prior,status:'abierto',outcome:null,resolutionDate:null,notes:null,resolvedAt:null,updatedAt:stamp(clock)};return store.transaction(()=>{store.putMatterResolution(next);audit('resolution.reopen',m.id);return next;});
      }
      case 'statistics.get': {fields(p,[],'Parámetros de estadísticas');return statistics();}
      default:throw new Error('Acción de tiempo y honorarios no admitida.');
    }
  }
  return {dispatch};
}

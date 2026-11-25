import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../server/store.mjs';
import {amountCentavos,csvSafeCell,registerTimeBilling,roundBillingMinutes,toCsv} from '../server/time-billing.mjs';

function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'lex-time-billing-'));
  const store=createStore(dir);
  const workspace={id:'workspace-1',name:'Despacho sintético',createdAt:'2026-01-01T00:00:00.000Z'};
  const matters=[
    {id:'matter-1',workspaceId:workspace.id,title:'Asunto sintético uno',client:'Cliente sintético',createdAt:'2026-01-01T00:00:00.000Z'},
    {id:'matter-2',workspaceId:workspace.id,title:'Asunto sintético dos',client:'Cliente alterno',createdAt:'2026-01-02T00:00:00.000Z'},
  ];
  store.put('workspace',workspace);for(const matter of matters)store.put('matter',matter);
  let current=new Date('2026-02-01T09:00:00.000Z');
  const service={
    requireWorkspace:()=>workspace,
    matter:id=>{const found=matters.find(item=>item.id===id);if(!found)throw new Error('Asunto no encontrado en este despacho.');return found;},
    listMatters:()=>matters,
    clock:()=>new Date(current.getTime()),
  };
  const billing=registerTimeBilling(service,store);
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  return {store,billing,dir,service,setClock:value=>{current=new Date(value);},matters,workspace};
}

test('additive migration creates isolated time and billing tables without changing the existing schema marker',t=>{
  const {store}=fixture(t);
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,3);
  for(const name of ['time_entries','active_timers','fee_arrangements','client_hourly_rates','matter_resolutions'])assert.ok(store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
});

test('integer minute and centavo rounding is explicit and stable',()=>{
  assert.equal(roundBillingMinutes(0,6),0);
  assert.equal(roundBillingMinutes(3,6),6);
  assert.equal(roundBillingMinutes(2,6),0);
  assert.equal(roundBillingMinutes(8,15),15);
  assert.equal(amountCentavos(1,100),2); // 100/60 centavos, half-up to 2
  assert.equal(amountCentavos(30,12_000),6_000);
  assert.throws(()=>roundBillingMinutes(3,5),/incremento/);
});

test('timer snapshots rate, pauses, stops, and remains matter-scoped',t=>{
  const {billing,setClock}=fixture(t);
  const call=(action,payload)=>billing.dispatch(action,payload);
  call('billing.arrangement.set',{matterId:'matter-1',arrangement:'hourly',hourlyRateCentavos:12_000,billingIncrementMinutes:6});
  call('time.start',{matterId:'matter-1',description:'Revisión sintética'});
  assert.throws(()=>call('time.start',{matterId:'matter-2',description:'Otro'}),/temporizador activo/);
  setClock('2026-02-01T09:10:31.000Z');call('time.pause',{matterId:'matter-1'});
  setClock('2026-02-01T11:00:00.000Z');call('time.resume',{matterId:'matter-1'});
  setClock('2026-02-01T11:20:00.000Z');
  const entry=call('time.stop',{matterId:'matter-1'});
  assert.equal(entry.durationMinutes,31);
  assert.equal(entry.billedMinutes,30);
  assert.equal(entry.rateCentavos,12_000);
  assert.equal(entry.amountCentavos,6_000);
  assert.equal(call('time.active',{}),null);
  assert.equal(call('time.list',{matterId:'matter-2'}).some(item=>item.id===entry.id),false);
});

test('manual entries use configured client rate and reports sum stored parts without drift',t=>{
  const {billing}=fixture(t);const call=(action,payload)=>billing.dispatch(action,payload);
  call('billing.clientRate.set',{matterId:'matter-1',hourlyRateCentavos:9_999});
  let seed=0x51a7;const entries=[];
  for(let index=0;index<2_000;index++){
    seed=(seed*1_664_525+1_013_904_223)>>>0;
    const minutes=(seed%240)+1;
    entries.push(call('time.create',{matterId:'matter-1',minutes,description:`Actividad sintética ${index}`,billable:true,createdAt:`2026-02-${String((index%27)+1).padStart(2,'0')}T10:00:00.000Z`}));
  }
  const report=call('billing.report',{matterId:'matter-1',groupBy:'matter',range:'all'});
  assert.equal(report.totals.minutes,entries.reduce((total,entry)=>total+entry.durationMinutes,0));
  assert.equal(report.totals.amountCentavos,entries.reduce((total,entry)=>total+entry.amountCentavos,0));
  assert.equal(report.totals.unbilledCentavos,report.totals.amountCentavos);
  assert.ok(entries.every(entry=>Number.isInteger(entry.amountCentavos)&&Number.isInteger(entry.durationMinutes)));
});

test('stale timer requires an explicit recovery and has a bounded durable outcome',t=>{
  const {billing,setClock}=fixture(t);const call=(action,payload)=>billing.dispatch(action,payload);
  call('time.start',{matterId:'matter-1',description:'Trabajo sintético'});
  setClock('2026-02-01T22:00:00.000Z');
  assert.equal(call('time.active',{}).stale,true);
  assert.throws(()=>call('time.stop',{matterId:'matter-1'}),/recuperación explícita/);
  const entry=call('time.recover',{matterId:'matter-1',action:'stop'});
  assert.equal(entry.source,'timer');assert.equal(entry.durationMinutes,720);
  assert.equal(call('time.active',{}),null);
});

test('resolution closing is explicit, audited, and stats reuse tasks and reminders',t=>{
  const {billing,store,workspace}=fixture(t);const call=(action,payload)=>billing.dispatch(action,payload);
  assert.throws(()=>call('resolution.setStatus',{matterId:'matter-1',status:'resuelto'}),/cierre explícito/);
  const resolved=call('resolution.close',{matterId:'matter-1',outcome:'acuerdo',date:'2026-02-10',notes:'Acuerdo sintético confirmado por el equipo.'});
  assert.equal(resolved.status,'resuelto');assert.equal(resolved.outcome,'acuerdo');
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='resolution.close' AND entity_id=?").get('matter-1').n,1);
  store.put('task',{id:'task-1',workspaceId:workspace.id,matterId:'matter-1',title:'Pendiente sintético',status:'pending'});
  store.createReminder({id:'reminder-1',workspaceId:workspace.id,matterId:'matter-1',kind:'followup',title:'Seguimiento',dueAt:null,note:'',status:'approved',source:'user',createdAt:'2026-02-01T00:00:00.000Z',updatedAt:'2026-02-01T00:00:00.000Z'});
  const stats=call('statistics.get',{});
  assert.equal(stats.byStatus.resuelto,1);assert.equal(stats.byOutcome.acuerdo,1);assert.equal(stats.pendingTasks,1);assert.equal(stats.pendingReminders,1);assert.equal(stats.pendingOpen,2);
  assert.equal(call('resolution.reopen',{matterId:'matter-1'}).status,'abierto');
});

test('CSV is UTF-8 BOM-ready and prevents spreadsheet formula interpretation',t=>{
  const {billing}=fixture(t);const call=(action,payload)=>billing.dispatch(action,payload);
  call('time.create',{matterId:'matter-1',minutes:6,description:'=SUM(A1:A2)',billable:false});
  const exported=call('billing.exportCsv',{matterId:'matter-1'});
  const csv=Buffer.from(exported.base64,'base64').toString('utf8');
  assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/'=SUM\(A1:A2\)/);
  assert.equal(csvSafeCell('+malicioso'),"'+malicioso");
  assert.match(toCsv([]),/^\ufeffFecha/);
});

for(const seconds of [29,31])test(`pause/resume does not change total time or billed amount for four ${seconds}s segments`,t=>{
 const {billing,setClock}=fixture(t),call=(action,payload={})=>billing.dispatch(action,payload),base=Date.parse('2026-02-01T09:00:00Z');
 call('billing.arrangement.set',{matterId:'matter-1',arrangement:'hourly',hourlyRateCentavos:12000,billingIncrementMinutes:1});
 call('time.start',{matterId:'matter-1',description:'Tramos sintéticos'});
 let now=base;
 for(let segment=0;segment<4;segment++){now+=seconds*1000;setClock(new Date(now));if(segment<3){call('time.pause',{matterId:'matter-1'});now+=60000;setClock(new Date(now));call('time.resume',{matterId:'matter-1'});}}
 const fragmented=call('time.stop',{matterId:'matter-1'});
 setClock(new Date(base));call('time.start',{matterId:'matter-1',description:'Mismo trabajo continuo'});setClock(new Date(base+4*seconds*1000));const continuous=call('time.stop',{matterId:'matter-1'});
 assert.equal(fragmented.durationMinutes,continuous.durationMinutes);assert.equal(fragmented.billedMinutes,continuous.billedMinutes);assert.equal(fragmented.amountCentavos,continuous.amountCentavos);
});


test('exact paused milliseconds survive store restart, failed stop rollback, and exclude paused wall time',t=>{
 const {store,billing,dir,service,setClock}=fixture(t),base=Date.parse('2026-02-01T09:00:00Z');
 billing.dispatch('time.start',{matterId:'matter-1',description:'Persistencia sintética'});
 setClock(new Date(base+29000));billing.dispatch('time.pause',{matterId:'matter-1'});
 assert.equal(store.getActiveTimer('workspace-1','local-user').accumulatedMilliseconds,29000);store.close();store.close=()=>{};
 const reopened=createStore(dir);store.close=()=>reopened.close();const again=registerTimeBilling(service,reopened);
 assert.equal(again.dispatch('time.active',{}).runningMinutes,0);setClock(new Date(base+3600000));again.dispatch('time.resume',{matterId:'matter-1'});setClock(new Date(base+3600000+29000));
 const original=reopened.createTimeEntry;reopened.createTimeEntry=()=>{throw Error('synthetic write failure');};assert.throws(()=>again.dispatch('time.stop',{matterId:'matter-1'}),/synthetic write failure/);assert.ok(reopened.getActiveTimer('workspace-1','local-user'));reopened.createTimeEntry=original;
 const entry=again.dispatch('time.stop',{matterId:'matter-1'});assert.equal(entry.durationMinutes,1);assert.equal(again.dispatch('time.active',{}),null);assert.equal(again.dispatch('time.list',{matterId:'matter-1'}).length,1);
});

test('legacy timer migration preserves known rounded minutes and is idempotent',t=>{
 const dir=mkdtempSync(join(tmpdir(),'lex-legacy-timer-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const db=new DatabaseSync(join(dir,'lex.sqlite'));
 db.exec("CREATE TABLE active_timers(workspace_id TEXT,user_id TEXT,matter_id TEXT,started_at TEXT,accumulated_minutes INTEGER,paused_at TEXT,state TEXT,rate_centavos INTEGER,billable INTEGER,description TEXT,currency TEXT,PRIMARY KEY(workspace_id,user_id)); INSERT INTO active_timers VALUES('w','u','m','2026-02-01T09:00:00Z',3,'2026-02-01T09:03:00Z','paused',12000,1,'Legacy','MXN');");db.close();
 for(let pass=0;pass<2;pass++){const store=createStore(dir);const timer=store.getActiveTimer('w','u');assert.equal(timer.accumulatedMinutes,3);assert.equal(timer.accumulatedMilliseconds,180000);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,3);store.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingToday, proposeFollowUps } from '../server/planner.mjs';

test('pendingToday uses the supplied Mexico City clock at local midnight and sorts stable buckets',()=>{
  const items=[
    {id:'7',title:'Siete días',dueAt:'2026-01-21',status:'approved'},
    {id:'1',title:'Atrasado B',dueAt:'2026-01-13',status:'approved'},
    {id:'2',title:'Atrasado A',dueAt:'2026-01-13',status:'approved'},
    {id:'3',title:'Hoy por instante',dueAt:'2026-01-15T06:00:00Z',status:'approved'},
    {id:'4',title:'Hoy por fecha',dueAt:'2026-01-14',status:'proposed'},
    {id:'5',title:'Ocho días',dueAt:'2026-01-22',status:'approved'},
    {id:'6',title:'Cerrado',dueAt:'2026-01-13',status:'done'},
  ];
  // 05:30Z is 23:30 on Jan 14 in America/Mexico_City; the instant at 06:00Z starts Jan 15 locally.
  const result=pendingToday(items,new Date('2026-01-15T05:30:00Z'),'America/Mexico_City');
  assert.deepEqual(result.overdue.map(item=>item.title),['Atrasado A','Atrasado B']);
  assert.deepEqual(result.dueToday.map(item=>item.title),['Hoy por fecha']);
  assert.deepEqual(result.dueIn7Days.map(item=>item.title),['Hoy por instante','Siete días']);
});

test('proposeFollowUps is deterministic, local, and leaves every suggestion proposed',()=>{
  const now=new Date('2026-05-20T12:00:00Z');
  const documentOnly=proposeFollowUps({
    matter:{createdAt:'2026-05-20T11:00:00Z'},documents:[{createdAt:'2026-05-20T11:00:00Z'}],answers:[],items:[],now,
  });
  assert.deepEqual(documentOnly.map(item=>item.plannerRule),['documents-no-analysis']);
  assert.equal(documentOnly[0].status,'proposed');assert.equal(documentOnly[0].source,'planner');

  const proposals=proposeFollowUps({
    matter:{createdAt:'2026-05-01T12:00:00Z'},
    documents:[{createdAt:'2026-05-01T12:00:00Z'}],
    answers:[{id:'answer-1',skillId:'contract-reviewer',createdAt:'2026-05-01T12:00:00Z'}],
    items:[{id:'deadline-1',kind:'deadline',title:'Contestación',dueAt:'2026-05-22',status:'approved',source:'user',createdAt:'2026-05-01T12:00:00Z'}],
    now,
  });
  assert.deepEqual(proposals.map(item=>item.plannerRule),['analysis-no-draft','deadline-deadline-1','no-activity-14-days']);
  assert.ok(proposals.every(item=>item.status==='proposed'&&item.source==='planner'));
  const deduped=proposeFollowUps({
    matter:{createdAt:'2026-05-01T12:00:00Z'},documents:[{createdAt:'2026-05-01T12:00:00Z'}],answers:[],
    items:[{...documentOnly[0],createdAt:'2026-05-20T11:00:00Z'}],now,
  });
  assert.deepEqual(deduped.map(item=>item.plannerRule),[]);
});

test('proposeFollowUps judges "today" in the supplied time zone, not UTC',()=>{
  // 03:00Z on May 21 is still 21:00 on May 20 in Mexico City, so a May 23 deadline is exactly 3 local days away.
  const base={matter:{createdAt:'2026-05-20T12:00:00Z'},documents:[],answers:[],now:new Date('2026-05-21T03:00:00Z')};
  const deadline={id:'d1',kind:'deadline',title:'Plazo',status:'approved',source:'user',createdAt:'2026-05-20T12:00:00Z'};
  assert.deepEqual(proposeFollowUps({...base,items:[{...deadline,dueAt:'2026-05-23'}]}).map(item=>item.plannerRule),['deadline-d1']);
  assert.deepEqual(proposeFollowUps({...base,items:[{...deadline,dueAt:'2026-05-24'}]}).map(item=>item.plannerRule),[]);
  assert.deepEqual(proposeFollowUps({...base,timeZone:'UTC',items:[{...deadline,dueAt:'2026-05-24'}]}).map(item=>item.plannerRule),['deadline-d1']);
});

test('proposeFollowUps does not re-propose a rule the lawyer already dismissed',()=>{
  const now=new Date('2026-05-20T12:00:00Z');
  const args={matter:{createdAt:'2026-05-20T11:00:00Z'},documents:[{createdAt:'2026-05-20T11:00:00Z'}],answers:[],now};
  const [first]=proposeFollowUps({...args,items:[]});
  assert.equal(first.plannerRule,'documents-no-analysis');
  assert.deepEqual(proposeFollowUps({...args,items:[{...first,status:'dismissed',createdAt:'2026-05-20T11:30:00Z'}]}),[]);
});

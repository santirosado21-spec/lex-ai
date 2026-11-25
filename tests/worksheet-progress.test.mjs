import test from 'node:test';
import assert from 'node:assert/strict';
import {worksheetProgress} from '../src/worksheet-progress.js';
const row=(id,status)=>({id,label:'Concepto '+id,status});
test('manual workflow states remain separate, received is still pending',()=>{
 const rows=['Por revisar','Solicitado','Recibido','Cotejado','No aplica'].map((status,i)=>row(String(i),status));
 const before=structuredClone(rows),p=worksheetProgress(rows);
 assert.equal(p.total,5);assert.equal(p.checked,1);assert.equal(p.notApplicable,1);assert.equal(p.unknown,0);
 assert.deepEqual(p.pending.map(r=>r.id),['0','1','2']);assert.deepEqual(rows,before);
});
test('copies are separate work items and labels stay literal',()=>{
 const p=worksheetProgress([row('flete','Cotejado'),{...row('flete~copy','Solicitado'),label:'<b>Flete</b> adicional'}]);
 assert.equal(p.total,2);assert.equal(p.checked,1);assert.equal(p.pending[0].label,'<b>Flete</b> adicional');
});
test('unknown states cannot be counted as checked or not applicable',()=>{
 const p=worksheetProgress([row('a','Approved'),row('b',''),row('c','Cotejado')]);
 assert.equal(p.unknown,2);assert.equal(p.checked,1);assert.equal(p.pending.length,0);
 assert.deepEqual(worksheetProgress([]),{total:0,pending:[],checked:0,notApplicable:0,unknown:0});
});

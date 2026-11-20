import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {permitNote,permitReferences,pedimentoAttachment,searchPermits} from '../server/corpus/pedimento-index.mjs';
import {prepareFollowup,quotedRanges,renderFollowup} from '../server/corpus/intake-followup.mjs';

const lookup=(date,other={})=>permitNote({code:'AL',agency:'SE',classification:'7616999991',regime:'Depósito fiscal',date,...other});
test('appendix 9 distinguishes dates, authorities and commodity qualifications',()=>{
 const energy={code:'C1',agency:'SENER',classification:'',regime:''};
 for(const [date,match] of [['2026-05-17',/anterior a la apertura/],['2026-05-18',/admitía/],['2026-05-24',/admitía/],['2026-05-25',/Desde el 25/]])assert.match(lookup(date).stage,match);
 assert.match(lookup('2026-05-17').text,/Publicación posterior/);
 assert.match(lookup('2026-05-25').detail,/Únicamente: las demás piezas coladas o piezas forjadas/);
 assert.match(lookup('2026-05-25',{classification:'7616999999'}).detail,/Sin coincidencia/);
 assert.match(lookup('2026-05-25',{regime:'Otro régimen'}).detail,/Fuera de los cinco/);
 for(const day of ['2026-02-30','2026-11-20','2026-01-14'])assert.throws(()=>lookup(day));
 const rows=searchPermits('C1','2026-09-22').rows;assert.equal(rows.length,2);
 assert.equal(rows.find(r=>r.agency==='SE').prior.date,'2026-01-15');
 assert.equal(rows.find(r=>r.agency==='SENER').date,'2026-01-15');
 assert.doesNotMatch(lookup('2026-09-23',energy).stage,/azúcar/);
 assert.match(lookup('2026-09-23',{...energy,agency:'SE'}).stage,/precede a la declaración/);
 assert.match(lookup('2026-09-28',{...energy,agency:'SE'}).stage,/Desde el 28/);
 assert.throws(()=>lookup('2026-05-25',{agency:'SENER'}));assert.throws(()=>lookup('2026-05-25',{classification:'otra'}));
});
test('cloud follow-up uses whole public sources, keeping the date and local checks off the wire',()=>{
 const a=lookup('2026-05-21'),b=lookup('2026-06-07',{classification:'7601100201',regime:'Otro régimen'});
 const build=n=>prepareFollowup(n,quotedRanges(n,n.text),'control').prompt;
 assert.equal(build(a),build(b));assert.notEqual(a.id,b.id);assert.equal(permitReferences(a).length,4);
 for(const word of ['7616.99.99','Depósito fiscal','2026-05-21','Otro régimen'])assert.ok(!build(a).includes(word));
 for(const word of ['RGCE-2026-TR2','SE-2026-AL','VUCEM-2026-HI02','RGCE-A9-SE-AL'])assert.ok(build(a).includes(word));
 assert.throws(()=>permitReferences({...a}));assert.throws(()=>prepareFollowup({...a},quotedRanges(a,a.text),'control'));
 for(const r of a.references.filter(r=>r.localUrl))assert.equal(pedimentoAttachment(r.localUrl.split('#')[0]).type,'application/pdf');
 assert.equal(pedimentoAttachment('/fuentes/no-existe.pdf'),null);
 const ranges=quotedRanges(a,a.text);
 assert.throws(()=>prepareFollowup(a,[{...ranges[0],length:ranges[0].length-1}],'control'));
});
test('sugar scope keeps the merged qualification and its definitive import regime',()=>{
 const options={code:'C1',agency:'SE',classification:'2106909999',regime:'Importación temporal'};
 const sugar=lookup('2026-09-24',options);
 assert.match(sugar.detail,/constituidas esencialmente de azúcar/);assert.match(sugar.detail,/indica importación definitiva/);
 assert.ok(!sugar.text.includes(options.classification));assert.equal(sugar.period,'captura');
 assert.equal(lookup('2026-08-30',options).period,'antes');
 assert.equal(lookup('2026-09-28',options).period,'declaracion');
 assert.match(lookup('2026-09-28',{...options,classification:'1702123499'}).detail,/Sin coincidencia/);
});

test('one captured OpenAI response selects different actions locally around both milestones',async()=>{
 const {response}=JSON.parse(await readFile('fixtures/public-cases/anexo22-r18.json','utf8'));
 for(const [date,stage] of [['2026-05-17','antes'],['2026-05-18','captura'],['2026-05-25','declaracion']]){
  const note=lookup(date),task=prepareFollowup(note,quotedRanges(note,note.text),'control');
  const text=renderFollowup(JSON.stringify(response),task);
  assert.ok(text.includes(response.comun)&&text.includes(response[stage]));
  for(const other of ['antes','captura','declaracion'].filter(s=>s!==stage))assert.ok(!text.includes(response[other]));
  assert.throws(()=>renderFollowup(JSON.stringify({acciones:[response.comun,response.declaracion]}),task));
  assert.throws(()=>renderFollowup(JSON.stringify({...response,captura:response.declaracion}),task));
 }
});

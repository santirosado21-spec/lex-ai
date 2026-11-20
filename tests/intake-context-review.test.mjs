import assert from 'node:assert/strict';
import test from 'node:test';
import {reviewContextLocally} from '../server/privacy/intake-context-review.mjs';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {logisticsReferenceRanges} from '../server/privacy/trade-document-structure.mjs';

test('context review only admits known UTF-16 sentence offsets from its current local batch',async()=>{
 const text='🚢 Informe inicial.  Recibió la carga quien cubre ese turno.';
 const r=await reviewContextLocally(text,async(_s,input)=>{
  const segments=JSON.parse(input);
  assert.equal(segments.length,2);return {oraciones:[segments[1].id]};
 });
 assert.equal(r.available,true);
 assert.equal(text.slice(...r.ranges[0]),'Recibió la carga quien cubre ese turno.');
 for(const reply of [{oraciones:[3]},{oraciones:[0,0]},{oraciones:[0],text:'original'},{oraciones:'0'}]){
  const fail=await reviewContextLocally(text,async()=>reply);assert.equal(fail.available,false);assert.deepEqual(fail.ranges,[]);
 }
 const cancel=new AbortController();cancel.abort();
 await assert.rejects(reviewContextLocally(text,()=>{throw Error();},cancel.signal));
});

test('a failed second batch preserves the first local protections and flags the incomplete examination',async()=>{
 const text=Array.from({length:26},(_,i)=>'Apartado '+i+' de este informe.').join(' ');
 let calls=0;
 const context=await reviewContextLocally(text,async(_s,input)=>{
  if(++calls===2)throw Error('local unavailable');return {oraciones:[JSON.parse(input)[0].id]};
 });
 assert.equal(calls,2);assert.equal(context.available,false);assert.equal(context.ranges.length,1);
 const r=await reviewIntakeDocument({text,originalHash:'f'.repeat(64),suggestions:[],fields:[],context});
 assert.ok(r.contextUnavailable&&r.needsReview);assert.ok(r.parts[0].label);assert.equal(r.restored,text);
});

test('a precise operational time can precede or follow the date; a statute publication date stays out of this rule',()=>{
 for(const [text,stamp] of [
  ['La descarga se programó para las 05:32 del 08-02-2026.','05:32 del 08-02-2026'],
  ['Cita de entrega para el 2026-11-14 a las 08:31.','2026-11-14 a las 08:31'],
 ]){
  assert.ok(logisticsReferenceRanges(text).map(([a,b])=>text.slice(a,b)).includes(stamp));
 }
 assert.deepEqual(logisticsReferenceRanges('La ley se publicó el 02/03/2025 a las 10:00.'),[]);
});

test('the context pass retains a fully matched documentary clause and masks the original range for an actual location',async()=>{
 const text='Para la carta de porte LARGO-9039127392 el comprador cubrió el flete por separado. Llegó junto a la torre tornasol con LARGO-9039127392.';
 const value='LARGO-9039127392';
 const parts=[text.indexOf(value),text.lastIndexOf(value)].map(start=>({label:'Dato 1',start,end:start+value.length}));
 const result=await reviewContextLocally(text,async(_s,input)=>{
  assert.match(input,/torre tornasol/);const segments=JSON.parse(input);return {oraciones:segments.map(s=>s.id)};
 },undefined,parts);
 assert.equal(result.available,true);assert.equal(result.ranges.length,1);
 assert.equal(text.slice(...result.ranges[0]),'Llegó junto a la torre tornasol con LARGO-9039127392.');
});

test('spatial and event descriptions are masked while payment questions retain generic legal terms',async()=>{
 const text='El paquete se descargó frente al arco pintado de ámbar. El contrato se firmó durante la feria de las cometas dobles. ¿Qué comprobante pedirías a Rosa para aclarar quién asumió el seguro de AB-643?';
 const r=await reviewIntakeDocument({text,originalHash:'a'.repeat(64),fields:['Rosa','AB-643'],suggestions:['comprobante','seguro']});
 const visible=r.parts.map(x=>x.text??'***').join('');
 for(const s of ['arco pintado','cometas dobles','Rosa','AB-643'])assert.ok(!visible.includes(s),s);
 assert.ok(visible.includes('Qué comprobante pedirías')&&visible.includes('quién asumió el seguro'));
 assert.equal(r.restored,text);
});

test('a temporal sound cue is protected and generic test descriptions stay readable',async()=>{
 const text='La guía se selló cuando repicaron las hojas de bronce de la estación. La prueba acústica detectó una vibración en el motor.';
 const result=await reviewIntakeDocument({text,originalHash:'a'.repeat(64),suggestions:[],fields:[]});
 const visible=result.parts.map(p=>p.text??'***').join('');
 assert.ok(!visible.includes('hojas de bronce')&&visible.includes('vibración en el motor'));
 const ordinary='El informe indica la exportación temporal para transformación.';
 const specific=ordinary.slice(0,-1)+' junto al reloj con dientes de ámbar.';
 const selectAll=async(_s,input)=>({oraciones:JSON.parse(input).map(s=>s.id)});
 assert.deepEqual((await reviewContextLocally(ordinary,selectAll)).ranges,[]);
 assert.deepEqual((await reviewContextLocally(specific,selectAll)).ranges,[[0,specific.length]]);
});

test('locative descriptions of a delivery are protected even without a name or a clock time',async()=>{
 const text='🚚 El camión llegó donde las vecinas izan el gallardete de barro; el vendedor pagó el transporte. El taller cuya puerta tiene remaches de ónix recibió la caja.';
 const result=await reviewIntakeDocument({text,originalHash:'3'.repeat(64),suggestions:[],fields:[]});
 const visible=result.parts.map(p=>p.text??'***').join('');
 assert.ok(!visible.includes('gallardete')&&!visible.includes('remaches'));
 assert.ok(visible.includes('el vendedor pagó el transporte'));assert.equal(result.restored,text);
 const paperwork='El mensajero entregó el informe donde consta el pago.';
 const review=await reviewIntakeDocument({text:paperwork,originalHash:'4'.repeat(64),suggestions:[],fields:[]});
 assert.ok(review.parts.map(p=>p.text??'***').join('').includes('donde consta el pago'));
});

test('a generic calibration stays readable while added identifying context still receives full review',async()=>{
 const routine='Se trasladó al taller una bomba para su calibración en el extranjero.';
 const qualified=routine.slice(0,-1)+' durante la romería de los faroles.';
 const all=async(_s,input)=>({oraciones:JSON.parse(input).map(s=>s.id)});
 assert.deepEqual((await reviewContextLocally(routine,all)).ranges,[]);
 assert.deepEqual((await reviewContextLocally(qualified,all)).ranges,[[0,qualified.length]]);
});

test('origin review separates visible technical composition from marked and reserved values',async()=>{
 const text='Material: Fibra de vidrio. Fabricada en plantas próximas a la vieja compuerta. Se encontró una mancha ocre en el precinto.';
 const review=await reviewIntakeDocument({text,originalHash:'c'.repeat(64),suggestions:['Fibra de vidrio'],fields:[]});
 const masked=review.parts.map(p=>p.text??'***').join('');
 assert.ok(masked.includes('Fibra de vidrio')&&!masked.includes('compuerta')&&!masked.includes('ocre'));
 assert.equal(review.restored,text);
 const field=await reviewIntakeDocument({text,originalHash:'c'.repeat(64),suggestions:[],fields:['Fibra de vidrio']});
 assert.ok(!field.parts.map(p=>p.text??'***').join('').includes('Fibra de vidrio'));
});

test('a visual emblem can identify a shipment while the reason for a legal ruling remains readable',async()=>{
 const {originContextRanges}=await import('../server/privacy/origin-evidence.mjs');
 const text='El motivo de la resolución fue la falta de pruebas. El perito anotó el emblema de las golondrinas blancas.';
 const spans=originContextRanges(text).map(([a,b])=>text.slice(a,b));
 assert.deepEqual(spans,['emblema de las golondrinas blancas']);
});

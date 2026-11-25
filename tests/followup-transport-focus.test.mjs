import test from 'node:test';
import assert from 'node:assert/strict';
import {focusFromInstruction,prepareFollowup,quotedRanges,renderFollowup,followupEnvelope} from '../server/corpus/intake-followup.mjs';
import {loadTradeReading,renderTradeReading} from '../server/corpus/intake-trade-reading.mjs';

test('a carta de porte is kept as transport focus instead of silently dropping that requested document',()=>{
 for(const text of ['Revisar la carta de porte.','Cotejar las cartas de porte.'])assert.deepEqual(focusFromInstruction(text),['transporte']);
 assert.deepEqual(focusFromInstruction('Comparar la factura y la carta de porte.'),['factura','transporte']);
 assert.deepEqual(focusFromInstruction('Revisar la guía aérea y la carta de porte.'),['transporte']);
});
test('the transport alias counts toward the two-document cap and cannot bypass exclusions',()=>{
 for(const text of ['Comparar factura, carta de porte y comprobante de pago.','Revisar carta de porte, contrato y pedimento.','Factura pero no carta de porte.','Cotejar todo excepto la carta de porte.'])assert.throws(()=>focusFromInstruction(text));
 assert.throws(()=>focusFromInstruction('Revisar la carta de presentación.'));
});
test('the second-turn packet and its output check retain both requested canonical document types',()=>{
 const reading=loadTradeReading(null,'lectura-valoracion');
 const selected=reading.choices[1].find(p=>p.condition);
 const initial=renderTradeReading(JSON.stringify({B:{pasaje:selected.key,solicitud:'¿Qué gasto acredita el comprobante?'}}),reading);
 const focus=focusFromInstruction('Comparar la factura y la carta de porte.');
 const packet=prepareFollowup(reading,quotedRanges(reading,initial),'control',focus);
 assert.deepEqual(packet.focus,['factura comercial','documento de transporte']);
 const prompt=followupEnvelope(packet).messages[0].content;
 assert.ok(prompt.includes('factura comercial y documento de transporte'));
 assert.ok(prompt.includes(selected.quote)&&prompt.includes(selected.condition));
 const missing=JSON.stringify({acciones:['Verificar la factura comercial contra el comprobante de pago.','Cotejar el comprobante de pago con la factura comercial.']});
 assert.throws(()=>renderFollowup(missing,packet),/acciones documentales/);
 const valid=JSON.stringify({acciones:['Verificar la factura comercial contra el documento de transporte.','Cotejar el documento de transporte con las condiciones de la factura comercial.']});
 const output=renderFollowup(valid,packet);assert.ok(output.includes('documento de transporte'));
});

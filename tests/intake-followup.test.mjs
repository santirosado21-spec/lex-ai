import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {focusFromInstruction,followupEnvelope,prepareFollowup,quotedRanges,renderFollowup} from '../server/corpus/intake-followup.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {openPublicLibrary} from '../server/public-library.mjs';
import {loadTradeReading,renderTradeReading} from '../server/corpus/intake-trade-reading.mjs';
import {loadResearchPassage,renderResearchNote} from '../server/corpus/intake-research.mjs';
import {practiceDocument,prepareProtectedCase,renderProtectedCase} from '../server/corpus/pilot-protected-case.mjs';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {bindReviewedDocument} from '../server/privacy/intake-document-map.mjs';
const check=JSON.stringify({acciones:['Verificar la factura comercial contra el comprobante de pago.','Cotejar la descripción del transporte con la factura comercial.']});
const letter=JSON.stringify({acciones:['Solicitamos la factura comercial para identificar el pago.','Por favor, remita el comprobante de pago para cotejar el importe.']});
test('typed requests expose only canonical document types and reject ambiguous or unsupported instructions',()=>{
 assert.deepEqual(focusFromInstruction('Coteja el comprobante de pago AX-82 y la factura de Nube Ficticia.'),['factura','pago']);
 assert.deepEqual(focusFromInstruction(''),[]);
 for(const text of ['Pide lo necesario.','Pide el pedimento pero no la factura.','Menos los contratos','Factura, contrato y pedimento','x'.repeat(401)])
  assert.throws(()=>focusFromInstruction(text));
});
test('a follow-up reuses the exact selected legal text, subparagraph condition and locator',async()=>{
 const reading=loadTradeReading(null,'lectura-valoracion');
 const selected=reading.choices[1].find(p=>p.condition);
 const original=renderTradeReading(JSON.stringify({B:{pasaje:selected.key,solicitud:'¿Qué gasto acredita el comprobante?'}}),reading);
 const ranges=quotedRanges(reading,original);assert.equal(ranges.length,1);
 const packet=prepareFollowup(reading,ranges,'control',['factura','pago']);
 assert.ok(packet.prompt.includes(selected.quote)&&packet.prompt.includes(selected.condition)&&packet.prompt.includes(selected.locator));
 const result=renderFollowup(check,packet,{evidence:true});assert.ok(result.includes(selected.condition)&&result.includes('[[SOPORTE]]'));
 assert.throws(()=>prepareFollowup(reading,[{...ranges[0],start:ranges[0].start+1}],'control'));
 assert.throws(()=>prepareFollowup({...reading},ranges,'carta'));assert.throws(()=>prepareFollowup(reading,ranges,'carta',['private text']));
 assert.throws(()=>renderFollowup(letter,packet));assert.throws(()=>renderFollowup(check.replaceAll('comprobante de pago','reporte'),packet));
 let reached=false;
 const provider=createIntakeGenerator({getApiKey:()=>{reached=true;},fetchImpl:()=>{reached=true;}});
 await assert.rejects(provider('revision',{followup:{prompt:'Nombres del expediente'}}));
 assert.ok(!reached);
});
test('an arbitrary selected public article can be followed up, while the client letter omits local evidence',async t=>{
 const index='resources/public-library.sqlite';
 try{await access(index);}catch{t.skip('Se requiere la biblioteca del piloto');return;}
 const lib=await openPublicLibrary(index);t.after(()=>lib.close());
 const source=loadResearchPassage(lib,lib.lookupArticle({lawId:'MX-FED-LCE',articleId:'23'}).id,0);
 const cita=source.ref.text.slice(0,90).trim();
 const raw=JSON.stringify({cita,solicitud:'¿Qué documento permite identificar la asignación?'});
 const initial=renderResearchNote(raw,source)+'\n\nDato local añadido';
 const packet=prepareFollowup(source,quotedRanges(source,initial),'carta',['factura']);
 assert.ok(!packet.synthetic);assert.ok(packet.prompt.includes(cita));assert.ok(!packet.prompt.includes('Dato local'));
 const draft=renderFollowup(letter,packet,{evidence:true});assert.ok(draft.includes(cita)&&!draft.includes('[[SOPORTE]]'));
 assert.throws(()=>prepareFollowup(source,quotedRanges(source,renderResearchNote('{}',source)),'control'));
});
test('practice facts remain substituted on the second turn and restore locally in an internal work paper',async t=>{
 const index='resources/public-library.sqlite';
 try{await access(index);}catch{t.skip('Se requiere la biblioteca del piloto');return;}
 const lib=await openPublicLibrary(index);t.after(()=>lib.close());
 const seed='00'.repeat(12),fixture=practiceDocument(seed);
 const protection=await reviewIntakeDocument({text:fixture.text,originalHash:createHash('sha256').update(fixture.text).digest('hex'),fields:[],suggestions:['Canadá']});
 const doc=bindReviewedDocument(protection,'firm','matter'),source=prepareProtectedCase(seed,doc,'firm','matter',lib);
 const note=renderProtectedCase(JSON.stringify({proveedor:source.provider,hecho:source.facts[0],cita:source.ref.text.slice(0,90).trim(),solicitud:'¿Qué documento identifica el origen de los insumos?'}),source);
 const pack=prepareFollowup(source,quotedRanges(source,note),'control',['factura','pago']);
 assert.ok(pack.synthetic);const prompt=followupEnvelope(pack).messages[0].content;
 assert.ok(prompt.includes('[[PARTE_'));for(const value of [fixture.client,fixture.supplier,fixture.title,fixture.email,'Canadá',doc.snapshot.namespace])assert.ok(!prompt.includes(value));
 const internal=renderFollowup(check,pack);assert.ok(internal.includes('Proveedor registrado')&&internal.includes('[[DATO_'));
 assert.ok(!internal.includes('[[PARTE_'));
});

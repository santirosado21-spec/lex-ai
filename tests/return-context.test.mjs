import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {returnContext} from '../server/corpus/return-context.mjs';
import {questionCandidates} from '../server/corpus/intake-question.mjs';
import {questionPassage,researchEnvelope,renderResearchNote} from '../server/corpus/intake-research.mjs';

const doc=(id,original)=>({id,label:'Documento '+id,original});
const q='¿Volvió el mismo equipo de la factura FC-200?';
const order=doc('orden','Orden de retorno: OR-100\nEl medidor salió del país para inspección.');
const report=doc('informe','Factura: FC-200\nServicio para OR-100.\nEl taller ajustó el medidor.');
const unrelated=doc('otro','Orden de retorno: OR-300\nEl taller nunca salió del país.');
const check=(text,docs)=>returnContext(text,docs);

test('an invoice locates a linked order, each pertinent line, and keeps other equipment isolated',()=>{
 const ctx=check(q,[order,report,unrelated]);
 assert.equal(ctx.state,'supported');assert.deepEqual(ctx.lines.map(l=>[l.sourceId,l.line]),[['orden',2],['informe',3]]);
 const mixed=doc('otro','La máquina salió del país y el taller ajustó el medidor.');
 const chosen=(doc,line)=>({sourceId:doc.id,text:doc.original.split('\n')[line-1],line});
 assert.equal(returnContext(q,[mixed,report],[chosen(mixed,1),chosen(report,3)]).state,'unlinked');
 assert.equal(returnContext(q.replace('FC-200','FC-200 y FC-999'),[order,report],[chosen(order,2),chosen(report,3)]).state,'unlinked');
 assert.equal(returnContext(q,[order,report],[chosen(order,2),chosen(report,3)]).state,'supported');
 const sources=questionCandidates(null,q,[{text:q}],null,ctx);
 assert.equal(sources[0].source,'aduana-117');assert.ok(!sources.some(s=>s.source==='aduana-97'));
 for(const [text,state] of [
  ['Orden de retorno: OR-100\nEl equipo no salió del país.','domestic'],
  ['Orden de retorno: OR-100\nSe recibió desde el extranjero.','direction'],
  ['Orden de retorno: OR-100\nSe desconoce si el equipo salió del país.','direction'],
 ])assert.equal(check(q,[doc('var',text),report]).state,state);
 assert.equal(check(q,[order,doc('info','Factura: FC-200\nServicio para OR-100.\nEl taller no reparó la pieza.')]).state,'work');
 assert.equal(check(q,[order,report,doc('mixta','Orden de retorno: OR-300\nSoporte de OR-100.')]).state,'ambiguous');
 assert.equal(check('¿Regresó el mismo equipo de OR-100 y OR-300?',[order,report,unrelated]).state,'ambiguous');
 assert.equal(check('¿Regresó el mismo equipo de FC-200 y FC-201?',[order,report]).state,'unlinked');
 assert.equal(check('¿Regresó el mismo equipo?',[order,report]).state,'unlinked');
 assert.equal(check(q,[order,doc('informe',report.original+'\nSerie: SN-001\nSerie: SN-002')]).state,'ambiguous');
 assert.equal(check('¿Puede el comprador deducir el flete de FC-200?',[order,report]),null);
 assert.deepEqual(questionCandidates(null,q,[],{unavailable:true},ctx),[]);
});

test('the unchanged inspection fixture has an outbound line, while the warranty fixture leaves geography unresolved',async()=>{
 for(const [file,expected] of [['inspeccion','supported'],['transferencia-garantia','ambiguous']]){
  const {entries}=JSON.parse(await readFile('eval/privacy-trade/dialogo-'+file+'-r25.json','utf8'));
  const docs=entries.slice(0,2).map(r=>doc(r.kind,r.text));
  for(const row of entries.slice(2))assert.equal(check(row.text,docs).state,expected,row.kind);
 }
});

test('the model receives a normative identity question and the complete cited public paragraph',()=>{
 const note=questionPassage(null,{sourceId:'aduana-117',part:0,angle:'documentos',equipmentIdentity:true});
 const prompt=researchEnvelope(note).messages[0].content;
 assert.ok(prompt.includes('cambiar una pieza')&&!prompt.includes('FC-200'));
 const reply={lectura:'Cotejar el documento de salida y el informe de servicio permitiría identificar si se trata del mismo bien.',cita:note.body.slice(0,72),solicitud:'¿Qué documento identifica el equipo al regreso?'};
 assert.ok(renderResearchNote(JSON.stringify(reply),note).includes(reply.lectura));
 assert.match(renderResearchNote(JSON.stringify({...reply,cita:'Una cita que nunca se encuentra en la fuente'}),note),/Fundamento pendiente/);
});

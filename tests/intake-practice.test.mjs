import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openPublicLibrary} from '../server/public-library.mjs';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {bindReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {practiceDocument,prepareProtectedCase,protectedCaseEnvelope,renderProtectedCase} from '../server/corpus/pilot-protected-case.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';

test('an unverified practice envelope cannot reach OpenAI',async()=>{
 let posted=false;
 const generate=createIntakeGenerator({getApiKey:async()=>'unused',fetchImpl:()=>{posted=true;}});
 await assert.rejects(generate('case-note',{practice:{prompt:'Caso de otra procedencia'}}),/comprobado/);
 assert.equal(posted,false);
});

test('origin and quota cases pass only with their exact generated text, complete masked fields, operational facts and a pinned public source',async t=>{
 const file='resources/public-library.sqlite';
 try{await access(file);}catch{t.skip('Se requiere la biblioteca del piloto');return;}
 const library=await openPublicLibrary(file);t.after(()=>library.close());
 for(const seed of ['00'.repeat(12),'01'.repeat(12)]){
  const example=practiceDocument(seed);
  const review=await reviewIntakeDocument({text:example.text,originalHash:createHash('sha256').update(example.text).digest('hex'),
   fields:[],suggestions:[]});
  const doc=bindReviewedDocument(review,'w','m');
  const prepared=prepareProtectedCase(seed,doc,'w','m',library);
  const {messages}=protectedCaseEnvelope(prepared);
  const prompt=messages[0].content;
  for(const raw of [example.client,example.supplier,example.title,example.email])assert.ok(!prompt.includes(raw));
  assert.ok(!prompt.includes(doc.snapshot.namespace));
  for(const fact of example.facts)assert.ok(prompt.includes(fact));
  assert.equal(prepared.ref.article,example.article);
  const response={proveedor:prepared.provider,hecho:example.facts[1],cita:prepared.ref.text.slice(0,75),solicitud:'¿Qué documento respalda los hechos descritos?'};
  assert.match(renderProtectedCase(JSON.stringify(response),prepared),/\[\[DATO_\d+_[a-f0-9]{12}\]\]/);
  for(const change of [{proveedor:'[[PARTE_999]]'},{hecho:'Inventado'},{cita:'Referencia inventada para el borrador.'}]){
   assert.match(renderProtectedCase(JSON.stringify({...response,...change}),prepared),/Fundamento pendiente/);
  }
  assert.throws(()=>prepareProtectedCase(seed,doc,'w','otro',library));
  assert.throws(()=>prepareProtectedCase('03'.repeat(12),doc,'w','m',library));
  if(example.article==='9'){
   const geography=await reviewIntakeDocument({text:example.text,originalHash:createHash('sha256').update(example.text).digest('hex'),fields:[],suggestions:['Canadá']});
   const privateCountry=prepareProtectedCase(seed,bindReviewedDocument(geography,'w','m'),'w','m',library);
   assert.ok(!privateCountry.facts[0].includes('Canadá'));
   assert.match(privateCountry.facts[0],/ensambladas en \[\[PARTE_\d+\]\]/);
   const draft=renderProtectedCase(JSON.stringify({...response,proveedor:privateCountry.provider,hecho:privateCountry.facts[0]}),privateCountry);
   assert.match(draft,/ensambladas en \[\[DATO_/);
   assert.ok(!draft.includes('[[PARTE_'));
   const phrase=example.facts[0].split('importación de ')[1].slice(0,-1);
   const compound=await reviewIntakeDocument({text:example.text,originalHash:createHash('sha256').update(example.text).digest('hex'),fields:[],suggestions:[phrase]});
   const reduced=prepareProtectedCase(seed,bindReviewedDocument(compound,'w','m'),'w','m',library);
   assert.ok(!reduced.prompt.includes(phrase));assert.match(reduced.facts[0],/importación de \[\[PARTE_/);

  }
  const clear=bindReviewedDocument({restored:example.text,parts:[{text:example.text}],needsReview:false},'w','m');
  assert.throws(()=>prepareProtectedCase(seed,clear,'w','m',library),/identidad/);
  const needle=example.facts[1],start=example.text.indexOf(needle);
  const extraMask={...review,parts:[...review.parts]};
  const last=extraMask.parts.pop();
  assert.ok(last.text.endsWith(needle));
  extraMask.parts.push({text:last.text.slice(0,-needle.length)},{label:'Dato adicional',start,end:start+needle.length});
  assert.throws(()=>prepareProtectedCase(seed,bindReviewedDocument(extraMask,'w','m'),'w','m',library),/hechos/);
 }
});

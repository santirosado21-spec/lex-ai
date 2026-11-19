import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {bindReviewedDocument,openReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {createHash} from 'node:crypto';

async function review(text,suggestions=[],fields=[]){
 return reviewIntakeDocument({text,originalHash:createHash('sha256').update(text).digest('hex'),suggestions,fields});
}
const protectedForm=p=>p.parts.map(x=>x.text??'['+x.label+']').join('');

test('public caption syntax preserves headings while the same words in a private value remain covered',async()=>{
 const company='País de Origen';
 const doc='Columnas del pedimento: País de Origen, Unidad de Medida.\nNombre del proveedor: País de Origen\nCorreo de contacto: alfa@example.test';
 const r=await review(doc,[company,'Unidad de Medida','alfa@example.test']);
 const view=protectedForm(r);
 assert.match(view,/Columnas del pedimento: País de Origen, Unidad de Medida/);
 assert.ok(!view.split('\n')[1].includes(company));
 assert.ok(!view.includes('alfa@example.test'));
 const entityPriority=await review('País de Origen: prueba. Parte identificada: País de Origen.',[company],[company]);
 assert.ok(!protectedForm(entityPriority).includes(company));
});
test('a completed postal address ends before a fresh documentary action while retaining interior and another identity',async()=>{
 const doc='Domicilio: Av. Molino Muestra 63, CP 00006, Interior C. Se requiere ficha técnica y se envía a alfa@example.test.';
 const r=await review(doc);
 assert.equal(r.restored,doc);
 const view=protectedForm(r);
 assert.ok(!view.includes('Interior C')&&!view.includes('alfa@example.test'));
 assert.ok(view.includes('ficha técnica'));
});
test('the reversible document map is bound to the saved matter',async()=>{
 const r=await review('El correo ficticio es beta@example.test.');
 const doc=bindReviewedDocument(r,'w','m');
 assert.equal(openReviewedDocument(doc,'w','m').original,r.restored);
 assert.throws(()=>openReviewedDocument(doc,'w','other'));
 assert.throws(()=>openReviewedDocument({...doc,protectedText:doc.protectedText+' cambio'},'w','m'));
});
test('new document markers persist encrypted, stay out of cloud drafts, restore once and reject a foreign marker',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'rejon-mapa-'));
 const original='El proveedor ficticio envía confirmación a anil@example.test. Solicitar certificado de origen.';
 const bytes=Buffer.from(original).toString('base64');
 const sent=[];
 const generate=createIntakeGenerator({getApiKey:async()=>'sk-'+'s'.repeat(32),fetchImpl:async(url,opts)=>{
  sent.push(opts.body);return Response.json({choices:[{finish_reason:'stop',message:{content:'Atención [[CLIENTE]] con respecto a [[ASUNTO]].'}}]});
 }});
 const start=()=>startServer({dataDir:dir,autoInitialize:false,intakePilot:true,intakeGenerate:generate,pilotPassphrase:Buffer.from('frase ficticia del expediente'),libraryPath:path.join(dir,'ausente')});
 let app=await start();t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const call=(action,payload={})=>app.service.dispatch(action,payload);
 const fetchOriginal=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  return Response.json({message:{content:JSON.stringify({client:'',title:'',documentKind:'otro',entities:['anil@example.test']})}});
 };
 const fields={client:'Persona de Muestra',title:'Asunto Privado Ficticio',firm:'Despacho de Pruebas',jurisdiction:'MX-FED'};
 try{
  const first=await call('intake.inspectLocal',{base64:bytes,extension:'txt',review:true});
  const second=await call('intake.inspectLocal',{base64:bytes,extension:'txt',review:true});
  await assert.rejects(call('intake.save',{...fields,reviewId:first.reviewId}));
  assert.ok((await call('intake.save',{...fields,reviewId:second.reviewId})).hasDocument);
 }finally{globalThis.fetch=fetchOriginal;}
 assert.equal(sent.length,0);
 await call('intake.draft',{task:'opening'});
 const note=await call('intake.readDocument');
 const token=note.tokens.find(d=>d.value==='anil@example.test').token;
 const edited='Para [[CLIENTE]] en [[ASUNTO]], contactar a '+token+' y enviar copia a '+token+'.';
 await assert.rejects(call('intake.edit',{task:'opening',text:edited.replace(token,'[[DATO_999_000000000000]]')}));
 await call('intake.edit',{task:'opening',text:edited});
 await app.close(); app=await start();
 assert.equal((await call('intake.readDocument')).original,original);
 const {text}=await call('intake.preview',{task:'opening'});
 assert.equal(text.split('anil@example.test').length,3);
 const file=await call('intake.export',{task:'opening',format:'docx'});
 const {value}=await mammoth.extractRawText({buffer:Buffer.from(file.base64,'base64')});
 assert.ok(value.includes('anil@example.test')&&!value.includes(token));
 assert.equal(sent.length,1);
 assert.ok(!sent[0].includes('anil@example.test')&&!sent[0].includes(token)&&!sent[0].includes(fields.title));
 assert.ok(!(await readFile(path.join(dir,'rejon-protegido.sqlite'))).includes(Buffer.from('anil@example.test')));
});

test('transport references are substituted at each occurrence and ordinary documentary requests stay legible',async()=>{
 const id='FIC/7781.x',seal='A19-711';
 const original='Invoice No.: '+id+'\nSello de seguridad: '+seal+'\nVerificar origen del producto (fic/7781.x) y constancia de envío '+seal+'.';
 const inspected=await review(original);
 const protectedText=protectedForm(inspected);
 assert.equal(inspected.restored,original);
 assert.ok(!protectedText.toLowerCase().includes(id.toLowerCase())&&!protectedText.includes(seal));
 assert.match(protectedText,/origen del producto/);
 const missing='Se requiere la factura comercial. Invoice: pending.';
 assert.ok(protectedForm(await review(missing)).includes('pending'));
});

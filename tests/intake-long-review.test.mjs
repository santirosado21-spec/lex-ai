import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectLocalDocument} from '../server/intake-import.mjs';
import {intakeWindows} from '../server/privacy/intake-windows.mjs';
import {bindReviewedDocument,openReviewedDocument} from '../server/privacy/intake-document-map.mjs';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {reviewIntakeDocument} from '../server/privacy/intake-document-review.mjs';
import {reviewContextLocally} from '../server/privacy/intake-context-review.mjs';

test('a long imported file uses bounded overlapping local model inputs and restores its last page',async()=>{
 const last='Consorcio Zafiro Ficticio',first='Taller Greda Ficticio';
 const body='Se verificó la forma de la pieza contra el dibujo.\n'.repeat(1120);
 const text=first+' recibió el material. '+last+' figura en un anexo.\n'+body+'Cliente: '+last;
 const windows=intakeWindows(text),seen=[];
 assert.ok(text.length>55000&&windows.length>7);
 assert.ok(windows.every(w=>w.length<=8000));
 const fetchImpl=async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  const request=JSON.parse(opts.body),input=request.messages.at(-1).content;
  let response={oraciones:[]};
  if(request.format.properties.entities){
   seen.push(input);response={client:input.endsWith(last)?last:'',title:'',documentKind:'otro',entities:input.endsWith(last)?[last]:input.startsWith(first)?[first]:[]};
  }
  return Response.json({message:{content:JSON.stringify(response)}});
 };
 const view=await inspectLocalDocument({extension:'txt',base64:Buffer.from(text).toString('base64'),review:true},{fetchImpl});
 assert.deepEqual(seen,windows);assert.equal(view.reviewedWindows,windows.length);assert.equal(view.client,last);
 const opened=openReviewedDocument(bindReviewedDocument(view.protection,'firm','matter'),'firm','matter');
 assert.equal(opened.original,text);assert.ok(!opened.masked.includes(last)&&!opened.masked.includes(first));
 assert.throws(()=>intakeWindows('x'.repeat(60001)),/60 000/);
 assert.throws(()=>intakeWindows('z'.repeat(8200)),/8 000/);
 const vault=createPseudonymStore(),scope={workspaceId:'firm',matterId:'matter',threadId:'thread'};
 const {mappingVersion}=vault.protect({scope,entities:[],messages:[{role:'user',content:''}]});
 assert.throws(()=>vault.restore({scope,mappingVersion,text}));
 assert.throws(()=>vault.restoreReviewedDocument({scope,mappingVersion,text:text+'[[LEX_no]]'}));
});

test('a missing review in any model block leaves the whole review unavailable',async()=>{
 const text='Una nota documental para revisar.\n'.repeat(320);
 let calls=0;
 const view=await inspectLocalDocument({extension:'txt',base64:Buffer.from(text).toString('base64'),review:true},{fetchImpl:async()=>{
  return Response.json({message:{content:JSON.stringify({client:'',title:'',documentKind:'otro',...(++calls===1?{entities:[]}:{})})}});
 }});
 assert.ok(calls>1);assert.equal(view.protection.available,false);
});

test('technical grammar does not unmask a known party, a technical code used as a folio, or the named terminal',async()=>{
 const text='Incoterm: FOB Terminal de Prueba. El fabricante declara una etapa de extrusión. Clave de cliente: T6. El perfil de aluminio recibió tratamiento T6.';
 const r=await reviewIntakeDocument({text,originalHash:'a'.repeat(64),fields:['T6','fabricante'],suggestions:['FOB Terminal de Prueba','T6','fabricante','etapa de extrusión','perfil de aluminio']});
 const visible=r.parts.map(x=>x.text??'***').join('');
 assert.ok(visible.includes('FOB ***')&&visible.includes('etapa de extrusión')&&visible.includes('perfil de aluminio'));
 for(const v of ['Terminal de Prueba','T6','fabricante'])assert.ok(!visible.includes(v));
 const sample='Folio X19: El ensayo de tracción se realizó junto al antiguo atrio.';
 const select=async()=>({oraciones:[0]});
 assert.equal((await reviewContextLocally(sample,select)).ranges[0][0],0);
 assert.equal(sample.slice(...(await reviewContextLocally(sample,select,null,[{label:'Dato 1',start:6,end:9}])).ranges[0]),'junto al antiguo atrio.');
});

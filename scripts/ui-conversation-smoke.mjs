/** Unified assistant: real local HTTP/UI; all model responses are explicitly synthetic. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/main.mjs';

const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-unified-ui-'));
const calls=[];let hold=false,release,cancelled=0;
const inference={
 async status(){return {state:'ready',supported:true};},
 async stop(){release?.();},
 async *generate(messages,{responseFormat,signal}={}){
  calls.push({messages,responseFormat});
  if(responseFormat==='text'){
   yield 'Podemos organizar tus ideas ';
   if(hold)await new Promise((resolve,reject)=>{release=resolve;signal?.addEventListener('abort',()=>{cancelled++;reject(Error('Cancelación sintética'));},{once:true});});
   yield 'y preparar un plan de trabajo. Respuesta conversacional sintética.';
   return;
  }
  const {sources}=JSON.parse(messages.at(-1).content);
  const source=sources.find(s=>s.category==='internal-firm-document')||sources[0];assert.ok(source);
  yield JSON.stringify({analysis:`El pasaje recuperado ofrece contexto para la consulta y requiere revisión profesional. [${source.id}]`,citations:[{sourceId:source.id,quote:source.allowedQuotes[0]}]});
 }
};
const app=await startServer({dataDir,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'missing.sqlite')});
const report={mode:'unified assistant; synthetic model responses; actual local API and UI; no real inference',checks:[],startedAt:new Date().toISOString()};
const api=async(action,payload={})=>{const response=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:`Bearer ${app.connection.token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});assert.equal(response.status,200,action);return response.json();};
let browser,page;
try{
 await mkdir('artifacts/ui-conversation',{recursive:true});
 await api('workspace.create',{name:'Despacho sintético conversación',practiceAreas:['Penal']});
 browser=await chromium.launch({headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[],remote=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(!request.url().startsWith(app.connection.url)&&!request.url().startsWith('data:'))remote.push(request.url());if(request.url().endsWith('/analyze'))requests.push(request.postDataJSON());});
 // Voice is optional; its absence must not hide the written assistant.
 await page.route('**/api',async route=>{const body=route.request().postDataJSON();if(body.action==='stt.status')return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Dictado sintético no disponible'})});return route.continue();});
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
 const input=page.getByLabel('Pregunta sobre el asunto'),send=page.getByRole('button',{name:'Preguntar',exact:true}),turns=page.locator('.thread-turn');
 await expect(page.getByRole('combobox',{name:'Modo de conversación'})).toHaveCount(0);
 await expect(page.getByLabel('Habilidad',{exact:true})).toHaveValue('auto');await expect(input).toBeEnabled();
 const submit=async(question,count)=>{await input.fill(question);await expect(send).toBeEnabled();await send.click();await expect(turns).toHaveCount(count);await expect(input).toHaveValue('');};
 await submit('Hola, soy abogado penal, ¿cómo puedes ayudarme?',1);
 await expect(turns.last()).toContainText('Respuesta conversacional sintética.');
 await expect(turns.last()).toContainText('Sin fuentes verificadas para esta respuesta.');
 await expect(turns.last().getByText('Referencias comprobadas contra los fragmentos.',{exact:true})).toHaveCount(0);
 await submit('¿Qué dispone el artículo 1797 del Código Civil Federal?',2);
 await expect(turns.last().getByText('Referencias comprobadas contra los fragmentos.',{exact:true})).toBeVisible();
 await expect(turns.last().getByRole('button',{name:'Exportar DOCX',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Abrir escrito',exact:true})).toHaveCount(0);
 await submit('¿Y el artículo anterior?',3);
 // This fixture deliberately has no fragment index/library. Navigation must
 // abstain instead of recycling the predecessor as a newly verified source.
 await expect(turns.last().getByText('Referencias comprobadas contra los fragmentos.',{exact:true})).toHaveCount(0);
 await expect(turns.last()).toContainText(/fuente/i);
 assert.ok(requests.every(request=>request.mode==='auto'&&request.skillId==='auto'));
 let snapshot=await api('state');assert.equal(snapshot.chatTurns.length,2);assert.equal(snapshot.answers.length,1);assert.equal(snapshot.matters.length,0);assert.equal(snapshot.documents.length,0);
 assert.equal(calls[0].responseFormat,'text');assert.ok(calls.slice(1).every(call=>call.responseFormat!=='text'));
 report.checks.push('one default assistant and automatic skill; professional presentation and public legal request in one visible thread; navigation without a fragment index abstains instead of repeating the previous article','public-only sourced replies work without matter/documents, show verified references, and do not offer matter-dependent exports; ordinary chat does not claim verified sources','optional voice status failure does not block written interaction');
 const matter=await api('matter.create',{title:'Contrato sintético A',client:'Parte ficticia A',jurisdiction:'MX-FED'});
 const other=await api('matter.create',{title:'Asunto sintético B',client:'Parte ficticia B',jurisdiction:'MX-FED'});
 await api('document.import',{matterId:matter.id,name:'contrato.txt',base64:Buffer.from('Contrato sintético para prueba. Saludo incluido para esta prueba: Hola. Las partes establecen obligaciones de pago y entrega por servicios. Se revisan exclusivamente datos sintéticos.').toString('base64')});
 await api('document.import',{matterId:other.id,name:'ajeno.txt',base64:Buffer.from('MARCADOR_AJENO_DOCUMENTO privado sintético del segundo asunto.').toString('base64')});
 await page.reload();await expect(page.getByRole('combobox',{name:'Asunto activo'})).toHaveValue(matter.id);
 await expect(turns).toHaveCount(0);await expect(page.getByRole('button',{name:'Adjuntar documento',exact:true})).toBeEnabled();
 await page.getByLabel('Habilidad',{exact:true}).selectOption('legal-researcher');await submit('Hola',1);
 await expect(turns.last()).toContainText('Respuesta conversacional sintética.');assert.equal(calls.at(-1).responseFormat,'text');
 await expect(turns.last().getByText('Referencias comprobadas contra los fragmentos.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Nuevo chat',exact:true}).click();await expect(turns).toHaveCount(0);await page.getByLabel('Habilidad',{exact:true}).selectOption('auto');
 report.checks.push('Hola stays conversational with an active matter, a document containing the greeting and legal researcher selected');
 await submit('Ayúdame a organizar ideas para una reunión',1);
 await expect(turns.last()).toContainText('Respuesta conversacional sintética.');
 await submit('¿Qué obligaciones establece el contrato?',2);
 await expect(turns.last().getByRole('button',{name:'Exportar DOCX',exact:true})).toBeVisible();
 await expect(turns.last().getByText('Referencias comprobadas contra los fragmentos.',{exact:true})).toBeVisible();
 assert.ok(calls.every(call=>!JSON.stringify(call.messages).includes('MARCADOR_AJENO_DOCUMENTO')));
 await page.getByRole('combobox',{name:'Asunto activo'}).selectOption('');await expect(turns).toHaveCount(3);
 await page.getByRole('combobox',{name:'Asunto activo'}).selectOption(other.id);await expect(turns).toHaveCount(0);
 report.checks.push('matter conversation and document analysis share one thread; attachment available with matter; existing general history is retained; another matter stays isolated');
 hold=true;await input.fill('Borrador que debe sobrevivir a la cancelación');await send.click();await expect(page.getByRole('button',{name:'Cancelar',exact:true})).toBeVisible();
 await expect.poll(()=>typeof release).toBe('function');await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(input).toHaveValue('Borrador que debe sobrevivir a la cancelación');await expect.poll(()=>cancelled).toBe(1);hold=false;
 await expect(turns).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('combobox',{name:'Asunto activo'}).selectOption('');await expect(turns).toHaveCount(3);
 snapshot=await api('state');assert.equal(snapshot.chatTurns.filter(turn=>turn.matterId===other.id).length,0);
 report.checks.push('cancelled generation retains draft and is not saved or displayed in a different scope');
 // Multiple chats retain separate context through reload and the narrow drawer.
 await page.getByRole('button',{name:'Nuevo chat',exact:true}).click();await expect(turns).toHaveCount(0);await expect(input).toHaveValue('');
 const agenda='Ayúdame a preparar una reunión con una agenda';
 await submit(agenda,1);assert.ok(!JSON.stringify(calls.at(-1).messages).includes('Hola, soy abogado penal'));
 await submit('Hazla más breve',2);assert.ok(JSON.stringify(calls.at(-1).messages).includes(agenda));
 const history=page.getByRole('navigation',{name:'Historial de chats'});
 await expect(history.getByRole('button')).toHaveCount(2);
 await page.getByRole('searchbox',{name:'Buscar chats'}).fill('agenda');await expect(history.getByRole('button')).toHaveCount(1);
 await page.getByRole('searchbox',{name:'Buscar chats'}).fill('ningunresultado');await expect(history).toContainText('No hay chats con ese nombre.');
 await page.getByRole('searchbox',{name:'Buscar chats'}).fill('');
 await history.getByRole('button',{name:/Hola, soy abogado penal/}).click();await expect(turns).toHaveCount(3);
 await page.reload();await expect(turns).toHaveCount(3);
 await page.getByRole('combobox',{name:'Contexto de los chats'}).selectOption(other.id);await expect(turns).toHaveCount(0);await expect(history.getByRole('button')).toHaveCount(0);
 await page.getByRole('combobox',{name:'Contexto de los chats'}).selectOption('');await expect(turns).toHaveCount(3);
 await page.setViewportSize({width:1000,height:1000});const chats=page.getByRole('button',{name:'Chats',exact:true});await chats.click();
 await expect(page.getByRole('dialog',{name:'Chats',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(chats).toBeFocused();
 await chats.click();await page.getByRole('navigation',{name:'Historial de chats'}).getByRole('button',{name:/preparar una reunión con una agenda/}).click();await expect(turns).toHaveCount(2);await expect(page.getByRole('dialog',{name:'Chats',exact:true})).not.toBeVisible();
 await chats.click();await page.screenshot({path:'artifacts/ui-conversation/chats-drawer.png',fullPage:true});await page.getByRole('button',{name:'Cerrar chats',exact:true}).click();
 report.checks.push('multiple chats preserve separate real API histories and conversational context; search, selection, reload, matter isolation, 1000px drawer, Escape and focus return pass');
 if(await page.getByRole('button',{name:'Ocultar panel de contexto',exact:true}).isVisible())await page.getByRole('button',{name:'Ocultar panel de contexto',exact:true}).click();
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await expect(input).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),{message:`No overflow at ${width}px`}).toBe(false);
  const size=await send.boundingBox();assert.ok(size.width>=44&&size.height>=44);
  await page.screenshot({path:`artifacts/ui-conversation/conversation-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.checks.push('1440/768/390/320px layouts have no horizontal overflow, send target is at least44px, no browser exceptions or external requests');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;report.alerts=await page?.getByRole('alert').allTextContents();report.calls=calls.map(call=>({format:call.responseFormat,lastMessage:call.messages.at(-1).content.slice(0,200)}));await page?.screenshot({path:'artifacts/ui-conversation/failure.png',fullPage:true});process.exitCode=1;}
finally{release?.();await browser?.close();await app.close();report.finishedAt=new Date().toISOString();await writeFile('artifacts/ui-conversation/smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}

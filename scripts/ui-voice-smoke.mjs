/** Browser smoke only: fake microphone frames and fake local dictation transport. It never records real audio. */
import {chromium,expect} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../server/main.mjs';

const dataDir=await mkdtemp(path.join(os.tmpdir(),'lex-voice-ui-'));
const inference={async status(){return {state:'ready',supported:true};},async initialize(){return {state:'ready',supported:true};},async stop(){return {state:'stopped',supported:true};},async *generate(){yield JSON.stringify({analysis:'Respuesta sintética.',citations:[]});}};
const app=await startServer({dataDir,inference});let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const context=await browser.newContext();await context.addInitScript(()=>{
  class Port {onmessage;postMessage(){}}class Node {constructor(){this.port=new Port();}connect(){}disconnect(){}}class Context {sampleRate=48000;audioWorklet={addModule:async()=>{}};createMediaStreamSource(){return {connect:node=>setTimeout(()=>node.port.onmessage?.({data:new Float32Array(480).fill(.08).buffer}),0)};}close(){return Promise.resolve();}}
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})},configurable:true});Object.defineProperty(window,'AudioContext',{value:Context,configurable:true});Object.defineProperty(window,'AudioWorkletNode',{value:Node,configurable:true});
 });const page=await context.newPage();await page.route('**/api',async route=>{const request=route.request();let body;try{body=request.postDataJSON();}catch{return route.continue();}if(body?.action==='stt.status')return route.fulfill({json:{state:'ready',ready:true,installed:true,message:'Dictado listo en este equipo.'}});if(body?.action==='stt.transcribe')return route.fulfill({json:{text:'Texto de dictado sintético para revisar.'}});return route.continue();});
 await page.goto(`${app.connection.url}/#token=${app.connection.token}`);await page.getByLabel('Nombre del despacho').fill('Despacho sintético');await page.getByRole('button',{name:'Crear espacio privado'}).click();await page.getByRole('button',{name:'Asuntos',exact:true}).click();await page.getByRole('button',{name:'Nuevo asunto',exact:true}).click();await page.getByLabel('Nombre del asunto').fill('Asunto de dictado');await page.getByLabel('Cliente',{exact:true}).fill('Cliente sintético');await page.getByRole('button',{name:'Crear asunto'}).click();await page.getByRole('button',{name:'Asistente',exact:true}).click();
 await page.getByRole('button',{name:'Dictar texto'}).click();await expect(page.getByRole('button',{name:'Finalizar dictado'})).toBeVisible();await page.getByRole('button',{name:'Finalizar dictado'}).click();await expect(page.getByLabel('Pregunta sobre el asunto')).toHaveValue(/Texto de dictado sintético/);assert.equal(await page.getByRole('button',{name:'Preguntar',exact:true}).isEnabled(),true);console.log('Voice UI smoke passed: transcript is inserted and remains unsent.');
}finally{await browser?.close();await app.close();}

// Explicit opt-in test provider. Nothing here starts a runtime or sends a request.
import {setTimeout as delay} from 'node:timers/promises';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../resources/model-catalog.json',import.meta.url),'utf8'));

import {canonicalJson} from './canonical-json.mjs';

export function createMockInference({responses=[],chunkDelayMs=0,maxInputCharacters=catalog.maxInputCharacters}={}){
 const fixtures=JSON.parse(canonicalJson(responses));
 if(!Array.isArray(fixtures)||fixtures.some(r=>typeof r!=='string'&&(!Array.isArray(r)||r.some(c=>typeof c!=='string'))))throw Error('Las respuestas simuladas deben ser texto o listas de fragmentos de texto.');
 if(!Number.isInteger(chunkDelayMs)||chunkDelayMs<0||chunkDelayMs>60000)throw Error('Demora simulada inválida.');
 if(!Number.isInteger(maxInputCharacters)||maxInputCharacters<1||maxInputCharacters>7000)throw Error('Presupuesto simulado inválido.');
 const queue=fixtures.map(r=>typeof r==='string'?[r]:r),sent=[];
 let state='stopped',active;
 const status=()=>({state,model:'LEX AI',simulated:true,busy:Boolean(active),progress:state==='ready'?100:0});
 const cancelled=()=>Error('Análisis cancelado o tiempo máximo excedido.');
 return {
  outputContract:'paragraph-citations-v1',
  // Neither caller input nor mutation of a returned capture can change history.
  get sent(){return structuredClone(sent);},
  async status(){return status();},
  async initialize(){state='ready';return status();},
  async *generate(messages,{signal,outputSchema,responseFormat='json'}={}){
   if(state!=='ready')throw Error('Prepara LEX AI antes de analizar documentos.');
   if(active)throw Error('Ya hay un análisis en curso.');
   if(!['json','text'].includes(responseFormat)||responseFormat==='text'&&outputSchema)throw Error('Formato de respuesta no admitido.');
   if(!Array.isArray(messages)||!messages.length||messages.length>16)throw Error('El contexto excede el presupuesto local. Acota tu pregunta y las fuentes.');
   const envelope={version:1,messages,responseFormat,...(outputSchema===undefined?{}:{outputSchema})};
   const serialized=canonicalJson(envelope),request=JSON.parse(serialized);
   if(request.messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||request.messages.reduce((n,m)=>n+m.content.length,0)>maxInputCharacters||JSON.stringify(request.outputSchema||{}).length>16000)throw Error('El contexto excede el presupuesto local. Acota tu pregunta y las fuentes.');
   if(signal!==undefined&&!(signal instanceof AbortSignal))throw Error('Señal de cancelación inválida.');
   if(signal?.aborted)throw cancelled();
   if(!queue.length)throw Error('No quedan respuestas simuladas.');
   const controller=new AbortController();active=controller;
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
   try{
    sent.push({...request,serialized,bytes:new TextEncoder().encode(serialized)});
    const chunks=queue.shift();let characters=0;
    for(const chunk of chunks){
     if(controller.signal.aborted)throw cancelled();
     if(chunkDelayMs)await delay(chunkDelayMs,undefined,{signal:controller.signal});
     if(controller.signal.aborted)throw cancelled();
     characters+=chunk.length;if(characters>32768)throw Error('Respuesta local demasiado grande.');
     yield chunk;
    }
    if(controller.signal.aborted)throw cancelled();
   }catch(e){if(controller.signal.aborted)throw cancelled();throw e;}
   finally{signal?.removeEventListener('abort',abort);if(active===controller)active=undefined;}
  },
  async stop(){state='stopped';active?.abort();return status();}
 };
}

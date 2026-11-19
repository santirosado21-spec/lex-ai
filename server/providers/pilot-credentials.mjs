// Select local Keychain accounts before dispatch. Never replay an HTTP request.
import {createOpenAiKeychain} from './openai-keychain.mjs';

export function selectPilotCredential(mode='primary', read=slot=>createOpenAiKeychain({enabled:true,slot}).getApiKey(), selected=()=>{}) {
 if (!['primary','lorenzo','backup','alternate'].includes(mode)) throw new Error('Selecciona primary, lorenzo, backup o alternate.');
 let turn=0;
 const use=async slot=>{const key=await read(slot);selected(slot);return key;};
 return async () => {
  if (mode==='primary' || mode==='lorenzo') return use(mode);
  const slots=mode==='alternate' && (turn++%2===1) ? ['lorenzo','primary'] : ['primary','lorenzo'];
  try {return await use(slots[0]);} catch (error) {
   if (error?.code!=='credential_unavailable') throw error;
   return use(slots[1]);
  }
 };
}

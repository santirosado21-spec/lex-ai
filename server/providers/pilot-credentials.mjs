// Resolve credentials locally. Only explicit backup mode offers a second key after a confirmed refusal.
import {createOpenAiKeychain} from './openai-keychain.mjs';

export function selectPilotCredential(mode='primary', read=slot=>createOpenAiKeychain({enabled:true,slot}).getApiKey(), selected=()=>{}) {
 if (!['primary','lorenzo','backup','alternate'].includes(mode)) throw new Error('Selecciona primary, lorenzo, backup o alternate.');
 let turn=0, lastSlot;
 const use=async slot=>{const key=await read(slot);lastSlot=slot;selected(slot);return key;};
 const choose=async () => {
  if (mode==='primary' || mode==='lorenzo') return use(mode);
  const slots=mode==='alternate' && (turn++%2===1) ? ['lorenzo','primary'] : ['primary','lorenzo'];
  try {return await use(slots[0]);} catch (error) {
   if (error?.code!=='credential_unavailable') throw error;
   return use(slots[1]);
  }
 };
 if (mode==='backup') choose.afterRejection=async previous=>{
  if(lastSlot!=='primary')throw Error('Respaldo agotado.');
  const key=await read('lorenzo');
  if(key===previous)throw Error('La clave de respaldo coincide con la principal.');
  lastSlot='lorenzo';selected('lorenzo');return key;
 };
 return choose;
}


export async function selectTemporaryPilotCredential(mode, askHidden, selected) {
 if (!['primary','lorenzo','backup','alternate'].includes(mode)) throw Error('Modo de cuenta no válido.');
 const combined=mode==='backup'||mode==='alternate';
 const slots=combined?['primary','lorenzo']:[mode];
 const keys=new Map();
 for(const slot of slots){
  const label=slot==='primary'?'principal':'de Lorenzo';
  const literal=(await askHidden('Clave temporal '+label+(combined?' (Enter para omitir)':'')+': ')).trim();
  if(!literal&&combined)continue;
  if(!/^sk-[A-Za-z0-9_-]{20,256}$/.test(literal))throw Error('Formato de clave no válido.');
  keys.set(slot,literal);
 }
 if(!keys.size)throw Error('Ingresa al menos una clave para la sesión.');
 return selectPilotCredential(mode,async slot=>{
  if(!keys.has(slot))throw Object.assign(Error('Cuenta sin configurar.'),{code:'credential_unavailable'});
  return keys.get(slot);
 },selected);
}

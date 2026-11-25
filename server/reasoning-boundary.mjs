// Product composition boundary. The local engine is reserved for anonymization.
// No cloud route is activated by disabling legacy local reasoning.
export const REASONING_UNAVAILABLE = Object.freeze({
 available:false,
 code:'reasoning-route-unavailable',
 message:'El modelo local solo se usa para anonimizar. El razonamiento con OpenAI aún no está operativo en este espacio. Puedes consultar y editar el trabajo guardado; no se enviará esta consulta.',
});
export function createReasoningBoundary(local){
 if(!local||typeof local!=='object')throw Error('Motor local inválido.');
 const fail=()=>{throw Object.assign(new Error(REASONING_UNAVAILABLE.message),{code:REASONING_UNAVAILABLE.code});};
 return Object.freeze({
  reasoningStatus:REASONING_UNAVAILABLE,
  async status(){return {state:'unavailable',supported:false,busy:false,message:REASONING_UNAVAILABLE.message,reasoning:REASONING_UNAVAILABLE};},
  async initialize(){return fail();},
  async stop(){return local.stop?.();},
  async *generate(){fail();},
 });
}

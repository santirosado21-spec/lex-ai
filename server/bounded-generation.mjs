// One generation with at most one retry, only when the model's output was cut at the length cap
// (error code TRUNCATED_TEXT). Any other failure, or a second truncation, is raised as is: the
// caller never receives a trimmed or repaired answer presented as complete.
export const RETRY_INSTRUCTION='Reintento: cada text debe ser una o dos oraciones completas de menos de 250 caracteres, incluir las salvedades necesarias y terminar en punto.';
export const INCOMPLETE_MESSAGE='La respuesta del modelo quedó incompleta y no se muestra. Haz una pregunta más acotada e intenta de nuevo.';
export const DEADLINE_MS=180_000,TIMEOUT_MESSAGE='Análisis cancelado o tiempo máximo excedido.';
// One shared budget for the whole cycle (first attempt plus retry): the same deadline and the same
// character budget, never two full budgets. Caller cancellation is preserved.
export async function generateValidated({generate,validate,messages,signal,maxChars=40_000,deadlineMs=DEADLINE_MS,now=()=>Date.now()}){
 const started=now();let used=0;
 for(let attempt=0;attempt<2;attempt++){
  const remaining=deadlineMs-(now()-started);
  if(signal?.aborted)throw new Error('Análisis cancelado.');
  if(remaining<=0)throw new Error(TIMEOUT_MESSAGE);
  const timer=new AbortController(),handle=setTimeout(()=>timer.abort(),remaining);
  const cycle=AbortSignal.any([timer.signal,...(signal?[signal]:[])]);
  const turn=attempt?[...messages,{role:'user',content:RETRY_INSTRUCTION}]:messages;
  let raw='';
  try{
   for await(const chunk of generate(turn,{signal:cycle})){
    if(typeof chunk!=='string')throw new Error('El motor local devolvió un fragmento inválido.');
    raw+=chunk;used+=chunk.length;if(used>maxChars)throw new Error('El modelo superó el límite de salida.');
    if(cycle.aborted)break;
   }
  }catch(e){clearTimeout(handle);if(signal?.aborted)throw new Error('Análisis cancelado.');if(cycle.aborted)throw new Error(TIMEOUT_MESSAGE);throw e;}
  clearTimeout(handle);
  if(signal?.aborted)throw new Error('Análisis cancelado.');
  if(cycle.aborted)throw new Error(TIMEOUT_MESSAGE);
  try{return {value:validate(raw),attempts:attempt+1};}
  catch(error){
   if(error.code!=='TRUNCATED_TEXT')throw error;
   if(attempt===1){const final=new Error(INCOMPLETE_MESSAGE);final.code='INCOMPLETE_RESPONSE';throw final;}
  }
 }
}

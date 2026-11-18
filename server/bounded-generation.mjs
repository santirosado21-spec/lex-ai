// One generation with at most one retry, only when the model's output was cut at the length cap
// (error code TRUNCATED_TEXT). Any other failure, or a second truncation, is raised as is: the
// caller never receives a trimmed or repaired answer presented as complete.
export const RETRY_INSTRUCTION='Reintento: cada text debe ser una o dos oraciones completas de menos de 250 caracteres, incluir las salvedades necesarias y terminar en punto.';
export const INCOMPLETE_MESSAGE='La respuesta del modelo quedó incompleta y no se muestra. Haz una pregunta más acotada e intenta de nuevo.';
export async function generateValidated({generate,validate,messages,signal,maxChars=40_000}){
 for(let attempt=0;attempt<2;attempt++){
  const turn=attempt?[...messages,{role:'user',content:RETRY_INSTRUCTION}]:messages;
  let raw='';
  for await(const chunk of generate(turn,{signal})){
   if(typeof chunk!=='string')throw new Error('El motor local devolvió un fragmento inválido.');
   raw+=chunk;if(raw.length>maxChars)throw new Error('El modelo superó el límite de salida.');
  }
  if(signal?.aborted)throw new Error('Análisis cancelado.');
  try{return {value:validate(raw),attempts:attempt+1};}
  catch(error){
   if(error.code!=='TRUNCATED_TEXT')throw error;
   if(attempt===1){const final=new Error(INCOMPLETE_MESSAGE);final.code='INCOMPLETE_RESPONSE';throw final;}
  }
 }
}

const fold=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();

// Recall is a lookup of the user's own explicit statements, never a guess from
// assistant claims or documents. The caller supplies only the selected thread.
export function recallUserStatement(question,history){
 const q=fold(question);
 const name=/\b(?:como me llamo|cual es mi nombre|recuerdas mi nombre)\b/.test(q);
 const profession=/\b(?:recuerdas mi profesion|cual es mi profesion)\b/.test(q);
 if(!name&&!profession)return null;
 for(const turn of [...history].reverse()){
  const sentences=String(turn.question||'').match(/[^.!?\n]+[.!?]?/gu)||[];
  for(const sentence of sentences.reverse()){
   const statement=sentence.trim(),plain=fold(statement);
   if(statement.length>350||/\b(?:no|si|supongamos|imagina|ejemplo)\b.*\b(?:me llamo|mi nombre|soy|trabajo como|mi profesion)\b/.test(plain))continue;
   const declaration=name?/\b(?:me llamo|mi nombre(?: de prueba)? es)\s+\p{L}/u:/\b(?:soy|trabajo como|mi profesion es)\s+\p{L}/u;
   if(declaration.test(plain))return `Me dijiste: «${statement.replace(/[.!?]+$/,'')}».`;
  }
 }
 return `No encuentro tu ${name?'nombre':'profesión'} en el contexto disponible de este chat.`;
}

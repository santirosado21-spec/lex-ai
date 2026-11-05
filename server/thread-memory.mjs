import {createHash} from 'node:crypto';

// Planning estimate, not a measurement by the model tokenizer. UTF-8 / 2 is
// deliberately conservative for Spanish prose. The runtime also enforces 7k
// characters and disables truncation/context shifting; overflow fails closed.
export const CONTEXT_BUDGET=Object.freeze({instructions:600,memory:400,turns:700,passages:1700,response:512,context:4096});
export const estimateTokens=value=>Math.ceil(Buffer.byteLength(String(value),'utf8')/2);
export function clipTokens(value,budget){
 let result='';for(const char of String(value)){if(estimateTokens(result+char)>budget)break;result+=char;}return result;
}
const key=(workspaceId,matterId,threadId)=>'thread-memory-'+createHash('sha256').update(JSON.stringify([workspaceId,matterId,threadId])).digest('hex');

export function createThreadMemory({store,workspace,matter}){
 function scope(matterId,threadId=''){
  const w=workspace();if(!w)throw Error('Primero crea el espacio del despacho.');
  if(typeof matterId!=='string'||typeof threadId!=='string'||threadId&&!/^[A-Za-z0-9_-]{1,64}$/.test(threadId))throw Error('Conversación inválida.');
  if(matterId)matter(matterId);
  return {id:key(w.id,matterId,threadId),workspaceId:w.id,matterId,threadId};
 }
 function read(matterId,threadId=''){
  const s=scope(matterId,threadId),entry=store.get('thread-memory',s.id,s.matterId);
  return entry?.workspaceId===s.workspaceId&&entry.threadId===s.threadId?entry.summary:'';
 }
 function update(matterId,threadId,history){
  const s=scope(matterId,threadId);
  const turns=history.filter(t=>t.workspaceId===s.workspaceId&&t.matterId===s.matterId&&(t.threadId||'')===s.threadId);
  const older=turns.slice(0,-4);
  // Extractive memory retains the first request and recent older requests.
  // Assistant claims/citations are deliberately not promoted into memory.
  const selected=older.length>6?[older[0],...older.slice(-5)]:older;
  const summary=clipTokens(selected.map(t=>'Usuario: '+clipTokens(t.question.replace(/\s+/g,' '),55)).join('\n'),CONTEXT_BUDGET.memory-30);
  store.put('thread-memory',{...s,summary,version:1,summarizedTurns:older.length,updatedAt:new Date().toISOString()});
  return summary;
 }
 return {read,update};
}

export function buildUnifiedContext({instructions,question,memory='',history=[],sources=[],jurisdiction=''}){
 if(estimateTokens(instructions)>CONTEXT_BUDGET.instructions)throw Error('Instrucciones fuera del presupuesto local.');
 // The current question shares the recent-turn allowance; never silently cut it.
 if(estimateTokens(question)>CONTEXT_BUDGET.turns-40)throw Error('La consulta excede el presupuesto de este turno. Acótala para conservar las fuentes.');
 const conversation=[];
 for(const turn of history.slice(-4).reverse()){
  // Citation markers in past answers are added by the system; showing them makes
  // the model copy "[L1]" into its own text.
  const pair={user:clipTokens(turn.question,130),assistant:clipTokens(String(turn.text).replace(/\s*\[[^\]\n]{1,120}\]/g,''),180)};
  if(estimateTokens(JSON.stringify({question,conversation:[pair,...conversation]}))>CONTEXT_BUDGET.turns)break;
  conversation.unshift(pair);
 }
 const boundedMemory=clipTokens(memory,CONTEXT_BUDGET.memory-30),selected=[];
 for(const source of sources){
  if(estimateTokens(JSON.stringify([...selected,source]))>CONTEXT_BUDGET.passages)continue;
  selected.push(source);
 }
 const content={question,jurisdiction,conversation,memory:boundedMemory,sources:selected};
 const messages=[{role:'system',content:instructions},{role:'user',content:JSON.stringify(content)}];
 const inputTokens=messages.reduce((n,m)=>n+estimateTokens(m.content)+8,0);
 if(inputTokens+CONTEXT_BUDGET.response>CONTEXT_BUDGET.context||messages.reduce((n,m)=>n+m.content.length,0)>7000)throw Error('El contexto excede el presupuesto local. Acota tu pregunta.');
 return {messages,sources:selected,budget:{...CONTEXT_BUDGET,inputTokens,estimated:true}};
}

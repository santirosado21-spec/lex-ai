export const readerModel='qwen3.5:2b-q4_K_M';

// Probe only the fixed loopback model catalogue. Share no other model names
// with the pilot and do not load, install or change any model here.
export async function localReaderStatus({signal,fetchImpl=fetch}={}){
 const timeout=AbortSignal.timeout(3000);
 let response;
 try{
  response=await fetchImpl('http://127.0.0.1:11434/api/tags',{
   method:'GET',redirect:'error',signal:signal?AbortSignal.any([timeout,signal]):timeout,
  });
 }catch{signal?.throwIfAborted();return {state:'offline'};}
 try{
  if(!response.ok||!response.body)return {state:'unknown'};
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
   for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>262144){await reader.cancel();return {state:'unknown'};}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Array.isArray(data?.models)||!data.models.every(m=>typeof m?.name==='string'))return {state:'unknown'};
  const found=data.models.some(m=>m.name.toLowerCase()===readerModel.toLowerCase());
  return {state:found?'ready':'missing'};
 }catch{signal?.throwIfAborted();return {state:'unknown'};}
}

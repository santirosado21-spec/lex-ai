import { extname } from 'node:path';
import { Worker } from 'node:worker_threads';
export const MAX_BYTES=10*1024*1024;
export const MAX_TEXT=500_000;

export async function extractDocument(name, base64) {
  if (typeof name!=='string' || !name.trim() || name.length>200 || /[\\/\u0000-\u001f]/.test(name)) throw new Error('Nombre de archivo inválido.');
  if (typeof base64!=='string' || base64.length>Math.ceil(MAX_BYTES/3)*4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Archivo inválido o mayor a 10 MiB.');
  const bytes=Buffer.from(base64,'base64');
  if (!bytes.length || bytes.length>MAX_BYTES) throw new Error('Archivo vacío o mayor a 10 MiB.');
  const extension=extname(name).toLowerCase();
  if (!['.txt','.md','.docx','.pdf'].includes(extension)) throw new Error('Formato no admitido. Usa PDF, DOCX, TXT o Markdown.');
  let text;
  if (extension==='.txt'||extension==='.md') {
    try { text=new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
    catch { throw new Error('El texto debe estar codificado en UTF-8.'); }
  } else {
    text=await extractInWorker(extension,bytes);
  }
  text=text.replace(/\u0000/g,'').replace(/\r\n/g,'\n').trim();
  if (!text || text.length<10) throw new Error('No se encontró texto legible. Los PDF escaneados requieren OCR, aún no disponible.');
  if(text.length>MAX_TEXT) throw new Error('El documento supera el límite de 500 000 caracteres.');
  return { bytes, text, extension };
}

function extractInWorker(extension,bytes) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./extraction-worker.mjs',import.meta.url),{workerData:{extension,bytes},resourceLimits:{maxOldGenerationSizeMb:256}});
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(new Error('La extracción excedió 30 segundos.')),30_000);
    worker.on('message',m=>m.error?finish(new Error(m.error)):finish(null,m.text));
    worker.on('error',()=>finish(new Error('No se pudo procesar el archivo de forma segura.')));
    worker.on('exit',code=>{if(!settled)finish(new Error(`El extractor terminó sin texto (${code}).`));});
  });
}

export function chunkText(text, documentId, size=1600) {
  const chunks=[];
  for (let offset=0;offset<text.length;offset+=size-200) {
    chunks.push({id:`DOC-${documentId}-${chunks.length+1}`,text:text.slice(offset,offset+size)});
  }
  return chunks;
}

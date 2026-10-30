import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const bytes=Buffer.from(workerData.bytes);
async function preflightZip(bytes) {
  const yauzl=require('yauzl');
  await new Promise((resolve,reject)=>{
    yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error)return reject(new Error('DOCX inválido.'));
      let total=0,count=0,document=false,ended=false;
      const fail=()=>{if(ended)return;ended=true;zip.close();reject(new Error('DOCX excede límites seguros o contiene elementos no admitidos.'));};
      zip.on('error',fail);
      zip.on('entry',entry=>{
        total+=entry.uncompressedSize;count++;
        if(total>30*1024*1024 || count>1000 || entry.generalPurposeBitFlag&1 || /(^|\/)\.\.(\/|$)|vbaProject\.bin$/i.test(entry.fileName) || (entry.compressedSize>0 && entry.uncompressedSize/entry.compressedSize>200))return fail();
        if(entry.fileName==='word/document.xml')document=true;
        zip.readEntry();
      });
      zip.on('end',()=>{if(ended)return;ended=true;document?resolve():reject(new Error('El archivo no es un DOCX.'));});
      zip.readEntry();
    });
  });
}
try {
  let text;
  if(workerData.extension==='.docx') {
    await preflightZip(bytes);
    text=(await require('mammoth').extractRawText({buffer:bytes})).value;
  } else {
    if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('PDF inválido.');
    const pdf=require('pdf-parse/lib/pdf-parse.js');
    // PDF.js expects Uint8Array slicing semantics; Node Buffer.slice() aliases
    // memory and makes some valid cross-reference tables fail to parse.
    const parsed=await pdf(new Uint8Array(bytes),{max:200});
    if(parsed.numpages>200)throw new Error('El PDF supera el límite de 200 páginas. Divide el documento antes de importarlo.');
    text=parsed.text;
  }
  parentPort.postMessage({text});
} catch(e) {parentPort.postMessage({error:e.message || 'Error al extraer texto.'});}

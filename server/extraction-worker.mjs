import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const bytes=Buffer.from(workerData.bytes);
async function preflightZip(bytes,extension) {
  const sheet=extension==='.xlsx';
  const kind=sheet?'XLSX':'DOCX';
  const entryPoint=sheet?'xl/workbook.xml':'word/document.xml';
  const yauzl=require('yauzl');
  await new Promise((resolve,reject)=>{
    yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error)return reject(new Error(kind+' inválido.'));
      let total=0,count=0,document=false,ended=false;
      const fail=()=>{if(ended)return;ended=true;zip.close();reject(new Error(kind+' excede límites seguros o contiene elementos no admitidos.'));};
      zip.on('error',fail);
      zip.on('entry',entry=>{
        total+=entry.uncompressedSize;count++;
        if(total>30*1024*1024 || count>1000 || entry.generalPurposeBitFlag&1 || /(^|\/)\.\.(\/|$)|vbaProject\.bin$/i.test(entry.fileName) || (entry.compressedSize>0 && entry.uncompressedSize/entry.compressedSize>200))return fail();
        if(entry.fileName===entryPoint)document=true;
        zip.readEntry();
      });
      zip.on('end',()=>{if(ended)return;ended=true;document?resolve():reject(new Error('El archivo no es un '+kind+'.'));});
      zip.readEntry();
    });
  });
}
try {
  let text;
  if(workerData.extension==='.docx'||workerData.extension==='.xlsx') {
    await preflightZip(bytes,workerData.extension);
    if(workerData.extension==='.xlsx'){
      const {extractSpreadsheet}=await import('./extraction-spreadsheet.mjs');
      text=await extractSpreadsheet(bytes,workerData.maxText);
    }else text=(await require('mammoth').extractRawText({buffer:bytes})).value;
  } else {
    if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('PDF inválido.');
    const pdf=require('pdf-parse/lib/pdf-parse.js');
    // PDF.js expects Uint8Array slicing semantics; Node Buffer.slice() aliases
    // memory and makes some valid cross-reference tables fail to parse.
    // pdf-parse's default renderer joins text items on one line with no separator, so table cells like 'PZA' '1' '1,900,000.00' collapse into 'PZA11,900,000.00'
    // and silently change amounts. Same line grouping as the default; a space is added only where the items have a real horizontal gap and neither side already carries whitespace.
    const pagerender=async page=>{
      const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});
      let lastY,lastEnd,lastStr='',text='';
      for(const item of content.items){
        const x=item.transform[4],y=item.transform[5];
        if(lastY===undefined||lastY===y){
          if(lastY!==undefined&&Number.isFinite(lastEnd)&&x-lastEnd>1.5&&!/\s$/.test(lastStr)&&!/^\s/.test(item.str))text+=' ';
          text+=item.str;
        }else text+='\n'+item.str;
        lastY=y;lastEnd=x+(item.width||0);lastStr=item.str;
      }
      return text;
    };
    const parsed=await pdf(new Uint8Array(bytes),{max:200,pagerender});
    if(parsed.numpages>200)throw new Error('El PDF supera el límite de 200 páginas. Divide el documento antes de importarlo.');
    text=parsed.text;
  }
  parentPort.postMessage({text});
} catch(e) {parentPort.postMessage({error:e.message || 'Error al extraer texto.'});}

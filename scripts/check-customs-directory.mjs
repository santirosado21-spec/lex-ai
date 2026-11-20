// Independently read each mapped heading and each selected excerpt with PDF.js.
import assert from 'node:assert/strict';
import pdfjs from 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js';
import {customsDirectory,customsPdf,regulationDirectory,regulationPdf} from '../server/corpus/customs-edition.mjs';

async function verify(bytes,entries,regulation){
const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),verbosity:0});
const clean=text=>text.replace(/\s+/gu,' ').trim();
const pages=new Map();
async function pageText(page){
 if(!pages.has(page)){
  const sheet=await pdf.getPage(page);
  const {items}=await sheet.getTextContent();
  let text='',previous;
  for(const item of items){
   if(previous&&(Math.abs(item.transform[5]-previous.transform[5])>1||
      item.transform[4]-previous.transform[4]-previous.width>1.5))text+=' ';
   text+=item.str;
   previous=item;
  }
  pages.set(page,clean(text));
 }
 return pages.get(page);
}
let checked=0;
try{
 for(const {article,page,passages} of entries){
  const [base,...suffix]=article.split('-');
  const ordinal=Number(base)<10?'o':'';
  const parts=suffix.length===1&&suffix[0].length===1
   ?(ordinal?'.':'')+'-'+suffix[0]:suffix.map(s=>' '+s.toLowerCase()).join('');
  const title=base+ordinal+parts+'.';
  const text=await pageText(page);
  if(regulation)assert.ok(['Artículo ', 'Artículo. '].some(label=>text.includes(label+article+'.')),article+' (p. '+page+')');
  else assert.ok(['ARTICULO','Artículo','ARTÍCULO'].some(label=>text.includes(label+' '+title)),title+' (p. '+page+')');
  for(const passage of passages){
   const first=await pageText(passage.page);
   if(passage.endPage){
    const next=await pageText(passage.endPage);
    // PDF.js reads this edition's footer before the body in content-stream order.
    const headerEnd=passage.endPage+' de 220';
    assert.equal(next.split(headerEnd).length,2);
    const right=next.slice(next.indexOf(headerEnd)+headerEnd.length);
    assert.ok(clean(first+' '+right).includes(passage.text),passage.locator);
   }else assert.ok(first.includes(passage.text),article+' '+passage.locator);
   checked++;
  }
 }
 console.log((regulation?'Reglamento':'Ley')+' · '+entries.length+' encabezados y '+checked+' pasajes confirmados con PDF.js');
}finally{await pdf.destroy();}
}
await verify(customsPdf(),customsDirectory(),false);
await verify(regulationPdf(),regulationDirectory(),true);

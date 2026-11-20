// Reconstruct the body from PDF.js line positions independently of Poppler.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pdfjs from 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js';
import {regulationPdf} from '../server/corpus/customs-edition.mjs';

const clean=s=>s.replace(/\s+/gu,' ').trim();
const gold=JSON.parse(await readFile(new URL('../resources/trade/reglamento-aduanero-articulos.json',import.meta.url)));
const pdf=await pdfjs.getDocument({data:new Uint8Array(regulationPdf()),verbosity:0});
const result=[];
let article,finished=false;
try{
 for(let page=1;page<=pdf.numPages&&!finished;page++){
  const {items}=await (await pdf.getPage(page)).getTextContent();
  const lines=[];let previous,line='';
  for(const item of items){
   if(previous&&Math.abs(item.transform[5]-previous.transform[5])>1){
    if(clean(line))lines.push(clean(line));line='';
   }else if(previous&&item.transform[4]-previous.transform[4]-previous.width>1.5)line+=' ';
   line+=item.str;previous=item;
  }
  if(clean(line))lines.push(clean(line));
  const footer=lines.indexOf(page+' de '+pdf.numPages);
  assert.ok(footer>=0,'Falta número de página '+page);
  for(let text of lines.slice(footer+1)){
   if(text==='TRANSITORIOS'){finished=true;break;}
   if(/^(?:CAPÍTULO\s+(?:[IVXLC]+|ÚNICO)|TÍTULO\s+[A-ZÁÉÍÓÚ]+|SECCIÓN\s+\p{L}+)$/iu.test(text)){article=null;continue;}
   const heading=/^Artículo[.]?\s+(\d+(?:-[A-Z])?)\.[-]?\s*/u.exec(text);
   if(heading){article={article:heading[1],page,pages:[]};result.push(article);text=text.slice(heading[0].length);}
   if(!article||!text)continue;
   let current=article.pages.at(-1);
   if(current?.page!==page){current={page,text:''};article.pages.push(current);}
   current.text=clean(current.text+' '+text);
  }
 }
 assert.ok(finished);assert.equal(result.length,gold.length);
 let pages=0;
 for(const [i,row] of result.entries()){
  const stored=gold[i];assert.equal(row.article,stored.article);
  assert.deepEqual(row.pages.map(p=>p.page),stored.pages.map(p=>p.page),row.article);
  for(const [j,part] of row.pages.entries()){
   const expected=stored.pages[j].text;
   if(part.text!==expected){
    const pos=Array.from(part.text).findIndex((v,k)=>expected[k]!==v);
    throw Error('Diferencia en art. '+row.article+', p. '+part.page+' a '+pos+' · PDF.js '+part.text.slice(Math.max(0,pos-25),pos+65)+' · Poppler '+expected.slice(Math.max(0,pos-25),pos+65));
   }
   pages++;
  }
 }
 console.log(result.length+' artículos completos, '+pages+' bloques de página y '+result.filter(r=>r.pages.length>1).length+' artículos en varias páginas cotejados.');
}finally{await pdf.destroy();}

// Independent PDF.js extraction checks each code and full description on its physical PDF page.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pdfjs from 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js';
const root=new URL('../resources/trade/',import.meta.url);
const index=JSON.parse(await readFile(new URL('anexo22-apendice9.json',root)));
const compact=s=>s.normalize('NFKC').replace(/\s/gu,'');
let verified=0;
for(const e of index.editions){
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await readFile(new URL('anexo22-'+e.date+'.pdf',root))),disableFontFace:true}).promise;
 try{
  for(const n of new Set(e.rows.map(row=>row.page))){
   const page=await pdf.getPage(n),{items}=await page.getTextContent();
   const text=compact(items.map(v=>v.str).join(' '));
   for(const row of e.rows.filter(row=>row.page===n)){
    assert.ok(text.includes(compact(row.code+row.text)),[e.date,n,row.agency,row.code].join(' '));verified++;
   }
  }
 }finally{await pdf.destroy();}
}
assert.equal(verified,39);console.log({verified});

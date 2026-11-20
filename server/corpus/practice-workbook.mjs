import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const manifestHash='04c1037aea10143623e9af9b3112f17da87fc624581d11bb685d562bd5877470';
let catalogue;

export function certifiedWorkbook(source){
 if(source?.extension!=='xlsx'||!source.byteHash||source.contextComplete!==true)return null;
 if(!catalogue){
  const bytes=readFileSync(new URL('../../resources/trade/matrices-practica.json',import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==manifestHash)return null;
  catalogue=JSON.parse(bytes);
 }
 return catalogue.find(row=>row.fileSha256===source.byteHash&&row.sha256===source.document?.sha256)??null;
}

// The case annotation checks the output of the local privacy reader. It never
// substitutes data on the reader's behalf. Extra or partial masks change meaning.
export function workbookCellParts(cert,text,parts){
 if(!cert)return null;
 const prefix=/^Hoja 1 · ([A-Z]+[1-9]\d*) \| /u.exec(text);
 if(!prefix||!cert.cells.includes(prefix[1])||!parts[0]?.text?.startsWith(prefix[0]))return null;
 const values=parts.map((p,i)=>i===0?{text:p.text.slice(prefix[0].length)}:p);
 const original=text.slice(prefix[0].length);
 const actual=values.map(p=>p.text??(p.token&&cert.private.includes(p.value)?'\u0000':'\u0001')).join('');
 const expected=cert.private.reduce((s,v)=>s.replaceAll(v,'\u0000'),original);
 return actual===expected?values:null;
}

export function workbookInquiry(cert,original,protectedText,entries,values){
 if(!cert||original!==cert.question)return '';
 const stem=cert.questionStem;
 if(!original.startsWith(stem))return '';
 let expected=stem;
 for(const value of cert.private){
  const alias=values.get(value)?.out;
  if(!alias)return '';
  expected=expected.replaceAll(value,alias);
 }
 // The chosen legal provision supplies its own verified title. Only project
 // the substantive part of the question, retaining every mask within it.
 const marks=new Map(entries.map(e=>[e.marker,e.text]));
 let actual='',cursor=0;
 for(const part of protectedText.split(/(\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\])/gu)){
  if(cursor>=stem.length)break;
  const hidden=marks.get(part);
  if(hidden!==undefined){
   if(cursor+hidden.length>stem.length)return '';
   actual+=values.get(hidden)?.out??'\u0000';cursor+=hidden.length;
  }else{
   const count=Math.min(part.length,stem.length-cursor);
   actual+=part.slice(0,count);cursor+=count;
  }
 }
 return cursor===stem.length&&expected===actual?actual+'?':'';
}

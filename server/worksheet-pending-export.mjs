import {worksheetPendingBlocks} from './intake-trade-worksheet.mjs';

export async function exportWorksheetPending({firm,matter,sheet}){
 const {Document,Packer,Paragraph,TextRun,HeadingLevel}=await import('docx');
 const children=[new Paragraph({text:'Pendientes del control documental',heading:HeadingLevel.TITLE}),
  ...[['Despacho',firm.name],['Cliente',matter.client],['Asunto',matter.title]].map(([label,value])=>new Paragraph({children:[new TextRun({text:label+': ',bold:true}),new TextRun({text:value})]}))];
 for(const {kind,text} of worksheetPendingBlocks(sheet).slice(1)){
  // Structure comes from closed block kinds, never from text supplied by a user.
  const lines=text.split(/\r?\n/u),runs=[];
  for(const [index,line] of lines.entries())runs.push(new TextRun({text:line,...(index?{break:1}:{})}));
  children.push(new Paragraph({children:runs,...(kind==='heading'?{heading:HeadingLevel.HEADING_2}:kind==='item'?{bullet:{level:0}}:{})}));
 }
 const doc=new Document({creator:'Rejon.AI',title:'Pendientes del control documental',
  styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{after:140,line:270}}}}},
  sections:[{properties:{page:{margin:{top:900,right:900,bottom:900,left:900}}},children}]});
 const buffer=await Packer.toBuffer(doc);
 return {name:'Rejon-pendientes.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',base64:buffer.toString('base64')};
}

import {worksheetPendingNote} from './intake-trade-worksheet.mjs';

export async function exportWorksheetPending({firm,matter,sheet}){
 const {Document,Packer,Paragraph,TextRun,HeadingLevel}=await import('docx');
 const children=[new Paragraph({text:'Pendientes del control documental',heading:HeadingLevel.TITLE}),
  ...[['Despacho',firm.name],['Cliente',matter.client],['Asunto',matter.title]].map(([label,value])=>new Paragraph({children:[new TextRun({text:label+': ',bold:true}),new TextRun({text:value})]}))];
 for(const raw of worksheetPendingNote(sheet).split('\n\n').slice(1)){
  const heading=/^## (.+)$/u.exec(raw),bullet=/^- (.+)$/u.exec(raw);
  children.push(new Paragraph(heading?{text:heading[1],heading:HeadingLevel.HEADING_2}:bullet?{text:bullet[1],bullet:{level:0}}:{text:raw}));
 }
 const doc=new Document({creator:'Rejon.AI',title:'Pendientes del control documental',
  styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{after:140,line:270}}}}},
  sections:[{properties:{page:{margin:{top:900,right:900,bottom:900,left:900}}},children}]});
 const buffer=await Packer.toBuffer(doc);
 return {name:'Rejon-pendientes.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',base64:buffer.toString('base64')};
}

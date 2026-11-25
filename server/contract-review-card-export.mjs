// Local download of ONE stored manual card. No Markdown interpretation, remote
// content, generation or automatic sharing. Caller owns scope/revision checks.
export async function exportContractReviewCard({firm,matter,card}){
 const {Document,Packer,Paragraph,TextRun,HeadingLevel}=await import('docx');
 const children=[];
 const text=(value,style={})=>{const lines=String(value??'').split(/\r\n|\r|\n/u);children.push(new Paragraph({children:lines.map((line,i)=>new TextRun({text:line,...(i?{break:1}:{}),...style})),spacing:{after:120}}));};
 const heading=value=>children.push(new Paragraph({text:value,heading:HeadingLevel.HEADING_2,keepNext:true,spacing:{before:200,after:100}}));
 const field=(label,value)=>{text(label,{bold:true});text(value||'No declarado.');};
 const input=card.input;
 children.push(new Paragraph({text:'Ficha manual de revisión contractual',heading:HeadingLevel.TITLE}));
 text('Comentario redactado por el usuario. No es análisis generado por Rejon ni aprobación para firmar.');
 text(card.evidenceCurrent===false?'ADVERTENCIA: EVIDENCIA HISTÓRICA. El soporte o la edición jurídica actual cambió o no pudo verificarse. Se exporta únicamente el guardado original, sin vincularlo al texto actual.':'Citas del guardado coincidentes con las copias locales al exportar. Esto no acredita vigencia jurídica, aplicabilidad ni soporte lógico.');
 text('Archivo descargado sin cifrado del expediente. Puede contener nombres, citas y comentarios privados. Revisa el contenido y destinatario antes de compartir; no se envía automáticamente.');
 heading('Identidad del guardado');
 for(const [label,value]of [['Despacho actual',firm.name],['Cliente actual',matter.client],['Asunto actual',matter.title],['ID de ficha',card.id],['Revisión guardada',String(card.revision)],['Fecha de guardado (UTC)',card.updatedAt],['Autoría',card.authorship]])field(label,value);
 heading('Contexto declarado por el usuario');
 const kinds={documental:'Observación documental',negociacion:'Preferencia de negociación del usuario','juridica-manual':'Análisis jurídico redactado por el usuario'};
 for(const [label,value]of [['Clase de observación',kinds[input.kind]],['Estado manual',input.status==='pendiente'?'Pendiente':'Revisado por el usuario, no aprobado para firma'],['Parte representada',input.partyRole],['Jurisdicción declarada',input.jurisdiction],['Fecha de revisión declarada',input.asOf],['Cobertura declarada',input.coverage==='excerpt'?'Solo un extracto suministrado':input.coverage==='full'?'Texto completo declarado por el usuario':'Pendiente de declarar']])field(label,value);
 text('La cobertura declarada no acredita anexos leídos ni revisión completa.');
 heading('Observación manual del usuario');text(input.observation);
 heading('Qué falta resolver o preguntar');text(input.nextStep||'Pendiente de declarar.');
 heading('Cita contractual guardada');field('Documento',card.documentLabel);text(input.document.quote);
 field('Localizador del guardado',`ID ${input.document.id}; tramo UTF-16 [${input.document.start}, ${input.document.end}); SHA-256 ${input.document.sha256}`);
 heading('Fuente jurídica guardada');
 if(input.law&&card.legal){
  field('Fuente',card.legal.label);text(input.law.quote);field('Edición guardada',input.law.version);field('Página(s) PDF',(card.legal.pages??[]).join(', '));field('URL de fuente',card.legal.url);field('Fecha de recuperación de la copia',card.legal.retrievedAt);
  field('Localizador del guardado',`ID ${input.law.id}; tramo UTF-16 [${input.law.start}, ${input.law.end}); SHA-256 texto ${input.law.sha256}; SHA-256 PDF ${input.law.pdfSha256}`);
 }else text('Sin fuente jurídica vinculada. Fundamento y aplicabilidad pendientes de revisión.');
 text('Las citas y el comentario se conservan literalmente del guardado. La integridad textual no valida razonamiento, vigencia ni aplicabilidad.');
 const doc=new Document({creator:'Rejon.AI',title:'Ficha manual de revisión contractual',styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{after:120,line:260}}}}},sections:[{properties:{page:{margin:{top:900,right:900,bottom:900,left:900}}},children}]});
 return {name:'Rejon-ficha-manual-r'+card.revision+'.docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',base64:(await Packer.toBuffer(doc)).toString('base64')};
}

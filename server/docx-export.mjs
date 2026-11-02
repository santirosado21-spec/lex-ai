const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const BODY_FONT='Times New Roman';
const INK='000000';
const MUTED='555555';
const RULE='D9D9D9';
const NAVY='18324A';

const safeText=(value,fallback='')=>typeof value==='string'&&value.trim()?value.trim():fallback;
const dateForDocument=value=>{
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return safeText(value,'Fecha no disponible');
  return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
};
const officialUrl=value=>{
  try {const url=new URL(value);return url.protocol==='https:'?url.href:null;} catch {return null;}
};
const sourceLabel=(citation,index)=>`[${index+1}] ${safeText(citation.title,'Fuente recuperada')}${citation.article?` — Artículo ${citation.article}`:''}`;
const sourceDetails=(citation,answer)=>[
  `Versión: ${safeText(citation.version,'copia recuperada')}`,
  `Fecha: ${safeText(citation.retrievedAt,dateForDocument(answer.createdAt))}`,
  `Estado: ${safeText(citation.status,'vigencia no evaluada')}`,
].join(' · ');

export async function buildAnswerDocx({firm,matter,answer}) {
  const {
    AlignmentType,BorderStyle,Document,ExternalHyperlink,Footer,FootnoteReferenceRun,
    Header,HeadingLevel,LevelFormat,Packer,PageNumber,Paragraph,ShadingType,
    Table,TableCell,TableLayoutType,TableRow,TextRun,VerticalAlign,WidthType,
  }=await import('docx');
  const citations=Array.isArray(answer.citations)?answer.citations:[];
  const citationNumbers=new Map(citations.map((citation,index)=>[citation.id,index+1]));
  const bodyRun={font:BODY_FONT,size:22,color:INK};
  const bodyParagraph={alignment:AlignmentType.JUSTIFIED,spacing:{after:150,line:276},widowControl:true};
  const tableBorders={top:{style:BorderStyle.SINGLE,size:4,color:RULE},bottom:{style:BorderStyle.SINGLE,size:4,color:RULE},left:{style:BorderStyle.SINGLE,size:4,color:RULE},right:{style:BorderStyle.SINGLE,size:4,color:RULE},insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:RULE},insideVertical:{style:BorderStyle.SINGLE,size:4,color:RULE}};
  const cell=(children,{header=false,width}={})=>new TableCell({
    children,
    width:width?{size:width,type:WidthType.DXA}:undefined,
    verticalAlign:VerticalAlign.CENTER,
    margins:{top:90,bottom:90,left:100,right:100},
    shading:header?{type:ShadingType.CLEAR,color:'auto',fill:NAVY}:undefined,
    borders:{top:{style:BorderStyle.SINGLE,size:4,color:RULE},bottom:{style:BorderStyle.SINGLE,size:4,color:RULE},left:{style:BorderStyle.SINGLE,size:4,color:RULE},right:{style:BorderStyle.SINGLE,size:4,color:RULE}},
  });
  const tableText=(value,{bold=false,header=false,alignment=AlignmentType.LEFT,size=18}={})=>new Paragraph({
    alignment,
    spacing:{after:0,line:220},
    children:[new TextRun({text:safeText(value,'—'),font:BODY_FONT,size,bold,color:header?'FFFFFF':INK})],
  });
  const footnotes={},firstFootnote=new Map();let footnoteCount=0;
  const registerFootnote=citationNumber=>{
    const citation=citations[citationNumber-1],id=++footnoteCount,repeat=firstFootnote.get(citationNumber);
    if(repeat===undefined)firstFootnote.set(citationNumber,id);
    const lines=repeat===undefined
      ?[[sourceLabel(citation,citationNumber-1),true],[sourceDetails(citation,answer),false],[officialUrl(citation.url)??'Enlace oficial no disponible',false,'0563C1']]
      :[[`Ibíd. (véase nota ${repeat}): ${sourceLabel(citation,citationNumber-1)}`,false]];
    footnotes[id]={children:lines.map(([text,bold,color],i)=>new Paragraph({spacing:{after:i===lines.length-1?0:45,line:210},children:[new TextRun({text,font:BODY_FONT,size:18,bold,color})]}))};
    return id;
  };
  const citationRuns=text=>{
    const runs=[];let cursor=0;
    for(const match of text.matchAll(/\[([^\]\n]+)\]/g)){
      const index=match.index??0,id=match[1],citationNumber=citationNumbers.get(id);
      if(index>cursor)runs.push(new TextRun({...bodyRun,text:text.slice(cursor,index)}));
      if(citationNumber)runs.push(new FootnoteReferenceRun(registerFootnote(citationNumber)));
      else runs.push(new TextRun({...bodyRun,text:match[0]}));
      cursor=index+match[0].length;
    }
    if(cursor<text.length||!runs.length)runs.push(new TextRun({...bodyRun,text:text.slice(cursor)}));
    return runs;
  };
  let listInstance=0,prevNumbered=false;
  const analysisParagraphs=[];
  for(const rawLine of safeText(answer.text).split(/\r?\n/)){
    const line=rawLine.trim();if(!line)continue;
    const list=/^(?:\d+[.)]|[-*•])\s+(.+)$/u.exec(line);
    if(list){
      const startsNumber=/^\d+/.test(line);
      if(startsNumber&&!prevNumbered)listInstance++;
      prevNumbered=startsNumber;
      analysisParagraphs.push(new Paragraph({
        ...bodyParagraph,
        numbering:{reference:startsNumber?'legal-numbered':'legal-bullets',level:0,instance:startsNumber?listInstance:undefined},
        children:citationRuns(list[1]),
      }));
      continue;
    }
    prevNumbered=false;
    const heading=/^(#{1,3})\s+(.+)$/u.exec(line);
    if(heading){
      const levels=[HeadingLevel.HEADING_1,HeadingLevel.HEADING_2,HeadingLevel.HEADING_3];
      analysisParagraphs.push(new Paragraph({text:heading[2],heading:levels[heading[1].length-1]}));
      continue;
    }
    analysisParagraphs.push(new Paragraph({...bodyParagraph,children:citationRuns(line)}));
  }
  if(!analysisParagraphs.length)analysisParagraphs.push(new Paragraph({...bodyParagraph,children:[new TextRun({...bodyRun,text:'No se generó texto para este borrador.'})]}));

  const sourceRows=[new TableRow({tableHeader:true,children:[
    cell([tableText('Instrumento',{header:true,bold:true})],{header:true,width:2800}),
    cell([tableText('Artículo',{header:true,bold:true,alignment:AlignmentType.CENTER})],{header:true,width:900}),
    cell([tableText('Versión y fecha',{header:true,bold:true})],{header:true,width:2200}),
    cell([tableText('Enlace oficial',{header:true,bold:true})],{header:true,width:3300}),
  ]})];
  for(const [index,citation] of citations.entries()){
    const url=officialUrl(citation.url);
    const linkParagraph=url?new Paragraph({spacing:{after:0,line:220},children:[new ExternalHyperlink({link:url,children:[new TextRun({text:'Consultar fuente oficial',font:BODY_FONT,size:18,color:'0563C1',underline:{type:'single'}})]})]}):tableText('No disponible');
    sourceRows.push(new TableRow({cantSplit:true,children:[
      cell([tableText(sourceLabel(citation,index))],{width:2800}),
      cell([tableText(citation.article,{alignment:AlignmentType.CENTER})],{width:900}),
      cell([tableText(`${safeText(citation.version,'copia recuperada')}\n${safeText(citation.retrievedAt,dateForDocument(answer.createdAt))}\n${safeText(citation.status,'vigencia no evaluada')}`)],{width:2200}),
      cell([linkParagraph],{width:3300}),
    ]}));
  }
  if(!citations.length)sourceRows.push(new TableRow({children:[cell([tableText('No se recuperaron fuentes para este borrador.')],{width:9200})]}));

  const cover=[
    new Paragraph({text:safeText(firm.name,'Despacho'),style:'FirmName'}),
    new Paragraph({text:'Análisis jurídico',heading:HeadingLevel.TITLE}),
    new Paragraph({text:safeText(matter.title,'Asunto sin título'),style:'MatterName'}),
    new Paragraph({text:`Fecha: ${dateForDocument(answer.createdAt)}`,style:'MatterMeta'}),
    new Paragraph({text:'Borrador sujeto a revisión profesional',style:'ReviewNotice'}),
    new Paragraph({text:'Consulta',heading:HeadingLevel.HEADING_1}),
    new Paragraph({...bodyParagraph,children:[new TextRun({...bodyRun,text:safeText(answer.question,'Consulta no disponible')})]}),
    new Paragraph({text:'Análisis',heading:HeadingLevel.HEADING_1}),
  ];
  const disclaimer=[
    new Paragraph({text:'Aviso profesional',heading:HeadingLevel.HEADING_2}),
    new Paragraph({style:'Disclaimer',children:[new TextRun({text:'Este documento es un borrador informativo elaborado con base en las fuentes recuperadas para este asunto. No sustituye el análisis del abogado responsable, no constituye una opinión legal definitiva y no acredita la vigencia de las disposiciones citadas. Antes de usarlo, confirme los hechos, las fuentes y su vigencia aplicable.',font:BODY_FONT,size:20,italics:true,color:MUTED})]}),
  ];
  const document=new Document({
    creator:'LEX AI',title:'Análisis jurídico',description:'Borrador con fuentes para revisión profesional',
    footnotes,
    styles:{
      default:{document:{run:{font:BODY_FONT,size:22,color:INK},paragraph:bodyParagraph}},
      paragraphStyles:[
        {id:'FirmName',name:'Despacho',basedOn:'Normal',run:{font:BODY_FONT,size:24,bold:true,color:INK},paragraph:{spacing:{after:70}}},
        {id:'MatterName',name:'Asunto',basedOn:'Normal',run:{font:BODY_FONT,size:24,bold:true,color:INK},paragraph:{spacing:{after:36}}},
        {id:'MatterMeta',name:'Metadatos del asunto',basedOn:'Normal',run:{font:BODY_FONT,size:20,color:MUTED},paragraph:{spacing:{after:120}}},
        {id:'ReviewNotice',name:'Revisión profesional',basedOn:'Normal',run:{font:BODY_FONT,size:20,italics:true,color:MUTED},paragraph:{spacing:{after:250}}},
        {id:'Disclaimer',name:'Aviso profesional',basedOn:'Normal',run:{font:BODY_FONT,size:20,italics:true,color:MUTED},paragraph:{alignment:AlignmentType.JUSTIFIED,spacing:{after:0,line:250}}},
        {id:'Title',name:'Title',basedOn:'Normal',run:{font:BODY_FONT,size:32,bold:true,color:INK},paragraph:{spacing:{before:40,after:100},keepNext:true}},
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:BODY_FONT,size:26,bold:true,color:INK},paragraph:{spacing:{before:280,after:120},keepNext:true,outlineLevel:0}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:BODY_FONT,size:24,bold:true,color:INK},paragraph:{spacing:{before:220,after:90},keepNext:true,outlineLevel:1}},
        {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:BODY_FONT,size:22,bold:true,color:INK},paragraph:{spacing:{before:180,after:70},keepNext:true,outlineLevel:2}},
      ],
    },
    numbering:{config:[
      {reference:'legal-numbered',levels:[{level:0,format:LevelFormat.DECIMAL,text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:540,hanging:260}}}}]},
      {reference:'legal-bullets',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:540,hanging:260}}}}]},
    ]},
    sections:[{
      properties:{page:{size:{width:12240,height:15840},margin:{top:1224,right:1224,bottom:1224,left:1224,header:600,footer:600}}},
      headers:{default:new Header({children:[new Paragraph({
        border:{bottom:{style:BorderStyle.SINGLE,size:4,color:RULE,space:6}},
        tabStops:[{type:'right',position:9792}],
        children:[new TextRun({text:safeText(firm.name,'Despacho'),font:BODY_FONT,size:18,bold:true,color:INK}),new TextRun({text:'\tAnálisis jurídico · Borrador',font:BODY_FONT,size:18,color:MUTED})],
      })]})},
      footers:{default:new Footer({children:[new Paragraph({
        alignment:AlignmentType.CENTER,
        border:{top:{style:BorderStyle.SINGLE,size:4,color:RULE,space:6}},
        children:[new TextRun({text:'Borrador sujeto a revisión profesional · Página ',font:BODY_FONT,size:18,color:MUTED}),new TextRun({children:[PageNumber.CURRENT],font:BODY_FONT,size:18,color:MUTED})],
      })]})},
      children:[...cover,...analysisParagraphs,new Paragraph({text:'Fuentes recuperadas',heading:HeadingLevel.HEADING_1}),new Paragraph({text:'Las referencias se muestran como notas al pie en el análisis y se resumen para consulta.',style:'MatterMeta'}),new Table({rows:sourceRows,width:{size:9200,type:WidthType.DXA},columnWidths:[2800,900,2200,3300],layout:TableLayoutType.FIXED,borders:tableBorders}),...disclaimer],
    }],
  });
  return Packer.toBuffer(document);
}

export {DOCX_MIME};

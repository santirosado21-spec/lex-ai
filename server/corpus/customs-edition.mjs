import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../../resources/trade/',import.meta.url);
const pdfName='ley-aduanera-2025.pdf';
const pdfHash='43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d';
const passageHash='203b4bf2abfc83401dce86e6741ec8b66129383880a173818cb4593a5d52b665';
const official='https://www.diputados.gob.mx/LeyesBiblio/pdf/LAdua.pdf';
export const customsPdfPath='/fuentes/'+pdfHash+'.pdf';
export const customsLawId='MX-FED-LADUA';
let edition;

function checkedFile(name,hash){
 const bytes=readFileSync(new URL(name,root));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('La copia local de la fuente aduanera requiere cotejo.');
 return bytes;
}

export function customsPdf(){return checkedFile(pdfName,pdfHash);}

function loadEdition(){
 if(!edition){
  customsPdf();
  edition=JSON.parse(checkedFile('ley-aduanera-pasajes.json',passageHash).toString('utf8'));
 }
 return edition;
}

export function hasCustomsPassage(article){
 return Object.hasOwn(loadEdition(),article);
}

let directory;
export function customsDirectory(){
 if(!directory){
  const excerpts=loadEdition();
  const index=JSON.parse(checkedFile('ley-aduanera-indice.json','08ef2d304544fb3e1b5d1ed12ea0bd138301e886cb18718d4850d91173b40ad0'));
  directory=Object.entries(index).map(([article,page])=>{
   const source=Object.hasOwn(excerpts,article)?customsPassage(article):null;
   return {article,page,warning:source?.ref.summary??null,
    localUrl:customsPdfPath+'#page='+page,passages:(excerpts[article]??[]).map((p,i)=>({...p,condition:source.passages[i].condition??null}))};
  })
   .sort((a,b)=>a.page-b.page||a.article.localeCompare(b.article,'es',{numeric:true}));
 }
 return directory;
}

export function customsPassage(article){
 if(!hasCustomsPassage(article))throw Error('Artículo sin pasajes cotejados.');
 const passages=edition[article];
 const pages=[...new Set(passages.flatMap(p=>p.endPage?[p.page,p.endPage]:[p.page]))];
 const location=pages.length===1?'p. '+pages[0]:'pp. '+pages.join(' y ');
 const ref=Object.freeze({id:customsLawId+'-'+article,title:'Ley Aduanera',article,
  locator:'Artículo '+article+' · selección de pasajes · '+location+' · edición impresa 19-11-2025',
  checkedOn:'2026-11-19',pdfSha256:pdfHash,url:official+'#page='+pages[0],localUrl:customsPdfPath+'#page='+pages[0],
  historyUrl:'https://www.diputados.gob.mx/LeyesBiblio/ref/ladua.htm',
  text:passages.map(p=>'P. '+p.page+' · '+p.locator+'\n'+p.text).join('\n\n'),
  summary:'La Cámara registra una reforma posterior publicada el 23-10-2026. Coteja los transitorios y la fecha de la operación.'});
 const firstFraction=article==='65'?passages.find(p=>p.locator==='fracción I, encabezado'):null;
 const valuationContext=['66','67'].includes(article)?[passages[0].text,passages.at(-1).text].join('\n\n'):null;
 const linkageContext=article==='68'?passages[0].text.slice(0,passages[0].text.indexOf(':')+1):article==='69'?passages.slice(0,2).map(p=>p.text).join('\n\n'):article==='70'?[passages[0],...passages.slice(-2)].map(p=>p.text).join('\n\n'):null;
 const excludedHeading=article==='66'?passages.find(p=>p.locator==='fracción II, encabezado').text:null;
 return {ref,passages:passages.map(p=>({quote:p.text,locator:p.locator+(p.endPage?' · pp. '+p.page+'–'+p.endPage:' · p. '+p.page),
  ...(['97','117'].includes(article)&&p!==passages[0]?{condition:passages[0].text}:{}),
  ...(firstFraction&&p.locator==='fracción I, inciso d)'?{condition:firstFraction.text}:{}),
  ...(linkageContext?{condition:linkageContext}:{}),
  ...(valuationContext?{condition:valuationContext+(excludedHeading&&p.locator.startsWith('fracción II, inciso')?'\n\n'+excludedHeading:'')}:{})}))};
}

const regulationHash='bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812';
export const regulationTitle='Reglamento de la Ley Aduanera';
export const regulationLawId='MX-FED-REG-LADUA';
export const regulationPdfPath='/fuentes/'+regulationHash+'.pdf';
export const regulationPdf=()=>checkedFile('reglamento-aduanero-2026.pdf',regulationHash);
let regulationIndex;
export function regulationDirectory(){
 if(!regulationIndex){
  regulationPdf();
  const data=checkedFile('reglamento-aduanero-indice.json','c55e83a216dec11004c22fcd87d90b711d1bec5873965a72bef0e6ab1e93ab31');
  const published=JSON.parse(data);
  const complete=JSON.parse(checkedFile('reglamento-aduanero-articulos.json','8c5b01794d36513043d6932976f64c8572e607d6575ff33bb46efae66ab1bd94'));
  if(complete.length!==published.length)throw Error('El índice del Reglamento requiere cotejo.');
  regulationIndex=complete.map(({article,page,pages},i)=>{
   const prior=published[i],last=pages.at(-1).page;
   if(prior.article!==article||prior.page!==page)throw Error('Cambió la paginación del Reglamento.');
   const text=pages.map(p=>p.text).join(' ');
   const pageTexts=pages.map(p=>({page:p.page,paragraphs:p.starts.map((start,i)=>p.text.slice(start,p.starts[i+1]??p.text.length).trimEnd())}));
   const full={page,...(last>page?{endPage:last}:{}),pageTexts,locator:'texto del artículo',text,full:true};
   const repealed=text.startsWith('Derogado.');
   const passages=prior.passages.some(p=>p.text===text)?prior.passages:[...prior.passages,full];
   return {article,page,localUrl:regulationPdfPath+'#page='+page,passages,repealed};
  });
 }
 return regulationIndex;
}

export function regulationPassage(article){
 const entry=regulationDirectory().find(row=>row.article===article);
 if(!entry)throw Error('Artículo del Reglamento sin texto cotejado.');
 const {page,passages,localUrl}=entry;
 const refs=passages.map(p=>{
  const location=(p.endPage?'pp. '+p.page+'–'+p.endPage:'p. '+p.page);
  return Object.freeze({id:regulationLawId+'-'+article,title:regulationTitle,article,
   locator:'Artículo '+article+' · '+p.locator+' · '+location+' · edición 23-02-2026',checkedOn:'2026-11-19',
   pdfSha256:regulationHash,localUrl,url:'https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf#page='+page,
   text:p.text,summary:entry.repealed?'La edición identifica este artículo como derogado. Comprueba la versión aplicable en la fecha de la operación.':'Comprueba la fecha de la operación y las disposiciones transitorias del Reglamento.'});
 });
 return {ref:refs[0],passages:passages.map((p,i)=>({quote:p.text,reference:refs[i],full:p.full===true,
  locator:p.locator+(p.endPage?' · pp. '+p.page+'–'+p.endPage:' · p. '+p.page)}))};
}

// Resolve a single reference when the question discusses both the statute and
// its regulation. A nested title is not an independent mention of the statute.
export function customsInstrumentForArticle(query){
 const text=query.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const articles=[...text.matchAll(/\b(?:articulos?|arts?[.]?)\s+\d{1,6}(?:\s*-\s*[a-z])?/gu)];
 if(articles.length!==1)return null;
 const titles=[...text.matchAll(/\b(?:reglamento (?:de la ley aduanera|aduanero)|ley aduanera)\b/gu)];
 const id=t=>t[0].startsWith('reglamento')?regulationLawId:customsLawId;
 if(new Set(titles.map(id)).size<2)return null;
 const a=articles[0],end=a.index+a[0].length;
 const after=titles.find(t=>t.index>=end&&/^\s*(?:,?\s*(?:fraccion\s+[ivxlcdm]+|inciso\s+[a-z]\)?|parrafo\s+(?:primero|segundo|tercero)))?\s*,?\s*(?:de la|del)\s*$/u.test(text.slice(end,t.index)));
 if(after)return {lawId:id(after)};
 const before=titles.filter(t=>t.index<a.index&&/^\s*[,:(]?\s*$/u.test(text.slice(t.index+t[0].length,a.index))).at(-1);
 return before?{lawId:id(before)}:{unavailable:true};
}

// Preserve an existing, pinned source warning in local documents. This does
// not fetch reforms, establish current law or change any provider envelope.
export function customsEditionWarnings(refs){
 return [...new Set(refs.filter(ref=>ref?.id?.startsWith(customsLawId+'-')&&typeof ref.summary==='string').map(ref=>ref.summary))];
}

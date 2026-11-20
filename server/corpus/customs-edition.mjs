import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../../resources/trade/',import.meta.url);
const pdfName='ley-aduanera-2025.pdf';
const pdfHash='43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d';
const passageHash='300144a3d2f557b8ae2ff6ff286b87d4f4df4295eafdd79de1a93bc9991145d5';
const official='https://www.diputados.gob.mx/LeyesBiblio/pdf/LAdua.pdf';
export const customsPdfPath='/fuentes/'+pdfHash+'.pdf';
export const customsLawId='MX-FED-LADUA';
let edition;

function checkedFile(name,hash){
 const bytes=readFileSync(new URL(name,root));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('La copia local de la Ley Aduanera requiere cotejo.');
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
  directory=Object.entries(index).map(([article,page])=>({article,page,
   localUrl:customsPdfPath+'#page='+page,passages:excerpts[article]??[]}))
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
 return {ref,passages:passages.map(p=>({quote:p.text,locator:p.locator+(p.endPage?' · pp. '+p.page+'–'+p.endPage:' · p. '+p.page),
  ...(['97','117'].includes(article)&&p!==passages[0]?{condition:passages[0].text}:{}),
  ...(firstFraction&&p.locator==='fracción I, inciso d)'?{condition:firstFraction.text}:{})}))};
}

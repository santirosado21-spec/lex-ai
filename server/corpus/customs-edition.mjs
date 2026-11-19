import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../../resources/trade/',import.meta.url);
const pdfName='ley-aduanera-2025.pdf';
const pdfHash='43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d';
const passageHash='9eb68abae5c21a2f9ec9c1e5c3ba067f2031a41954c24b38f591db32c1c7a956';
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

export function customsPassage(article){
 if(!edition){
  customsPdf();
  edition=JSON.parse(checkedFile('ley-aduanera-pasajes.json',passageHash).toString('utf8'));
 }
 if(!Object.hasOwn(edition,article))throw Error('Artículo sin pasajes cotejados.');
 const passages=edition[article];
 const pages=[...new Set(passages.map(p=>p.page))];
 const location=pages.length===1?'p. '+pages[0]:'pp. '+pages.join(' y ');
 const ref=Object.freeze({id:customsLawId+'-'+article,title:'Ley Aduanera',article,
  locator:'Artículo '+article+' · selección de pasajes · '+location+' · edición impresa 19-11-2025',
  checkedOn:'2026-11-19',pdfSha256:pdfHash,url:official+'#page='+pages[0],localUrl:customsPdfPath+'#page='+pages[0],
  historyUrl:'https://www.diputados.gob.mx/LeyesBiblio/ref/ladua.htm',
  text:passages.map(p=>'P. '+p.page+' · '+p.locator+'\n'+p.text).join('\n\n'),
  summary:'La Cámara registra una reforma posterior publicada el 23-10-2026. Coteja los transitorios y la fecha de la operación.'});
 const firstFraction=article==='65'?passages.find(p=>p.locator==='fracción I, encabezado'):null;
 return {ref,passages:passages.map(p=>({quote:p.text,locator:p.locator+' · p. '+p.page,
  ...(firstFraction&&p.locator==='fracción I, inciso d)'?{condition:firstFraction.text}:{})}))};
}

// Harness de verificación extractor v17→v22 (revisión independiente 2026-11-11).
// Uso: node scripts/qa/reconciliar-pdfjs.mjs [raiz-corpus] [fecha-corte-ISO] — por defecto artifacts/public-corpus y 2026-11-11T18:50:00-06:00.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
const root=process.argv[2]||'.';
const jobs=[
 ['fed-diagnostic-1','lgsmime',['12','21','21-BIS','37','43','43-BIS','43-TER','56','63','77','77-BIS','77-TER','78-BIS']],
 ['fed-diagnostic-1','reg-senado',['25','56','56-BIS','56-TER','56-QUATER','56-QUINQUIES','221','265','265-BIS']],
 ['fed-diagnostic-1','loefam',['21','23','31','32','75','77','95-QUINQUIES','130','138','156','170']],
];
const removable=[
 /^\s*$/,/^\[LEX_PAGE_\d+\]$/,/^LEY GENERAL DEL SISTEMA DE MEDIOS/,/^REGLAMENTO DEL SENADO DE LA REP/,/^LEY ORG\u00c1NICA DEL EJ\u00c9RCITO/,
 /^(?:De (?:la|las|los|del)|Del) [A-Za-zÁÉÍÓÚÑáéíóúñ][^.:;!?"'»)\]]{0,100}$/,
 /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'()-]{7,90}$/,
 /^(?:Servicio|Cuerpo) /,/^(?:Generalidades|Disposiciones)$/,
 /^CÁMARA DE DIPUTADOS/,/^Secretaría General$/,/^Secretaría de Servicios Parlamentarios$/,/^Últimas?\s+Reformas?\s+DOF/i,/^\d+ de \d+$/,
 /^(?:Artículo|Párrafo|Sección|Subsección|Capítulo|Título|Apartado|Numeral|Inciso|Denominación|Fracción|Transitorio) (?:reformad|adicionad|derogad|recorrid)/i,
 /^Fe de erratas/i,/^Denominación (?:reformada|adicionada)/i,
 /^(?:LIBRO|TÍTULO|TITULO|CAP[IÍ]TULO|SECCI[OÓ]N|SECCION|APARTADO|SUBSECCI[OÓ]N|PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PTIMO|OCTAVO|NOVENO|D[EÉ]CIMO|[IVXL]+\.)[A-ZÁÉÍÓÚÑ ,.'()\-–—\d]*$/i,
];
const norm=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
function spanLines(raw,headingRe,nextRe){
  const lines=raw.split('\n');const out=[];let on=false;
  for(const l of lines){const t=norm(l);if(!t)continue;
    if(!on&&headingRe.test(t)){on=true;continue;}
    if(on&&nextRe.test(t))break;
    if(on)out.push(t);}
  return out;
}
let fail=0;
for(const [batch,doc,ids] of jobs){
  const dir=path.join(root,'artifacts/public-corpus',batch);
  const snapDir=path.join(dir,'acquisitions/snapshots',doc);
  const pdfSha=readdirSync(snapDir)[0];
  const bytes=readFileSync(path.join(snapDir,pdfSha));
  const {text:raw}=await pdf(new Uint8Array(bytes),{pagerender:async page=>{
    const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});let text=`[LEX_PAGE_${page.pageNumber}]\n`,lastY;
    for(const item of content.items){text+=(lastY===undefined||lastY===item.transform[5]?'':'\n')+item.str;lastY=item.transform[5];}return text;}});
  const exDir=path.join(dir,'extractions',doc,pdfSha.replace(/\.pdf$/,''));
  const files=readdirSync(exDir).filter(f=>f.endsWith('.json')).sort((a,b)=>statSync(path.join(exDir,a)).mtimeMs-statSync(path.join(exDir,b)).mtimeMs);
  const ex=JSON.parse(readFileSync(path.join(exDir,files[files.length-1]),'utf8'));
  const recs=new Map(ex.records.map(r=>[r.articleId,r.text]));
  for(const id of ids){
    const num=id.replace(/-.*$/,'');const suf=id.includes('-')?id.split('-').slice(1).join(' '):null;
    const headRe=suf?new RegExp(`^ART[ÍI]CULO\\s+${num}\\s+${suf.replace('QUINQUIES','QUINQUIES')}(\\s|$|[.,])`,'i'):new RegExp(`^ART[ÍI]CULO\\s+${num}(\\s|$|[.,-])`,'i');
    const nextRe=/^ART[ÍI]CULO\s+\d/i;
    const span=spanLines(raw,headRe,nextRe);
    const text=recs.get(id);
    if(!text){console.log(`FAIL ${doc} ${id}: sin registro`);fail++;continue;}
    const unexplained=[];
    for(const l of span){
      if(text.includes(l))continue;
      if(removable.some(r=>r.test(l)))continue;
      if(l.length<4)continue;
      // wrapped fragments: a line may be split; check its half
      const half=l.slice(0,Math.ceil(l.length/2));
      if(half.length>=12&&text.includes(half))continue;
      unexplained.push(l);
    }
    if(unexplained.length){fail++;console.log(`FAIL ${doc} ${id}: ${unexplained.length} líneas sin explicación:`);unexplained.slice(0,5).forEach(l=>console.log('   | '+l.slice(0,110)));}
    else console.log(`OK   ${doc} ${id}: ${span.length} líneas reconciliadas, len=${text.length}`);
  }
}
process.exitCode=fail?1:0;

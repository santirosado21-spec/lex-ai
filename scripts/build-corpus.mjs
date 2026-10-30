import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const norm=s=>s.normalize('NFC').replace(/\s+/g,' ').trim();
const fold=s=>norm(s).normalize('NFD').replace(/\p{M}/gu,'').toUpperCase();

export function extractSelectedArticle(raw,number,title){
  const re=new RegExp('^[ \\t]*ART[ÍI]CULO[ \\t]+'+number+'(?:o\\.?)?[ \\t]*[.\\-]','im');
  const start=re.exec(raw);if(!start)throw new Error(`Artículo ${number} no encontrado en ${title}.`);
  const after=start.index+start[0].length;const next=/^[ \t]*ART[ÍI]CULO[ \t]+\d+/im.exec(raw.slice(after));
  if(!next)throw new Error(`Límite del artículo ${number} no encontrado.`);
  const snippet=raw.slice(start.index,after+next.index);
  const priorPage=[...raw.slice(0,start.index).matchAll(/\[LEX_PAGE_(\d+)\]/g)].at(-1)?.[1];
  const pages=[];let currentPage=Number(priorPage);
  const amendmentNotes=[];const lines=[];
  for(const line of snippet.split('\n')){
    const trimmed=norm(line);if(!trimmed)continue;
    const marker=/^\[LEX_PAGE_(\d+)\]$/.exec(trimmed);if(marker){currentPage=Number(marker[1]);continue;}
    if(fold(trimmed)===fold(title)||/^CÁMARA DE DIPUTADOS|^Secretaría General$|^Secretaría de Servicios Parlamentarios$|^Última Reforma DOF|^\d+ de \d+$/i.test(trimmed))continue;
    // Parenthesized CDMX annotations immediately precede the next article.
    if(/^\((?:REFORMADO|ADICIONADO)/i.test(trimmed))continue;
    if(/^(?:Artículo|Párrafo|Fracción|Inciso)\s+(?:reformad|adicionad|derogad)/i.test(trimmed)){amendmentNotes.push(trimmed);continue;}
    if(currentPage&&!pages.includes(currentPage))pages.push(currentPage);
    lines.push(trimmed);
  }
  // Explicit known following section titles, never a broad heuristic that could delete operative text.
  while(lines.length&&/^(?:DE LA CAPACIDAD|T[IÍ]TULO PRIMERO|DE LOS COMERCIANTES)$/i.test(lines.at(-1)))lines.pop();
  const text=norm(lines.join(' '));
  if(text.length<40||text.length>15_000||/Secretaría General|CÁMARA DE DIPUTADOS|LEX_PAGE_|INSTITUTO DE INVESTIGACIONES/.test(text))throw new Error(`Extracción ambigua del artículo ${number}: requiere revisión manual.`);
  return {text,pages,amendmentNotes};
}

async function readPdf(bytes){
  return pdf(new Uint8Array(bytes),{pagerender:async page=>{
    const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});let text=`[LEX_PAGE_${page.pageNumber}]\n`,lastY;
    for(const item of content.items){text+=(lastY===undefined||lastY===item.transform[5]?'':'\n')+item.str;lastY=item.transform[5];}return text;
  }});
}

export async function buildCorpus({writeApproved=false}={}){
  const catalog=JSON.parse(await readFile(path.join(root,'resources/legal-sources.json'),'utf8')).sources;
  const selection=JSON.parse(await readFile(path.join(root,'resources/legal-snapshots/seed-review.json'),'utf8'));
  const corpus=[];
  for(const reviewed of selection.sources){
    const source=catalog.find(x=>x.id===reviewed.id);if(!source)throw new Error('Fuente desconocida en selección revisada.');
    const snapshotPath=`legal-snapshots/${source.id}.pdf`;const bytes=await readFile(path.join(root,'resources',snapshotPath));
    if(sha(bytes)!==reviewed.pdfSha256)throw new Error(`La versión de ${source.id} no es la seleccionada; se requiere nueva revisión.`);
    const {text:raw}=await readPdf(bytes);const cover=raw.slice(0,3000);const reform=/Última\s+Reforma(?:\s+publicada)?(?:\s+DOF)?\s+(\d{2})-(\d{2})-(\d{4})/i.exec(cover);
    const amendedAt=reform?`${reform[3]}-${reform[2]}-${reform[1]}`:reviewed.declaredAmendedAt??null;
    for(const article of reviewed.articles){
      const extracted=extractSelectedArticle(raw,article.number,source.title);const textHash=sha(extracted.text);
      if(writeApproved&&article.reviewedTextSha256!==textHash)throw new Error(`Artículo ${source.id}/${article.number} no tiene revisión de transcripción para este hash.`);
      corpus.push({name:source.id,prefix:source.prefix,id:`${source.prefix}-${article.number}`,title:source.title,authority:source.authority,jurisdiction:source.jurisdiction,practiceAreas:source.practiceAreas,category:'legislation-snapshot',publishedAt:null,effectiveAt:null,amendedAt,version:amendedAt?`Última reforma declarada por el PDF: ${amendedAt}; vigencia no verificada`:'Copia histórica; fecha de reforma no verificada',article:`Artículo ${article.number}`,url:source.url,retrievedAt:reviewed.retrievedAt,status:'snapshot-current-validity-unverified',...extracted,sha256:textHash,originalSha256:reviewed.pdfSha256,snapshotPath,review:{type:'source-transcription',reviewedAt:selection.reviewedAt,legalAccuracy:'not-professionally-evaluated'},accessNote:'Texto legislativo oficial de acceso público. Copia acotada; LFDA artículo 14 fracción VIII excluye textos legislativos de protección autoral, no comentarios editoriales. No se eluden controles. No se afirma vigencia actual.',...(source.editorialWarning?{editorialWarning:source.editorialWarning}:{})});
    }
  }
  const output=path.join(root,writeApproved?'resources/legal-corpus.json':'artifacts/legal-sync/corpus-proposal.json');await mkdir(path.dirname(output),{recursive:true});
  const temporary=output+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(corpus,null,2)+'\n');await rename(temporary,output);
  return {state:writeApproved?'approved-seed-written':'proposal-only',articles:corpus.length,output,sourceIds:selection.sources.map(s=>s.id)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);if(args.some(x=>!['--preview','--write-approved'].includes(x))){console.error('Usa --preview o --write-approved con hashes revisados.');process.exitCode=2;}
  else try{console.log(JSON.stringify(await buildCorpus({writeApproved:args.includes('--write-approved')})));}catch(e){console.error(e.message);process.exitCode=1;}
}

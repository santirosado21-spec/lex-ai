import {readFile,writeFile,mkdir,rename,open,unlink,statfs} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import path from 'node:path';
import {runLegalSync,validateSourceUrl,robotsPolicy,LEGAL_SYNC_AGENT} from './legal-sync.mjs';

export const EXTRACTOR_VERSION=22;
export const INDEX_URL='https://www.diputados.gob.mx/LeyesBiblio/index.htm';
export const REGLAMENTOS_INDEX_URL='https://www.diputados.gob.mx/LeyesBiblio/regla.htm';
export const CANDIDATE_REPOSITORIES=['renich/LeyesMexicanas','rafael-afie/leyes-fiscales-mx','alfonsomp18/mx-law-code-v2'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const normalize=value=>value.normalize('NFC').replace(/\s+/g,' ').trim();
const folded=value=>normalize(value).normalize('NFD').replace(/\p{M}/gu,'').toUpperCase();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(tmp,file);}
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}

const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',ntilde:'ñ',Ntilde:'Ñ',uuml:'ü',Uuml:'Ü'};
function htmlText(value){return normalize(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(match,name)=>{if(name.startsWith('#')){const number=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):parseInt(name.slice(1),10);return number<=0x10ffff?String.fromCodePoint(number):match;}return named[name]??match;}));}
export function decodeIndex(bytes){try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),encoding:'utf-8'};}catch{return {text:new TextDecoder('windows-1252').decode(bytes),encoding:'windows-1252'};}}

export function parseOfficialIndex(html,{retrievedAt=new Date().toISOString(),indexSha256=digest(html)}={}){
  const sources=[],seen=new Set(),anomalies=[];
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const contents=row[1];const links=[...contents.matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
    for(const link of links){let url;try{url=new URL(link[1].replaceAll('&amp;','&'),INDEX_URL);}catch{continue;}
      if(url.origin!=='https://www.diputados.gob.mx'||!/^\/LeyesBiblio\/pdf\/[A-Za-z0-9_-]+\.pdf$/i.test(url.pathname)||seen.has(url.href))continue;
      const ref=/<a\b[^>]*href\s*=\s*["'](?:ref\/[^"']+|[^"']*\/ref\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(contents);
      const cells=[...contents.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>htmlText(x[1]));
      const title=ref?htmlText(ref[1]):cells[1]?.split(/\s+DOF\b/)[0];
      if(!title||title.length<5||title.length>1000){anomalies.push({url:url.href,reason:'missing-or-ambiguous-title'});continue;}
      const code=path.posix.basename(url.pathname,'.pdf');const stableCode=code.replace(/_\d{6,8}$/,'');const baseId=stableCode.toLowerCase().replace(/_/g,'-');const id=/^[a-z]/.test(baseId)?baseId:'law-'+baseId;
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(id)){anomalies.push({url:url.href,reason:'unsupported-source-id'});continue;}
      sources.push({id,lawId:`MX-FED-${stableCode.toUpperCase()}`,title,url:url.href,authority:'Cámara de Diputados del H. Congreso de la Unión',jurisdiction:'MX-FED',language:'es',publisherIndex:INDEX_URL,indexRow:cells.slice(0,3),indexSha256,discoveredAt:retrievedAt,listedStatus:'publisher-index-listing-not-independent-currentness-verification',reuseBasis:{kind:'official-legislative-text',reference:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf',article:'14 VIII',scope:'Statutory text only; commentary excluded; source fidelity required; not an individualized legal license opinion.'}});seen.add(url.href);
    }
  }
  if(!sources.length)throw new Error('El índice no contiene filas PDF reconocibles; no se crea un catálogo vacío.');
  return {schemaVersion:1,source:INDEX_URL,retrievedAt,indexSha256,count:sources.length,sources,anomalies,coverage:'Recognized main PDF links from this dated index snapshot; not all Mexican law.'};
}

// The regulations index has a different, older table layout than index.htm. Keep
// this parser separate so a markup change cannot silently broaden the law parser.
export function parseRegulationsIndex(html,{retrievedAt=new Date().toISOString(),indexSha256=digest(html)}={}){
  const sources=[],seen=new Set(),anomalies=[];let rows=0;
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const contents=row[1];const cells=[...contents.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>htmlText(x[1]));
    const titleCandidates=[...(cells[1]??'').matchAll(/(?:^|\s)(REGLAMENTO\b[\s\S]*?)(?=\s+(?:Original|Reformas?|Cantidades)\b|$)/gi)].map(x=>normalize(x[1]));
    const title=titleCandidates[0]??normalize(cells[1]?.split(/\s+(?:Original|Reformas?|Cantidades)\b/i)[0]??'');
    if(/\.pdf(?:["']|\s|$)/i.test(contents))rows++;
    for(const link of contents.matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
      let url;try{url=new URL(link[1].replaceAll('&amp;','&'),REGLAMENTOS_INDEX_URL);}catch{anomalies.push({row:cells.slice(0,4),target:link[1],reason:'invalid-link-target'});continue;}
      const isPdf=/\.pdf$/i.test(url.pathname);
      if(!isPdf)continue;
      if(url.origin!=='https://www.diputados.gob.mx'||!/^\/LeyesBiblio\/regley\/[A-Za-z0-9_-]+\.pdf$/i.test(url.pathname)){
        anomalies.push({row:cells.slice(0,4),url:url.href,reason:'excluded-noncanonical-or-foreign-pdf-target'});continue;
      }
      if(seen.has(url.href)){anomalies.push({row:cells.slice(0,4),url:url.href,reason:'excluded-duplicate-pdf-target'});continue;}
      if(!title||title.length<5||title.length>1000){anomalies.push({row:cells.slice(0,4),url:url.href,reason:'missing-or-ambiguous-title'});continue;}
      const code=path.posix.basename(url.pathname,'.pdf');const stableCode=code.replace(/_\d{6,8}$/,'').replace(/^Reg_/i,'');const baseId='reg-'+stableCode.toLowerCase().replace(/_/g,'-');
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(baseId)){anomalies.push({row:cells.slice(0,4),url:url.href,reason:'unsupported-source-id'});continue;}
      sources.push({id:baseId,lawId:`MX-FED-REG-${stableCode.toUpperCase()}`,title,url:url.href,authority:'Cámara de Diputados del H. Congreso de la Unión',jurisdiction:'MX-FED',language:'es',publisherIndex:REGLAMENTOS_INDEX_URL,indexRow:cells.slice(0,4),indexSha256,discoveredAt:retrievedAt,listedStatus:'publisher-index-listing-not-independent-currentness-verification',reuseBasis:{kind:'official-legislative-text',reference:'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf',article:'14 VIII',scope:'Statutory text only; commentary excluded; source fidelity required; not an individualized legal license opinion.'}});seen.add(url.href);
    }
  }
  if(!sources.length)throw new Error('El índice de reglamentos no contiene filas PDF reconocibles; no se crea un catálogo vacío.');
  const excluded=anomalies.filter(anomaly=>anomaly.reason.startsWith('excluded-')).length;
  return {schemaVersion:1,source:REGLAMENTOS_INDEX_URL,retrievedAt,indexSha256,count:sources.length,rows,kept:sources.length,excluded,sources,anomalies,coverage:'Recognized main PDF links from this dated federal regulations index snapshot; not all Mexican law or regulations.'};
}

async function boundedGet(url,{fetchImpl=fetch,maxBytes=5*1024*1024,timeoutMs=45000,github=false}={}){
  let current=new URL(url);
  for(let n=0;n<4;n++){
    if(github){if(current.protocol!=='https:'||current.hostname!=='api.github.com'||current.port||current.username||current.password)throw new Error('Destino GitHub no permitido.');}else validateSourceUrl(current.href);
    const response=await fetchImpl(current.href,{redirect:'manual',headers:{'User-Agent':LEGAL_SYNC_AGENT,Accept:github?'application/vnd.github.raw+json':'text/html, text/plain'},signal:AbortSignal.timeout(timeoutMs)});
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('Redirección sin destino');current=new URL(location,current);continue;}
    if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw new Error('Respuesta demasiado grande');}
    const chunks=[];let total=0;for await(const b of response.body??[]){total+=b.length;if(total>maxBytes)throw new Error('Respuesta demasiado grande');chunks.push(Buffer.from(b));}
    return {status:response.status,bytes:Buffer.concat(chunks),headers:Object.fromEntries(response.headers),url:current.href};
  }
  throw new Error('Demasiadas redirecciones.');
}

export async function discoverLibrary({outputDir,catalogPath,indexFile,compareRepositories=false,fetchImpl=fetch,sleep=pause}={}){
  await mkdir(path.join(outputDir,'discovery'),{recursive:true});let bytes,network=null;
  if(indexFile)bytes=await readFile(indexFile);
  else{
    const robots=await boundedGet(new URL('/robots.txt',INDEX_URL).href,{fetchImpl,maxBytes:512000});
    if(![200,404,410].includes(robots.status))throw new Error('robots.txt no verificable; descubrimiento aplazado.');
    const policy=robotsPolicy(robots.status===200?robots.bytes.toString('utf8'):'',INDEX_URL);if(!policy.allowed||policy.crawlDelayMs>60_000)throw new Error('Índice bloqueado o aplazado por robots.txt.');
    await sleep(Math.max(2000,policy.crawlDelayMs));network=await boundedGet(INDEX_URL,{fetchImpl});if(network.status!==200)throw new Error(`Índice HTTP ${network.status}`);bytes=network.bytes;
    await atomic(path.join(outputDir,'discovery/network.json'),{retrievedAt:new Date().toISOString(),headers:network.headers,robotsStatus:robots.status,robotsSha256:digest(robots.bytes)});
  }
  const decoded=decodeIndex(bytes);const catalog=parseOfficialIndex(decoded.text,{indexSha256:digest(bytes)});catalog.encoding=decoded.encoding;catalog.importedSnapshot=Boolean(indexFile);
  await writeFile(path.join(outputDir,'discovery/index.html'),bytes);
  catalog.repositoryComparisons=[];
  if(compareRepositories){for(const repository of CANDIDATE_REPOSITORIES){try{const result=await boundedGet(`https://api.github.com/repos/${repository}/readme`,{fetchImpl,maxBytes:256000,github:true});if(result.status!==200)throw new Error(`README HTTP ${result.status}`);let text=result.bytes.toString('utf8');try{const body=JSON.parse(text);if(body.encoding==='base64'&&body.content)text=Buffer.from(body.content,'base64').toString('utf8');}catch{}
    const candidates=[...new Set(text.match(/https?:\/\/(?:www\.)?diputados\.gob\.mx\/LeyesBiblio\/pdf\/[A-Za-z0-9_-]+\.pdf/g)??[])];
    catalog.repositoryComparisons.push({repository,url:`https://github.com/${repository}`,checkedAt:new Date().toISOString(),readmeSha256:digest(result.bytes),officialUrlCandidates:candidates.map(url=>({url,matchedOfficialCatalog:catalog.sources.some(s=>s.url===url.replace(/^http:/,'https:').replace('://diputados.', '://www.diputados.'))})),status:'candidate-only',codeExecuted:false,textIngested:false});
    await writeFile(path.join(outputDir,'discovery',repository.replace('/','--')+'.README.txt'),text);
  }catch(e){catalog.repositoryComparisons.push({repository,status:'unavailable',error:e.message,codeExecuted:false,textIngested:false});}await sleep(2000);}}
  else catalog.repositoryComparisons=CANDIDATE_REPOSITORIES.map(repository=>({repository,status:'documented-candidate-not-fetched-this-run',reference:'docs/architecture/legal-repositories.md',codeExecuted:false,textIngested:false}));
  await atomic(catalogPath,catalog);return catalog;
}

export async function discoverRegulationsLibrary({outputDir,catalogPath,indexFile,fetchImpl=fetch,sleep=pause}={}){
  await mkdir(path.join(outputDir,'discovery'),{recursive:true});let bytes,network=null;
  if(indexFile)bytes=await readFile(indexFile);
  else{
    const robots=await boundedGet(new URL('/robots.txt',REGLAMENTOS_INDEX_URL).href,{fetchImpl,maxBytes:512000});
    if(![200,404,410].includes(robots.status))throw new Error('robots.txt no verificable; descubrimiento aplazado.');
    const policy=robotsPolicy(robots.status===200?robots.bytes.toString('utf8'):'',REGLAMENTOS_INDEX_URL);if(!policy.allowed||policy.crawlDelayMs>60_000)throw new Error('Índice bloqueado o aplazado por robots.txt.');
    await sleep(Math.max(2000,policy.crawlDelayMs));network=await boundedGet(REGLAMENTOS_INDEX_URL,{fetchImpl});if(network.status!==200)throw new Error(`Índice HTTP ${network.status}`);bytes=network.bytes;
    await atomic(path.join(outputDir,'discovery/reglamentos-network.json'),{retrievedAt:new Date().toISOString(),headers:network.headers,robotsStatus:robots.status,robotsSha256:digest(robots.bytes)});
  }
  const decoded=decodeIndex(bytes);const catalog=parseRegulationsIndex(decoded.text,{indexSha256:digest(bytes)});catalog.encoding=decoded.encoding;catalog.importedSnapshot=Boolean(indexFile);catalog.repositoryComparisons=[];
  await writeFile(path.join(outputDir,'discovery/reglamentos-index.html'),bytes);await atomic(catalogPath,catalog);return catalog;
}

export function splitForLaw(lawId){const bucket=parseInt(digest('lex-law-split-v1:'+lawId).slice(0,8),16)%100;return bucket<80?'train':bucket<90?'validation':'test';}
const ARTICLE=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ART\.|Art\.)\s+(\d+)(?:(?:[oº°]|\/o)(?=\s|[.\-]))?(?:[.](?=[ \t]+(?:BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS)\b|[ \t]*-[ \t]*(?:[A-ZÑ]|\d+)(?:[ \t]+(?:BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS))?[.\-]))?(?:[ \t]*[-–][ \t]*(BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS|[A-ZÑ]|\d+))?(?:[ \t]+(BIS|TER|QU[ÁA]TER|QUATER|QUINQUIES|QUINTUS|SEXIES|SEXTUS|SEPTIES|SEPTIMUS|OCTIES|NONIES|NONUS|DECIES|UNDECIES|DUODECIES|DUODECIMUS)(?:(?:[ \t-]+|\.[ \t]+)((?:[IVXL]+)|\d+)(?=[ \t]*[.\-]))?)?(?:[ \t]*[-–][ \t]*((?:[IVXL]+)|\d+)(?=[ \t]*[.\-]))?[ \t]*(?:[.:]|[-–](?![A-Za-zÑñ\d])|[ \t]+\((?=(?:DEROGADO|REFORMADO|ADICIONADO)\b))/i;
const amendment=/^(?:Art[íi]culo|P[áa]rrafo|Fracci[óo]n|Inciso|Numeral|Apartado|Cap[íi]tulo|Secci[óo]n|Denominaci[óo]n|T[íi]tulo)\b.*\b(?:reformad[oa]|adicionad[oa]|derogad[oa]|recorrid[oa])\b.*\bDOF\b/i;
const section=/^(?:LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[ÓO]N|SUBSECCI[ÓO]N)\s+(?:[IVXLCDM]+|\d+|PRIMER[OA]|SEGUND[OA]|TERCER[OA]?|CUART[OA]|QUINT[OA]|SEXTO|S[ÉE]PTIMO|OCTAVO|NOVENO|D[ÉE]CIMO|[ÚU]NIC[OA])\b/i;
const transitory=/^(?:ART[IÍ]CULOS?\s+)?TRANSITORIOS?\s*[.:]?$/i;
const editorialLine=/^(?:Reforma DOF|Fe de erratas|Art[íi]culo vinculado con art[íi]culo transitorio|[A-Za-zÁÉÍÓÚáéíóúñÑ ]+ (?:reformado|adicionado|derogado) DOF)\b/i;
const reformNote=/^\((?:REFORMADO|ADICIONADO|DEROGADO)/i;
const headingPre=/^(?:ART[IÍ]CULO|Art[íi]culo|ART\.|Art\.)\s/;
// Loose heading without terminator: number followed by an uppercase word. A suffix word after the number blocks this route (it is handled by noTermSuffix/bareSuffix) so "Artículo 21 Bis ..." can never open a plain article 21.
const noTerm=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ART\.|Art\.)\s+(\d+)[ \t]+(?!(?:Bis|Ter|Qu[áa]ter|Quater|Quinquies|Quintus|Sexies|Sextus|Septies|Septimus|Octies|Nonies|Nonus|Decies|Undecies|Duodecies|Duodecimus)\b)(?=[A-ZÁÉÍÓÚÑ])/i;
// Loose suffixed heading glued to body text ("Artículo 21 Bis 1. ..."): after the suffix there must be EOL, a terminator, a numeric list marker or an uppercase word; "Artículo 21 Bis de la ley" (lowercase tail) stays body text.
const noTermSuffix=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo|ART\.|Art\.)\s+(\d+)[ \t]+(Bis|Ter|Qu[áa]ter|Quater|Quinquies|Quintus|Sexies|Sextus|Septies|Septimus|Octies|Nonies|Nonus|Decies|Undecies|Duodecies|Duodecimus)(?![a-záéíóúñ])(?:[ \t]+([IVXL]+)(?=[ \t]*[.,\-]))?(?=[ \t]*[.:]|[ \t]+\d+[.)]|[ \t]+[A-ZÁÉÍÓÚÑ(]|[ \t]*,[ \t]*\((?:DEROGADO|Derogado)|[ \t]*$)/i;
// Official period-less heading variant: the whole line is exactly "Artículo N" (seen in LGSMIME and Reg_Senado official PDFs). Accepted fail-closed: it can only open the body at article 1 or continue it strictly sequentially; anything else stays body text.
const bare=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo)\s+(\d+)[ \t]*$/;
// Official period-less SUFFIXED heading variant: the whole line is exactly "Artículo N Sufijo" (seen in LGSMIME and Reg_Senado official PDFs). Accepted fail-closed: only right after its numeric base article; anything else stays body text and flags the document.
const bareSuffix=/^[ \t]*(?:ART[ÍI]CULO|Art[íi]culo)\s+(\d+)[ \t]+(Bis|Ter|Qu[áa]ter|Quater|Quinquies|Quintus|Sexies|Sextus|Septies|Septimus|Octies|Nonies|Nonus|Decies|Undecies|Duodecies|Duodecimus)(?:[ \t]+([IVXL]+|\d+))?[ \t]*$/i;
const suffixId=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const sentenceClosed=/[.…:;!?"'»)\]]\s*$|(?:\bDerogad[oa])\.?\s*$/;
function midSentenceFragment(lines,i,checkNext=true){
  let j=i-1;
  while(j>=0&&(amendment.test(lines[j].text)||editorialLine.test(lines[j].text)||reformNote.test(lines[j].text)||section.test(lines[j].text)||lines[j].secSkip))j--;
  if(j>=0&&!sentenceClosed.test(lines[j].text))return true;
  if(!checkNext)return false;
  const next=lines[i+1];
  return Boolean(next&&headingPre.test(next.text)&&ARTICLE.test(next.text));
}
// True when the previous significant line closed its sentence (or nothing precedes), so a LIBRO/TÍTULO/CAPÍTULO/SECCIÓN line can be a real heading rather than a wrapped body line.
function prevClosed(lines,i){
  let j=i-1;
  while(j>=0&&(amendment.test(lines[j].text)||editorialLine.test(lines[j].text)||reformNote.test(lines[j].text)||section.test(lines[j].text)||lines[j].secSkip))j--;
  return j<0||sentenceClosed.test(lines[j].text);
}
// Trailing editorial headings that belong to the NEXT section but landed at the end of an article: title-case subtitles without final punctuation ("De las Licencias"), short ALL-CAPS headings, service/corps subtitles ("Servicio de Ingenieros"), single title-case words ("Generalidades"), and headings glued to their DOF amendment note. A trailing line WITH sentence-final punctuation is never trimmed.
const rubricTitle=/^(?:De (?:la|las|los|del)|Del) [A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{0,59}$/;
const rubricAllCaps=/^(?=[A-ZÁÉÍÓÚÑ ,.'-]{8,90}$)(?!.*\.$)(?!(?:[^ ]* ){8})[A-ZÁÉÍÓÚÑ]+(?: [A-ZÁÉÍÓÚÑ0-9.'-]+)+$/;
const prevLineClosed=(lines,idx)=>idx<=0||/[.!?)]$/ .test(lines[idx-1].text.trim());
const rubricService=/^(?:Servicio|Cuerpo|Departamento|Direcci[óo]n|Subdirecci[óo]n|Jefatura|Unidad) (?:(?:de|del|de la|de las|de los) )?[A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{0,55}$/;
const rubricSingleWord=/^(?:Generalidades|Disposiciones)$/;
const rubricGluedNote=/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'-]{6,90}(?:Secci[óo]n|Subsecci[óo]n|Cap[íi]tulo|T[íi]tulo|Apartado|Numeral|Inciso|Denominaci[óo]n) (?:adicionad[oa]|reformad[oa]|derogad[oa]|recorrid[oa]) DOF \d{2}-\d{2}-\d{4}$/;
const trailingRubric=line=>rubricTitle.test(line)||rubricAllCaps.test(line)||rubricService.test(line)||rubricSingleWord.test(line)||rubricGluedNote.test(line)||/^(?:DE LA CAPACIDAD|DE LOS COMERCIANTES|DE LA FORMA)$/i.test(line);
// Same rúbricas when the PDF text layer glues them onto the end of the last body line. Only cut at a sentence-close boundary (keeping the period); the ALL-CAPS variant requires lowercase in the preceding text so wrapped body sentences in all-caps documents are never cut.
const inlineRubricSuffix=line=>{
  let m=/\s([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'()-]{6,89}(?:Secci[óo]n|Subsecci[óo]n|Cap[íi]tulo|T[íi]tulo|Apartado|Numeral|Inciso|Denominaci[óo]n) (?:adicionad[oa]|reformad[oa]|derogad[oa]|recorrid[oa]) DOF \d{2}-\d{2}-\d{4})$/.exec(line);
  if(m)return m;
  m=/ (Generalidades|Disposiciones)$/.exec(line);
  if(m&&/DOF \d{2}-\d{2}-\d{4}$/.test(line.slice(0,m.index)))return m;
  m=/[.!?] ((?:De (?:la|las|los|del)|Del) [A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{2,59})$/.exec(line);
  if(m)return m;
  m=/[.!?] ((?:Servicio|Cuerpo|Departamento|Direcci[óo]n|Subdirecci[óo]n|Jefatura|Unidad) (?:(?:de|del|de la|de las|de los) )?[A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{1,45})$/.exec(line);
  if(m)return m;
  m=/[.!?] ([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.'()-]{7,89})$/.exec(line);
  if(m&&!m[1].endsWith('.')&&m[1].includes(' ')&&(m[1].match(/ /g)||[]).length<=10&&/[a-záéíóúñ]/.test(line.slice(0,m.index)))return m;
  return null;
};

export function extractArticles(pages,source,{pdfSha256,retrievedAt}={}){
  const titleFold=folded(source.title);const lines=[];const rawLines=[];
  const coverage={pages:pages.length,rawCharacters:pages.reduce((n,p)=>n+p.text.length,0),removedHeaderLines:0,removedEditorialLines:0,removedSectionLines:0,removedSubtitleLines:0,removedTrailingRubrics:0,keptAmbiguousStructuralLines:0,discardedSamples:[],operativeArticleCandidates:0,exportableArticles:0,transitoryStartPage:null};
  const cover=pages.slice(0,2).map(p=>p.text).join('\n');const date=/Últimas?\s+Reformas?(?:\s+publicadas?)?(?:\s+DOF)?\s+(\d{2})[-/](\d{2})[-/](\d{4})/i.exec(cover);const declaredAmendedAt=date?`${date[3]}-${date[2]}-${date[1]}`:null;
  const versionDate=declaredAmendedAt??retrievedAt.slice(0,10);const versionId=`${source.lawId}@${versionDate}+${pdfSha256.slice(0,16)}`;
  for(const p of pages){for(const line of p.text.split('\n')){const value=normalize(line);if(!value)continue;rawLines.push({text:value,page:p.number});const upper=folded(value);
    if(upper===titleFold||/^CÁMARA DE DIPUTADOS/.test(value)||/^Secretaría General$|^Secretaría de Servicios Parlamentarios$|^Últimas?\s+Reformas?\s+DOF|^\d+ de \d+$/i.test(value)){coverage.removedHeaderLines++;continue;}lines.push({text:value,page:p.number});}}
  const records=[],documentAnomalies=[];let current=null,started=false,ended=false,pendingSection=false,sectionDiscard=0;const seen=new Set();
  const sampleDiscard=(rule,line)=>{if(coverage.discardedSamples.length<50)coverage.discardedSamples.push({rule,page:line.page,line:line.text.slice(0,200)});};
  function finish(){if(!current)return;const anomalies=[...(current.anomalies??[])];let rubricPops=0;while(current.lines.length&&rubricPops<2&&trailingRubric(current.lines.at(-1).text)&&prevLineClosed(current.lines,current.lines.length-1)){const removed=current.lines.pop();current.editorial.push(removed.text);coverage.removedTrailingRubrics++;rubricPops++;sampleDiscard('trailing-rubric',removed);}
    const body=current.lines.map(x=>x.text);let text=normalize(body.join(' '));
    let inlinePops=0;while(inlinePops<2){const m=inlineRubricSuffix(text);if(!m)break;const cut=/^[.!?]/.test(m[0])?m.index+1:m.index;const note=text.slice(cut).trim();text=text.slice(0,cut).trimEnd();current.editorial.push(note);coverage.removedTrailingRubrics++;inlinePops++;sampleDiscard('trailing-rubric-inline',{page:current.lines.at(-1)?.page??null,text:note});}
    const gluedDerogated=/\s+(Derogad[oa]\.?)\s+((?:De (?:la|las|los|del)|Del) [A-ZÁÉÍÓÚÑ][^.:;!?"'»)\]]{0,59}|Generalidades)$/.exec(text);if(gluedDerogated){text=text.slice(0,gluedDerogated.index)+' '+gluedDerogated[1];current.editorial.push(gluedDerogated[2]);coverage.removedTrailingRubrics++;coverage.discardedSamples.push({rule:'trailing-rubric',page:current.lines.at(-1)?.page??null,line:gluedDerogated[2].slice(0,200)});}
    if(text.length<60)anomalies.push('too-short-for-structural-export');if(/\uFFFD|Secretaría General|CÁMARA DE DIPUTADOS/.test(text))anomalies.push('extraction-artifact');if(text.length>60000)anomalies.push('article-exceeds-60000-characters');if(/(?:\bSe deroga\b|\bDerogado\b)/i.test(text)&&text.length<140)anomalies.push('repealed-marker-not-training-example');
    if(seen.has(current.articleId))anomalies.push('duplicate-article-identifier');seen.add(current.articleId);
    const content=text.replace(ARTICLE,'').trim();
    records.push({id:`${versionId}:art:${current.articleId}`,lawId:source.lawId,lawTitle:source.title,versionId,versionDate,articleId:current.articleId,text,sourceUrl:source.url,publisher:source.authority,jurisdiction:source.jurisdiction,language:'es',pdfSha256,textSha256:digest(text),contentSha256:digest(content),sourcePages:[...new Set(current.lines.map(x=>x.page))],declaredAmendedAt,effectiveAt:null,retrievedAt,split:splitForLaw(source.lawId),splitGroup:source.lawId,quality:{status:anomalies.length?'quarantined':'structurally-verified',anomalies,legalAccuracy:'not-evaluated',currentness:'unverified',extraction:'deterministic-pdf-text-no-generated-content'},rights:source.reuseBasis,editorialNotes:current.editorial});current=null;}
  for(let li=0;li<lines.length;li++){const line=lines[li];
    if(started&&transitory.test(line.text)){finish();coverage.transitoryStartPage=line.page;ended=true;break;}
    if(current&&/^Nota\s*:/i.test(line.text)){current.note=true;current.anomalies=['publisher-note-requires-manual-segmentation'];current.editorial.push(line.text);continue;}
    const match=headingPre.test(line.text)?ARTICLE.exec(line.text):null;
    if(current?.note&&(!match||Number(match[1])<=Number(current.articleId.split('-')[0]))){current.editorial.push(line.text);continue;}
    if(match){
      const rest=line.text.slice(match[0].length);
      if((rest.trim()===''||match[0].endsWith('('))&&midSentenceFragment(lines,li)){if(current)current.lines.push(line);continue;}
      finish();started=true;pendingSection=false;const articleId=[match[1],match[2]?.toUpperCase(),match[3]?.toUpperCase(),match[4]?.toUpperCase(),match[5]?.toUpperCase()].filter(Boolean).join('-');
      if(seen.has(articleId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId};ended=true;break;}
      current={articleId,lines:[line],editorial:[]};continue;}
    if(!match&&current){
      const looseS=noTermSuffix.exec(line.text);
      if(looseS){
        const base=Number(current.articleId.split('-')[0]);
        if(Number(looseS[1])===base&&!midSentenceFragment(lines,li,false)){
          finish();pendingSection=false;sectionDiscard=0;const looseId=looseS[1]+'-'+suffixId(looseS[2])+(looseS[3]?'-'+looseS[3].toUpperCase():'');
          if(seen.has(looseId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:looseId};ended=true;break;}
          current={articleId:looseId,lines:[line],editorial:[]};continue;
        }
        if(!midSentenceFragment(lines,li,false)&&!documentAnomalies.includes('unmatched-suffixed-heading-in-body'))documentAnomalies.push('unmatched-suffixed-heading-in-body');
      }
      const loose=noTerm.exec(line.text);
      if(loose&&Number(loose[1])===Number(current.articleId.split('-')[0])+1&&!midSentenceFragment(lines,li,false)){
        finish();pendingSection=false;sectionDiscard=0;const looseId=loose[1];
        if(seen.has(looseId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:looseId};ended=true;break;}
        current={articleId:looseId,lines:[line],editorial:[]};continue;
      }
    }
    if(!match){
      const bareMatch=bare.exec(line.text);
      if(bareMatch){
        const bareNumber=Number(bareMatch[1]);
        const currentNumber=current?Number(current.articleId.split('-')[0]):null;
        if((!started&&bareNumber===1)||(current&&bareNumber===currentNumber+1)){
          finish();started=true;pendingSection=false;sectionDiscard=0;const bareId=bareMatch[1];
          if(seen.has(bareId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:bareId};ended=true;break;}
          current={articleId:bareId,lines:[line],editorial:[]};continue;
        }
      }
      const bareSuf=bareSuffix.exec(line.text);
      if(bareSuf){
        const base=current?Number(current.articleId.split('-')[0]):null;
        if(started&&current&&Number(bareSuf[1])===base){
          finish();pendingSection=false;sectionDiscard=0;const sufId=bareSuf[1]+'-'+suffixId(bareSuf[2])+(bareSuf[3]?'-'+bareSuf[3].toUpperCase():'');
          if(seen.has(sufId)){documentAnomalies.push('operative-numbering-restarts-before-transitory-boundary');coverage.stoppedAt={page:line.page,line:line.text.slice(0,300),articleId:sufId};ended=true;break;}
          current={articleId:sufId,lines:[line],editorial:[]};continue;
        }
        if(!documentAnomalies.includes('unmatched-suffixed-heading-in-body'))documentAnomalies.push('unmatched-suffixed-heading-in-body');
      }
    }
    if(!started||!current)continue;
    if(amendment.test(line.text)||editorialLine.test(line.text)){coverage.removedEditorialLines++;current.editorial.push(line.text);continue;}
    if(section.test(line.text)){
      if(prevClosed(lines,li)||!/[a-záéíóúñ]/.test(line.text)){coverage.removedSectionLines++;sampleDiscard('section-heading',line);pendingSection=true;sectionDiscard=0;continue;}
      coverage.keptAmbiguousStructuralLines++;sampleDiscard('ambiguous-structural-kept-as-body',line);
      if(!documentAnomalies.includes('mid-sentence-structural-line-kept-as-body'))documentAnomalies.push('mid-sentence-structural-line-kept-as-body');
      current.lines.push(line);continue;
    }
    if(pendingSection){
      sectionDiscard++;
      if(sectionDiscard<=2){coverage.removedSubtitleLines++;sampleDiscard('section-subtitle',line);line.secSkip=true;continue;}
      if(!documentAnomalies.includes('section-discard-exceeded-2-lines'))documentAnomalies.push('section-discard-exceeded-2-lines');
      pendingSection=false;current.lines.push(line);continue;
    }
    if(reformNote.test(line.text)){coverage.removedEditorialLines++;continue;}
    current.lines.push(line);
  }
  if(!ended){finish();documentAnomalies.push('no-explicit-transitory-boundary');}
  coverage.operativeArticleCandidates=records.length;if(!records.length)documentAnomalies.push('no-numeric-article-headings');
  if(documentAnomalies.length)for(const record of records){record.quality.status='quarantined';record.quality.anomalies.push(...documentAnomalies);}
  coverage.exportableArticles=records.filter(r=>r.quality.status==='structurally-verified').length;
  return {schemaVersion:1,extractorVersion:EXTRACTOR_VERSION,lawId:source.lawId,versionId,pdfSha256,sourceUrl:source.url,retrievedAt,declaredAmendedAt,coverage,documentAnomalies,records};
}

export async function parsePdfInWorker(file,source,metadata){
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{execArgv:[],workerData:{kind:'extract-legal-library',file,source,metadata},resourceLimits:{maxOldGenerationSizeMb:768}});let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};const timer=setTimeout(()=>finish(new Error('PDF extraction timeout after 120 seconds')),120000);worker.on('message',m=>m.error?finish(new Error(m.error)):finish(null,m.result));worker.on('error',e=>finish(e));worker.on('exit',code=>{if(!settled)finish(new Error(`Extractor exited without result (${code})`));});});
}

const PRIORITY=['cpeum','ccf','ccom','cff','cpf','cnpp','cnpcf','lamp','lft','lfpc','lfda','lfpa','lfpca','lfpdppp','lgsm','lgtoc','lic','liva','lisr','lss','linfonavit','lfce','lpi','lfpp','lgra','lga','lgtaip','lgps','lgahotdu','lgcc','lan','lgen','lgs','lgvs','lgeepa','la','laf','lgsc','lcpaf','lfd'];
export function selectSources(catalog,limit=40){const rank=id=>{const i=PRIORITY.indexOf(id);return i<0?1000:i;};return [...catalog.sources].sort((a,b)=>rank(a.id)-rank(b.id)||a.id.localeCompare(b.id)).slice(0,limit);}

export async function exportLibrary(extractions,outputDir){
  const eligible=extractions.flatMap(x=>x.records).filter(r=>r.quality.status==='structurally-verified');const groups=new Map();for(const row of eligible){const values=groups.get(row.contentSha256)??[];values.push(row);groups.set(row.contentSha256,values);}
  const rows=[],excluded=[];for(const records of groups.values()){if(new Set(records.map(x=>x.split)).size>1){excluded.push(...records.map(x=>({id:x.id,reason:'exact-content-duplicate-across-splits'})));continue;}rows.push(records[0]);excluded.push(...records.slice(1).map(x=>({id:x.id,reason:'exact-content-duplicate-within-split'})));}
  rows.sort((a,b)=>a.id.localeCompare(b.id));await mkdir(outputDir,{recursive:true});
  for(const split of ['train','validation','test'])await atomic(path.join(outputDir,split+'.jsonl'),rows.filter(x=>x.split===split).map(x=>JSON.stringify(x)).join('\n')+'\n');
  await atomic(path.join(outputDir,'corpus.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');await atomic(path.join(outputDir,'excluded.json'),excluded);
  const report={schemaVersion:1,createdAt:new Date().toISOString(),laws:new Set(rows.map(x=>x.lawId)).size,articles:rows.length,exactDuplicateExclusions:excluded.length,splits:Object.fromEntries(['train','validation','test'].map(s=>[s,{laws:new Set(rows.filter(x=>x.split===s).map(x=>x.lawId)).size,articles:rows.filter(x=>x.split===s).length}])),partitionRule:'sha256(lex-law-split-v1:lawId) mod100, 80/10/10; all versions of a law share partition',trainingUse:'Source text only. Do not treat model-generated text or retrieval interpretations as true labels. No professional legal validation.'};await atomic(path.join(outputDir,'manifest.json'),report);return report;
}

export async function ingestLibrary({catalog,outputDir,limit=40,download=true,fetchImpl=fetch,maxTotalBytes=1024**3,extractor=parsePdfInWorker,sleep=pause}={}){
  if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('limit must be 1..500');await mkdir(outputDir,{recursive:true});
  const lockPath=path.join(outputDir,'ingest.lock');let handle;try{handle=await open(lockPath,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await handle.close();}catch(e){if(e.code==='EEXIST')throw new Error('Library ingest already running or stale lock requires explicit review.');throw e;}
  const status={schemaVersion:1,state:'running',startedAt:new Date().toISOString(),catalogTotal:catalog.sources.length,requestedLimit:limit,phase:'download',sources:[],summary:{downloadedLaws:0,extractedLaws:0,failedLaws:0,quarantinedArticles:0,exportableArticles:0}};
  try{
    const disk=await statfs(outputDir);if(Number(disk.bavail)*Number(disk.bsize)<2*1024**3)throw new Error('At least 2GiB free required.');
    const selected=selectSources(catalog,limit);await atomic(path.join(outputDir,'status.json'),status);
    const acquisitionDir=path.join(outputDir,'acquisitions');
    if(download){for(let start=0;start<selected.length;start+=30){const batch=selected.slice(start,start+30);const before=await json(path.join(acquisitionDir,'manifest.json'),{sources:{}});const used=Object.values(before.sources).reduce((n,s)=>n+s.versions.reduce((m,v)=>m+v.bytes,0),0);if(used+batch.length*20*1024*1024>maxTotalBytes)throw new Error('Download budget insufficient for next bounded batch; snapshots preserved.');await runLegalSync({sources:batch,outputDir:acquisitionDir,fetchImpl,sleep,limits:{rateMs:2000,maxBytes:20*1024*1024,timeoutMs:45000,maxRetries:1}});const manifest=await json(path.join(acquisitionDir,'manifest.json'),{sources:{}});const total=Object.values(manifest.sources).reduce((n,s)=>n+s.versions.reduce((m,v)=>m+v.bytes,0),0);if(total>maxTotalBytes)throw new Error('Download budget reached; snapshots preserved for resume.');}}
    const manifest=await json(path.join(acquisitionDir,'manifest.json'),{sources:{}});status.phase='extract';const extractions=[];
    for(const source of selected){const stored=manifest.sources[source.id];const version=stored?.url===source.url?stored.versions.find(v=>v.sha256===stored.latestSha256):null;const entry={id:source.id,lawId:source.lawId,title:source.title,state:'pending'};
      try{if(!version)throw new Error('No downloaded version available');if(!/^[a-f0-9]{64}$/.test(version.sha256)||version.snapshotPath!==`snapshots/${source.id}/${version.sha256}.pdf`)throw new Error('Invalid snapshot path');const file=path.join(acquisitionDir,version.snapshotPath);const bytes=await readFile(file);if(digest(bytes)!==version.sha256)throw new Error('PDF hash mismatch');status.summary.downloadedLaws++;
        const extractedPath=path.join(outputDir,'extractions',source.id,version.sha256+'.json');let result=await json(extractedPath,null);
        if(!result||result.extractorVersion!==EXTRACTOR_VERSION){result=await extractor(file,source,{pdfSha256:version.sha256,retrievedAt:version.retrievedAt});await atomic(extractedPath,result);}
        if(result.pdfSha256!==version.sha256||result.lawId!==source.lawId||result.sourceUrl!==version.url||version.url!==source.url)throw new Error('Extraction provenance mismatch');extractions.push(result);entry.state=result.documentAnomalies.length?'quarantined':'extracted';entry.versionId=result.versionId;entry.pdfSha256=version.sha256;entry.coverage=result.coverage;entry.anomalies=result.documentAnomalies;status.summary.extractedLaws++;status.summary.quarantinedArticles+=result.records.filter(r=>r.quality.status!=='structurally-verified').length;status.summary.exportableArticles+=result.records.filter(r=>r.quality.status==='structurally-verified').length;
      }catch(e){entry.state='failed';entry.error=e.message;status.summary.failedLaws++;}status.sources.push(entry);await atomic(path.join(outputDir,'status.json'),status);
    }
    status.phase='export';status.export=await exportLibrary(extractions,path.join(outputDir,'exports'));status.state=status.summary.failedLaws||status.sources.some(s=>s.state==='quarantined')?'partial':'complete';status.phase='finished';status.finishedAt=new Date().toISOString();await atomic(path.join(outputDir,'status.json'),status);return status;
  }catch(e){status.state='failed';status.error=e.message;status.finishedAt=new Date().toISOString();await atomic(path.join(outputDir,'status.json'),status);throw e;}finally{await unlink(lockPath).catch(()=>{});}
}

if(!isMainThread&&workerData?.kind==='extract-legal-library'){
  try{const {default:pdf}=await import('pdf-parse/lib/pdf-parse.js');const bytes=await readFile(workerData.file);if(bytes.length>20*1024*1024)throw new Error('PDF too large');const pages=[];
    const result=await pdf(new Uint8Array(bytes),{max:1200,pagerender:async page=>{const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});let text='',lastY;for(const item of content.items){text+=(lastY===undefined||lastY===item.transform[5]?'':'\n')+item.str;lastY=item.transform[5];}pages.push({number:page.pageNumber,text});return text;}});
    if(result.numpages>1200||pages.length!==result.numpages)throw new Error('PDF page coverage incomplete');pages.sort((a,b)=>a.number-b.number);parentPort.postMessage({result:extractArticles(pages,workerData.source,workerData.metadata)});
  }catch(e){parentPort.postMessage({error:e.message});}
}

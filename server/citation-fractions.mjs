// Structural article/fraction citations: offline, deterministic, report-only consumer.
// This is a syntactic proof-of-support, NOT a legal-validity or effective-law check.
// Existing private D* evidence is never sent through these functions.
const ARTICLE_RE = /\b(?:art[ií]culos?|arts?\.)\s*(\d{1,5}(?:o|º)?(?:\s*-\s*[a-z]{1,3}|\s+(?:bis|ter|qu[aá]ter))?)(?![\p{L}\p{N}])/giu;
// One ordered citation scan; source interpretation uses separate helpers.
const MENTION_RE = /\b(?:(?:art[ií]culos?|arts?\.)\s*(\d{1,5}(?:o|º)?(?:\s*-\s*[a-z]{1,3}|\s+(?:bis|ter|qu[aá]ter))?)(?![\p{L}\p{N}])|fracci[oó]n(?:es)?\b)/giu;
const FRACTION_WORD_RE = /\bfracci[oó]n(?:es)?\b/giu;
const FRAC_LIST_PREFIX = /^(?:[IVXLCDM]+|\d+)(?![\p{L}\p{N}])(?:(?:\s*(?:,\s*(?:y|e)?|[-–—]|\b(?:y|e|al|a|hasta)\b)\s*)(?:[IVXLCDM]+|\d+)(?![\p{L}\p{N}]))*/iu;
const ROMAN_RE = /^(?=[IVXLCDM]+$)M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;
const ORDINARY_TOKEN_RE = /^(?:\d+|[IVXLCDM]+)/i;
const CONNECTOR_RE = /^(?:,\s*(?:y|e)?|[-–—]|(?:hasta|al|a|y|e)\b)/i;
const ENUM_RE = /(?:^|[;:.!?\n][\s-]*)\s*([IVXLCDM]{1,12})\s*[.)]\s+(?=\p{L})/gimu;
function malformed(reason) {
 const err = Error('Estructura de artículo o fracción no sustentada.');
 err.code='UNSUPPORTED_CITATION_STRUCTURE';
 err.reason=reason;
 return err;
}
const fold = value => value.normalize('NFC').toLocaleLowerCase('es');
function articuloCanon(token) {
 if (typeof token !== 'string') throw malformed('invalid_article');
 const match = /^\s*(\d{1,5})(?:o|º)?(?:\s*-\s*([a-z]{1,3})|\s+(bis|ter|qu[aá]ter))?\s*$/iu.exec(token);
 if (!match || Number(match[1])===0) throw malformed('invalid_article');
 const suffix = match[2] ? '-'+fold(match[2]) : match[3] ? ' '+fold(match[3]).replace('á','a') : '';
 return String(Number(match[1]))+suffix;
}
export function romanoAEntero(token) {
 if (typeof token !== 'string') throw malformed('invalid_fraction');
 const t=token.trim().toUpperCase();
 if (/^\d{1,5}$/.test(t)) {
  const n=Number(t);
  if (n>=1&&n<=9999) return n;
  throw malformed('invalid_fraction');
 }
 if (!ROMAN_RE.test(t)) throw malformed('invalid_fraction');
 const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
 let total=0;
 for (let i=0;i<t.length;i++) total+=values[t[i]]<(values[t[i+1]]||0)?-values[t[i]]:values[t[i]];
 if (!total) throw malformed('invalid_fraction');
 return total;
}
export function normalizaFraccion(token) {
 if (typeof token!=='string') throw malformed('invalid_fraction');
 const cleaned=token.trim().replace(/^fracci[oó]n(?:es)?\s+/iu,'');
 return String(romanoAEntero(cleaned));
}
export function fraccionesDeLista(text) {
 if (typeof text!=='string' || text.length>512) throw malformed('invalid_fraction_list');
 let remaining=text.trim().replace(/^fracci[oó]n(?:es)?\s+/iu,'').trim();
 let m=ORDINARY_TOKEN_RE.exec(remaining);
 if (!m) throw malformed('invalid_fraction_list');
 let previous=romanoAEntero(m[0]), list=[String(previous)];
 remaining=remaining.slice(m[0].length);
 while (remaining.trim()) {
  remaining=remaining.trimStart();
  const connector=CONNECTOR_RE.exec(remaining);
  if (!connector) throw malformed('invalid_fraction_list');
  const range=/^(?:[-–—]|a|al|hasta)$/i.test(connector[0].trim());
  remaining=remaining.slice(connector[0].length).trimStart();
  m=ORDINARY_TOKEN_RE.exec(remaining);
  if (!m || /[\p{L}\p{N}]/u.test(remaining[m[0].length]||'') && !/^\s*(?:,|[-–—]|\b(?:y|e|a|al|hasta)\b)/i.test(remaining.slice(m[0].length))) {
   throw malformed('invalid_fraction_list');
  }
  const next=romanoAEntero(m[0]);
  if (range) {
   if (next<=previous || next-previous>256) throw malformed('invalid_fraction_range');
   for (let k=previous+1;k<=next;k++) list.push(String(k));
  } else list.push(String(next));
  previous=next;
  if (list.length>256) throw malformed('invalid_fraction_list');
  remaining=remaining.slice(m[0].length);
 }
 return [...new Set(list)];
}
function articulos(text) {
 const found=[];
 for (const m of text.matchAll(ARTICLE_RE)) found.push({start:m.index,end:m.index+m[0].length,article:articuloCanon(m[1])});
 return found;
}
function fractionAt(text, start, wordEnd, strict=true) {
 const tail=text.slice(wordEnd);
 // Narrow ordinary-language uses are not article subdivisions. Do not
 // let them become phantom fraction claims or evidence. Unknown legal-looking
 // tokens remain fail-closed when strict=true.
 if (/^\s*(?:de\s+un\s+total|de\s+una\s+cantidad|numeradas?)\b/iu.test(tail)) return null;
 const startSpace=/^\s*/u.exec(tail)[0].length;
 const parsed=FRAC_LIST_PREFIX.exec(tail.slice(startSpace));
 if (!parsed) { if (strict) throw malformed('invalid_fraction_list'); return null; }
 const value=parsed[0];
 if (/^[\p{L}\p{N}]/u.test(tail.slice(startSpace+value.length))) {
  if (strict) throw malformed('invalid_fraction_list');
  return null;
 }
 let values;
 try {values=fraccionesDeLista(value);}
 catch (error) {if (strict) throw error; return null;}
 return {start,end:wordEnd+startSpace+value.length,values};
}
function fracciones(text,strict=true) {
 const found=[];
 for(const m of text.matchAll(FRACTION_WORD_RE)) {
  const parsed=fractionAt(text,m.index,m.index+m[0].length,strict);
  if(parsed)found.push(parsed);
 }
 return found;
}
// One ordered scanner over articles + fractions. With a single distinct named
// article, a preceding fraction can bind to it; with multiple article IDs,
// a fraction preceding the first named article is orphaned (fail-closed).
export function paresDeCita(texto) {
 if(typeof texto!=='string'||texto.length>16000)throw malformed('invalid_text');
 const events=[],articleIds=new Set();
 let lastArticle=null;
 for(const m of texto.matchAll(MENTION_RE)) {
  if(m[1]!==undefined) {
   lastArticle=articuloCanon(m[1]);
   articleIds.add(lastArticle);
   events.push({type:'article',articulo:lastArticle});
  } else {
   const parsed=fractionAt(texto,m.index,m.index+m[0].length,true);
   if(parsed) events.push({type:'fraction',articulo:lastArticle,values:parsed.values});
  }
 }
 const onlyArticle=articleIds.size===1?[...articleIds][0]:null;
 const pairs=[];
 for(const event of events) {
  if(event.type==='article') {pairs.push({articulo:event.articulo,fraccion:null});continue;}
  const bound=event.articulo??onlyArticle;
  if(!bound)throw malformed('orphan_fraction');
  for(const fraccion of event.values)pairs.push({articulo:bound,fraccion});
 }
 return pairs;
}
// A source can substantiate its own article, not other articles it merely cites.
function articleSet({label,text}) {
 const fromLabel=articulos(label);
 if (fromLabel.length) return new Set(fromLabel.map(a=>a.article));
 // When metadata has no article, only heading-like source spans establish
 // ownership. Bare references within prose must not authorize cited articles.
 const headings=articulos(text).filter(a=>{
  const prefix=text.slice(Math.max(0,a.start-64),a.start);
  const atBoundary=a.start===0 || /(?:[.!?]\s+|[\r\n]\s*)$/u.test(prefix);
  const upper=/^(?:Art[ií]culo\b|ART[IÍ]CULO\b|Art\.)/u.test(text.slice(a.start,a.end));
  return atBoundary && upper;
 });
 return new Set(headings.map(a=>a.article));
}
function soportePorArticulo({label='',text=''}) {
 if (typeof label!=='string'||typeof text!=='string') throw malformed('invalid_source');
 const own=articleSet({label,text});
 const byArticle=new Map([...own].map(article=>[article,new Set()]));
 const put=(article,values)=>{
  const supported=byArticle.get(article);
  if (supported) for (const value of values) supported.add(value);
 };
 // Metadata labels may explicitly enumerate fractions; preserve article pairing.
 for (const pair of paresDeCita(label)) {
  if (pair.fraccion!==null) put(pair.articulo,[pair.fraccion]);
 }
 const bodyArticles=articulos(text);
 const closest=position=>bodyArticles.filter(a=>a.start<position).at(-1)?.article;
 // The passage's list bullets substantiate only the enclosing article.
 // Single-letter C. does not open an enumeration (e.g. "C. Ciudadano").
 for (const match of text.matchAll(ENUM_RE)) {
  const roman=match[1].toUpperCase();
  if (roman.length===1&&!['I','V','X'].includes(roman)) continue;
  const owner=closest(match.index) ?? (own.size===1?[...own][0]:null);
  if (!owner) continue;
  try { put(owner,[String(romanoAEntero(roman))]); } catch { /* lexical noise */ }
 }
 for (const f of fracciones(text, false)) {
  const after=text.slice(f.end,f.end+90);
  const explicitAfter=/^\s*(?:de este art[ií]culo\b|del art[ií]culo\s+(\d{1,5}(?:o|º)?(?:\s*-\s*[a-z]{1,3}|\s+(?:bis|ter|qu[aá]ter))?))/iu.exec(after);
  let owner;
  if (explicitAfter) {
   owner=explicitAfter[1]?articuloCanon(explicitAfter[1]):closest(f.start) ?? (own.size===1?[...own][0]:null);
  } else owner=closest(f.start);
  if (owner) put(owner,f.values);
 }
 return byArticle;
}
export function fraccionesSostenidas({label='',text=''}) {
 const byArticle=soportePorArticulo({label,text});
 return new Set([...byArticle.values()].flatMap(values=>[...values]));
}
export function reporteCitaEstructural(texto,{label='',text=''}) {
 try {
  const pairs=paresDeCita(texto);
  if (!pairs.length) return {ok:true,reason:null};
  const byArticle=soportePorArticulo({label,text});
  if (pairs.some(({articulo})=>!byArticle.has(articulo))) return {ok:false,reason:'article_not_in_source'};
  if (pairs.some(({articulo,fraccion})=>fraccion!==null&&!byArticle.get(articulo).has(fraccion))) {
   return {ok:false,reason:'fraction_not_supported'};
  }
  return {ok:true,reason:null};
 } catch(error) {
  if(error?.code==='UNSUPPORTED_CITATION_STRUCTURE') return {ok:false,reason:error.reason};
  throw error;
 }
}

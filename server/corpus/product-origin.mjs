import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root = new URL('../../resources/trade/', import.meta.url);
const edition = 'ecea17b0e46a8f37f1391dae908548461ddcd0c8b385fcf19615576277622bbd';
const index = 'aacb1444c780b3785547e4255b90c9c2e4939312908b75c36c4c1b2d382b5996';
const local = '/fuentes/' + edition + '.pdf';
const publication = 'https://dof.gob.mx/2020/SRE/T_MEC_290620.pdf';
export const productOriginId = 'tmec-4b-' + index.slice(0,12);
let data;

function verified(file, digest) {
  const bytes = readFileSync(new URL(file, root));
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('Revisa la edición del DOF para el Anexo 4-B.');
  return bytes;
}

function directory() {
  if (!data) {
    verified('tmec-dof-20200629.pdf', edition);
    data = JSON.parse(verified('tmec-4b-directorio.json', index));
  }
  return data;
}

export function productOriginAttachment(path) {
  return path === local ? {type:'application/pdf', bytes:verified('tmec-dof-20200629.pdf', edition)} : null;
}

function reference(label, page) {
  return {label, page, localUrl:local + '#page=' + page};
}

function compact(value) {
  return value.replaceAll('.', '');
}

function matchingCode(label, code) {
  const [first, last = first] = label.split('-').map(compact);
  const width = Math.min(6, first.length, code.length);
  return code.slice(0,width) >= first.slice(0,width) && code.slice(0,width) <= last.slice(0,width);
}

export function productOriginLookup(query) {
  if (typeof query !== 'string' || query.length > 120) throw Error('Busca por capítulo, mercancía o código de hasta diez dígitos.');
  const {chapters, entries} = directory();
  const term = query.trim();
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  const chapter = /^(?:cap[ií]tulo\s+)?(\d{1,2})$/iu.exec(term);
  const code = /^(?:\d{4}(?:\d{2}){0,3}|\d{2}\.\d{2}|\d{4}\.\d{2}(?:\.\d{2}){0,2})$/u.test(term) ? compact(term) : '';
  const words = normalize(term).split(/\s+/u);
  const found = chapters.filter(c => chapter ? c.number === Number(chapter[1]) : code ? c.number === Number(code.slice(0,2)) : words.every(w => normalize(c.title).includes(w)));
  const groups = found.map(c => ({
    ...reference(c.title, c.page), number:c.number, section:reference('Inicio de la sección', c.sectionPage),
    rows:!term ? [] : entries.filter(e => e.chapter === c.number && (!code || matchingCode(e.label,code))).map(e => ({
      ...reference(e.label, e.page), ...(e.quote ? {quote:e.quote} : {}), ...(e.footnote ? {footnote:e.footnote} : {})
    }))
  }));
  const cocoa = code.startsWith('180610') || (found.length === 1 && found[0].number === 18 && !code);
  return {groups, chapters:chapters.map(({number,title})=>({number,title})), references:[
    reference('Nota interpretativa del Anexo 4-B',86), reference('Correspondencias nacionales · SA 2012',187),
    reference('Excepciones de minimis · Anexo 4-A',85), reference('Apéndice automotriz',198)
  ], cocoa:cocoa ? productOriginRef(productOriginId,1) : null};
}

export function productOriginRef(sourceId, part) {
  if (sourceId !== productOriginId || !Number.isInteger(part)) throw Error('Elige una referencia del Anexo 4-B.');
  if (part !== 1) {
    const {chapters, entries} = directory();
    const row = entries[part - 2];
    if (!row?.quote) throw Error('Revisa este renglón en la página del DOF.');
    const chapter = chapters.find(c => c.number === row.chapter);
    const context = ['Nota general · p. 86\n'+directory().nonOriginating];
    if(chapter.sectionNotes)context.push('Nota de sección · p. '+chapter.sectionPage+'\n'+chapter.sectionNotes);
    if(chapter.chapterNotes)context.push('Nota de capítulo · p. '+chapter.page+'\n'+chapter.chapterNotes);
    const text = row.label+' · p. '+row.page+'\n'+row.quote+'\n\n'+context.join('\n\n');
    return {sourceId, id:'TMEC-4B-'+row.label+'-P'+row.page, title:'T-MEC · Anexo 4-B · '+row.label,
      text, quote:row.quote, locator:'Capítulo '+row.chapter+' · p. '+row.page+' · DOF 29/06/2020',
      localUrl:local+'#page='+row.page, url:publication+'#page='+row.page, checkedOn:'2026-11-20', pdfSha256:edition,
      summary:'Coteja la nota general (p. 86), las notas de la sección (p. '+chapter.sectionPage+'), el capítulo (p. '+chapter.page+') y las correspondencias nacionales (p. 187 y siguientes). Verifica las modificaciones aplicables en la fecha de la operación.'};
  }
  const c = directory().cocoa;
  const text = [
    'Sección B · Capítulo 18 · p. 90\n' + c.rules,
    'Sección C · SA 2012 · p. 187\n1806.10.aa · México ' + c.mexicanCode + ' · ' + c.description,
    'Sección A · Nota general interpretativa · p. 86\n' + c.priority + '\n' + c.weight,
    'Anexo 4-A · p. 85\n' + c.exceptionLead + '\n' + c.exception
  ].join('\n\n');
  return {sourceId, id:'TMEC-4B-180610', title:'T-MEC · Cacao · subpartida 1806.10', text,
    locator:'Anexos 4-B y 4-A · pp. 90, 187, 86 y 85 · DOF 29/06/2020',
    localUrl:local+'#page=90', url:publication+'#page=90', checkedOn:'2026-11-20', pdfSha256:edition,
    summary:'Coteja clasificación, composición, peso y origen de los insumos, así como modificaciones y equivalencias vigentes en la fecha de la operación.'};
}

export function requestsProductOrigin(question) {
  return /\bt[ -]?mec\b/iu.test(question) && /\banexo\s+4[ -]?b\b|\breglas? (?:específicas? )?de origen\b/iu.test(question);
}

export function cocoaInquiry(question) {
  return /(?<![\d.])1806\.?10(?:\.?\d{2}){0,2}(?!\d|\.\d)/u.test(question);
}

export function productOriginSuggestions(question) {
  if (!requestsProductOrigin(question)) return [];
  const entries = directory().entries;
  // The library identifies the printed row and its physical page. A free-form
  // inquiry may name a national code; return its public candidates for review.
  const chosen = /renglón ([a-z0-9.-]+) de la página (\d{2,3})\b/iu.exec(question);
  if (chosen) {
    const i = entries.findIndex(e => e.label === chosen[1] && e.page === Number(chosen[2]) && e.quote);
    return i === -1 ? [] : [{part:i+2, ref:productOriginRef(productOriginId,i+2)}];
  }

  const codes = [...question.matchAll(/\b(?:subpartida|partida|fracción(?: arancelaria)?|código)\s+(\d{2}\.\d{2}|\d{4}(?:\.?(?:\d{2})){0,3})(?!\d|\.\d)/giu)];
  const result = new Map();
  if(cocoaInquiry(question))result.set(-1,{part:1,ref:productOriginRef(productOriginId,1)});
  for (const match of codes) {
    if(compact(match[1]).startsWith('180610')) continue;
    const code = compact(match[1]);
    entries.forEach((e,i) => {
      if (e.quote && matchingCode(e.label,code)) result.set(i,{part:i+2,ref:productOriginRef(productOriginId,i+2)});
    });
  }
  return [...result.values()];
}

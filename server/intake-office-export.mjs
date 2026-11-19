import {buildAnswerDocx, DOCX_MIME} from './docx-export.mjs';

const mimeTypes = Object.freeze({
  docx: DOCX_MIME,
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});
const navy = '173648';
const green = '15715F';

function blocks(text, limit) {
  const chunks = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let remaining = paragraph.trim();
    while (remaining.length > limit) {
      let boundary = remaining.lastIndexOf(' ', limit);
      if (boundary < 1) boundary = limit;
      if (/[\uD800-\uDBFF]/u.test(remaining[boundary - 1])) boundary--;
      chunks.push(remaining.slice(0, boundary));
      remaining = remaining.slice(boundary).trimStart();
    }
    if (remaining) chunks.push(remaining);
  }
  return chunks;
}

async function workbook({firm, matter, answer}, task) {
  const {default: ExcelJS} = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'Rejon.AI';
  const pageSetup = {paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0};
  const sheet = book.addWorksheet('Expediente', {pageSetup, views: [{state: 'frozen', ySplit: 1}]});
  sheet.columns = [{width: 23}, {width: 92}];
  const entries = [
    ['Expediente', answer.question],
    ['Despacho', firm.name],
    ['Cliente', matter.client],
    ['Asunto', matter.title],
    ...blocks(answer.text, 480).map((section, i) => [i ? 'Continuación' : 'Borrador', section]),
  ];
  for (const [label, value] of entries) {
    const row = sheet.addRow([label, value]);
    row.alignment = {wrapText: true, vertical: 'middle'};
    row.height = Math.max(27, 18 * Math.ceil(value.length / 72));
    row.getCell(1).font = {bold: true, color: {argb: 'FF' + green}};
  }
  function styleHeader(row) {
    row.font = {bold: true, color: {argb: 'FFFFFFFF'}};
    row.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF' + navy}};
    row.height = 32;
  }
  styleHeader(sheet.getRow(1));
  if (task === 'trade') {
    const evidence = book.addWorksheet('Control documental', {pageSetup, views: [{state: 'frozen', ySplit: 1}]});
    evidence.columns = [{width: 27}, {width: 74}, {width: 21}, {width: 27}, {width: 48}];
    styleHeader(evidence.addRow(['Documento o dato', 'Qué cotejar', 'Estado', 'Responsable', 'Referencia en el expediente']));
    const checklist = [
      ['Factura comercial', 'Vincular descripción, moneda, cantidad y partes con la operación.'],
      ['Ficha técnica', 'Identificar función, materiales, presentación y unidad del producto.'],
      ['Insumos', 'Solicitar la clasificación propuesta, origen y valor de los insumos relevantes.'],
      ['Proceso productivo', 'Documentar las operaciones realizadas y en qué países ocurrieron.'],
      ['Certificación de origen', 'Si se pretende trato preferencial, localizar la certificación y sus soportes.'],
      ['Pedimento y anexos', 'Si existe pedimento, cotejar los campos declarados con sus documentos de soporte.'],
      ['Fecha de la operación', 'Registrar la fecha pertinente y localizar la publicación aplicable.'],
    ];
    for (const [document, check] of checklist) {
      const row = evidence.addRow([document, check, 'Por revisar', '', '']);
      row.alignment = {vertical: 'middle', wrapText: true};
      row.height = 39;
      row.getCell(3).dataValidation = {type: 'list', allowBlank: true, formulae: ['"Por revisar,Solicitado,Recibido,Revisado,No aplica"']};
    }
    evidence.autoFilter = 'A1:E' + evidence.rowCount;
  }
  if (answer.citations.length) {
    const sources = book.addWorksheet('Fuentes', {pageSetup});
    sources.columns = [{width: 42}, {width: 50}, {width: 19}, {width: 68}];
    styleHeader(sources.addRow(['Instrumento', 'Referencia', 'Consultado', 'Enlace oficial']));
    for (const citation of answer.citations) {
      const row = sources.addRow([citation.title, citation.locator, citation.retrievedAt,
        {text: citation.url, hyperlink: citation.url}]);
      row.alignment = {vertical: 'middle', wrapText: true};
      row.height = 57;
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function presentation({firm, matter, answer}) {
  const {default: PptxGenJS} = await import('pptxgenjs');
  const deck = new PptxGenJS();
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'Rejon.AI';
  deck.title = answer.question;
  function page(title) {
    const slide = deck.addSlide();
    slide.background = {color: 'F9F8F4'};
    slide.addText(title, {x: 0.75, y: 0.6, w: 11.8, h: 1.0, fontFace: 'Georgia',
      fontSize: 32, color: navy, margin: 0, fit: 'shrink'});
    slide.addText('Rejon.AI   ·   Borrador para revisión', {x: 0.75, y: 7.0, w: 11.8,
      h: 0.28, fontSize: 11, color: green, margin: 0});
    return slide;
  }
  const cover = page(answer.question);
  for (const [i, [label, value]] of [
    ['Despacho', firm.name], ['Cliente', matter.client], ['Asunto', matter.title],
  ].entries()) {
    const y = 2.0 + i * 1.42;
    cover.addText(label, {x: 0.75, y, w: 11.8, h: 0.28, fontSize: 14, color: green, margin: 0, bold: true});
    cover.addText(value, {x: 0.75, y: y + 0.36, w: 11.8, h: 0.9, fontSize: 23,
      color: navy, margin: 0, fit: 'shrink'});
  }
  let body = '';
  const addBody = () => page(answer.question).addText(body, {x: 0.75, y: 1.85, w: 11.8,
    h: 4.85, margin: 0, fontSize: 23, color: navy, valign: 'top', fit: 'shrink'});
  for (const part of blocks(answer.text, 680)) {
    if (body && (body.length + part.length > 680 || body.split('\n').length > 6)) {
      addBody();
      body = '';
    }
    body += (body ? '\n\n' : '') + part;
  }
  if (body) addBody();
  for (let i = 0; i < answer.citations.length; i += 3) {
    const slide = page('Fuentes de consulta');
    for (const [j, source] of answer.citations.slice(i, i + 3).entries()) {
      const y = 1.8 + j * 1.56;
      slide.addText(source.title, {x: 0.75, y, w: 11.8, h: 0.52,
        fontSize: 22, color: green, margin: 0, fit: 'shrink', hyperlink: {url: source.url}});
      slide.addText(`${source.locator} · Consultado el ${source.retrievedAt}`, {x: 0.75, y: y + 0.65,
        w: 11.8, h: 0.75, fontSize: 17, color: navy, margin: 0, fit: 'shrink'});
    }
  }
  return Buffer.from(await deck.write({outputType: 'nodebuffer'}));
}

export async function exportIntakeDocument(format, task, context) {
  if (typeof format !== 'string' || !Object.hasOwn(mimeTypes, format)) {
    throw new Error('Elige Word, Excel o PowerPoint.');
  }
  const builders = {docx: buildAnswerDocx, xlsx: workbook, pptx: presentation};
  const buffer = await builders[format](context, task);
  return {name: `Rejon-${task}.${format}`, mime: mimeTypes[format], base64: buffer.toString('base64')};
}

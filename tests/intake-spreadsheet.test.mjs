import {emptyLocalReading} from './helpers/local-reader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {extractDocument} from '../server/extraction.mjs';
import {inspectLocalDocument} from '../server/intake-import.mjs';

test('the local Excel reader preserves visible coordinates, number formats and stored results',async()=>{
 const book=new ExcelJS.Workbook();
 book.properties.date1904=true;
 book.addWorksheet('Privada',{state:'veryHidden'}).getCell('A1').value='Secreto de ensayo';
 const sheet=book.addWorksheet('Operación de ensayo');
 sheet.getCell('A1').value=217;
 sheet.getCell('A1').numFmt='000000';
 sheet.getCell('A1').note='Anotación interna';
 sheet.getCell('B1').value=1234.5;
 sheet.getCell('B1').numFmt='#,##0.00';
 sheet.getCell('C1').value={formula:'SUM(0)',result:0};
 sheet.getCell('D1').value={formula:'SUM(3,4)'};
 sheet.getCell('A2').value=new Date('2025-03-14T00:00:00Z');
 sheet.getCell('A2').numFmt='yyyy-mm-dd';
 sheet.getCell('B2').value={text:'Comprobante',hyperlink:'https://example.invalid/privado'};
 sheet.getCell('C2').value={richText:[{text:'dos'},{text:' líneas\nmaterial'}]};
 sheet.getCell('D2').value=false;
 sheet.getCell('A3').value='Omitir fila';sheet.getRow(3).hidden=true;
 sheet.getCell('E1').value='Omitir columna';sheet.getColumn('E').hidden=true;
 sheet.mergeCells('A4:B4');sheet.getCell('A4').value='Una sola vez';
 const base64=Buffer.from(await book.xlsx.writeBuffer()).toString('base64');
 const expected=['A1 | 000217','B1 | 1,234.50','C1 | Resultado guardado de fórmula · 0','D1 | Fórmula sin resultado guardado','A2 | 2025-03-14','B2 | Comprobante','C2 | dos líneas','C2 | material','D2 | FALSO','A4 | Una sola vez'].map(v=>'Hoja 2 · '+v).join('\n');
 assert.equal((await extractDocument('ensayo.xlsx',base64,{spreadsheet:true})).text,expected);
 const data=await inspectLocalDocument({extension:'xlsx',base64,review:true},{fetchImpl:async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  const body=JSON.parse(opts.body);
  for(const secret of ['Secreto de ensayo','Anotación interna','example.invalid','Omitir','SUM('])assert.ok(!opts.body.includes(secret));
  return Response.json({message:{content:JSON.stringify(emptyLocalReading(body.format.properties))}});
 }});
 assert.equal(data.protection.restored,expected);
});

import ExcelJS from 'exceljs';
import SSF from 'ssf';

// Only locally stored values enter the review. Sheet positions in the original
// workbook remain stable even when the workbook has hidden tabs.
function storedText(value,format,date1904){
 if(value instanceof Date){
  const serial=25569+value.getTime()/86400000-(date1904?1462:0);
  return SSF.format(format||'yyyy-mm-dd',serial,{date1904});
 }
 if(typeof value==='number')return SSF.format(format||'General',value,{date1904});
 if(typeof value==='boolean')return value?'VERDADERO':'FALSO';
 if(typeof value==='string')return value;
 if(Array.isArray(value?.richText))return value.richText.map(run=>run.text).join('');
 if(value?.error)return 'Error de Excel ('+value.error+')';
 throw Error('Hay una celda con un tipo de dato que no se pudo leer.');
}

export async function extractSpreadsheet(bytes,maxText){
 const book=new ExcelJS.Workbook();
 await book.xlsx.load(bytes);
 const lines=[];
 let size=0;
 for(const [index,sheet] of book.worksheets.entries()){
  if(sheet.state==='hidden'||sheet.state==='veryHidden')continue;
  sheet.eachRow(row=>{
   if(row.hidden)return;
   row.eachCell(cell=>{
    if(sheet.getColumn(cell.col).hidden||cell.type===ExcelJS.ValueType.Merge)return;
    let value=cell.value,prefix='';
    if(cell.type===ExcelJS.ValueType.Formula){
     value=cell.result;
     prefix=value===undefined||value===null?'Fórmula sin resultado guardado':'Resultado guardado de fórmula · ';
    }else if(cell.type===ExcelJS.ValueType.Hyperlink){
     value=cell.text;
    }
    const display=value===null||value===undefined?'':storedText(value,cell.numFmt,Boolean(book.properties.date1904));
    if(!display.trim()&&!prefix)return;
    const address='Hoja '+(index+1)+' · '+cell.address+' | ';
    for(const part of (prefix+display).split(/\r\n|[\r\n]/u)){
     const line=address+part;
     size+=line.length+1;
     if(size>maxText)throw Error('La matriz supera el límite de lectura. Divide el libro por operación.');
     lines.push(line);
    }
   });
  });
 }
 if(!lines.length)throw Error('El libro de Excel no contiene valores visibles que se puedan revisar.');
 return lines.join('\n');
}

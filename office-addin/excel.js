import {mountAssistant} from './assistant.js';
/* global Office, Excel */
import {bridge,initPairing,renderSuggestions,setText} from './common.js';
let fields=[];
const safeCell=value=>/^\s*[=+\-@]/.test(value)?`'${value}`:value;
async function selectedText(){return Excel.run(async context=>{const range=context.workbook.getSelectedRange();range.load('cellCount');await context.sync();if(range.cellCount<1||range.cellCount>5000)throw Error('Selecciona hasta 5000 celdas.');range.load('text');await context.sync();return range.text.flat().join('\n');});}
async function review(){try{setText('review-status','Leyendo la selección local…');const result=await bridge.request('/v1/audit',{text:await selectedText(),documentType:document.getElementById('document-type').value});fields=result.fields;renderSuggestions({suggestions:result.suggestions},()=>{});document.getElementById('draft').disabled=false;setText('review-status',`Revisión terminada: ${fields.length} campo(s) extraído(s).`);}catch(error){setText('review-status',error.message,'error');}}
async function draft(){try{await Excel.run(async context=>{const target=context.workbook.worksheets.add();const values=[['LEX AI — BORRADOR',''],['Revise y confirme antes de usar',''],['Campo','Valor'],...fields.map(field=>[safeCell(field.kind),safeCell(field.value)])];target.getRangeByIndexes(0,0,values.length,2).values=values;target.getRange('A1:B2').format.fill.color='#FFF1C1';target.getRange('A3:B3').format.fill.color='#D6EAE8';target.activate();await context.sync();});setText('draft-status','Se creó una hoja nueva con la tabla para revisión.');}catch(error){setText('draft-status',error.message,'error');}}
async function today(){try{const result=await bridge.request('/v1/agent',{action:'agent.propose',payload:{matterId:sessionStorage.getItem('lex-office-matter')||'',action:'planner.today',args:{}}});setText('today-status',`${result.result?.length||0} recordatorio(s) para hoy.`);}catch(error){setText('today-status',error.message,'error');}}
Office.onReady(()=>{mountAssistant('Excel',selectedText,insertDraft);initPairing(session=>{if(session?.matterId)sessionStorage.setItem('lex-office-matter',session.matterId);});document.getElementById('review').addEventListener('click',review);document.getElementById('today').addEventListener('click',today);document.getElementById('draft').addEventListener('click',draft);});

async function insertDraft(text){
  await Excel.run(async context=>{
    const cell=context.workbook.getSelectedRange();
    cell.load('cellCount');await context.sync();
    if(cell.cellCount!==1)throw Error('Selecciona una sola celda vacía.');
    cell.load('values,formulas');await context.sync();
    if(cell.values[0][0]!==''||cell.formulas[0][0]!=='')throw Error('Selecciona una celda vacía para conservar el contenido del libro.');
    cell.numberFormat=[['@']];
    cell.values=[[safeCell(text)]];
    await context.sync();
  });
}

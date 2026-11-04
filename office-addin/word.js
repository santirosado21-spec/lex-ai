import {mountAssistant} from './assistant.js';
/* global Office, Word */
import {bridge,initPairing,renderSuggestions,setText} from './common.js';
let selected=null;
async function documentText(){return Word.run(async context=>{const body=context.document.body;body.load('text');await context.sync();return body.text;});}
async function review(){try{setText('review-status','Leyendo el documento local…');const result=await bridge.request('/v1/audit',{text:await documentText(),documentType:document.getElementById('document-type').value});renderSuggestions(result,(suggestion,node)=>{selected=suggestion;document.querySelectorAll('.suggestion').forEach(item=>item.classList.remove('selected'));node.classList.add('selected');document.getElementById('apply').disabled=false;});setText('review-status',`Revisión terminada: ${result.suggestions.length} sugerencia(s).`);}catch(error){setText('review-status',error.message,'error');}}
async function apply(){if(!selected)return;try{await Word.run(async context=>{context.document.changeTrackingMode=Word.ChangeTrackingMode.trackAll;const range=context.document.getSelection();range.load('text');await context.sync();const replacement=selected.replacement||selected.message;if(!range.text.trim())throw new Error('Seleccione en Word el texto al que desea aplicar esta sugerencia.');range.insertText(replacement,Word.InsertLocation.replace);await context.sync();});setText('apply-status','Cambio aplicado con control de cambios. Revíselo y acepte o rechace el cambio en Word.');}catch(error){setText('apply-status',error.message,'error');}}
async function today(){try{const result=await bridge.request('/v1/agent',{action:'agent.propose',payload:{matterId:sessionStorage.getItem('lex-office-matter')||'',action:'planner.today',args:{}}});setText('today-status',`${result.result?.length||0} recordatorio(s) para hoy.`);}catch(error){setText('today-status',error.message,'error');}}
Office.onReady(()=>{mountAssistant('Word',selectedText,insertDraft);initPairing(session=>{if(session?.matterId)sessionStorage.setItem('lex-office-matter',session.matterId);});document.getElementById('review').addEventListener('click',review);document.getElementById('today').addEventListener('click',today);document.getElementById('apply').addEventListener('click',apply);});

async function selectedText(){return Word.run(async context=>{const range=context.document.getSelection();range.load('text');await context.sync();return range.text;});}

async function insertDraft(text){
  await Word.run(async context=>{
    context.document.changeTrackingMode=Word.ChangeTrackingMode.trackAll;
    context.document.getSelection().insertText(text,Word.InsertLocation.after);
    await context.sync();
  });
}

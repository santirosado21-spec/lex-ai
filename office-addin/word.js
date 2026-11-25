import {mountAssistant} from './assistant.js';
/* global Office, Word */
import {bridge,initPairing,renderSuggestions,setText} from './common.js';
let selected=null,reviewedText=null,reviewVersion=0,reviewing=false,applying=false;
const element=id=>document.getElementById(id);
function replacementAvailable(suggestion){return typeof suggestion?.target==='string'&&Boolean(suggestion.target.trim())&&typeof suggestion.replacement==='string'&&Boolean(suggestion.replacement.trim())&&suggestion.target!==suggestion.replacement;}
function clearReview(){
  reviewVersion++;selected=null;reviewedText=null;
  element('suggestions').replaceChildren();element('apply').disabled=true;
  setText('apply-preview','');setText('apply-status','');
}
async function documentText(){return Word.run(async context=>{const body=context.document.body;body.load('text');await context.sync();return body.text;});}
async function review(){
  if(reviewing||applying)return;
  clearReview();const version=reviewVersion;reviewing=true;element('review').disabled=true;
  try{
    setText('review-status','Leyendo el documento local…');
    const text=await documentText();
    const result=await bridge.request('/v1/audit',{text,documentType:element('document-type').value});
    if(version!==reviewVersion)return;
    reviewedText=text;
    renderSuggestions(result,(suggestion,node)=>{
      if(applying)return;
      selected=suggestion;document.querySelectorAll('.suggestion').forEach(item=>item.classList.remove('selected'));node.classList.add('selected');
      const available=replacementAvailable(suggestion);element('apply').disabled=!available;
      setText('apply-preview',available?`Texto seleccionado requerido: ${suggestion.target}\nSe reemplazará por: ${suggestion.replacement}`:'');
      setText('apply-status',available?'Selecciona exactamente el texto indicado en Word.':'No incluye una sustitución concreta. Revisa esta observación y edita el documento manualmente si corresponde.');
    });
    setText('review-status',`Revisión terminada: ${result.suggestions.length} sugerencia(s).`);
  }catch(error){if(version===reviewVersion){clearReview();setText('review-status',error.message,'error');}}
  finally{reviewing=false;element('review').disabled=false;}
}
async function apply(){
  if(reviewing||applying||reviewedText===null||!replacementAvailable(selected))return;
  const suggestion=selected,snapshot=reviewedText,version=reviewVersion;
  applying=true;element('apply').disabled=true;element('review').disabled=true;element('document-type').disabled=true;
  let writeQueued=false;
  try{
    await Word.run(async context=>{
      const body=context.document.body,range=context.document.getSelection();body.load('text');range.load('text');await context.sync();
      if(version!==reviewVersion||body.text!==snapshot){clearReview();throw new Error('El documento cambió desde la revisión. Vuelve a revisarlo antes de aplicar.');}
      if(range.text!==suggestion.target)throw new Error('Selecciona exactamente el texto indicado en Word. No se aplicó ningún cambio.');
      context.document.changeTrackingMode=Word.ChangeTrackingMode.trackAll;
      writeQueued=true;range.insertText(suggestion.replacement,Word.InsertLocation.replace);await context.sync();
    });
    clearReview();setText('apply-status','Cambio aplicado con control de cambios. Revíselo y acepte o rechace el cambio en Word. Vuelve a revisar antes de otro cambio.');
  }catch(error){if(writeQueued)clearReview();setText('apply-status',writeQueued?'No se pudo confirmar el cambio. Revisa el documento en Word y vuelve a revisarlo antes de reintentar.':error.message,'error');}
  finally{applying=false;element('review').disabled=false;element('document-type').disabled=false;element('apply').disabled=reviewedText===null||!replacementAvailable(selected);}
}
async function today(){try{const result=await bridge.request('/v1/agent',{action:'agent.propose',payload:{matterId:sessionStorage.getItem('lex-office-matter')||'',action:'planner.today',args:{}}});setText('today-status',`${result.result?.length||0} recordatorio(s) para hoy.`);}catch(error){setText('today-status',error.message,'error');}}
Office.onReady(()=>{mountAssistant('Word',selectedText,insertDraft);initPairing(session=>{if(session?.matterId)sessionStorage.setItem('lex-office-matter',session.matterId);});element('review').addEventListener('click',review);element('today').addEventListener('click',today);element('apply').addEventListener('click',apply);element('document-type').addEventListener('change',()=>{clearReview();setText('review-status','Tipo de documento cambiado. Vuelve a revisar.');});});

async function selectedText(){return Word.run(async context=>{const range=context.document.getSelection();range.load('text');await context.sync();return range.text;});}

async function insertDraft(text){
  await Word.run(async context=>{
    context.document.changeTrackingMode=Word.ChangeTrackingMode.trackAll;
    context.document.getSelection().insertText(text,Word.InsertLocation.after);
    await context.sync();
  });
}

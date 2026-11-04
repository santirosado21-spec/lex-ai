import {bridge} from './common.js';

export function mountAssistant(host, readSelection, insertDraft) {
  const section = document.createElement('section');
  section.className = 'block assistant';
  const material = host==='Excel'?'las celdas seleccionadas':host==='SharePoint'?'el texto seleccionado en la página':'el texto seleccionado';
  section.innerHTML = `<p role="status" class="pane-status"></p>
    <h2>Preguntar</h2>
    <label><span class="sr-only">Consulta</span><textarea data-question rows="3" maxlength="4000" placeholder="Pregunta sobre el asunto vinculado"></textarea></label>
    <div class="row"><button type="button" data-ask>Preguntar a LEX AI</button><button type="button" data-history>Ver conversación del asunto</button></div>
    <div data-replies class="replies"></div>
    <h2 class="sub">Selección</h2>
    <p class="hint">Guarda en el asunto ${material}. Revisa el texto antes de guardarlo.</p>
    <button type="button" data-preview>Leer selección</button>
    <label>Texto que se guardará en el asunto<textarea data-selection rows="4" maxlength="60000"></textarea></label>
    <button type="button" data-save>Guardar este texto en el asunto</button>`;
  document.getElementById('workspace').prepend(section);
  const get = selector => section.querySelector(selector);
  const status = get('[role=status]');
  function action(selector, run) {
    const button = get(selector);
    button.onclick = async () => {
      button.disabled = true;
      try {await run();} catch(error){status.textContent=error.message;}
      finally {button.disabled=false;}
    };
  }
  action('[data-preview]',async()=>{
    const value = await readSelection();
    if (!value.trim() || value.length>60000) throw Error('Elige un fragmento de hasta 60.000 caracteres.');
    get('[data-selection]').value=value;
    status.textContent='Revisa el texto antes de guardarlo.';
  });
  action('[data-save]',async()=>{
    await bridge.request('/v1/selection',{host,text:get('[data-selection]').value});
    status.textContent='Texto disponible en la biblioteca local del asunto.';
  });
  function renderReply(answer){
    const card=document.createElement('article');card.className='reply';
    const label=document.createElement('label');
    label.textContent=answer.question+(answer.editedDraft?' · Editada, versión '+answer.editedDraft.version:'');
    const editor=document.createElement('textarea');
    editor.rows=7; editor.value=answer.text; editor.readOnly=true; label.append(editor);
    const edit=document.createElement('button');
    edit.textContent='Editar versión'; let draft;
    edit.onclick=async()=>{
      edit.disabled=true;
      try{
        if(!draft){
          draft=await bridge.request('/v1/draft',{replyId:answer.id});
          editor.value=draft.text;editor.readOnly=false;
          edit.textContent='Guardar versión en el asunto';editor.focus();
        }else{
          draft=await bridge.request('/v1/draft/save',{draftId:draft.id,expectedVersion:draft.version,title:draft.title,text:editor.value});
          status.textContent='Versión '+draft.version+' guardada. Las fuentes corresponden al original.';
        }
      }catch(error){status.textContent=error.message;}finally{edit.disabled=false;}
    };
    const sources=document.createElement('p');sources.className='sources';
    sources.textContent=(answer.citations||[]).map(c=>c.title||c.name||c.sourceId).filter(Boolean).join('; ');
    card.append(label,sources,edit);get('[data-replies]').append(card);
    if(insertDraft){
      const insert=document.createElement('button');
      insert.textContent=host==='Word'?'Insertar después de la selección en Word':'Insertar en la celda vacía seleccionada';
      insert.onclick=async()=>{
        insert.disabled=true;
        try{await insertDraft(editor.value);status.textContent='Borrador insertado en '+host+'.';}
        catch(error){status.textContent=error.message;}
        finally{insert.disabled=false;}
      };
      card.append(insert);
    }
  }
  action('[data-history]',async()=>{
    const thread=await bridge.request('/v1/thread',{});
    get('[data-replies]').replaceChildren();
    thread.forEach(renderReply);
    status.textContent=thread.length?'Conversación del asunto cargada.':'Este asunto aún no tiene mensajes.';
  });
  action('[data-ask]',async()=>{
    const question=get('[data-question]').value.trim();
    if (!question) throw Error('Escribe una consulta.');
    status.textContent='Consultando en este equipo…';
    const answer=await bridge.request('/v1/ask',{question});
    renderReply({...answer,question});
    get('[data-question]').value='';
    status.textContent='Puedes editar y copiar el borrador. El original queda en el hilo local.';
  });
}

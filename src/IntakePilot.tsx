import IntakeTariff from './IntakeTariff';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronLeft, Cloud, ExternalLink, FileText, FolderClosed, HardDrive, LoaderCircle, Monitor, Presentation, Table2} from 'lucide-react';
import {api, downloadFile} from './api';
import IntakeCaseDocument,{type CaseDatum} from './IntakeCaseDocument';
import IntakeCloudUsage,{type CloudUsage} from './IntakeCloudUsage';
import IntakeTradeWorksheet from './IntakeTradeWorksheet';
import LocalIntakeImport from './LocalIntakeImport';
import PublicLibrary from './PublicLibrary';
import mark from './assets/rejon-mark.svg';
import './intake-pilot.css';

type Task = 'case-note' | 'opening' | 'documents' | 'trade' | `research-${string}` | `lectura-${string}` | `contraste-${string}` | `revision-${string}` | `tarifa-${string}`;
type Format = 'docx' | 'xlsx' | 'pptx';
type IntakeFields = {reviewId?:string;client:string; title:string; documentKind:string; scenarioId?:string; supplier?:string};
type TaskInfo = {
  id: Task; parent?:Task; localOnly?:boolean; title: string; preview?: string; evidence?:{line:number;excerpt:string;additional?:{line:number;excerpt:string}[]};
  comparison?:{subject:string;title:string;label:string;suggested:boolean;suggestedLabel:string;conflicting:boolean;cached:boolean};
  references?: {id: string; title: string; url: string; locator: string; summary: string; checkedOn: string; text?: string; sourceId?: string;localUrl?:string;historyUrl?:string}[];
};
type PilotStatus = {saved: boolean; cloudUsage?:CloudUsage; protectedRecords?:boolean;hasDocument?:boolean; drafts: Partial<Record<Task,string>>; tasks: TaskInfo[]; followupParents?:Task[]; editedTasks?: Task[]};
const formats = [
  {id:'docx', name:'Word', Icon:FileText},
  {id:'xlsx', name:'Excel', Icon:Table2},
  {id:'pptx', name:'PowerPoint', Icon:Presentation},
] as const;

function MarkedText({text}:{text:string}) {
  return <>{text.split(/(\[\[(?:[A-Z_][A-Z_0-9]*|DATO_\d+_[a-f0-9]{12})\]\])/g).map((part,index)=>
    part.startsWith('[[') && part.endsWith(']]') ? <mark key={index}>{part==='[[SOPORTE]]'?'Fragmento del soporte':part.startsWith('[[DATO_')?'Dato '+part.split('_')[1]:part}</mark> : part)}</>;
}

export default function IntakePilot() {
  const [pilot,setPilot] = useState<PilotStatus|null>(null);
  const [clientStep,setClientStep] = useState(false);
  const [worksheetDirty,setWorksheetDirty]=useState(false);
  const [focusRequest,setFocusRequest]=useState('');
  const [inspecting,setInspecting] = useState(false);
  const [libraryView,setLibraryView]=useState<'leyes'|'tarifa'>('leyes');
  const [libraryOpen,setLibraryOpen] = useState(false);
  const [firm,setFirm] = useState('');
  const [client,setClient] = useState('');
  const [title,setTitle] = useState('');
  const [documentKind,setDocumentKind] = useState('otro');
  const [scenarioId,setScenarioId] = useState<string>();
  const [reviewId,setReviewId] = useState<string>();
  const [extraProtection,setExtraProtection]=useState(false);
  const [keepDocument,setKeepDocument] = useState(true);
  const editBox=useRef<HTMLTextAreaElement>(null);
  const [supplier,setSupplier] = useState('');
  const [selected,setSelected] = useState<Task>('trade');
  const [format,setFormat] = useState<Format>('docx');
  const [activity,setActivity] = useState<'loading'|'save'|'cloud'|'edit'|'preview'|'export'|null>('loading');
  const [restored,setRestored] = useState('');
  const [editText,setEditText] = useState<string|null>(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const saved = Boolean(pilot?.saved);
  const activeTask = pilot?.tasks.find(item=>item.id===selected) ?? pilot?.tasks[0];
  const task = activeTask?.id;
  const comparison=activeTask?.comparison;
  const taskList=pilot?.tasks.filter(item=>!item.comparison||(item.comparison.subject===comparison?.subject?item.id===task:item.comparison.suggested));
  const draft = task && pilot?.drafts[task];
  const busy = activity!==null || inspecting || worksheetDirty;
  const stage = !saved ? 0 : draft ? 2 : 1;

  useEffect(()=>{
    let active=true;
    api<PilotStatus>('intake.status').then(result=>{if(active){setPilot(result);const initial=result.tasks.find(item=>item.id==='case-note'||item.evidence);if(initial)setSelected(initial.id);}})
      .catch(()=>{if(active) setError('Abre el piloto desde su lanzador local para conectar con el expediente.');})
      .finally(()=>{if(active) setActivity(null);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    if (clientStep || saved) heading.current?.focus();
  },[clientStep,saved]);

  function clearFeedback() { setError(''); setNotice(''); }
  function clearScenario() {
    setScenarioId(undefined);
    setSupplier('');
  }
  function applyExtract(fields:IntakeFields) {
    setExtraProtection(false);setReviewId(fields.reviewId);setKeepDocument(true);
    setClient(fields.client);
    setTitle(fields.title);
    setDocumentKind(fields.documentKind);
    setScenarioId(fields.scenarioId);
    setSupplier(fields.supplier??'');
  }

  async function save(event:FormEvent) {
    event.preventDefault();
    if (busy) return;
    clearFeedback();
    if (!clientStep) {setClientStep(true); return;}
    setActivity('save');
    try {
      const invoice = !extraProtection && scenarioId==='factura-origen-v1' && documentKind==='factura';
      const data=await api<PilotStatus>('intake.save',{
        firm:firm.trim(),client:client.trim(),title:title.trim(),jurisdiction:'MX-FED',documentKind,
        ...(invoice ? {scenarioId} : {}),
        ...(keepDocument&&reviewId?{reviewId}:{}),
        ...(invoice && supplier.trim() ? {supplier:supplier.trim()} : {}),
      });
      setPilot(data);
      const initial=data.tasks.find(item=>item.id==='case-note'||item.evidence);if(initial)setSelected(initial.id);
      setFirm(''); setClient(''); setTitle('');setReviewId(undefined); clearScenario();
      setNotice('Expediente guardado en este equipo.');
    } catch {setError('No se pudo guardar el expediente. Revisa los campos y vuelve a intentarlo.');}
    finally {setActivity(null);}
  }
  async function chooseTariff(code:string,page:number) {
    const result=await api<{task:Task;status:PilotStatus}>('intake.addTariff',{code,page});
    setPilot(result.status);setSelected(result.task);setRestored('');clearFeedback();
    setLibraryOpen(false);setNotice('Ficha guardada en el expediente.');heading.current?.focus();
  }
  async function choosePassage(sourceId:string,part:number) {
    const result=await api<{task:Task;status:PilotStatus}>('intake.addPassage',{sourceId,part});
    setPilot(result.status);setSelected(result.task);setRestored('');clearFeedback();
    setLibraryOpen(false);setNotice('Pasaje añadido. Revisa el mensaje antes de enviarlo.');
    heading.current?.focus();
  }
  async function generate() {
    if (busy || !task || !activeTask?.preview) return;
    clearFeedback(); setRestored(''); setActivity('cloud');
    try {
      setPilot(await api<PilotStatus>('intake.draft',{task}));
      setNotice(comparison?.cached?'Borrador preparado con la consulta guardada en este equipo.':'Borrador recibido. Ya puedes revisar la versión local.');
    } catch(cause) {
      const invalidComparison=comparison&&cause instanceof Error&&/contraste|hipótesis|pregunta guardada/i.test(cause.message);
      setError(invalidComparison?'La respuesta del contraste necesita cotejo. El borrador sigue pendiente.':comparison?.cached?'No se pudo abrir la consulta guardada en este equipo.':'La consulta terminó sin un borrador. Revisa el uso de OpenAI y las cuentas configuradas en el lanzador.');
      try{setPilot(await api<PilotStatus>('intake.status'));}catch{ /* Preserve the local view if the service is offline. */ }
    }
    finally {setActivity(null);}
  }
  useEffect(()=>{setFocusRequest('');},[task]);
  async function followup(form:'carta'|'control') {
    if (!task||busy) return;
    clearFeedback();setActivity('loading');
    try {
      const next=await api<{task:Task;status:PilotStatus}>('intake.addFollowup',{task,form,instruction:focusRequest});
      setPilot(next.status);setSelected(next.task);setRestored('');
      requestAnimationFrame(()=>document.querySelector<HTMLElement>('#intake-task')?.focus());
    } catch(cause) {setError(cause instanceof Error?cause.message:'No se pudo preparar el seguimiento con las fuentes de la nota.');}
    finally {setActivity(null);}
  }
  async function reveal() {
    if (busy || !task || !draft) return;
    clearFeedback(); setActivity('preview');
    try {setRestored((await api<{text:string}>('intake.preview',{task})).text);}
    catch {setError('El servicio local no pudo recuperar el texto original.');}
    finally {setActivity(null);}
  }
  function insertDatum(item:CaseDatum) {
    const element=editBox.current;
    if(editText===null||!element)return;
    const start=element.selectionStart,end=element.selectionEnd;
    const next=editText.slice(0,start)+item.token+editText.slice(end);
    if(next.length>1800){setError('El marcador superaría los 1800 caracteres del borrador.');return;}
    setEditText(next);clearFeedback();
    requestAnimationFrame(()=>{element.focus();element.setSelectionRange(start+item.token.length,start+item.token.length);});
  }
  async function saveEdit() {
    if (busy || !task || editText===null) return;
    clearFeedback();
    const validatedText=activeTask?.evidence?editText.replaceAll('[[SOPORTE]]',''):editText;
    if (!editText.includes('[[CLIENTE]]') || !editText.includes('[[ASUNTO]]') || /\[\[|\]\]/.test(validatedText.replace(/\[\[(?:CLIENTE|ASUNTO|DATO_[1-9]\d{0,2}_[a-f0-9]{12})\]\]/g,''))) {
      setError('Conserva los marcadores [[CLIENTE]] y [[ASUNTO]] y usa los datos del soporte de este expediente.');
      return;
    }
    setActivity('edit');
    try {
      setPilot(await api<PilotStatus>('intake.edit',{task,text:editText}));
      setEditText(null); setNotice('Cambios guardados en este equipo.');
    } catch {setError('No se pudo guardar la edición. Tus cambios siguen abiertos.');}
    finally {setActivity(null);}
  }
  async function exportTariffs(){
    if(busy)return;
    clearFeedback();setActivity('export');
    try{downloadFile(await api<{name:string;base64:string;mime:string}>('intake.exportTariffBook',{}));setNotice('Comparativo generado en este equipo.');}
    catch{setError('No se pudo generar el comparativo de la tarifa.');}
    finally{setActivity(null);}
  }
  async function exportDraft() {
    if (busy || !draft || !task) return;
    clearFeedback(); setActivity('export');
    try {
      downloadFile(await api<{name:string;base64:string;mime:string}>('intake.export',{task,format}));
      setNotice('Archivo generado con los datos originales. Revisa tus descargas.');
    } catch {setError('No se pudo generar el archivo. El borrador sigue disponible.');}
    finally {setActivity(null);}
  }

  return <main className="rp-shell">
    <header className="rp-top">
      <div className="rp-brand"><img src={mark} alt=""/>Rejon<span>.AI</span></div>
      <div className="rp-tools"><button className="rp-library-button" type="button" aria-controls="rp-law-library" aria-expanded={libraryOpen} disabled={busy||editText!==null} onClick={()=>setLibraryOpen(!libraryOpen)}><BookOpen size={16}/>{libraryOpen?'Cerrar biblioteca':'Biblioteca federal'}</button>
      <span className="rp-local"><Monitor size={15}/> {pilot?.protectedRecords?'Expediente cifrado':'Espacio local'}</span></div>
    </header>
    <div id="rp-law-library" hidden={!libraryOpen} className="rp-library-panel">{libraryOpen&&<><div className="rp-library-views" role="group" aria-label="Colección jurídica">
    <button className="rp-quiet" aria-pressed={libraryView==='leyes'} onClick={()=>setLibraryView('leyes')}>Leyes federales</button>
    <button className="rp-quiet" aria-pressed={libraryView==='tarifa'} onClick={()=>setLibraryView('tarifa')}>Tarifa arancelaria</button></div>
    {libraryView==='leyes'?<PublicLibrary onChoosePassage={saved?choosePassage:undefined}/>:<IntakeTariff saved={Boolean(saved&&pilot?.protectedRecords)} onSave={chooseTariff}/>}</>}</div>
    <div className="rp-layout" hidden={libraryOpen}>
      <aside className="rp-context">
        <div className="rp-image"><img src="/brand/lex-cover.webp" alt=""/></div>
        <div className="rp-aside-body"><div className="rp-eyebrow">Práctica jurídica · México</div><h2>Comercio <br/>exterior</h2>
          <ol className="rp-steps" aria-label="Flujo del expediente">
            {[
              {name:'Alta del expediente',where:'En tu equipo',Icon:FolderClosed},
              {name:'Redacción con marcadores',where:'En OpenAI',Icon:Cloud},
              {name:'Restitución y exportación',where:'En tu equipo',Icon:ArrowDownToLine},
            ].map(({name,where,Icon},i)=><li key={name} aria-current={i===stage?'step':undefined} className={i<stage?'rp-complete':''}>
              <span className="rp-step-icon">{i<stage?<Check size={16}/>:<Icon size={16}/>}</span>
              <div>{name}<small>{where}</small></div></li>)}
          </ol>
        </div>
      </aside>
      <section className="rp-work" aria-busy={activity!==null||inspecting}>
        <div className="rp-intro">
          <div className="rp-eyebrow">{saved?'Mesa de trabajo':clientStep?'Alta del asunto':'Alta del despacho'}</div>
          <h1 tabIndex={-1} ref={heading}>{saved?'Preparar un borrador':clientStep?'Abre tu expediente':'Tu espacio de trabajo'}</h1>
          <p>{saved?'Selecciona la tarea y revisa el texto que recibirá OpenAI.':clientStep?'Revisa el cliente y el asunto antes de guardarlos en este equipo.':'Prueba el flujo con un despacho y un cliente ficticios. Los datos del alta se guardan en este equipo.'}</p>
        </div>
        {activity==='loading'&&<p role="status">Abriendo el espacio local…</p>}
        {pilot&&!saved&&<div key={clientStep?'client':'firm'} className="rp-reveal">
          {clientStep&&<LocalIntakeImport ciphered={pilot.protectedRecords} onBusyChange={setInspecting} onReviewChange={(id,corrected)=>{setReviewId(id);setExtraProtection(corrected);}} onReplace={()=>{clearScenario();setExtraProtection(false);setReviewId(undefined);}} onExtract={applyExtract}/>}
          <form className="rp-form" onSubmit={save}>
            {!clientStep?<label htmlFor="intake-firm">Nombre del despacho<input id="intake-firm" autoComplete="off" required maxLength={120} value={firm} onChange={e=>setFirm(e.target.value)} placeholder="Nombre del despacho ficticio"/></label>:<>
              <label htmlFor="intake-client">Cliente<input id="intake-client" autoComplete="off" required maxLength={200} disabled={busy} value={client} onChange={e=>setClient(e.target.value)}/></label>
              {!extraProtection&&documentKind==='factura'&&scenarioId==='factura-origen-v1'&&<label htmlFor="intake-supplier">Proveedor<input id="intake-supplier" autoComplete="off" maxLength={200} disabled={busy} value={supplier} onChange={e=>setSupplier(e.target.value)}/></label>}
              <label htmlFor="intake-title">Asunto<input id="intake-title" autoComplete="off" required maxLength={200} disabled={busy} value={title} onChange={e=>setTitle(e.target.value)}/></label>
              <label htmlFor="intake-kind">Tipo de documento<select id="intake-kind" disabled={busy} value={documentKind} onChange={e=>{setDocumentKind(e.target.value);clearScenario();}}><option value="otro">Otro</option><option value="pedimento">Pedimento</option><option value="factura">Factura</option><option value="contrato">Contrato</option></select></label>
              {reviewId&&<label className="rp-keep-document"><input type="checkbox" checked={keepDocument} onChange={event=>setKeepDocument(event.target.checked)}/> Guardar el texto revisado y sus sustituciones en este expediente cifrado</label>}
              <small>La plantilla de comercio exterior incluye el tipo de documento que confirmes aquí.</small>
            </>}
            <div className="rp-actions">
              <button className="rp-primary" disabled={busy||!firm.trim()||(clientStep&&(!client.trim()||!title.trim()))}>{clientStep?'Guardar en este equipo':'Continuar'} <ArrowRight size={16}/></button>
              <button className="rp-quiet" type="button" disabled={busy} onClick={()=>{if(clientStep){setClient('Comercial Brújula Ficticia');setReviewId(undefined);setTitle('Revisión de pedimento ficticio');setDocumentKind('pedimento');clearScenario();}else setFirm('Despacho Horizonte Ficticio');}}>Usar ejemplo</button>
            </div>
            {clientStep&&<button type="button" className="rp-back" disabled={busy} onClick={()=>{clearFeedback();setReviewId(undefined);setClientStep(false);}}><ChevronLeft size={15}/> Volver al despacho</button>}
          </form>
        </div>}
        {pilot?.cloudUsage&&<IntakeCloudUsage usage={pilot.cloudUsage}/>}
        {saved&&activeTask&&<div className="rp-reveal rp-editor">
          <label htmlFor="intake-task">Tarea del despacho<select id="intake-task" value={task} disabled={busy||editText!==null} onChange={e=>{setSelected(e.target.value as Task);setRestored('');clearFeedback();}}>
            {taskList?.map(item=><option value={item.id} key={item.id}>{item.comparison?'Contrastar '+item.comparison.title.toLowerCase():item.title}</option>)}
          </select></label>
          {!pilot?.tasks.some(item=>item.id==='trade')&&<p className="rp-availability">La edición cotejada de las fuentes de comercio exterior no está disponible en este equipo.</p>}
          {activeTask.parent&&<div className="rp-followup"><button type="button" className="rp-quiet" disabled={busy||editText!==null} onClick={()=>{setSelected(activeTask.parent!);setRestored('');clearFeedback();}}><ChevronLeft size={15}/> Volver al primer borrador</button><p>La consulta retoma las citas del primer borrador. Las ediciones que escribiste permanecen en tu equipo.</p></div>}
          {task==='lectura-clasificacion'&&<button className="rp-quiet" disabled={busy||editText!==null} onClick={()=>{setLibraryView('tarifa');setLibraryOpen(true);}}>Buscar fracción en la tarifa</button>}
          {comparison&&<section className="rp-comparison" aria-label="Contraste del expediente">
            <label htmlFor="rp-variant">Hipótesis que quieres contrastar<select id="rp-variant" disabled={busy||editText!==null} value={task} onChange={e=>{setSelected(e.target.value as Task);setRestored('');clearFeedback();}}>
             {pilot?.tasks.filter(item=>item.comparison?.subject===comparison.subject).map(item=><option key={item.id} value={item.id}>{item.comparison?.label}</option>)}
            </select></label>
            <p>{comparison.conflicting?'El soporte contiene indicios contradictorios.':('Sugerencia local: '+comparison.suggestedLabel+'.')} Revisa las líneas del soporte antes de usar el borrador.</p>
          </section>}
          {activeTask.evidence&&<details className="rp-details rp-reading-evidence" key={'reading-'+task}><summary><FileText size={16}/> {comparison||activeTask.parent||activeTask.localOnly?'Líneas del soporte local':'Por qué se sugiere esta lectura'}</summary>
            <p>El tema aparece en la línea {activeTask.evidence.line} del texto extraído. Este fragmento se incorpora en tu equipo al mostrar los datos originales o exportar. Puedes quitarlo al editar el borrador.</p>
            <blockquote>{activeTask.evidence.excerpt}</blockquote>
            {activeTask.evidence.additional?.map(row=><blockquote key={row.line}>Línea {row.line} · {row.excerpt}</blockquote>)}
          </details>}
          {(task==='lectura-valoracion'||task==='lectura-pedimento')&&editText===null&&<IntakeTradeWorksheet key={task} task={task} disabled={activity!==null}
            onDirty={setWorksheetDirty} onSave={()=>{setRestored('');clearFeedback();}}/>}
          {pilot?.hasDocument&&editText===null&&<IntakeCaseDocument/>}
          {activeTask.references?.length ? <details className="rp-details" key={'sources-'+task}><summary><BookOpen size={16}/> Fuentes de consulta ({activeTask.references.length})</summary>
            <ul>{activeTask.references.map(source=><li key={source.id}><a href={source.url} rel="noreferrer" target="_blank">{source.title} <ExternalLink size={12}/></a><p>{source.locator} · {source.summary}</p>
                {source.localUrl&&<p><a href={source.localUrl} target="_blank" rel="noreferrer">Abrir la página en la copia local</a> · <a href={source.historyUrl} target="_blank" rel="noreferrer">Historial de reformas</a></p>}
                {source.text&&<details className="rp-citation"><summary>Texto consultado</summary><blockquote>{source.text}</blockquote>{source.sourceId&&<small>{source.sourceId}</small>}</details>}
              </li>)}</ul></details>:null}
          {activeTask.evidence&&!activeTask.preview&&!activeTask.localOnly&&<p className="rp-availability">Falta una fuente verificable para esta lectura. Puedes consultar el soporte local o elegir otra tarea.</p>}
          {task==='case-note'&&!activeTask.preview&&<p className="rp-availability">No se pudo verificar la protección, los hechos o la fuente pública de este ejercicio. El soporte permanece disponible en el equipo.</p>}
          {activeTask.localOnly?null:draft?<details className="rp-details" key={'sent-'+task}><summary><Cloud size={16}/> {comparison?'Ver la consulta común del tema':'Ver el mensaje enviado'}</summary><div className="rp-preview"><MarkedText text={activeTask.preview??''}/></div></details>:
            <section className="rp-proof"><h2><Cloud size={17}/> {comparison?.cached?'Consulta guardada en este equipo':'Mensaje para OpenAI'}</h2>{activeTask.evidence&&!activeTask.parent?<><p className="rp-reading-summary">{comparison?(comparison.cached?'Las tres hipótesis ya tienen respuesta. Puedes preparar esta variante en tu equipo.':'OpenAI recibe las tres hipótesis y la fuente jurídica. Tu elección y las líneas del expediente se quedan en este equipo.'):'La consulta incluye el tema y fragmentos de dos artículos federales. El fragmento del expediente permanece en este equipo.'}</p>
                <details className="rp-details rp-reading-message" key={'message-'+task}><summary>Leer el mensaje completo</summary><div className="rp-preview"><MarkedText text={activeTask.preview??'Vista previa no disponible.'}/></div></details></>:
                <div className="rp-preview"><MarkedText text={activeTask.preview??'Vista previa no disponible.'}/></div>}
              <button type="button" className="rp-primary" disabled={busy||!activeTask.preview||(!comparison?.cached&&pilot?.cloudUsage?.remaining===0)} onClick={()=>void generate()}>{activity==='cloud'?<><LoaderCircle className="rp-spin" size={16}/> {comparison?.cached?'Preparando borrador…':'Generando borrador…'}</>:<>{comparison?.cached?'Preparar esta variante en mi equipo':'Enviar y generar borrador'} <ArrowRight size={16}/></>}</button>
              {!comparison?.cached&&pilot?.cloudUsage?.remaining===0&&<p className="rp-availability">Se usaron los tres envíos de esta sesión. Puedes seguir trabajando con el expediente y los borradores guardados.</p>}
            </section>}
          {draft&&<section className="rp-proof rp-reveal"><h2><FileText size={17}/> {pilot?.editedTasks?.includes(task!)?'Borrador editado':activeTask.localOnly?'Ficha de la tarifa':'Borrador'}</h2>
            {editText!==null ? <div className="rp-edit">
              <label htmlFor="intake-edit">Editar en este equipo<textarea ref={editBox} id="intake-edit" autoFocus disabled={busy} value={editText} onChange={e=>setEditText(e.target.value)} maxLength={1800} rows={6}/></label>
              {pilot?.hasDocument&&<IntakeCaseDocument insert={insertDatum}/>}
              <small>Conserva [[CLIENTE]] y [[ASUNTO]] para recuperar los originales al exportar. {editText.length}/1800</small>
              <div className="rp-actions"><button className="rp-primary" disabled={busy} onClick={()=>void saveEdit()}>Guardar cambios</button><button className="rp-quiet" disabled={busy} onClick={()=>{setEditText(null);clearFeedback();}}>Descartar edición</button></div>
            </div>:<>
            <div className="rp-switch" aria-label="Vista del borrador" role="group"><button aria-pressed={!restored} disabled={busy} onClick={()=>setRestored('')}>{activeTask.localOnly?<HardDrive size={14}/>:<Cloud size={14}/>} Con marcadores</button><button aria-pressed={Boolean(restored)} disabled={busy} onClick={()=>void reveal()}><HardDrive size={14}/> Datos originales</button></div>
            <div className="rp-preview rp-document">{restored||<MarkedText text={draft}/>}</div>
            <button className="rp-quiet" disabled={busy} onClick={()=>{clearFeedback();setRestored('');setEditText(draft);}}>Editar borrador</button>
            {task&&pilot?.followupParents?.includes(task)&&<section className="rp-followup"><h3>Continuar desde esta nota</h3>
              <label htmlFor="rp-focus">Documentos que quieres revisar (opcional)<textarea id="rp-focus" rows={2} maxLength={400} value={focusRequest} disabled={busy} onChange={e=>setFocusRequest(e.target.value)} placeholder="Pide la factura y el comprobante de pago"/></label>
              <p>Rejon identifica hasta dos tipos de documento en tu indicación. Puedes revisar la selección y las citas en el mensaje antes de enviarlo.</p><div className="rp-actions">
              <button type="button" className="rp-quiet" disabled={busy} onClick={()=>void followup('carta')}>Preparar solicitud al cliente</button>
              <button type="button" className="rp-quiet" disabled={busy} onClick={()=>void followup('control')}>Preparar lista de cotejo</button>
            </div></section>}
            {activeTask.localOnly&&<button className="rp-quiet" disabled={busy} onClick={()=>void exportTariffs()}><Table2 size={16}/>Comparar fichas guardadas en Excel</button>}
            <h3>Exportar con datos originales</h3><div className="rp-formats" aria-label="Formato del archivo" role="group">{formats.map(({id,name,Icon})=><button key={id} aria-pressed={format===id} disabled={busy} onClick={()=>setFormat(id)}><Icon size={16}/>{name}</button>)}</div>
            <button className="rp-primary" disabled={busy} onClick={()=>void exportDraft()}><ArrowDownToLine size={16}/>{activity==='export'?'Generando archivo…':'Descargar .'+format}</button></>}
          </section>}
        </div>}
        {error&&<div className="rp-error" role="alert">{error}</div>}
        <div className="rp-notice" role="status">{notice}</div>
      </section>
    </div>
  </main>;
}

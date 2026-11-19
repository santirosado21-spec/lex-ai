import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronLeft, Cloud, ExternalLink, FileText, FolderClosed, HardDrive, LoaderCircle, Monitor, Presentation, Table2} from 'lucide-react';
import {api, downloadFile} from './api';
import LocalIntakeImport from './LocalIntakeImport';
import PublicLibrary from './PublicLibrary';
import mark from './assets/rejon-mark.svg';
import './intake-pilot.css';

type Task = 'opening' | 'documents' | 'trade' | `research-${string}`;
type Format = 'docx' | 'xlsx' | 'pptx';
type IntakeFields = {client:string; title:string; documentKind:string; scenarioId?:string; supplier?:string};
type TaskInfo = {
  id: Task; title: string; preview?: string;
  references?: {id: string; title: string; url: string; locator: string; summary: string; checkedOn: string; text?: string; sourceId?: string}[];
};
type PilotStatus = {saved: boolean; drafts: Partial<Record<Task,string>>; tasks: TaskInfo[]; editedTasks?: Task[]};
const formats = [
  {id:'docx', name:'Word', Icon:FileText},
  {id:'xlsx', name:'Excel', Icon:Table2},
  {id:'pptx', name:'PowerPoint', Icon:Presentation},
] as const;

function MarkedText({text}:{text:string}) {
  return <>{text.split(/(\[\[[A-Z_][A-Z_0-9]*\]\])/g).map((part,index)=>
    part.startsWith('[[') && part.endsWith(']]') ? <mark key={index}>{part}</mark> : part)}</>;
}

export default function IntakePilot() {
  const [pilot,setPilot] = useState<PilotStatus|null>(null);
  const [clientStep,setClientStep] = useState(false);
  const [inspecting,setInspecting] = useState(false);
  const [libraryOpen,setLibraryOpen] = useState(false);
  const [firm,setFirm] = useState('');
  const [client,setClient] = useState('');
  const [title,setTitle] = useState('');
  const [documentKind,setDocumentKind] = useState('otro');
  const [scenarioId,setScenarioId] = useState<string>();
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
  const draft = task && pilot?.drafts[task];
  const busy = activity!==null || inspecting;
  const stage = !saved ? 0 : draft ? 2 : 1;

  useEffect(()=>{
    let active=true;
    api<PilotStatus>('intake.status').then(result=>{if(active) setPilot(result);})
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
  function importActivity(busy:boolean) {
    setInspecting(busy);
    if (busy) clearScenario();
  }
  function applyExtract(fields:IntakeFields) {
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
      const invoice = scenarioId==='factura-origen-v1' && documentKind==='factura';
      const data=await api<PilotStatus>('intake.save',{
        firm:firm.trim(),client:client.trim(),title:title.trim(),jurisdiction:'MX-FED',documentKind,
        ...(invoice ? {scenarioId} : {}),
        ...(invoice && supplier.trim() ? {supplier:supplier.trim()} : {}),
      });
      setPilot(data);
      setFirm(''); setClient(''); setTitle(''); clearScenario();
      setNotice('Expediente guardado en este equipo.');
    } catch {setError('No se pudo guardar el expediente. Revisa los campos y vuelve a intentarlo.');}
    finally {setActivity(null);}
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
      setNotice('Borrador recibido. Ya puedes revisar la versión local.');
    } catch {setError('OpenAI no entregó el borrador. Verifica la conexión y la clave configurada en el lanzador.');}
    finally {setActivity(null);}
  }
  async function reveal() {
    if (busy || !task || !draft) return;
    clearFeedback(); setActivity('preview');
    try {setRestored((await api<{text:string}>('intake.preview',{task})).text);}
    catch {setError('El servicio local no pudo recuperar el texto original.');}
    finally {setActivity(null);}
  }
  async function saveEdit() {
    if (busy || !task || editText===null) return;
    clearFeedback();
    if (!editText.includes('[[CLIENTE]]') || !editText.includes('[[ASUNTO]]') || /\[\[|\]\]/.test(editText.replace(/\[\[(?:CLIENTE|ASUNTO)\]\]/g,''))) {
      setError('Conserva los marcadores [[CLIENTE]] y [[ASUNTO]] y evita otros marcadores dobles.');
      return;
    }
    setActivity('edit');
    try {
      setPilot(await api<PilotStatus>('intake.edit',{task,text:editText}));
      setEditText(null); setNotice('Cambios guardados en este equipo.');
    } catch {setError('No se pudo guardar la edición. Tus cambios siguen abiertos.');}
    finally {setActivity(null);}
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
      <span className="rp-local"><Monitor size={15}/> Espacio local</span></div>
    </header>
    <div id="rp-law-library" hidden={!libraryOpen} className="rp-library-panel">{libraryOpen&&<PublicLibrary onChoosePassage={saved?choosePassage:undefined}/>}</div>
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
      <section className="rp-work" aria-busy={busy}>
        <div className="rp-intro">
          <div className="rp-eyebrow">{saved?'Mesa de trabajo':clientStep?'Alta del asunto':'Alta del despacho'}</div>
          <h1 tabIndex={-1} ref={heading}>{saved?'Preparar un borrador':clientStep?'Abre tu expediente':'Tu espacio de trabajo'}</h1>
          <p>{saved?'Selecciona la tarea y revisa el texto que recibirá OpenAI.':clientStep?'Revisa el cliente y el asunto antes de guardarlos en este equipo.':'Prueba el flujo con un despacho y un cliente ficticios. Los datos del alta se guardan en este equipo.'}</p>
        </div>
        {activity==='loading'&&<p role="status">Abriendo el espacio local…</p>}
        {pilot&&!saved&&<div key={clientStep?'client':'firm'} className="rp-reveal">
          {clientStep&&<LocalIntakeImport onBusyChange={importActivity} onExtract={applyExtract}/>}
          <form className="rp-form" onSubmit={save}>
            {!clientStep?<label htmlFor="intake-firm">Nombre del despacho<input id="intake-firm" autoComplete="off" required maxLength={120} value={firm} onChange={e=>setFirm(e.target.value)} placeholder="Nombre del despacho ficticio"/></label>:<>
              <label htmlFor="intake-client">Cliente<input id="intake-client" autoComplete="off" required maxLength={200} disabled={busy} value={client} onChange={e=>setClient(e.target.value)}/></label>
              {documentKind==='factura'&&scenarioId==='factura-origen-v1'&&<label htmlFor="intake-supplier">Proveedor<input id="intake-supplier" autoComplete="off" maxLength={200} disabled={busy} value={supplier} onChange={e=>setSupplier(e.target.value)}/></label>}
              <label htmlFor="intake-title">Asunto<input id="intake-title" autoComplete="off" required maxLength={200} disabled={busy} value={title} onChange={e=>setTitle(e.target.value)}/></label>
              <label htmlFor="intake-kind">Tipo de documento<select id="intake-kind" disabled={busy} value={documentKind} onChange={e=>{setDocumentKind(e.target.value);clearScenario();}}><option value="otro">Otro</option><option value="pedimento">Pedimento</option><option value="factura">Factura</option><option value="contrato">Contrato</option></select></label>
              <small>La plantilla de comercio exterior incluye el tipo de documento que confirmes aquí.</small>
            </>}
            <div className="rp-actions">
              <button className="rp-primary" disabled={busy||!firm.trim()||(clientStep&&(!client.trim()||!title.trim()))}>{clientStep?'Guardar en este equipo':'Continuar'} <ArrowRight size={16}/></button>
              <button className="rp-quiet" type="button" disabled={busy} onClick={()=>{if(clientStep){setClient('Comercial Brújula Ficticia');setTitle('Revisión de pedimento ficticio');setDocumentKind('pedimento');clearScenario();}else setFirm('Despacho Horizonte Ficticio');}}>Usar ejemplo</button>
            </div>
            {clientStep&&<button type="button" className="rp-back" disabled={busy} onClick={()=>{clearFeedback();setClientStep(false);}}><ChevronLeft size={15}/> Volver al despacho</button>}
          </form>
        </div>}
        {saved&&activeTask&&<div className="rp-reveal rp-editor">
          <label htmlFor="intake-task">Tarea del despacho<select id="intake-task" value={task} disabled={busy||editText!==null} onChange={e=>{setSelected(e.target.value as Task);setRestored('');clearFeedback();}}>
            {pilot?.tasks.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}
          </select></label>
          {!pilot?.tasks.some(item=>item.id==='trade')&&<p className="rp-availability">La edición cotejada de las fuentes de comercio exterior no está disponible en este equipo.</p>}
          {activeTask.references?.length ? <details className="rp-details" key={'sources-'+task}><summary><BookOpen size={16}/> Fuentes de consulta ({activeTask.references.length})</summary>
            <ul>{activeTask.references.map(source=><li key={source.id}><a href={source.url} rel="noreferrer" target="_blank">{source.title} <ExternalLink size={12}/></a><p>{source.locator} · {source.summary}</p>
                {source.text&&<details className="rp-citation"><summary>Texto del artículo</summary><blockquote>{source.text}</blockquote>{source.sourceId&&<small>{source.sourceId}</small>}</details>}
              </li>)}</ul></details>:null}
          {draft?<details className="rp-details" key={'sent-'+task}><summary><Cloud size={16}/> Ver el mensaje enviado</summary><div className="rp-preview"><MarkedText text={activeTask.preview??''}/></div></details>:
            <section className="rp-proof"><h2><Cloud size={17}/> Mensaje para OpenAI</h2><div className="rp-preview"><MarkedText text={activeTask.preview??'Vista previa no disponible.'}/></div>
              <button type="button" className="rp-primary" disabled={busy||!activeTask.preview} onClick={()=>void generate()}>{activity==='cloud'?<><LoaderCircle className="rp-spin" size={16}/> Generando borrador…</>:<>Enviar y generar borrador <ArrowRight size={16}/></>}</button>
            </section>}
          {draft&&<section className="rp-proof rp-reveal"><h2><FileText size={17}/> {pilot?.editedTasks?.includes(task!)?'Borrador editado':'Borrador'}</h2>
            {editText!==null ? <div className="rp-edit">
              <label htmlFor="intake-edit">Editar en este equipo<textarea id="intake-edit" autoFocus disabled={busy} value={editText} onChange={e=>setEditText(e.target.value)} maxLength={1800} rows={6}/></label>
              <small>Conserva [[CLIENTE]] y [[ASUNTO]] para recuperar los originales al exportar. {editText.length}/1800</small>
              <div className="rp-actions"><button className="rp-primary" disabled={busy} onClick={()=>void saveEdit()}>Guardar cambios</button><button className="rp-quiet" disabled={busy} onClick={()=>{setEditText(null);clearFeedback();}}>Descartar edición</button></div>
            </div>:<>
            <div className="rp-switch" aria-label="Vista del borrador" role="group"><button aria-pressed={!restored} disabled={busy} onClick={()=>setRestored('')}><Cloud size={14}/> Con marcadores</button><button aria-pressed={Boolean(restored)} disabled={busy} onClick={()=>void reveal()}><HardDrive size={14}/> Datos originales</button></div>
            <div className="rp-preview rp-document">{restored||<MarkedText text={draft}/>}</div>
            <button className="rp-quiet" disabled={busy} onClick={()=>{clearFeedback();setRestored('');setEditText(draft);}}>Editar borrador</button>
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

import {useMemo,useState,type ChangeEvent} from 'react';
import {ArrowDown,ArrowUp,Blocks,CheckCircle2,Download,FileJson,LayoutGrid,LockKeyhole,Plus,Radar,Search,ShieldCheck,Trash2,Upload} from 'lucide-react';
import {
  TOOL_CATALOG, TOOL_TEMPLATES, addTool, buildTemplate, exportBlueprint, getWorkshopTool, importBlueprint,
  moveTool, removeTool, type WorkshopBlueprint, type WorkshopTool
} from './tool-workshop-model.js';
import './tool-workshop.css';

// T0 prototype only. This view has NO backend/client API, matter access, n8n,
// plugins, external link handlers, localStorage, credential access or execution.
function errorText(error:unknown) {
  if(error instanceof Error && 'code' in error) {
    const code=String(error.code);
    if(code==='DEPENDENCY_IN_USE')return 'Primero retira la herramienta que depende de este módulo.';
    if(code==='EMPTY_BLUEPRINT')return 'El plano debe conservar por lo menos una herramienta.';
    if(code==='UNKNOWN_MODULE')return 'La herramienta no está incluida en el catálogo autorizado.';
    if(code==='MISSING_DEPENDENCY')return 'Faltan herramientas necesarias para este plano.';
  }
  return 'El plano no se pudo validar. Solo se admiten módulos registrados, sin datos privados ni integraciones.';
}
function ModuleTag({tool}:{tool:WorkshopTool}){
  return <span className="rjwk-tag">{tool.category==='Radar'?<Radar size={12}/>:<Blocks size={12}/>} {tool.category}</span>;
}
export default function ToolWorkshopView(){
  const [plan,setPlan]=useState<WorkshopBlueprint>(()=>buildTemplate('general'));
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('Todas');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const categories=useMemo(()=>['Todas',...new Set(TOOL_CATALOG.map(item=>item.category))],[]);
  const filtered=useMemo(()=>TOOL_CATALOG.filter(item=>
    (category==='Todas'||item.category===category) &&
    (item.title+' '+item.summary+' '+item.practice.join(' ')).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es').trim())
  ),[category,search]);
  const configured=useMemo(()=>plan.layout.map(id=>getWorkshopTool(id)).filter((item):item is WorkshopTool=>Boolean(item)),[plan]);
  const template=TOOL_TEMPLATES.find(x=>x.id===plan.templateId);
  function transact(run:()=>WorkshopBlueprint,notice:string){
    try{const next=run();setPlan(next);setError('');setMessage(notice);}
    catch(reason){setError(errorText(reason));setMessage('');}
  }
  function chooseTemplate(next:string){
    transact(()=>buildTemplate(next),'Plantilla cargada en memoria. Solo demostración.');
  }
  function download(){
    try{
      const data=exportBlueprint(plan);
      const blob=new Blob([data],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;link.download='rejon-taller-plano-simulado.json';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),500);
      setMessage('Plano JSON descargado. No contiene expedientes ni claves.');setError('');
    }catch(reason){setError(errorText(reason));}
  }
  async function load(event:ChangeEvent<HTMLInputElement>){
    const input=event.currentTarget;
    const file=input.files?.[0];
    input.value='';
    if(!file)return;
    if(file.size>16_000||!file.name.toLowerCase().endsWith('.json')){
      setError('Selecciona exclusivamente un plano JSON de máximo 16 KB.');return;
    }
    try{
      const data=await file.text();
      const imported=importBlueprint(data);
      setPlan(imported);setError('');
      setMessage('Plano validado e importado solo a esta vista. No se han activado herramientas.');
    }catch(reason){setMessage('');setError(errorText(reason));}
  }
  return <section className="page rjwk" aria-labelledby="rjwk-heading">
    <header className="rjwk-header">
      <div>
        <p className="eyebrow">Rejon.AI · Taller de despacho</p>
        <h1 id="rjwk-heading">Construye tu espacio jurídico</h1>
        <p>Arma un escritorio por especialidad, incorpora herramientas y reordena tu propuesta. Sin datos de clientes ni conexiones activadas.</p>
      </div>
      <span className="rjwk-mode"><ShieldCheck size={15}/> Simulación aislada</span>
    </header>
    <div className="rjwk-notice"><LockKeyhole size={17}/><span>Prototipo de catálogo: no ejecuta agentes, n8n, radares, presentaciones, importaciones de expedientes ni acciones de escritura. Las configuraciones no se guardan en servidor o navegador.</span></div>
    <div className="rjwk-template">
      <label htmlFor="rjwk-template-select">Plantilla por tipo de despacho</label>
      <select id="rjwk-template-select" value={plan.templateId} onChange={e=>chooseTemplate(e.target.value)}>
        {TOOL_TEMPLATES.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <small>{template?.description}</small>
    </div>
    {error?<p className="rjwk-error" role="alert">{error}</p>:null}
    {message?<p className="rjwk-success" role="status"><CheckCircle2 size={15}/>{message}</p>:null}
    <div className="rjwk-grid">
      <section className="rjwk-panel rjwk-catalogue" aria-labelledby="rjwk-catalogue-title">
        <div className="rjwk-panel-heading"><div><h2 id="rjwk-catalogue-title">Biblioteca de herramientas</h2><p>{TOOL_CATALOG.length} módulos definidos · todos en simulación</p></div><Blocks size={20}/></div>
        <div className="rjwk-filters">
          <label className="rjwk-search"><Search size={16}/><span className="sr-only">Buscar herramienta</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por área o función"/></label>
          <label><span className="sr-only">Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(value=><option value={value} key={value}>{value}</option>)}</select></label>
        </div>
        <div className="rjwk-items">
          {filtered.length?filtered.map(tool=>{
            const added=plan.modules.includes(tool.id);
            return <article key={tool.id} className="rjwk-tool">
              <div className="rjwk-tool-top"><strong>{tool.title}</strong><ModuleTag tool={tool}/></div>
              <p>{tool.summary}</p>
              <div className="rjwk-tool-meta"><span>{tool.privacy==='private-local-locked'?'Local privado · bloqueado':'Público/sintético'}</span>{tool.automation==='n8n-planned'?<span>n8n · propuesto</span>:null}</div>
              <div className="rjwk-tool-bottom">
                {tool.requires.length?<small>Requiere: {tool.requires.map(id=>getWorkshopTool(id)?.title||id).join(', ')}</small>:<small>Sin dependencias de catálogo</small>}
                <button className={added?'secondary':'primary'} type="button" disabled={added} onClick={()=>transact(()=>addTool(plan,tool.id),'Herramienta incorporada con sus dependencias; no ejecutada.')}>
                  {added?<><CheckCircle2 size={14}/> Incluida</>:<><Plus size={14}/> Agregar</>}
                </button>
              </div>
            </article>;
          }):<p className="rjwk-empty">No hay módulos para ese filtro.</p>}
        </div>
      </section>
      <section className="rjwk-panel rjwk-layout" aria-labelledby="rjwk-layout-title">
        <div className="rjwk-panel-heading"><div><h2 id="rjwk-layout-title">Tu aplicación configurada</h2><p>{plan.modules.length} módulos · orden editable</p></div><LayoutGrid size={20}/></div>
        <div className="rjwk-layout-list">
          {configured.map((tool,index)=><article key={tool.id} className="rjwk-selected">
            <span className="rjwk-order" aria-hidden="true">{index+1}</span>
            <div className="rjwk-selected-body"><strong>{tool.title}</strong><small>{tool.category} · {tool.privacy==='private-local-locked'?'requiere controles locales':'fuente pública/sintética'}</small></div>
            <div className="rjwk-selected-actions">
              <button type="button" aria-label={'Subir '+tool.title} title="Subir" disabled={index===0} onClick={()=>transact(()=>moveTool(plan,tool.id,-1),'Orden actualizado.') }><ArrowUp size={15}/></button>
              <button type="button" aria-label={'Bajar '+tool.title} title="Bajar" disabled={index===configured.length-1} onClick={()=>transact(()=>moveTool(plan,tool.id,1),'Orden actualizado.') }><ArrowDown size={15}/></button>
              <button type="button" aria-label={'Quitar '+tool.title} title="Quitar" onClick={()=>transact(()=>removeTool(plan,tool.id),'Herramienta retirada del plano.') }><Trash2 size={15}/></button>
            </div>
          </article>)}
        </div>
        <div className="rjwk-preview">
          <h3>Vista previa del despacho</h3>
          <p>Así quedaría el menú. Los resultados jurídicos, alertas y expedientes no están conectados.</p>
          <div className="rjwk-preview-grid">{configured.map(tool=><div key={tool.id} className="rjwk-preview-item"><span>{tool.category==='Radar'?<Radar size={16}/>:<Blocks size={16}/>}</span><strong>{tool.title}</strong><small>Sin dato · demostración</small></div>)}</div>
        </div>
        <div className="rjwk-export">
          <button type="button" className="primary" onClick={download}><Download size={15}/> Exportar plano JSON</button>
          <label className="rjwk-file secondary"><Upload size={15}/> Importar plano <input type="file" accept=".json,application/json" onChange={e=>void load(e)}/></label>
        </div>
        <p className="rjwk-fineprint"><FileJson size={14}/> Solo se exportan IDs y orden de módulos del catálogo permitido. Para guardar configuraciones reales por despacho hace falta bóveda, permisos y revisión independiente.</p>
      </section>
    </div>
  </section>;
}
import {FormEvent, useEffect, useId, useState} from 'react';
import {Check, ClipboardList, Plus, Trash2} from 'lucide-react';
import {api, type Matter} from './api';

type ChecklistItem={id:string;label:string;completed:boolean};
type Checklist={matterId:string;items:ChecklistItem[];updatedAt:string|null};
type Template={id:string;name:string;description:string;items:string[]};
type TemplatesResponse={notice:string;templates:Template[]};

const itemId=()=>`item-${crypto.randomUUID()}`;
const templateItems=(template?:Template)=>template?.items.map(label=>({id:itemId(),label,completed:false}))??[];

export default function ChecklistView({matter}:{matter?:Matter}) {
  const titleId=useId(),templateId=useId(),addId=useId();
  const [items,setItems]=useState<ChecklistItem[]>([]);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [template,setTemplate]=useState('');
  const [newItem,setNewItem]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [dirty,setDirty]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    setItems([]);setTemplate('');setNewItem('');setError('');setNotice('');setDirty(false);
    if(!matter)return;
    setBusy('load');
    void Promise.all([api<Checklist>('checklist.get',{matterId:matter.id}),api<TemplatesResponse>('checklist.templates')])
      .then(([checklist,response])=>{if(cancelled)return;setItems(checklist.items);setTemplates(response.templates);setNotice(response.notice);})
      .catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'No se pudo abrir la checklist.');})
      .finally(()=>{if(!cancelled)setBusy('');});
    return ()=>{cancelled=true;};
  },[matter?.id]);

  const update=(next:ChecklistItem[])=>{setItems(next);setDirty(true);};
  async function save(){
    if(!matter||busy)return;
    setBusy('save');setError('');
    try {const checklist=await api<Checklist>('checklist.set',{matterId:matter.id,items});setItems(checklist.items);setDirty(false);setNotice('Checklist guardada solo en este asunto y en este equipo.');}
    catch(reason) {setError(reason instanceof Error?reason.message:'No se pudo guardar la checklist.');}
    finally {setBusy('');}
  }
  function applyTemplate(){
    const selected=templates.find(candidate=>candidate.id===template);
    if(!selected)return;
    update(templateItems(selected));setNotice(`Se aplicaron sugerencias organizativas de “${selected.name}”. Confírmalas antes de usarlas.`);
  }
  function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const label=newItem.trim();
    if(!label||items.length>=40)return;
    update([...items,{id:itemId(),label,completed:false}]);setNewItem('');
  }

  return <section className="page checklist-page" aria-labelledby={titleId}>
    <div className="page-heading checklist-heading"><div><p className="eyebrow">Organización local</p><h1 id={titleId}>Checklist</h1><p>Organiza materiales y próximos pasos del asunto activo.</p></div></div>
    <div className="checklist-notice" role="note"><ClipboardList size={18}/><p>Las plantillas son sugerencias organizativas. No declaran requisitos legales y la persona abogada debe confirmar qué aplica al asunto.</p></div>
    {!matter?<div className="checklist-empty"><strong>Selecciona o crea un asunto</strong><p>La checklist se guarda de forma independiente dentro de cada asunto.</p></div>:<>
      <section className="checklist-templates" aria-labelledby={`${titleId}-templates`}>
        <div className="section-heading"><div><h2 id={`${titleId}-templates`}>Empezar con una sugerencia</h2><p>Elige una plantilla general y adapta cada elemento al trabajo real.</p></div></div>
        <div className="checklist-template-controls"><label htmlFor={templateId}>Plantilla organizativa</label><div><select id={templateId} value={template} onChange={event=>setTemplate(event.target.value)} disabled={busy==='load'}><option value="">Selecciona una plantilla</option>{templates.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><button className="secondary" type="button" onClick={applyTemplate} disabled={!template||Boolean(busy)}>Aplicar plantilla</button></div>
        </div>
      </section>
      {error?<div className="checklist-error" role="alert"><span>{error}</span><button className="text-button" type="button" onClick={()=>setError('')}>Cerrar</button></div>:null}
      <section className="checklist-editor" aria-labelledby={`${titleId}-items`}>
        <div className="section-heading"><div><h2 id={`${titleId}-items`}>Elementos del asunto</h2><p>{busy==='load'?'Cargando checklist local…':`${items.filter(item=>item.completed).length} de ${items.length} completados.`}</p></div><span>{items.length}/40</span></div>
        {!items.length&&busy!=='load'?<div className="checklist-empty"><strong>Aún no hay elementos</strong><p>Agrega un elemento o empieza con una sugerencia organizativa.</p></div>:null}
        <ul className="checklist-items" aria-label="Elementos de checklist">{items.map(item=><li key={item.id}><label><input aria-label={`Marcar ${item.label}`} type="checkbox" checked={item.completed} onChange={()=>update(items.map(candidate=>candidate.id===item.id?{...candidate,completed:!candidate.completed}:candidate))}/><span className="checklist-check"><Check size={14}/></span><input aria-label={`Editar ${item.label}`} value={item.label} maxLength={160} minLength={2} onChange={event=>update(items.map(candidate=>candidate.id===item.id?{...candidate,label:event.target.value}:candidate))}/></label><button type="button" className="text-button" aria-label={`Eliminar ${item.label}`} onClick={()=>update(items.filter(candidate=>candidate.id!==item.id))} disabled={Boolean(busy)}><Trash2 size={16}/></button></li>)}</ul>
        <form className="checklist-add" onSubmit={add}><label htmlFor={addId}>Agregar elemento</label><div><input id={addId} value={newItem} onChange={event=>setNewItem(event.target.value)} maxLength={160} minLength={2} placeholder="Ej. Confirmar la siguiente revisión" disabled={Boolean(busy)||items.length>=40}/><button className="secondary" type="submit" disabled={Boolean(busy)||items.length>=40||newItem.trim().length<2}><Plus size={16}/>Agregar</button></div></form>
        <div className="checklist-save-row"><p>{notice}</p><button className="primary" type="button" onClick={()=>void save()} disabled={Boolean(busy)||!dirty}><Check size={16}/>{busy==='save'?'Guardando…':'Guardar cambios'}</button></div>
      </section>
    </>}
  </section>;
}

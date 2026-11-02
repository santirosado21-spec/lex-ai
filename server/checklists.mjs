/**
 * Local, matter-scoped organisational checklists.  Templates intentionally
 * contain only workflow prompts: they are not statements of legal requirements.
 */
export const MAX_CHECKLIST_ITEMS=40;
export const MAX_CHECKLIST_LABEL_LENGTH=160;

const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value);
const plainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const fields=(value,allowed)=>{
  if(!plainObject(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Campos de checklist no admitidos.');
};

const TEMPLATE_DEFINITIONS=[
  {id:'revision-inicial',name:'Revisión inicial',description:'Sugerencias organizativas para que la persona abogada las confirme.',items:['Definir el objetivo de la revisión','Registrar el material disponible','Anotar preguntas para confirmar con el equipo','Acordar el siguiente paso de trabajo']},
  {id:'preparacion-reunion',name:'Preparación de reunión',description:'Sugerencias organizativas para que la persona abogada las confirme.',items:['Confirmar el objetivo de la reunión','Preparar los puntos a tratar','Registrar a quién corresponde dar seguimiento','Anotar los acuerdos por confirmar']},
  {id:'entrega-borrador',name:'Entrega de borrador',description:'Sugerencias organizativas para que la persona abogada las confirme.',items:['Confirmar el propósito del borrador','Revisar los pendientes de información','Definir la persona revisora','Registrar la siguiente versión o entrega']},
];

export const checklistTemplates=()=>TEMPLATE_DEFINITIONS.map(template=>({...template,items:[...template.items]}));

export function validateChecklistGet(request){
  fields(request,['matterId']);
  if(!identifier(request.matterId))throw new Error('Asunto de checklist inválido.');
  return {matterId:request.matterId};
}

export function validateChecklistTemplates(request){
  fields(request,[]);
}

export function validateChecklistSet(request){
  fields(request,['matterId','items']);
  if(!identifier(request.matterId))throw new Error('Asunto de checklist inválido.');
  if(!Array.isArray(request.items)||request.items.length>MAX_CHECKLIST_ITEMS)throw new Error(`Checklist: proporciona entre 0 y ${MAX_CHECKLIST_ITEMS} elementos.`);
  const seen=new Set();
  const items=request.items.map(item=>{
    fields(item,['id','label','completed']);
    if(!identifier(item.id)||seen.has(item.id))throw new Error('Elemento de checklist inválido.');
    if(typeof item.label!=='string')throw new Error('Elemento de checklist inválido.');
    const label=item.label.trim();
    if(label.length<2||label.length>MAX_CHECKLIST_LABEL_LENGTH||typeof item.completed!=='boolean')throw new Error('Elemento de checklist inválido.');
    seen.add(item.id);
    return {id:item.id,label,completed:item.completed};
  });
  return {matterId:request.matterId,items};
}

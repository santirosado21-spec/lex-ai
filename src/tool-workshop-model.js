// Rejon.AI workshop catalogue: SYNTHETIC/DESIGN ONLY. No dispatch, network, matter storage, or execution.
// Importing a blueprint never executes an automation or loads a plugin.
const tool=(id,title,category,practice,summary,requires=[],privacy='public-or-synthetic',automation='none')=>
 Object.freeze({id,title,category,practice:Object.freeze(practice),summary,requires:Object.freeze(requires),
  privacy,automation,status:'simulation-only'});
export const TOOL_CATALOG=Object.freeze([
 tool('radar.dof','Radar Diario Oficial','Radar',['Regulatorio','Litigio','Corporativo'],'Nuevas disposiciones y reformas con enlace y fecha; fuente pendiente de verificación.',[],'public-or-synthetic','n8n-planned'),
 tool('radar.sjf','Radar de jurisprudencia','Radar',['Litigio','Derechos humanos'],'Criterios judiciales y tesis: identificar fuente y revisión pendiente.',[],'public-or-synthetic','n8n-planned'),
 tool('radar.gaceta','Radar Gaceta CDMX','Radar',['Regulatorio','Inmobiliario'],'Cambios normativos locales; sin consulta automática activada.',[],'public-or-synthetic','n8n-planned'),
 tool('radar.legislativo','Radar legislativo','Radar',['Corporativo','Regulatorio'],'Iniciativas y reformas en trámite sin confundirlas con leyes vigentes.',[],'public-or-synthetic','n8n-planned'),
 tool('radar.fiscal','Radar fiscal','Radar',['Fiscal','Corporativo'],'Actualizaciones públicas; no genera declaraciones fiscales.',[],'public-or-synthetic','n8n-planned'),
 tool('radar.comercio','Radar comercio exterior','Radar',['Regulatorio','Comercio exterior'],'Avisos públicos de comercio exterior y autoridades.',[],'public-or-synthetic','n8n-planned'),
 tool('tool.citas','Artículos y citas','Jurídica',['Litigio','Derechos humanos'],'Plano de verificación de referencias a artículos, tesis y fracciones.'),
 tool('tool.normas','Comparador normativo','Jurídica',['Regulatorio','Litigio'],'Comparación propuesta de versiones de artículos con trazabilidad.',['tool.citas']),
 tool('tool.matriz','Matriz probatoria','Litigio',['Litigio'],'Hechos, pretensiones, pruebas y contradicciones en esquema ficticio.',[],'private-local-locked'),
 tool('tool.cronologia','Cronología y plazos','Litigio',['Litigio','Inmobiliario'],'Cronología de actuaciones; los vencimientos exigen corroboración.',[],'private-local-locked'),
 tool('tool.escritos','Taller de escritos','Litigio',['Litigio'],'Esqueleto de demanda, contestación y promociones para revisión humana.',[],'private-local-locked'),
 tool('tool.contratos','Cláusulas y contratos','Contratos',['Corporativo','Inmobiliario'],'Comparador de cláusulas y obligaciones, sin firma ni envío.',[],'private-local-locked'),
 tool('tool.rentas','Locales y arrendamientos','Contratos',['Inmobiliario'],'Local, superficie, renta, garantías y anexos configurables ficticios.',[],'private-local-locked'),
 tool('tool.corporativo','Actas y poderes','Corporativo',['Corporativo'],'Checklist de actas, poderes y asambleas.',[],'private-local-locked'),
 tool('tool.exportacion','Checklist SENASICA / SE','Regulatorio',['Comercio exterior','Regulatorio'],'Fracción arancelaria, avisos y pedimento: lista ilustrativa.',[],'private-local-locked'),
 tool('tool.ddhh','Matriz de derechos humanos','Jurídica',['Derechos humanos','Litigio'],'Hechos, derechos, test y precedentes de manera trazable.',[],'private-local-locked'),
 tool('tool.conflictos','Conflicto de intereses','Operación',['Corporativo','Litigio'],'Comprobación local de conflictos, sólo una capacidad proyectada.',[],'private-local-locked'),
 tool('tool.horas','Tiempos y honorarios','Operación',['Corporativo','Litigio'],'Planeación de tiempo, tareas y honorarios por asunto.',[],'private-local-locked'),
 tool('workbench.hoy','Hoy jurídico','Espacio',['General'],'Panel de fechas y cambios con estado de procedencia.',[],'private-local-locked'),
 tool('workbench.approvals','Por aprobar','Espacio',['General'],'Bandeja de propuestas, nunca ejecución automática.',[],'private-local-locked'),
 tool('workbench.mesa','Mesa de agentes','Espacio',['General'],'Roles de investigación, redacción y revisión sin conexión a proveedores.',[],'private-local-locked'),
 tool('workbench.doctor','Doctor del despacho','Espacio',['General'],'Estados auditables de respaldo, fuentes y trabajos; Sin dato cuando corresponde.',[],'private-local-locked'),
 tool('recipe.reforma','Receta: cambio normativo','Automatización',['Regulatorio'],'Flujo propuesto: radar público → contraste → por aprobar.', ['radar.dof','tool.normas','workbench.approvals'],'public-or-synthetic','n8n-planned'),
 tool('recipe.jurisprudencia','Receta: nuevo criterio','Automatización',['Litigio'],'Flujo propuesto: jurisprudencia pública → contrastar → por aprobar.', ['radar.sjf','tool.citas','workbench.approvals'],'public-or-synthetic','n8n-planned')
]);
export const TOOL_TEMPLATES=Object.freeze([
 Object.freeze({id:'general',title:'Despacho general',description:'Inicio, propuestas y herramientas básicas',modules:Object.freeze(['workbench.hoy','workbench.approvals','tool.citas','radar.dof'])}),
 Object.freeze({id:'litigio',title:'Litigio',description:'Pruebas, cronologías y criterios judiciales',modules:Object.freeze(['workbench.hoy','workbench.approvals','radar.sjf','tool.citas','tool.matriz','tool.cronologia','tool.escritos'])}),
 Object.freeze({id:'inmobiliario',title:'Inmobiliario y rentas',description:'Locales, superficies, contratos y plazos',modules:Object.freeze(['workbench.hoy','workbench.approvals','tool.rentas','tool.contratos','tool.cronologia'])}),
 Object.freeze({id:'corporativo',title:'Corporativo',description:'Actas, poderes, contratos y novedades',modules:Object.freeze(['workbench.hoy','workbench.approvals','tool.corporativo','tool.contratos','radar.legislativo'])}),
 Object.freeze({id:'regulatorio',title:'Regulatorio y comercio exterior',description:'Cambios, permisos y requisitos',modules:Object.freeze(['workbench.hoy','workbench.approvals','radar.dof','radar.gaceta','tool.citas','tool.normas','tool.exportacion','recipe.reforma'])})
]);
const tools=new Map(TOOL_CATALOG.map(x=>[x.id,x]));
const templates=new Map(TOOL_TEMPLATES.map(x=>[x.id,x]));
const id=value=>typeof value==='string'&&/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value)&&value.length<=80;
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const blueprintKeys=['schemaVersion','kind','templateId','modules','layout','mode','privacy','integrationsEnabled'];
const error=(code)=>{const e=Error('El plano no es válido para este Taller de simulación.');e.code=code;return e;};
function exactKeys(object,keys){
 return Object.keys(object).length===keys.length&&keys.every(k=>Object.hasOwn(object,k));
}
export function getWorkshopTool(toolId){return tools.get(toolId)||null;}
export function validateBlueprint(raw){
 if(!isRecord(raw)||!exactKeys(raw,blueprintKeys))throw error('INVALID_BLUEPRINT_FIELDS');
 if(raw.schemaVersion!==1||raw.kind!=='rejon.workshop.blueprint'||!templates.has(raw.templateId)||
    raw.mode!=='simulation'||raw.privacy!=='public-or-synthetic-only'||raw.integrationsEnabled!==false){
  throw error('UNSAFE_BLUEPRINT');
 }
 if(!Array.isArray(raw.modules)||!Array.isArray(raw.layout)||raw.modules.length<1||raw.modules.length>24||raw.layout.length!==raw.modules.length){
  throw error('INVALID_MODULE_LIST');
 }
 if(!raw.modules.every(x=>id(x)&&tools.has(x))||!raw.layout.every(x=>id(x)&&tools.has(x)))throw error('UNKNOWN_MODULE');
 const selected=new Set(raw.modules),position=new Set(raw.layout);
 if(selected.size!==raw.modules.length||position.size!==raw.layout.length||
    raw.modules.some(x=>!position.has(x))||raw.layout.some(x=>!selected.has(x)))throw error('INVALID_LAYOUT');
 for(const moduleId of selected){
  if(tools.get(moduleId).requires.some(dep=>!selected.has(dep)))throw error('MISSING_DEPENDENCY');
 }
 return {schemaVersion:1,kind:'rejon.workshop.blueprint',templateId:raw.templateId,modules:[...raw.modules],layout:[...raw.layout],
  mode:'simulation',privacy:'public-or-synthetic-only',integrationsEnabled:false};
}
export function buildTemplate(templateId='general'){
 const template=templates.get(templateId);
 if(!template)throw error('UNKNOWN_TEMPLATE');
 return validateBlueprint({schemaVersion:1,kind:'rejon.workshop.blueprint',templateId,
  modules:[...template.modules],layout:[...template.modules],mode:'simulation',
  privacy:'public-or-synthetic-only',integrationsEnabled:false});
}
export function addTool(blueprint,toolId){
 const next=validateBlueprint(blueprint);
 if(!tools.has(toolId))throw error('UNKNOWN_MODULE');
 const seen=new Set(next.modules);
 function include(value,trail=new Set()){
  if(trail.has(value))throw error('CYCLIC_DEPENDENCY');
  if(seen.has(value))return;
  const def=tools.get(value);
  if(!def)throw error('UNKNOWN_MODULE');
  const chain=new Set([...trail,value]);
  for(const dep of def.requires)include(dep,chain);
  if(!seen.has(value)){seen.add(value);next.modules.push(value);next.layout.push(value);}
 }
 include(toolId);
 return validateBlueprint(next);
}
export function removeTool(blueprint,toolId){
 const next=validateBlueprint(blueprint);
 if(!next.modules.includes(toolId))return next;
 if(next.modules.length===1)throw error('EMPTY_BLUEPRINT');
 for(const other of next.modules){
  if(other!==toolId&&tools.get(other).requires.includes(toolId))throw error('DEPENDENCY_IN_USE');
 }
 next.modules=next.modules.filter(x=>x!==toolId);
 next.layout=next.layout.filter(x=>x!==toolId);
 return validateBlueprint(next);
}
export function moveTool(blueprint,toolId,direction){
 const next=validateBlueprint(blueprint);
 if(direction!==1&&direction!==-1)throw error('INVALID_MOVE');
 const from=next.layout.indexOf(toolId);
 if(from<0)throw error('UNKNOWN_MODULE');
 const to=from+direction;
 if(to<0||to>=next.layout.length)return next;
 [next.layout[from],next.layout[to]]=[next.layout[to],next.layout[from]];
 return validateBlueprint(next);
}
export function exportBlueprint(blueprint){return JSON.stringify(validateBlueprint(blueprint),null,2)+'\n';}
export function importBlueprint(json){
 if(typeof json!=='string'||json.length>16_000)throw error('BLUEPRINT_TOO_LARGE');
 let parsed;
 try{parsed=JSON.parse(json);}catch{throw error('INVALID_JSON');}
 return validateBlueprint(parsed);
}

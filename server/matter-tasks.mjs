/** Manual planning only: no legal deadline calculations or reminders. */
export function createMatterTasks({store,matter,scoped,record}) {
  function fields(payload,allowed){for(const key of Object.keys(payload))if(!allowed.includes(key))throw new Error(`Campo de tarea no admitido: ${key}.`);}
  function string(value,label,max,optional=false){if(value===undefined&&optional)return '';if(typeof value!=='string'||value.length>max||(!optional&&!value.trim()))throw new Error(`${label}: longitud inválida.`);return value.trim();}
  function date(value){if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))throw new Error('Fecha manual inválida: usa YYYY-MM-DD.');const parsed=new Date(`${value}T12:00:00Z`);if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new Error('La fecha manual no existe.');return value;}
  function status(value){if(!['pending','completed'].includes(value))throw new Error('Estado de tarea inválido.');return value;}
  return {
    create(p){fields(p,['matterId','title','note','plannedDate']);const m=matter(p.matterId);const stamp=new Date().toISOString();return record('task',{matterId:m.id,workspaceId:m.workspaceId,title:string(p.title,'Título',200),note:string(p.note,'Nota',4000,true),plannedDate:date(p.plannedDate),status:'pending',updatedAt:stamp,completedAt:null,history:[{event:'created',at:stamp}]});},
    list(p){fields(p,['matterId','status']);matter(p.matterId);if(p.status!==undefined)status(p.status);return store.list('task',p.matterId).filter(task=>p.status===undefined||task.status===p.status);},
    update(p){fields(p,['matterId','taskId','status']);const task=scoped('task',p.taskId,p.matterId);const next=status(p.status);if(task.status===next)return task;const stamp=new Date().toISOString();const updated={...task,status:next,updatedAt:stamp,completedAt:next==='completed'?stamp:null,history:[...task.history,{event:next==='completed'?'completed':'reopened',at:stamp}]};return store.transaction(()=>{store.put('task',updated);store.audit('task.update',task.id);return updated;});},
  };
}

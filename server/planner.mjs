/** Pure local planning helpers. Dates entered here are organizational only, never legal-term calculations. */

const dateOnly=/^\d{4}-\d{2}-\d{2}$/;
const active=item=>item?.status!=='done'&&item?.status!=='dismissed';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const byDueTitleId=(a,b)=>compare(a.dueAt??'',b.dueAt??'')||compare(a.title,b.title)||compare(String(a.id??''),String(b.id??''));

function instant(value) {
  const result=value instanceof Date?new Date(value.getTime()):new Date(value);
  if(Number.isNaN(result.getTime()))throw new Error('Reloj inválido.');
  return result;
}

function localDay(value,timeZone) {
  if(dateOnly.test(value))return value;
  const date=instant(value);
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const pick=type=>parts.find(part=>part.type===type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function plusDays(day,amount) {
  const result=new Date(`${day}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate()+amount);
  return result.toISOString().slice(0,10);
}

/** Buckets active items by their local calendar date. No legal deadline is calculated. */
export function pendingToday(items,now,timeZone) {
  if(!Array.isArray(items))throw new Error('Items inválidos.');
  if(typeof timeZone!=='string'||!timeZone)throw new Error('Zona horaria inválida.');
  const today=localDay(now,timeZone),weekEnd=plusDays(today,7);
  const buckets={overdue:[],dueToday:[],dueIn7Days:[]};
  for(const item of items.filter(active)) {
    if(!item?.dueAt)continue;
    let due;try{due=localDay(item.dueAt,timeZone);}catch{continue;}
    if(due<today)buckets.overdue.push(item);
    else if(due===today)buckets.dueToday.push(item);
    else if(due<=weekEnd)buckets.dueIn7Days.push(item);
  }
  for(const bucket of Object.values(buckets))bucket.sort(byDueTitleId);
  return buckets;
}

/** A rule fires once per matter in any status, so a dismissed or completed suggestion is not proposed again. */
function hasPlannerRule(items,rule) {
  return items.some(item=>item?.source==='planner'&&item.plannerRule===rule);
}

function proposal(rule,kind,title,note) {
  return {kind,title,dueAt:null,note,status:'proposed',source:'planner',plannerRule:rule};
}

/** Deterministic, local suggestions. Returned items remain inactive until a lawyer approves them. */
export function proposeFollowUps({matter,documents,answers,items,now,timeZone='America/Mexico_City'}) {
  if(!matter||!Array.isArray(documents)||!Array.isArray(answers)||!Array.isArray(items))throw new Error('Datos del planificador inválidos.');
  const current=instant(now),result=[];
  const add=(rule,kind,title,note)=>{if(!hasPlannerRule(items,rule))result.push(proposal(rule,kind,title,note));};
  if(documents.length&&!answers.length)add('documents-no-analysis','followup','Revisar documentos importados','Hay documentos en el asunto sin análisis guardado. Sugerencia local; requiere aprobación humana.');
  if(answers.length&&!answers.some(answer=>answer?.skillId==='legal-drafter'))add('analysis-no-draft','draft-suggestion','Preparar borrador a partir del análisis','Hay análisis guardado, pero ningún borrador generado. Sugerencia local; requiere aprobación humana.');
  const today=localDay(current,timeZone),threeDays=plusDays(today,3);
  for(const deadline of items.filter(item=>item?.kind==='deadline'&&item?.status==='approved'&&item.dueAt)) {
    let day;try{day=localDay(deadline.dueAt,timeZone);}catch{continue;}
    if(day>=today&&day<=threeDays)add(`deadline-${deadline.id??deadline.title}`,'followup',`Confirmar plazo: ${deadline.title}`,'El plazo fue capturado manualmente por la persona usuaria. Rejon.AI no calcula términos legales; requiere revisión humana.');
  }
  const activity=[matter,...documents,...answers,...items].map(item=>item?.updatedAt??item?.createdAt).filter(Boolean).map(value=>new Date(value).getTime()).filter(Number.isFinite);
  const latest=activity.length?Math.max(...activity):NaN;
  if(!Number.isFinite(latest)||current.getTime()-latest>=14*24*60*60*1000)add('no-activity-14-days','followup','Revisar asunto sin actividad reciente','No hay actividad registrada en los últimos 14 días. Sugerencia local; requiere aprobación humana.');
  return result.sort((a,b)=>a.plannerRule.localeCompare(b.plannerRule));
}

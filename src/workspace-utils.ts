export const normalizeSearch=(value:string)=>value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/\p{M}/gu,'');
export const matchesSearch=(value:string,query:string)=>normalizeSearch(query).trim().split(/\s+/).every(term=>normalizeSearch(value).includes(term));
export const fileType=(name:string)=>name.split('.').at(-1)?.toUpperCase() || 'ARCHIVO';
export const shortDate=(value?:string)=>value&&!Number.isNaN(Date.parse(value))?new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeZone:'America/Mexico_City'}).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T12:00:00-06:00`:value)):'Sin fecha';
export const fullDate=(value?:string)=>value&&!Number.isNaN(Date.parse(value))?new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(value)):'Sin fecha';
export const jurisdictionName=(value?:string)=>value==='MX-FED'?'Federal':value==='MX-CMX'?'Ciudad de México':value||'Sin jurisdicción';

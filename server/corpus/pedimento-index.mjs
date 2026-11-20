// Offline publications and case-date checks. Only verified public references may leave this module for a follow-up.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../resources/trade/',import.meta.url);
const indexHash='f55e34135fcf73331a551cd102440f52872b2ad73e87d89fc23035c3d97241b4';
const aluminumHash='4fd4a0ec9a104427e2232dcf1ad19397d1122037641a2a37b5fd5a3aee84c5ca';
const sugarHash='cd6844ebfa0af3f9bee645f5f762d44ba2cd5c970d95b7cd81f4fd1c54cb2fdf';
const resolutionHash='d06ed1551d8cb0f95bba385672e644a2c23be42ce67414af86d79cbd2fd2fe9e';
const bulletinHash='ec7edec1c886984b0e00e191ee6dce2f9689985da93cd922759d947890dc39e7';
const sugarResolutionHash='fb2d2204846d937232d79d9228449372dc6ae9aafbc28119f19e02c607c2b754';
const sugarBulletinHash='0c82355465cad7ebd89327614d97fe0e9d46dde9208bd37fefb12f5733279c49';
const cutoff='2026-11-19';
const checked=new WeakSet();
const regimes=['Importación temporal','Importación definitiva','Depósito fiscal','Elaboración, transformación o reparación en recinto fiscalizado','Recinto fiscalizado estratégico','Otro régimen'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function bytes(file,hash){
 const data=readFileSync(new URL(file,root));
 if(sha(data)!==hash)throw Error('La edición del Anexo 22 requiere cotejo.');
 return data;
}
let loaded;
function library(){
 if(!loaded){
  const {authorities,editions}=JSON.parse(bytes('anexo22-apendice9.json',indexHash));
  const {fractions}=JSON.parse(bytes('aluminio-20260402.json',aluminumHash));
  const sugar=JSON.parse(bytes('azucar-20260528.json',sugarHash));
  loaded={authorities,editions,fractions,sugar:sugar.fractions};
 }
 return loaded;
}
const local=(hash,page)=>'/fuentes/'+hash+'.pdf#page='+page;
export function pedimentoAttachment(path){
 const files=[[resolutionHash,'resolucion-rgce-2026-05-14.pdf'],[bulletinHash,'vucem-aluminio-2026.pdf'],
  [sugarResolutionHash,'resolucion-rgce-2026-09-22.pdf'],[sugarBulletinHash,'vutce-azucar-2026.pdf'],
  ...library().editions.map(e=>[e.sha256,'anexo22-'+e.date+'.pdf'])];
 const hit=files.find(([hash])=>path==='/fuentes/'+hash+'.pdf');
 return hit?{bytes:bytes(hit[1],hit[0]),type:'application/pdf'}:null;
}
const clean=text=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const ref=(id,title,locator,url,text,localUrl)=>Object.freeze({id,title,locator,url,text,localUrl,checkedOn:cutoff});
const aluminumSources=[
 ref('RGCE-2026-TR2','Primera resolución de modificaciones','Transitorio segundo · DOF 14 mayo 2026','https://sidof.segob.gob.mx/notas/docFuente/5787425','La adición de la clave AL del apéndice 9 del Anexo 22, entrará en vigor en términos del Transitorio Único',local(resolutionHash,1)),
 ref('SE-2026-AL','Acuerdo de la Secretaría de Economía','Anexo 2.2.1, numeral 8, fracción IV y transitorio único · DOF 2 abril 2026','https://sidof.segob.gob.mx/notas/docFuente/5783929','hasta que el trámite para enviar la información sobre el aviso automático de importación de productos de aluminio, sea liberado en la Ventanilla Digital Mexicana de Comercio Exterior.'),
 ref('VUCEM-2026-HI02','Hoja informativa de la VUCEM','Hoja 02 · captura desde el 18 de mayo de 2026 · página 1','https://www.ventanillaunica.gob.mx/vucem/meses/mayo2026/Hoja%20informativa%20No_02_Aviso_Automatico_Importacion_Aluminio.pdf','siendo obligatoria la declaración en el pedimento del número de aviso obtenido, a partir del 25 de mayo del mismo año.',local(bulletinHash,1)),
];
const sugarSources=[
 ref('RGCE-2026-2TR2','Segunda resolución de modificaciones','Transitorio segundo · 22 septiembre 2026 · página 5','https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/rgce/2daRMRGCEpara2026.pdf','La modificación a la clave C1 del apéndice 9 del Anexo 22, entrará en vigor en términos del Transitorio Único',local(sugarResolutionHash,5)),
 ref('SE-2026-AZ','Acuerdo de la Secretaría de Economía','Anexo 2.2.1, numeral 8 TER y transitorio único · 28 mayo 2026','https://sidof.segob.gob.mx/notas/docFuente/5788843','hasta que el trámite para enviar la información sobre el permiso previo de importación de azúcar, sea liberado en la Ventanilla Digital Mexicana de Comercio Exterior.'),
 ref('VUTCE-2026-AZ','Hoja informativa de la VUTCE','Hoja 02 · azúcar · captura desde el 31 de agosto y declaración desde el 28 de septiembre de 2026','https://www.ventanillaunica.gob.mx/vucem/meses/agosto2026/HOJA_INFORMATIVA_2_Permiso_Azucar.pdf','Será obligatorio declarar en el pedimento el número de permiso obtenido.',local(sugarBulletinHash,1)),
];
function validateDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(date))throw Error('Indica la fecha de la operación.');
 const d=new Date(date+'T12:00:00Z');
 if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==date)throw Error('La fecha de la operación es inválida.');
 if(date<'2026-01-15'||date>cutoff)throw Error('La captura cubre publicaciones del 15 de enero al 19 de noviembre de 2026. Consulta el DOF para esa fecha.');
}
function rowsAt(date){
 validateDate(date);
 const {editions,authorities}=library(),map=new Map();
 for(const e of editions){
  for(const row of e.rows){
   // Keep AL discoverable for retrospective checks made before its addition.
   const later=e.date>date;
   if(later&&row.code!=='AL')continue;
   const id=row.agency+'/'+row.code;
   const prior=map.get(id);
   map.set(id,{...row,agencyName:authorities[row.agency],date:e.date,later,url:e.url+'#page='+row.page,
    localUrl:local(e.sha256,row.page),hash:e.sha256,prior});
  }
 }
 return map;
}
export function searchPermits(query,date){
 if(typeof query!=='string'||!query.trim()||query.length>90)throw Error('Escribe una clave, autoridad o palabra de la descripción.');
 const terms=clean(query.trim()).split(/\s+/u);
 const all=[...rowsAt(date).values()];
 const exact=all.filter(r=>r.code===query.trim().toUpperCase());
 const rows=exact.length?exact:all.filter(r=>terms.every(t=>clean([r.code,r.agencyName,r.text].join(' ')).includes(t)));
 return {rows:rows.map(({prior,...row})=>({...row,prior:prior?{date:prior.date,text:prior.text,localUrl:prior.localUrl,page:prior.page}:null})),regimes};
}
function aluminumStatus(date){
 if(date<'2026-05-18')return 'La fecha es anterior a la apertura de captura del aviso anunciada por la VUCEM para el 18 de mayo.';
 if(date<'2026-05-25')return 'La VUCEM ya admitía solicitudes. El inicio anunciado para declarar el número de aviso en el pedimento era el 25 de mayo de 2026.';
 return 'Desde el 25 de mayo de 2026, la VUCEM indica declarar el número de aviso en el pedimento de las operaciones comprendidas. Coteja la mercancía y el régimen.';
}
function materialScope(classification,regime,sugar){
 if(typeof classification!=='string'||(classification&&!/^\d{10}$/u.test(classification))||typeof regime!=='string'||(regime&&!regimes.includes(regime)))throw Error('Usa diez dígitos de fracción y NICO y selecciona el régimen.');
 const parts=[];
 if(classification){
  const fraction=classification.slice(0,4)+'.'+classification.slice(4,6)+'.'+classification.slice(6,8),nico=classification.slice(8);
  const table=sugar?library().sugar:library().fractions;
  const entry=table[fraction],item=entry?.nicos[nico];
  parts.push(fraction+' · NICO '+nico+' · '+(item?[...new Set([item.description,entry.scope,item.scope].filter(Boolean))].join(' '):'Sin coincidencia exacta en la tabla del acuerdo de '+(sugar?'mayo.':'abril.')));
 }else parts.push('Pendiente cotejar la fracción, el NICO y la acotación de la mercancía.');
 parts.push(regime?regime+' · '+(sugar?(regime==='Importación definitiva'?'Figura en el numeral 8 TER revisado.':'El numeral 8 TER revisado indica importación definitiva.'):regime==='Otro régimen'?'Fuera de los cinco regímenes enumerados en el numeral revisado.':'Figura entre los regímenes enumerados en el numeral revisado.'):'Falta identificar el régimen de la operación.');
 return parts.join('\n');
}
export function permitNote({code,agency,date,classification,regime}){
 const row=rowsAt(date).get(agency+'/'+code);
 if(!row||row.agency!==agency||row.code!==code)throw Error('Selecciona la clave y su autoridad.');
 const aluminum=agency==='SE'&&code==='AL';
 const sugar=agency==='SE'&&code==='C1'&&date>='2026-05-28';
 if(!aluminum&&!sugar&&(classification!==''||regime!==''))throw Error('Ese cotejo de alcance no corresponde a la clave elegida.');
 const detail=aluminum||sugar?materialScope(classification,regime,sugar):'';
 const sugarStage=date<'2026-08-31'?'La fecha precede a la apertura de captura del 31 de agosto.':
  date<'2026-09-28'?'La captura estaba abierta. La fecha precede a la declaración obligatoria del número de permiso el 28 de septiembre.':
  'Desde el 28 de septiembre de 2026, la VUTCE indica declarar el número de permiso en las operaciones comprendidas.';
 const stage=aluminum?aluminumStatus(date):sugar?'Para la ampliación de C1 a azúcar y preparaciones del numeral 8 TER. '+sugarStage+' Coteja fracción, NICO, acotación y régimen en el acuerdo de mayo.':'Última descripción publicada localizada hasta la fecha indicada. Coteja el transitorio y el régimen aplicables.';
 const main=ref('RGCE-A9-'+agency+'-'+code+'-'+row.date,'Anexo 22 · '+agency+' · '+code,'Apéndice 9 · '+row.agencyName+' · '+row.date+' · PDF p. '+row.page,row.url,row.text,row.localUrl);
 const references=Object.freeze(aluminum?[main,...aluminumSources]:sugar?[main,...sugarSources]:[main]);
 const selection={code,agency,date,classification,regime};
 const id='pedimento-'+sha(JSON.stringify([selection,indexHash,aluminum?aluminumHash:'',references,stage,detail])).slice(0,24);
 const dates=aluminum?['2026-05-18','2026-05-25']:sugar?['2026-08-31','2026-09-28']:null;
 const period=dates?(date<dates[0]?'antes':date<dates[1]?'captura':'declaracion'):null;
 const note=Object.freeze({id,selection,period,title:'Pedimento · '+agency+' '+code+' · '+date,references,stage,detail,
  text:['Control de pedimento para [[CLIENTE]] · [[ASUNTO]]',
   row.later?'Publicación posterior a la operación · '+row.date:'Publicación consultada · '+row.date,
   ...references.map(r=>r.title+' ['+r.id+']\n'+r.text),'Cotejo local de la operación\n[[COTEJO]]'].filter(Boolean).join('\n\n')});
 checked.add(note);
 return note;
}
export function permitReferences(note){
 if(!checked.has(note))throw Error('Selecciona una publicación verificada del Anexo 22.');
 return note.references;
}

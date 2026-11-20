// Synthetic development questions. This diagnostic exercises the local review
// and lookup entry point. No OpenAI credential or network generation is used.
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../server/main.mjs';

const examples=[
 ['flete','¿Cómo acredito el flete de la factura FZ-82971 en el valor en aduana de este embarque?',['FZ-82971'],/Art\. 65 · fracción I, inciso d\)/u],
 ['licencia','¿Qué condición de venta debo cotejar en las regalías pactadas con Lienzos Azafrán de Ensayo, folio AJ-38114?',['Azafrán','AJ-38114'],/Art\. 65 · fracción III/u],
 ['acuse','¿Qué acuse de los anexos al pedimento debo solicitar a la agente Elisa Miralba mediante el correo oficial@taller.example.test?',['Miralba','oficial@taller.example.test'],/Art\. 36-A/u],
 ['origen','¿Qué pruebas del origen de los insumos de la orden de compra BI-1149 conviene revisar?',['BI-1149'],/Art\. (?:9|10) .*Comercio Exterior/iu],
 ['cupo','¿Cómo se acredita la asignación del cupo para el lote KQ-5824 antes de solicitar el permiso?',['KQ-5824'],/Art\. (?:23|24) .*Comercio Exterior/iu],
 ['competencia','¿Qué establece el artículo 87 de la Ley Federal del Trabajo para el expediente de Narda Albariza, folio LB-572?',['Albariza','LB-572'],/Art\. 87 .*Federal del Trabajo/iu],
 ['pagare','¿Qué requisitos debe contener el pagaré que firmó Verónica Trebolar a favor de la empresa ficticia?',['Trebolar'],/Títulos y Operaciones de Crédito/iu],
 ['ausencia','¿Qué dice el artículo 99999 de la Ley de Comercio Exterior sobre la solicitud de KL-4527?',['KL-4527'],null],
];
const out=path.resolve(process.argv[2]??'artifacts/consulta-r14/medicion');
await mkdir(out,{recursive:true});
const dataDir=await mkdtemp(path.join(tmpdir(),'rejon-consultas-ficticias-'));
let cloudCalls=0;
const app=await startServer({dataDir,intakePilot:true,autoInitialize:false,pilotPassphrase:Buffer.from('ejercicio local de medición'),
 intakeGenerate:async()=>{cloudCalls++;throw Error('La medición es local');}});
const rpc=(action,payload)=>app.service.dispatch('intake.'+action,payload);
const rows=[];
try{
 await rpc('save',{firm:'Despacho de Ensayo',client:'Compradora de Ensayo',title:'Práctica local',jurisdiction:'MX-FED'});
 for(const [name,text,probes,expected] of examples){
  let result;
  try{
   const {masked,candidates}=await rpc('inspectQuestion',{text});
   result={name,privateProbes:probes.length,visible:probes.filter(probe=>masked.includes(probe)),rank:expected?candidates.findIndex(row=>expected.test(row.label))+1:0,
    sources:candidates.map(row=>row.label),abstained:false};
  }catch(error){
   result={name,error:error.message,abstained:/No se encontró un pasaje/.test(error.message)};
  }
  rows.push(result);console.log(name,JSON.stringify({rank:result.rank,visible:result.visible,abstained:result.abstained}));
 }
 assert.equal(cloudCalls,0);
 await writeFile(path.join(out,'resultados.json'),JSON.stringify({cloudCalls,rows},null,2));
}finally{await app.close();await rm(dataDir,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import test from 'node:test';
import {documentPermitFields,permitFieldCitations,permitQuestionHint} from '../server/corpus/permit-question.mjs';
import {permitNote} from '../server/corpus/pedimento-index.mjs';

test('a local question distinguishes the shipment date, a publication, alternative regimes and names',()=>{
 const q='Según el DOF del 20 de mayo de 2026, ¿qué aviso aplica a la importación del 21 de mayo de 2026 de piezas de aluminio, fracción 7616.99.99 NICO 91, en depósito fiscal?';
 assert.deepEqual(permitQuestionHint(q),{query:'AL',date:'2026-05-21',classification:'7616999991',regime:'Depósito fiscal',sugar:false});
 const compute=text=>permitQuestionHint('¿Qué permiso corresponde al pedimento '+text+'?');
 assert.equal(compute('si el DOF publicó el acuerdo el 22 de mayo de 2026').date,'');
 assert.equal(permitQuestionHint('¿Es importante pedir un permiso laboral?'),null);
 assert.equal(compute('de piezas sin aluminio').query,'');
 assert.equal(compute('de la importación del 05/06/2026').date,'');
 assert.equal(compute('del despacho del 22/05/2026').date,'2026-05-22');
 assert.equal(compute('del despacho del 30 de febrero de 2026').date,'');
 assert.equal(compute('de la operación del 21 de mayo de 2026 o de la operación del 25 de mayo de 2026').date,'');
 assert.equal(compute('de importación temporal o definitiva').regime,'');
 assert.equal(compute('para las claves C1 y C6').query,'');
 assert.equal(compute('con el folio 7616999991').classification,'');
 assert.equal(permitQuestionHint('¿Qué aviso requiere Forja de Azúcar para el pedimento?', ['Forja de Azúcar']).query,'');
 assert.equal(permitQuestionHint('¿Qué dice el artículo 999 de la Ley Aduanera sobre el aviso de aluminio?'),null);
 assert.equal(permitQuestionHint('¿Qué clave de pedimento del apéndice 2 ampara la importación?'),null);
 assert.equal(permitQuestionHint('¿Qué señala el Anexo 22 de la Resolución Miscelánea Fiscal?'),null);
});
test('only supported, exact field selections are attributed to a document',()=>{
 const sources=[{id:'uno',label:'Primer soporte',original:'Fecha de factura: 2026-05-19\nFecha de operación: 2026-05-21\nFracción: 7616.99.99\nNICO: 91\nRégimen: depósito fiscal\nClave de permiso: AL'},
 {id:'dos',label:'Segundo soporte',original:'Fecha de despacho: 2026-05-26\nFracción: 7616.99.99\nFactura: 1\nNICO: 91'}];
 const docs=documentPermitFields(sources);
 assert.equal(docs[0].fields.length,4);assert.equal(docs[1].fields.length,1);
 const picks=[{sourceId:'uno',line:3,field:'classification'},{sourceId:'dos',line:1,field:'date'}],chosen={classification:'7616999991',date:'2026-05-26'};
 assert.deepEqual(permitFieldCitations(docs,picks,chosen),['Primer soporte · líneas 3–4 · Fracción y NICO · 7616999991','Segundo soporte · línea 1 · Fecha de operación · 2026-05-26','Los soportes contienen fechas distintas. El cotejo usa la fecha de la línea seleccionada.']);
 for(const wrong of [[picks[0],picks[0]],[{...picks[1],sourceId:'otro'}],[{...picks[1],field:'query'}]])assert.throws(()=>permitFieldCitations(docs,wrong,chosen));
 assert.throws(()=>permitFieldCitations(docs,picks,{...chosen,date:'2026-05-21'}));
});
test('a general SE C1 selection keeps sugar rules out until the material scope is chosen',()=>{
 const fields={code:'C1',agency:'SE',date:'2026-09-25',classification:'',regime:''};
 const general=permitNote({...fields,scope:'general'}),sugar=permitNote({...fields,scope:'azucar'}),legacy=permitNote(fields);
 assert.equal(general.references.length,1);assert.equal(general.period,null);assert.equal(sugar.period,'captura');
 assert.notEqual(general.id,sugar.id);assert.deepEqual(legacy.references,sugar.references);
 assert.throws(()=>permitNote({...fields,agency:'SENER',scope:'azucar'}));
});

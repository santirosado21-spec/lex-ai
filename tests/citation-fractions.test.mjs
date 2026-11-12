import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 romanoAEntero, normalizaFraccion, fraccionesDeLista, fraccionesSostenidas,
 paresDeCita, reporteCitaEstructural
} from '../server/citation-fractions.mjs';
import {validateGroundedOutput} from '../server/grounded-output.mjs';

// All legal-looking prose below is synthetic; public corpus is read-only.
const ART14='Artículo 14. I. Derecho inventado uno; II. Derecho inventado dos; III. Derecho inventado tres; IV. Derecho inventado cuatro; V. Derecho inventado cinco; VI. Derecho inventado seis; VII. Derecho inventado siete; VIII. Derecho inventado ocho; IX. Derecho inventado nueve.';
const source=(text,label='Artículo 14',id='L1')=>({
 id,article:label,text,allowedQuotes:[text.slice(0,Math.min(1500,text.length))],
 url:'https://example.test/legislacion-publica-sintetica',version:'synthetic'
});
const validate=(paragraph,s)=>{
 const q=s.allowedQuotes[0];
 return validateGroundedOutput(JSON.stringify({paragraphs:[{sourceId:s.id,quote:q,text:paragraph}]}),[s])
};
const report=result=>result.validated.validation.citationFractions;

test('1. fracción X inventada en artículo 14 que enumera solamente I-IX => se habría descartado',()=>{
 const verdict=validate('El artículo 14, fracción X, contendría una regla que no aparece en la enumeración del pasaje aprobado.',source(ART14));
 assert.equal(report(verdict).mode,'report-only');
 assert.deepEqual(report(verdict).findings,[{sourceId:'L1',reason:'fraction_not_supported'}]);
 // No rejection in phase 1: same paragraph still returned by existing validator.
 assert.equal(verdict.paragraphs.length,1);
});

test('2. dos artículos con fracciones cruzadas no se lavan por compartir la misma fuente',()=>{
 const text='Artículo 14, fracción I. Disposición ficticia del artículo 14. Artículo 16, fracción X. Disposición ficticia del artículo 16.';
 const s=source(text,'');
 const verdict=validate('El artículo 14, fracción X, y el artículo 16, fracción I, son un par cruzado que debe informarse.',s);
 assert.equal(report(verdict).wouldReject,1);
 assert.equal(report(verdict).findings[0].reason,'fraction_not_supported');
 assert.deepEqual(paresDeCita('artículo 14, fracción X, y artículo 16, fracción I').filter(x=>x.fraccion),[
  {articulo:'14',fraccion:'10'}, {articulo:'16',fraccion:'1'}
 ]);
});

test('3. dos artículos y fracción inicial huérfana => fallo cerrado solo reportado',()=>{
 const text='Artículo 14, fracción I. Texto ficticio de apoyo al artículo 14. Artículo 16, fracción II. Texto ficticio del artículo 16.';
 const s=source(text,'');
 const p='Fracción I del artículo 14 y artículo 16, fracción II, se mencionan juntos en esta exposición sintética.';
 const verdict=validate(p,s);
 assert.equal(report(verdict).wouldReject,1);
 assert.equal(report(verdict).findings[0].reason,'orphan_fraction');
 assert.throws(()=>paresDeCita(p),{reason:'orphan_fraction'});
});

test('4. C. Ciudadano no es enumeración C/100 ni D/500',()=>{
 const support=fraccionesSostenidas({label:'Artículo 123',text:'Artículo 123. C. Ciudadano. D. Derecho laboral inventado. I. Disposición ilustrativa.'});
 assert(support.has('1'));
 assert(!support.has('100'));
 assert(!support.has('500'));
 const s=source('Artículo 123. C. Ciudadano. I. Esta categoría inventada es la primera de la lista.', 'Artículo 123');
 const verdict=validate('El artículo 123, fracción C, contendría una regla atribuida sin apoyo estructural al pasaje.',s);
 assert.equal(report(verdict).findings[0].reason,'fraction_not_supported');
});

test('5. rango I a V cubre IV pero no VI; conectores y e intervalos',()=>{
 assert.deepEqual(fraccionesDeLista('fracciones I a V'),['1','2','3','4','5']);
 assert.deepEqual(fraccionesDeLista('I-V'),['1','2','3','4','5']);
 assert.deepEqual(fraccionesDeLista('I y X'),['1','10']);
 assert.deepEqual(fraccionesDeLista('I e II'),['1','2']);
 assert.deepEqual(fraccionesDeLista('I hasta V'),['1','2','3','4','5']);
 assert.deepEqual(fraccionesDeLista('I al V'),['1','2','3','4','5']);
 const s={label:'Artículo 14',text:'Artículo 14. Son aplicables las fracciones I a V de este artículo.'};
 assert(fraccionesSostenidas(s).has('4'));
 assert(reporteCitaEstructural('Artículo 14, fracción IV',s).ok);
 assert.deepEqual(reporteCitaEstructural('Artículo 14, fracción VI',s),{ok:false,reason:'fraction_not_supported'});
});

test('6. artículo 1 no coincide con artículo 123 por substring ni por referencias incidentales',()=>{
 const s=source('Artículo 123. Este artículo remite al artículo 1 únicamente como referencia incidental de un texto ficticio.', 'Artículo 123');
 assert.deepEqual(reporteCitaEstructural('Artículo 1', {label:s.article,text:s.text}),{ok:false,reason:'article_not_in_source'});
 const verdict=validate('El artículo 1 contiene una regla ficticia sin respaldo en el artículo principal del pasaje.',s);
 assert.equal(report(verdict).findings[0].reason,'article_not_in_source');
});

test('7. sufijos 144-A y 123 Bis; 123 Ter no equivale al 123',()=>{
 const hyphen={label:'Artículo 144-A',text:'Artículo 144-A.- II. Una regla sintética con sufijo unido al número.'};
 const bis={label:'Artículo 123 Bis',text:'Artículo 123 Bis. IV. Otra regla completamente inventada.'};
 assert(reporteCitaEstructural('Art. 144-A, fracción II',hyphen).ok);
 assert(reporteCitaEstructural('Artículo 123 Bis, fracción IV',bis).ok);
 assert.deepEqual(reporteCitaEstructural('Artículo 123 Ter, fracción IV',{label:'Artículo 123',text:'Artículo 123. IV. Otra regla.'}),{ok:false,reason:'article_not_in_source'});
 assert.deepEqual(paresDeCita('Art. 144-A, fracción II').filter(p=>p.fraccion),[{articulo:'144-a',fraccion:'2'}]);
});

test('8. fracción 2 equivale a II; romano inválido falla cerrado',()=>{
 assert.equal(romanoAEntero('II'),2);
 assert.equal(normalizaFraccion('fracción 2'),normalizaFraccion('fracción II'));
 assert(reporteCitaEstructural('Artículo 14, fracción 2',{label:'Artículo 14',text:'Artículo 14. II. Un ejemplo inventado para comparar tokens.'}).ok);
 for (const invalid of ['IIV','VX','IC','0','ABC','-1','MMMM']) {
  assert.throws(()=>romanoAEntero(invalid),{code:'UNSUPPORTED_CITATION_STRUCTURE'});
 }
});

test('9. el validador existente conserva contrato, y D* omite lectura estructural',()=>{
 const s=source(ART14);
 const valid=validate('El artículo 14, fracción II, está incluido en la enumeración ficticia de este pasaje público.',s);
 assert.equal(report(valid).wouldReject,0);
 assert.equal(valid.validated.validation.legalAccuracy,'not-evaluated');
 assert.equal(valid.validated.validation.citationIntegrity,true);
 const privateText='El artículo 14, fracción X, aparece literalmente en este contrato ficticio que no es fuente pública de derecho.';
 const privateDoc=source(privateText,'', 'D1');
 const original=structuredClone(privateDoc);
 const privateResult=validate('El artículo 14, fracción X, aparece en el contrato ficticio y no debe analizarse como legislación pública.',privateDoc);
 assert.deepEqual(report(privateResult),{mode:'report-only',checkedParagraphs:0,wouldReject:0,findings:[]});
 assert.deepEqual(privateDoc,original);
 assert.throws(()=>validate('El artículo 88 se encuentra en un documento de identidad contractual que no existe.',privateDoc),/respaldo/);
});

test('10. 21 fuentes públicas del corpus: prueba positiva de reporte sin falsos rechazos en este conjunto',()=>{
 const records=JSON.parse(readFileSync(new URL('../resources/legal-corpus.json',import.meta.url),'utf8'));
 assert.equal(records.length,21);
 let positives=0, rejected=0;
 for (const x of records) {
  const one=source(x.text,x.article,x.id);
  const p='El '+x.article.toLowerCase()+' se identifica en el texto de la fuente pública, sin afirmar su vigencia jurídica.';
  const result=validate(p,one);
  assert.equal(result.validated.validation.legalAccuracy,'not-evaluated');
  assert.equal(report(result).checkedParagraphs,1);
  positives++;
  rejected+=report(result).wouldReject;
 }
 console.log(JSON.stringify({tag:'CITATION_FRACTIONS_CORPUS_POSITIVE_PROBES',publicRecords:records.length,positiveProbes:positives,falseRejectionsWithinTheseProbes:rejected,mode:'report-only',legalAccuracy:'not-evaluated'}));
 assert.equal(rejected,0,'unexpected rejection of a positive constructed from the source own article');
});

test('metadata is text-free and unknown public source remains fatal',()=>{
 const s=source(ART14);
 const v=validate('El artículo 14, fracción X, no está incluido en la enumeración ficticia del pasaje citado.',s);
 assert(!JSON.stringify(report(v)).includes('Derecho inventado'));
 assert.throws(()=>validateGroundedOutput(JSON.stringify({paragraphs:[{sourceId:'MISSING',quote:s.allowedQuotes[0],text:'Un artículo público aparece con una fracción inventada e identificador de fuente incorrecto.'}]}),[s]),/aprobada/);
});

test('11. mención ordinaria de fracción en fuente no invalida un artículo sustentado',()=>{
 const s=source('Artículo 14. La fracción de un total se usa aquí como palabra corriente y no como numeral de ley.','Artículo 14');
 const p='El artículo 14 incluye una explicación sobre una fracción de un total y no cita fracciones numeradas.';
 const result=validate(p,s);
 assert.deepEqual(report(result),{mode:'report-only',checkedParagraphs:1,wouldReject:0,findings:[]});
 // An unnumbered use must NOT substantiate a numbered fraction.
 assert.deepEqual(reporteCitaEstructural('Artículo 14, fracción I',{label:s.article,text:s.text}),
  {ok:false,reason:'fraction_not_supported'});
});

test('12. sin etiqueta, referencias incidentales no acreditan otro artículo',()=>{
 const s=source('Artículo 123. Esta disposición ficticia remite al artículo 1 sin reproducir el texto de aquel.','');
 const p='El artículo 1 contiene una regla inventada que no está desarrollada en la fuente citada.';
 const result=validate(p,s);
 assert.equal(report(result).wouldReject,1);
 assert.equal(report(result).findings[0].reason,'article_not_in_source');
 const multi={label:'',text:'Artículo 14, fracción I. Regla ficticia uno. Artículo 16, fracción X. Regla ficticia dos.'};
 assert(reporteCitaEstructural('Artículo 16, fracción X',multi).ok);
 assert(!reporteCitaEstructural('Artículo 14, fracción X',multi).ok);
 assert(reporteCitaEstructural('Art. 144-A, fracción II',{label:'',text:'Art. 144-A. II. Apartado ficticio.'}).ok);
});

test('13. único escáner: pares emitidos en orden, único artículo libre y varios estrictos',()=>{
 assert.deepEqual(paresDeCita('artículo 14, fracción X, y artículo 16, fracción I'),[
  {articulo:'14',fraccion:null},
  {articulo:'14',fraccion:'10'},
  {articulo:'16',fraccion:null},
  {articulo:'16',fraccion:'1'}
 ]);
 assert.deepEqual(paresDeCita('fracción II del artículo 14'),[
  {articulo:'14',fraccion:'2'},
  {articulo:'14',fraccion:null}
 ]);
 assert.throws(()=>paresDeCita('fracción I del artículo 14 y artículo 16'),{reason:'orphan_fraction'});
});

test('14. mención fracción I del artículo posterior no hereda artículo previo',()=>{
 const s=source('Artículo 14. I. Regla sintética de catorce. Artículo 16. II. Regla sintética de dieciséis.','');
 const bad='El artículo 14 remite a la fracción I del artículo 16 en esta hipótesis sintética.';
 const good='El artículo 14 remite a la fracción II del artículo 16 en esta hipótesis sintética.';
 assert.deepEqual(paresDeCita(bad).filter(p=>p.fraccion),[{articulo:'16',fraccion:'1'}]);
 assert.deepEqual(paresDeCita('El artículo 14 remite a la fracción I del art. 16.').filter(p=>p.fraccion),[{articulo:'16',fraccion:'1'}]);
 assert.deepEqual(reporteCitaEstructural(bad,{label:'',text:s.text}),{ok:false,reason:'fraction_not_supported'});
 assert(reporteCitaEstructural(good,{label:'',text:s.text}).ok);
 const result=validate(bad,s);
 assert.equal(report(result).mode,'report-only');
 assert.deepEqual(report(result).findings,[{sourceId:'L1',reason:'fraction_not_supported'}]);
 assert.equal(result.paragraphs.length,1,'report-only never rejects a paragraph by itself');
});

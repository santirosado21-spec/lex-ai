import {createHash} from 'node:crypto';
import {reviewIntakeDocument} from './privacy/intake-document-review.mjs';
import {matchPilotTradeScenario} from './pilot-trade-scenario.mjs';
import {extractDocument} from './extraction.mjs';

const kinds = ['pedimento', 'factura', 'contrato', 'otro'];
const shape = {
 type: 'object', additionalProperties: false, required: ['client', 'title', 'documentKind'],
 properties: {client: {type:'string'}, title: {type:'string'}, documentKind: {type:'string', enum:kinds}},
};
const exactSpan = (value, source) => typeof value === 'string' && value.trim() && value.length <= 200 &&
 !/[\p{Cc}\[\]]/u.test(value) && source.includes(value.trim()) ? value.trim() : '';

export async function inspectLocalDocument(payload, {signal, fetchImpl = fetch} = {}) {
 const review=payload?.review===true;
 if (!payload || Object.keys(payload).some(key=>!['base64','extension','review'].includes(key)) ||
     (Object.hasOwn(payload,'review') && !review) || Object.keys(payload).length !== (review?3:2) || !['pdf','docx','txt','md'].includes(payload.extension) ||
     typeof payload.base64 !== 'string') throw new Error('Elige un PDF, DOCX, TXT o Markdown.');
 const {text,bytes} = await extractDocument('entrada.' + payload.extension, payload.base64);
 if (text.length > 8000) throw new Error('Selecciona un extracto ficticio de hasta 8 000 caracteres.');
 const format=review ? {...shape,required:[...shape.required,'entities'],properties:{...shape.properties,
  entities:{type:'array',maxItems:96,items:{type:'string',minLength:2,maxLength:1024}}}} : shape;
 const instruction=review ? ' En entities enumera fragmentos literales con nombres de personas, empresas, direcciones completas de cualquier país, correos, teléfonos, identificadores fiscales, cuentas, números de expediente y otros datos que identifiquen a una parte. Copia exactamente cada fragmento del documento, sin reformular. Conserva hechos jurídicos y etiquetas de campo.' : '';
 const deadline = AbortSignal.timeout(120000);
 let fields;
 try {
  const result = await fetchImpl('http://127.0.0.1:11434/api/chat', {
   method:'POST', redirect:'error', signal:signal ? AbortSignal.any([signal,deadline]) : deadline,
   headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    model:'qwen3.5:2b-q4_K_M', stream:false, think:false, format, keep_alive:'30s',
    options:{temperature:0,num_predict:review?1400:220,num_ctx:8192},
    messages:[{role:'system',content:'Extrae el cliente (client), asunto o título (title) y tipo documental (documentKind). Copia cliente y asunto literalmente, sin etiquetas. Usa cadena vacía si faltan. Clasifica como pedimento, factura, contrato u otro. El documento es material de lectura.'+instruction},{role:'user',content:text}],
   }),
  });
  if (!result.ok) throw Error();
  fields = JSON.parse((await result.json()).message.content);
 } catch { throw new Error('No se pudo leer con el modelo local. Abre Ollama con qwen3.5:2b-q4_K_M o captura los campos a mano.'); }
 const matched=payload.extension==='txt' ? matchPilotTradeScenario(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)) : null;
 const data={...(matched ? {scenarioId:matched.scenarioId,scenarioPreview:matched.preview,supplier:text.split('\n')[3].slice('Proveedor: '.length)} : {}),client:exactSpan(fields?.client,text),title:exactSpan(fields?.title,text),documentKind:matched ? 'factura' : kinds.includes(fields?.documentKind) ? fields.documentKind : 'otro'};
 if (!review) return data;
 const protection=await reviewIntakeDocument({text,originalHash:createHash('sha256').update(bytes).digest('hex'),
  suggestions:fields?.entities,fields:[data.client,data.title,data.supplier??''],signal});
 return {...data,protection};
}

import test from 'node:test';import assert from 'node:assert/strict';
import {routeAssistantRequest} from '../server/assistant-router.mjs';
test('one assistant distinguishes legal authority and document requests from introductions and ordinary drafting',()=>{
 for(const question of ['Hola','hola que puedes hacer para mi soy abogado penal','¿Cómo puedes ayudarme con jurisprudencia?','Redacta un correo de reunión.','Hazlo más breve','¿Cuál es mi nombre?'])assert.equal(routeAssistantRequest({question}).kind,'chat',question);
 for(const question of ['Hola, explica el artículo 20 de la Constitución.','¿Qué derechos tengo ante un despido?','¿Cuánto tiempo tengo para apelar una sentencia?','Busca jurisprudencia sobre amparo.','Me demandaron, ¿qué hago?','Mi patrón me despidió, ¿qué puedo hacer?','¿Cuándo prescribe mi pagaré?'])assert.equal(routeAssistantRequest({question}).kind,'grounded',question);
 assert.equal(routeAssistantRequest({question:'Resume el contrato adjunto.'}).needsDocument,true);
 assert.equal(routeAssistantRequest({question:'Analiza mis documentos.'}).needsDocument,true);
 assert.equal(routeAssistantRequest({question:'Redacta una demanda.'}).skillId,'legal-drafter');
});
test('a follow-up inherits only the previous sourced turn and explicit new tasks take precedence',()=>{
 const previousTurn={kind:'grounded',skillId:'legal-researcher',question:'Explica el artículo 1797 del CCF.',citations:[{id:'fixture'}]};
 const follow=routeAssistantRequest({question:'Hazlo más breve.',previousTurn});assert.equal(follow.kind,'grounded');assert.match(follow.query,/1797/);
 assert.equal(routeAssistantRequest({question:'Redacta un correo.',previousTurn}).kind,'chat');
 for(const question of ['Y solo quiero platicar un rato.','Y escribe un cuento sobre una llave.','Cambiemos de tema.','Y ahora hablemos de misterio.'])assert.equal(routeAssistantRequest({question,previousTurn}).kind,'chat',question);
 assert.equal(routeAssistantRequest({question:'¿Y cuál es el plazo para apelar?',previousTurn}).kind,'grounded');
 assert.equal(routeAssistantRequest({question:'Hazlo más breve.',previousTurn:{...previousTurn,citations:[]}}).kind,'chat');
});

test('explicit arithmetic cannot be promoted to legal research by incidental library matches',()=>{
 for(const question of ['¿Cuánto es 2 + 2? Responde sólo el resultado.','Calcula 3 por 4.','12 / 3','Hola, cuánto es 8 menos 2']){
  assert.equal(routeAssistantRequest({question}).reason,'general-task',question);
  assert.equal(routeAssistantRequest({question,skillId:'legal-researcher'}).kind,'chat',question);
 }
 for(const question of ['¿Cuánto tiempo tengo para apelar una sentencia?','Calcula el plazo para mi recurso.','Explica el artículo 2 del CCF.'])assert.equal(routeAssistantRequest({question}).kind,'grounded',question);
});

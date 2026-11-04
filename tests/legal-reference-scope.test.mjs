import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
import {createService} from '../server/service.mjs';
test('explicit federal code and Constitution requests use the named authority from a CDMX matter',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lex-explicit-authority-'));
 const corpus=[['FED-CCF','Código Civil Federal','MX-FED','1797','El pasaje federal sintético debe conservarse separado del pasaje civil local.'],['LOCAL-CC','Código Civil para el Distrito Federal','MX-CMX','1797','El pasaje local sintético no sustituye al federal expresamente solicitado.'],['FED-CONST','Constitución Política de los Estados Unidos Mexicanos','MX-FED','20','Este pasaje constitucional federal es una prueba sintética sin contenido normativo.']].map(([id,title,jurisdiction,article,text])=>({id,title,jurisdiction,article,text,sha256:createHash('sha256').update(text).digest('hex'),url:'https://www.diputados.gob.mx/test-synthetic',category:'legislation-snapshot'}));
 const corpusPath=path.join(dir,'corpus.json');await writeFile(corpusPath,JSON.stringify(corpus));let seen;
 const service=await createService({dataDir:dir,corpusPath,inference:{async *generate(messages){seen=JSON.parse(messages[1].content);const s=seen.sources[0];yield JSON.stringify({analysis:`El pasaje sintético se conserva para comprobar únicamente selección de fuente [${s.id}].`,citations:[{sourceId:s.id,quote:s.allowedQuotes[0]}]});}}});
 t.after(()=>{service.close();return rm(dir,{recursive:true,force:true});});
 await service.dispatch('workspace.create',{name:'Despacho sintético',practiceAreas:['civil']});
 const m=await service.dispatch('matter.create',{title:'Asunto local sintético',client:'Parte ficticia',jurisdiction:'MX-CMX'});
 for(const [question,id] of [['Explica el artículo 1797 del Código Civil Federal.','FED-CCF'],['Explica el artículo 1797 del CCF.','FED-CCF'],['Explica el artículo 20 de la Constitución.','FED-CONST'],['Explica el artículo 20 de la Constitución de los Estados Unidos Mexicanos.','FED-CONST'],['Explica el artículo 1797 del Código Civil para el Distrito Federal.','LOCAL-CC']]){
  const answer=await service.analyze({mode:'grounded',matterId:m.id,skillId:'legal-researcher',question});assert.equal(seen.sources[0].id,id);assert.equal(answer.citations[0].id,id);
 }
 await assert.rejects(service.analyze({matterId:m.id,skillId:'legal-researcher',question:'Explica el artículo 99999 del Código Civil Federal.'}),/no contiene evidencia/);
 for(const local of ['Constitución de CDMX','Constitución del Distrito Federal','Constitución local']){
  await assert.rejects(service.analyze({matterId:m.id,skillId:'legal-researcher',question:`Explica el artículo 20 de la ${local}.`}),/no contiene evidencia/);
  const absent=await service.analyze({mode:'auto',question:`Explica el artículo 20 de la ${local}.`});assert.equal(absent.citations.length,0);assert.equal(absent.validation.citationIntegrity,false);
 }
});

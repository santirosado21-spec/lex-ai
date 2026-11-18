import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createService } from '../server/service.mjs';

async function ids(query,jurisdiction='MX-FED'){
  const dir=mkdtempSync(join(tmpdir(),'lex-articles-'));
  const service=await createService({dataDir:join(dir,'firm'),corpusPath:new URL('../resources/legal-corpus.json',import.meta.url).pathname,inference:{async *generate(){}}});
  try{
    await service.dispatch('workspace.create',{name:'Pruebas',practiceAreas:['civil']});
    return (await service.dispatch('research.search',{query,jurisdiction})).map(s=>s.id).sort();
  }finally{service.close();rmSync(dir,{recursive:true,force:true});}
}

test('singular explicit references keep resolving to the named law',async()=>{
  assert.deepEqual(await ids('artículo 78 del Código de Comercio'),['MX-CCOM-78']);
  assert.deepEqual(await ids('artículo 1832 del Código Civil Federal'),['MX-CCF-1832']);
  assert.deepEqual(await ids('art. 1797 del CCF'),['MX-CCF-1797']);
});
test('plural and list references resolve every article of the named law',async()=>{
  assert.deepEqual(await ids('artículos 1797 y 1832 del Código Civil Federal'),['MX-CCF-1797','MX-CCF-1832']);
  assert.deepEqual(await ids('los artículos 1, 2 y 78 del Código de Comercio'),['MX-CCOM-1','MX-CCOM-2','MX-CCOM-78']);
  assert.deepEqual(await ids('arts. 1797, 1832 del CCF'),['MX-CCF-1797','MX-CCF-1832']);
  assert.deepEqual(await ids('artículos 1832 y 1832 del CCF'),['MX-CCF-1832']);
});
test('repeated article keyword with different laws keeps each association',async()=>{
  assert.deepEqual(await ids('artículo 78 del Código de Comercio y artículo 1832 del Código Civil Federal'),['MX-CCF-1832','MX-CCOM-78']);
  assert.deepEqual(await ids('artículos 78 del Código de Comercio y 1832 del Código Civil Federal'),[]);
});
test('the law named in the question is not replaced by the matter jurisdiction',async()=>{
  assert.deepEqual(await ids('artículos 1797 y 1832 del Código Civil Federal','MX-CMX'),['MX-CCF-1797','MX-CCF-1832']);
});
test('missing, unknown or ambiguous references return nothing instead of another norm',async()=>{
  assert.deepEqual(await ids('artículos 78 y 9999 del Código de Comercio'),[]);
  assert.deepEqual(await ids('artículos 78 y 1832 del Código Penal Federal'),[]);
  assert.deepEqual(await ids('artículos 78 y 1832'),[]);
  assert.deepEqual(await ids('artículos 78 y 1832 del Código Civil'),[]);
  assert.deepEqual(await ids('artículos 1 y 14 de los códigos de Comercio y Civil Federal'),[]);
});

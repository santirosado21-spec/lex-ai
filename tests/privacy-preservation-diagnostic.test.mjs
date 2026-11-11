// DIAGNOSTIC-ONLY harness: H3 protect/restore preservation fidelity for
// date/amount/citation spans. Development evidence only: NOT scored under
// eval/privacy/protocol.json ("preservation" is not-evaluated by the official
// prediction scorer), never gate, safe-egress or pilot evidence. Synthetic content.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createPseudonymStore} from '../server/privacy/pseudonyms.mjs';
import {createPseudonymSealer} from '../server/privacy/pseudonym-persistence.mjs';

const scope={workspaceId:'DIAG_FIRM',matterId:'DIAG_MATTER',threadId:'DIAG_THREAD'};
const pairOf=s=>({workspaceId:s.workspaceId,matterId:s.matterId});
const key=randomBytes(32);
const name='Persona Sintética Herrera';
const org='Laboratorio Sintético del Valle';
const text=`El 15 de marzo de 2026, ${name} pagó $1,250,000.00 MXN a ${org} conforme al expediente EXP-2026/00451 y el contrato "CONV-SINT-07" firmado el 2 de enero de 2026.`;
const preserved=['15 de marzo de 2026','$1,250,000.00','EXP-2026/00451','2 de enero de 2026'];
const entities=[name,org];

test('diagnostic: protected outbound keeps date/amount/citation spans literal while identities become markers',()=>{
 const store=createPseudonymStore();
 const out=store.protect({scope,messages:[{role:'user',content:text}],entities});
 const outbound=out.messages[0].content;
 for(const span of preserved)assert.ok(outbound.includes(span),`preserved span must stay literal: ${span}`);
 assert.ok(!outbound.includes(name)&&!outbound.includes(org),'identities must not leak into outbound');
 assert.match(outbound,/^\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]|^El 15/);
});

test('diagnostic: restore returns the byte-identical original after protection',()=>{
 const store=createPseudonymStore();
 const out=store.protect({scope,messages:[{role:'user',content:text}],entities});
 assert.equal(store.restore({scope,text:out.messages[0].content,mappingVersion:out.mappingVersion}),text);
});

test('diagnostic: restoreStream over arbitrarily chunked output yields one byte-identical string',async()=>{
 const store=createPseudonymStore();
 const out=store.protect({scope,messages:[{role:'user',content:text}],entities});
 const protectedText=out.messages[0].content;
 const chunks=[];for(let i=0;i<protectedText.length;i+=7)chunks.push(protectedText.slice(i,i+7));
 const collected=[];for await(const piece of store.restoreStream({scope,mappingVersion:out.mappingVersion,chunks}))collected.push(piece);
 assert.equal(collected.length,1);
 assert.equal(collected[0],text);
});

test('diagnostic: preservation fidelity survives the sealed-persistence restart cycle',()=>{
 const store=createPseudonymStore();
 const out=store.protect({scope,messages:[{role:'user',content:text}],entities});
 const sealed=createPseudonymSealer({key}).seal({scope:pairOf(scope),snapshot:store.exportSnapshot({scope})});
 const revived=createPseudonymStore();
 revived.importSnapshot({scope,snapshot:createPseudonymSealer({key}).open({scope:pairOf(scope),sealed})});
 const restored=revived.restore({scope,text:out.messages[0].content,mappingVersion:out.mappingVersion});
 assert.equal(restored,text);
 for(const span of preserved)assert.ok(restored.includes(span));
});

test('diagnostic: identities inside or beside preserved spans are still pseudonymized exactly once per literal occurrence',()=>{
 const tricky=`La cita "Ley de ${name}" del 3 de febrero de 2026 obliga a ${name}.`;
 const store=createPseudonymStore();
 const out=store.protect({scope,messages:[{role:'user',content:tricky}],entities});
 const outbound=out.messages[0].content;
 assert.ok(outbound.includes('3 de febrero de 2026'));
 assert.ok(!outbound.includes(name));
 assert.equal(store.restore({scope,text:outbound,mappingVersion:out.mappingVersion}),tricky);
});

test('diagnostic: metadata values are protected and restored-safe; metadata keys stay structural',()=>{
 const store=createPseudonymStore();
 const out=store.protect({scope,messages:[{role:'user',content:text,metadata:{nota:`Revisado por ${name} el 15 de marzo de 2026`,etiquetas:[org,'urgente']}}],entities});
 const meta=out.messages[0].metadata;
 assert.ok(!meta.nota.includes(name)&&meta.nota.includes('15 de marzo de 2026'));
 assert.ok(!meta.etiquetas[0].includes(org)&&meta.etiquetas[1]==='urgente');
 assert.deepEqual([...Object.keys(meta)].sort(),['etiquetas','nota']);
});

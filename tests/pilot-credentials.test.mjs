import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPilotCredential} from '../server/providers/pilot-credentials.mjs';
test('local key choice defaults to primary, explicit alternation distributes requests',async()=>{
 const selected=selectPilotCredential('alternate',async slot=>slot);
 assert.deepEqual([await selected(),await selected(),await selected()],['primary','lorenzo','primary']);
 assert.equal(await selectPilotCredential(undefined,async slot=>slot)(),'primary');
});
test('backup only selects a second credential if lookup failed before dispatch',async()=>{
 const calls=[];
 const selected=selectPilotCredential('backup',async slot=>{calls.push(slot);if(slot==='primary')throw Object.assign(Error(),{code:'credential_unavailable'});return slot;});
 assert.equal(await selected(),'lorenzo');assert.deepEqual(calls,['primary','lorenzo']);
 await assert.rejects(selectPilotCredential('backup',async()=>{throw Object.assign(Error(),{code:'invalid_credential'});}),{code:'invalid_credential'});
});

test('temporary accounts alternate on any OS and an omitted primary uses the backup',async()=>{
 const {selectTemporaryPilotCredential}=await import('../server/providers/pilot-credentials.mjs');
 const keys=['sk-'+'a'.repeat(30),'sk-'+'b'.repeat(30)];
 const selected=[];
 const answers=[...keys];
 const read=await selectTemporaryPilotCredential('alternate',async()=>answers.shift(),slot=>selected.push(slot));
 assert.deepEqual([await read(),await read(),await read()],[...keys,keys[0]]);
 assert.deepEqual(selected,['primary','lorenzo','primary']);
 const backup=['',keys[1]];
 assert.equal(await (await selectTemporaryPilotCredential('backup',async()=>backup.shift()))(),keys[1]);
 await assert.rejects(selectTemporaryPilotCredential('alternate',async()=>''),/al menos/);
 await assert.rejects(selectTemporaryPilotCredential('primary',async()=>'invalid'),/Formato/);
});

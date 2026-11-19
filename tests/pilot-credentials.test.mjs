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

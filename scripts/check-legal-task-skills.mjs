#!/usr/bin/env node
// Offline fixtures only. No provider route, inference, activation or privacy decision.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadLegalTaskBundle,prepareLegalTask,validateLegalTaskOutput} from '../server/legal-tasks/contracts.mjs';
import {canonicalJson} from '../server/canonical-json.mjs';
export async function checkLegalTaskSkills(){
 const bundle=await loadLegalTaskBundle();
 const lines=(await readFile(new URL('../eval/legal-tasks/development.jsonl',import.meta.url),'utf8')).trim().split('\n');
 const ids=new Set(),results=[];
 for(const line of lines){const row=JSON.parse(line);canonicalJson(row);
 const keys=['id','input','expectedPreparation','candidateOutput','expectedOutput','description','behavioralExpectation'];
 if(!row||Array.isArray(row)||Object.keys(row).sort().join('|')!==keys.sort().join('|')||typeof row.id!=='string'||!row.id||ids.has(row.id)||!['accept','reject'].includes(row.expectedPreparation)||!['accept','reject',null].includes(row.expectedOutput)||typeof row.description!=='string'||typeof row.behavioralExpectation!=='string')throw Error('Invalid/duplicate development fixture');ids.add(row.id);
 if(row.expectedPreparation==='reject'&&(row.candidateOutput!==null||row.expectedOutput!==null))throw Error('Rejected input cannot have output fixture');
 if((row.candidateOutput===null)!==(row.expectedOutput===null)||row.candidateOutput!==null&&(typeof row.candidateOutput!=='object'||Array.isArray(row.candidateOutput)))throw Error('Invalid candidate output fixture');
 let packet,error;try{packet=prepareLegalTask(bundle,row.input);}catch(e){error=e;}
 const preparation=packet?'accept':'reject';if(preparation!==row.expectedPreparation)throw Error(`Preparation expectation failed: ${row.id}: ${error?.message??'accepted'}`);
 let output=null;if(packet&&row.candidateOutput!==null){try{validateLegalTaskOutput(row.candidateOutput,packet);output='accept';}catch{output='reject';}if(output!==row.expectedOutput)throw Error(`Output expectation failed: ${row.id}`);}
 results.push({id:row.id,preparation,output});
 }
 return {status:'legal-task-skills-prepared-unmeasured',productionEnabled:false,authorizationGranted:false,remoteToolsEnabled:false,modelGenerations:0,prepared:results.filter(r=>r.preparation==='accept').length,rejected:results.filter(r=>r.preparation==='reject').length,validationFixtures:results.filter(r=>r.output!==null).length,outputAccepted:results.filter(r=>r.output==='accept').length,outputRejected:results.filter(r=>r.output==='reject').length,outputsNotRun:results.filter(r=>r.output===null).length,results};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==2)throw Error('No CLI flags are supported; offline only');console.log(JSON.stringify(await checkLegalTaskSkills(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}

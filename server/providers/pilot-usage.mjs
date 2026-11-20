// Counts only local receipts for this exercise. The provider owns billing.
import {appendFile,readFile} from 'node:fs/promises';
import path from 'node:path';

const slots=['primary','lorenzo'];
const outcomes=['answered','incomplete','rejected','unconfirmed'];
const reasons=['invalid_key','insufficient_quota'];
const tokenCount=value=>Number.isSafeInteger(value)&&value>=0;

export async function openPilotUsage(dataDir,mode){
 const file=path.join(dataDir,'uso-openai.jsonl');
 const accounts=Object.fromEntries(slots.map(slot=>[slot,{attempts:0,input:0,output:0,unreported:0}]));
 let partial=false,last=null;
 function apply(row){
  const outcome=row?.outcome??'answered'; // Earlier editions wrote successful receipts only.
  if(!slots.includes(row?.account)||!Object.hasOwn(row,'usage')||!outcomes.includes(outcome)){partial=true;return;}
  const entry=accounts[row.account];entry.attempts++;
  if(tokenCount(row.usage?.promptTokens))entry.input+=row.usage.promptTokens;
  if(tokenCount(row.usage?.completionTokens))entry.output+=row.usage.completionTokens;
  if(!tokenCount(row.usage?.promptTokens)||!tokenCount(row.usage?.completionTokens))entry.unreported++;
  last={account:row.account,outcome,reason:reasons.includes(row.reason)?row.reason:null};
 }
 try{
  const rows=await readFile(file,'utf8');
  for(const line of rows.split('\n')){
   if(!line.trim())continue;
   try{apply(JSON.parse(line));}catch{partial=true;}
  }
 }catch(error){if(error.code!=='ENOENT')partial=true;}
 return {
  status:()=>structuredClone({mode,accounts,last,partial}),
  async record(account,{outcome,rejection,receipt}){
   const model=receipt?.observedModel;
   const row={at:new Date().toISOString(),account,outcome,
    ...(reasons.includes(rejection)?{reason:rejection}:{}),
    model:model===receipt?.requestedModel&&typeof model==='string'?model:null,usage:receipt?.usage??null};
   apply(row);
   try{await appendFile(file,JSON.stringify(row)+'\n',{mode:0o600});}
   catch{partial=true;}
  },
 };
}

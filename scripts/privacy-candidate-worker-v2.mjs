// Child-only local candidate. Receives whitelisted operational inputs, never dataset IDs/gold.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createSemanticPrivacyDetector,SEMANTIC_VERSION} from '../server/privacy/semantic-v2.mjs';
import {copyPrivacyJson,exactFields,validateOperationalInput} from '../server/privacy/operational-v2.mjs';
const python=fileURLToPath(new URL('../artifacts/privacy/onnx-env/bin/python',import.meta.url));
const script=fileURLToPath(new URL('./privacy-onnx-worker.py',import.meta.url));
const fail=()=>({status:'blocked',reasonCategory:'detector_failure',detections:[]});
export function startPythonBackend({ablation=false}={}){
 if(typeof ablation!=='boolean')throw Error('invalid_configuration');
 const candidateId=ablation?'gliner-pii-small-uint8-local-v3':SEMANTIC_VERSION;
 const child=spawn(python,['-I','-B',script,'--serve',...(ablation?['--ablation-v3']:[])],{stdio:['pipe','pipe','ignore'],env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8',PYTHONNOUSERSITE:'1',TOKENIZERS_PARALLELISM:'false',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',LEX_PRIVACY_NETWORK_SANDBOX:'required'}});
 let pending=null,dead=false,buffer='',metadata=null,peakRssBytes=0,readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function stop(){if(dead)return;dead=true;clearTimeout(initial);child.kill('SIGKILL');readyReject(Error('detector_failure'));pending?.reject(Error('detector_failure'));pending=null;}
 const initial=setTimeout(stop,15000);
 child.on('error',stop);child.on('exit',stop);
 child.stdout.on('data',chunk=>{
  buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>524288)return stop();
  while(buffer.includes('\n')){
   const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);
   try{
    const result=JSON.parse(line);
    if(!metadata){exactFields(result,['ready']);metadata=copyPrivacyJson(result.ready);if(metadata.candidateId!==candidateId||metadata.executionProvider!=='CPUExecutionProvider')return stop();clearTimeout(initial);peakRssBytes=metadata.peakRssBytes;readyResolve(metadata);}
    else {if(!pending)return stop();const request=pending;const {peakRssBytes:rss,...output}=result;if(!Number.isInteger(rss)||rss<0||rss>924*1024*1024)return stop();peakRssBytes=Math.max(peakRssBytes,rss);pending=null;request.resolve(output);}
   }catch{stop();}
  }
 });
 return {ready,get metadata(){return metadata;},get peakRssBytes(){return peakRssBytes;},close:stop,
  async detect(input,{signal}={}){await ready;if(dead||pending||signal?.aborted)throw Error('detector_failure');return new Promise((resolve,reject)=>{
   const abort=()=>{stop();reject(Error('detector_failure'));};const timer=setTimeout(abort,15000);signal?.addEventListener('abort',abort,{once:true});
   const finish=fn=>value=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};pending={resolve:finish(resolve),reject:finish(reject)};
   child.stdin.write(JSON.stringify(input)+'\n',error=>{if(error)stop();});
  });},
 };
}
if(process.send){
 if(process.argv.slice(2).length && JSON.stringify(process.argv.slice(2))!==JSON.stringify(['--ablation-v3']))throw Error('invalid_configuration');
 const backend=startPythonBackend({ablation:process.argv[2]==='--ablation-v3'}),detector=createSemanticPrivacyDetector({backend});let busy=false;
 const memory=setInterval(()=>{if(process.resourceUsage().maxRSS*1024>100*1024*1024){backend.close();process.exit(3);}},25);
 process.on('disconnect',()=>{clearInterval(memory);backend.close();process.exit(0);});
 backend.ready.then(metadata=>process.send({ready:metadata})).catch(()=>{process.send({errorCategory:'detector_failure'});process.exitCode=2;backend.close();clearInterval(memory);process.disconnect();});
 process.on('message',async message=>{
  if(busy){process.send({errorCategory:'detector_failure'});return;}busy=true;
  try{
   const clean=copyPrivacyJson(message);exactFields(clean,['input']);const input=validateOperationalInput(clean.input);
   const start=performance.now(),result=await detector.detect(input);
   process.send({result,latencyMs:performance.now()-start,peakRssBytes:backend.peakRssBytes+process.resourceUsage().maxRSS*1024});
  }catch{process.send({result:fail(),latencyMs:0,peakRssBytes:backend.peakRssBytes+process.resourceUsage().maxRSS*1024});}
  finally{busy=false;}
 });
}

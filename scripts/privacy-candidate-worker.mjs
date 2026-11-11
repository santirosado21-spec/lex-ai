// Developer-only isolated detector evaluator. Receives no corpus files, IDs or gold labels.
import {createLocalPrivacyDetector,DETECTOR_VERSION} from '../server/privacy/detector.mjs';
import {createProvenanceRegistry,privacyTextHash} from '../server/privacy/provenance.mjs';
import {performance} from 'node:perf_hooks';

export async function detectFixtureInput(input) {
  const registry=createProvenanceRegistry();
  const segments=input.segments.map((segment,index)=>{
    if(segment.originScope===null)return {id:segment.id,path:segment.path,text:segment.text};
    return registry.registerSource({objectId:`fixture-${index}`,version:'v1',scope:segment.originScope,
      classification:segment.classification,
      // Frozen v2 segment states arrive from the case when authored; defaults
      // keep v1 material byte-identical. States are synthetic stimuli, never gold.
      extraction:{status:segment.extractionStatus??'complete',extractorVersion:'plain-fixture-v1',originalSha256:privacyTextHash(segment.text)},
      segments:[{id:segment.id,path:segment.path,text:segment.text}],assessment:segment.assessment??'known'}).segments[0];
  });
  return createLocalPrivacyDetector({provenanceRegistry:registry}).detect({scope:input.scope,segments});
}

if(process.send)process.on('message',async message=>{
  try {
    if(!Array.isArray(message?.inputs)||message.inputs.length>1000)throw Error('batch');
    const results=[],latenciesMs=[];
    for(const input of message.inputs){
      const start=performance.now();results.push(await detectFixtureInput(input));latenciesMs.push(performance.now()-start);
    }
    process.send({version:DETECTOR_VERSION,results,latenciesMs,peakRssBytes:process.resourceUsage().maxRSS*1024});
  }catch{process.send({errorCategory:'candidate_failed'});}
});

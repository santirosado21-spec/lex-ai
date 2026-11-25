// Explicit OFF-by-default composition. No caller-selectable URL, model or UI route.
// Constructing does not initialize. Importing from the product is intentionally absent.
import {createOwnedIntakeRuntime} from '../inference.mjs';
import {createIntakeContractualOllama} from './intake-contractual-ollama.mjs';
export function createOwnedIntakeContractualOllama(options){
 const runtime=createOwnedIntakeRuntime(options);
 const lifetime=new AbortController();
 const candidate=createIntakeContractualOllama({requestImpl:runtime.readerRequest});
 return Object.freeze({async detect(input,{signal}={}){const combined=AbortSignal.any([lifetime.signal,...(signal?[signal]:[])]);const result=await candidate.detect(input,{signal:combined});return combined.aborted?{status:'blocked',reasonCategory:'detector_failure',detections:[]}:result;},initialize:runtime.initialize,status:runtime.status,stop(){lifetime.abort();return runtime.stop();}});
}

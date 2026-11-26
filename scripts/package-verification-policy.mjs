// Package inventory/service checks must not reactivate legacy local reasoning.
export function assertPackageVerificationMode(env={}){
 if(env.LEX_VERIFY_CHAT==='1')throw Error('LEX_VERIFY_CHAT is no longer supported: local reasoning is disabled. Use a separately reviewed synthetic privacy-reader check.');
}
export function verifyReasoningDisabled(engine){
 if(engine?.state!=='unavailable'||engine.supported!==false||engine.busy!==false||engine.reasoning?.available!==false||engine.reasoning?.code!=='reasoning-route-unavailable')throw Error('Packaged reasoning boundary does not match the disabled product contract.');
 return {state:'unavailable',reasoningAvailable:false,localReaderRuntimeValidated:false};
}

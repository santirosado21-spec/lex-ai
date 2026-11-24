import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {openDofReviewIndex} from './dof-review-index.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Independently byte-checked 24nov2026. Only the isolated nine-text dev review.
export const REVIEWED_DEV_PIN=Object.freeze({scope:'nine-text-document-review-dev-only',candidateSha256:'893a70f67a3f85c04538882bb2edfc1dd7f05a95456d128d4bed49645942e015',htmlSha256:'d75b8279d1491c95473175300e04553c4ab954852407a8ba7888fa0af694fd38',indexSha256:'305306c419b8ed7ae8495822374d0a04c68bf6bb34535679d46a70b76ecf40d9'});
export function openDofAppReview({directory,indexSha256}){
 if(indexSha256!==undefined&&indexSha256!==REVIEWED_DEV_PIN.indexSha256)throw Error('Index digest override is not allowed for this reviewed dev cut');
 indexSha256=REVIEWED_DEV_PIN.indexSha256;
 if(sha(readFileSync(path.join(directory,'rgce3-isolated-content-candidate.json')))!==REVIEWED_DEV_PIN.candidateSha256)throw Error('Reviewed candidate integrity mismatch');
 const html=readFileSync(path.join(directory,'rgce3-final-dof-print.html'));
 const index=openDofReviewIndex({file:path.join(directory,'dev-index/dof-review.sqlite'),expectedIndexSha256:indexSha256});
 if(sha(html)!==REVIEWED_DEV_PIN.htmlSha256||index.meta.htmlSha256!==REVIEWED_DEV_PIN.htmlSha256||index.meta.candidateSha256!==REVIEWED_DEV_PIN.candidateSha256){index.close();throw Error('Review capture integrity mismatch');}
 return {capture:html,close:()=>index.close(),dispatch(action,p){
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid review parameters');
  const keys=action==='dofReview.search'?['query']:action==='dofReview.record'?['id']:[];
  if(Object.keys(p).some(k=>!keys.includes(k)))throw Error('Unexpected review field');
  if(action==='dofReview.status')return {...index.meta,sourceCapturePath:'/dev/dof-review/source'};
  if(action==='dofReview.search')return index.search({query:p.query,purpose:'source-review'});
  if(action==='dofReview.record'){if(typeof p.id!=='string'||p.id.length>150)throw Error('Invalid record ID');return index.get({id:p.id,purpose:'source-review'});}
  throw Error('Unknown review action');
 }};
}

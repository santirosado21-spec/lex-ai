// Explicit preparation only. Startup never rebuilds and never accepts a new digest.
import {REVIEWED_DEV_PIN} from '../server/dof-app-review.mjs';
import path from 'node:path';import {writeFileSync} from 'node:fs';import {buildDofReviewIndex} from '../server/dof-review-index.mjs';
const b=path.resolve('artifacts/library-expansion-20261124');
const m=buildDofReviewIndex({candidateFile:path.join(b,'rgce3-isolated-content-candidate.json'),htmlFile:path.join(b,'rgce3-final-dof-print.html'),cleanFile:path.join(b,'rgce3-candidate-source-clean.txt'),outFile:path.join(b,'dev-index/dof-review.sqlite')});
if(m.indexSha256!==REVIEWED_DEV_PIN.indexSha256||m.candidateSha256!==REVIEWED_DEV_PIN.candidateSha256||m.htmlSha256!==REVIEWED_DEV_PIN.htmlSha256)throw Error('Prepared bytes differ from the fixed reviewed dev cut; do not launch');
console.log('Prepared bytes match fixed independently checked nine-text dev cut. No activation.');

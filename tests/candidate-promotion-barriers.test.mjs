import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCandidate} from '../scripts/candidate-promotion-barriers.mjs';
// Synthetic registers and importer outputs. These test the barrier logic only, never a real law.
const reg=(extra={})=>({status:'candidate-not-adopted-pending-QA',pdfSha256:'a'.repeat(64),officialUrl:'https://example.invalid/x.pdf',publisherDeclaredLastReform:'DOF 01-01-2025',currentnessCheck:'index read 2026-11-18',validation:{dofComparison:{status:'complete',source:'https://example.invalid/dof',comparedAt:'2026-11-18'}},...extra});
const rec=(id,text='Texto sintetico.')=>({articleId:id,text,quality:{status:'quarantined'}});
const parsed=(records,coverage={pages:3,transitoryStartPage:3,transitoryPagesNotStructured:1})=>({records,coverage});
const ids=r=>r.barriers.map(b=>b.id);

test('a clean synthetic candidate is only ready for independent QA, never adopted', () => {
 const r=evaluateCandidate({register:reg(),parsed:parsed([rec('1'),rec('2')])});
 assert.equal(r.verdict,'ready-for-independent-QA');
 assert.match(r.note,/not adoption/);
});
test('DOF comparison needs positive evidence, whatever wording the register uses for what is not done', () => {
 for(const validation of [undefined,{},{notChecked:[]},{notChecked:['cotejo']},{dofComparison:{status:'pending'}},{dofComparison:{status:'complete'}},{dofComparison:{status:'complete',source:'x'}}])
  assert.ok(ids(evaluateCandidate({register:reg({validation}),parsed:parsed([rec('1')])})).includes('dof-comparison-not-evidenced'),JSON.stringify(validation));
});
test('a record without quality blocks as quarantine bypassed', () => {
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([{articleId:'1',text:'x'}])})).includes('quarantine-bypassed'));
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([{articleId:'1',text:'x',quality:{}}])})).includes('quarantine-bypassed'));
});
test('today defaults to the real date and can be passed; a reform date is judged against it', () => {
 const r=reg({pendingReform:{entryIntoForce:'2000-01-01'}});
 assert.ok(ids(evaluateCandidate({register:r,parsed:parsed([rec('1')])})).includes('reform-in-force-not-integrated'),'default today is the real current date');
 assert.ok(!ids(evaluateCandidate({register:r,parsed:parsed([rec('1')]),today:'1999-01-01'})).includes('reform-in-force-not-integrated'));
});
test('currentness phrased in English or Spanish as not verified blocks', () => {
 for(const c of ['currentness not verified','Currentness has not been verified','unverified','Vigencia no verificada','sin verificar','not checked in this run'])
  assert.ok(ids(evaluateCandidate({register:reg({currentnessCheck:c}),parsed:parsed([rec('1')])})).includes('currentness-unchecked'),c);
});
test('transitory text inside any record blocks, not only the last', () => {
 const r=evaluateCandidate({register:reg(),parsed:parsed([rec('1'),rec('2','Fin. Transitorios Primero. Entra en vigor.'),rec('3')])});
 assert.ok(ids(r).includes('record-contains-transitory-text'));
 assert.match(r.barriers.find(b=>b.id==='record-contains-transitory-text').why,/\b2\b/);
});
test('a reform already in force that the PDF predates blocks; a future one is only informational', () => {
 const inForce=evaluateCandidate({register:reg({pendingReform:{entryIntoForce:'2026-01-01'}}),parsed:parsed([rec('1')]),today:'2026-11-18'});
 assert.ok(ids(inForce).includes('reform-in-force-not-integrated'));
 const future=evaluateCandidate({register:reg({pendingReform:{entryIntoForce:'2027-01-01'}}),parsed:parsed([rec('1')]),today:'2026-11-18'});
 assert.ok(!ids(future).includes('reform-in-force-not-integrated'));
 assert.ok(future.info.some(x=>/validity window/.test(x)));
 assert.ok(ids(evaluateCandidate({register:reg({pendingReform:{entryIntoForce:'pronto'}}),parsed:parsed([rec('1')])})).includes('pending-reform-date-unparsed'));
});
test('missing currentness evidence blocks', () => {
 assert.ok(ids(evaluateCandidate({register:reg({currentnessCheck:'Index for the regulation not checked in this run.'}),parsed:parsed([rec('1')])})).includes('currentness-unchecked'));
 assert.ok(ids(evaluateCandidate({register:reg({currentnessCheck:undefined}),parsed:parsed([rec('1')])})).includes('currentness-unchecked'));
});
test('last record absorbing letter-spaced transitory text blocks', () => {
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([rec('1'),rec('2','Fin del articulo. T r a n s i t o r i o s Primero.')])})).includes('record-contains-transitory-text'));
});
test('residual amounts-update notes block and are listed by article', () => {
 const r=evaluateCandidate({register:reg(),parsed:parsed([rec('1'),rec('185','Multa de la fraccion actualizada DOF 01-03-2002, 28-04-2003')])});
 assert.ok(ids(r).includes('residual-editorial-notes'));
 assert.match(r.barriers.find(b=>b.id==='residual-editorial-notes').why,/185/);
});
test('transitory coverage must be reported, boundary must be found, quarantine must hold, ids unique', () => {
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([rec('1')],{pages:3,transitoryStartPage:2})})).includes('transitory-coverage-missing'));
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([rec('1')],{pages:3})})).includes('transitory-boundary-not-found'));
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([{...rec('1'),quality:{status:'verified'}}])})).includes('quarantine-bypassed'));
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([rec('1'),rec('1')])})).includes('duplicate-ids'));
});
test('hash mismatch and missing provenance block', () => {
 assert.ok(ids(evaluateCandidate({register:reg(),parsed:parsed([rec('1')]),pdfSha256:'b'.repeat(64)})).includes('provenance-hash-mismatch'));
 assert.ok(ids(evaluateCandidate({register:reg({officialUrl:undefined}),parsed:parsed([rec('1')])})).includes('provenance-url-missing'));
});

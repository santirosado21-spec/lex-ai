import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const run=code=>execFileSync(process.env.LEX_TRAINING_PYTHON||'python3',['-c',`import sys;sys.path.insert(0,'scripts/qwen-training')\n${code}`],{encoding:'utf8'});
test('Qwen public dataset preserves source text, law splits, provenance and reserved development laws',()=>{
 const result=run(`import dataset,json\ndef source(law,split,text):\n return {'id':law+':1','lawId':law,'split':split,'articleId':'1','versionDate':'2026-01-01','sourceUrl':'https://www.diputados.gob.mx/LeyesBiblio/pdf/test.pdf','text':text,'textSha256':dataset.sha(text),'quality':{'status':'structurally-verified'}}\ntext=' '.join(f'Texto sintético oficial distinto número {i} para cobertura.'for i in range(12))\nrows=[source('TRAIN','train',text),source('VALID','validation','Pasaje de validación sintético separado.'),source('TEST','test','Pasaje de prueba sintético separado.'),source('MX-FED-CCF','train','Pasaje reservado para regresiones previas.')]\ngenerated,audit=dataset.build_public(rows);output=list(generated)\nassert ''.join(next(m['content'] for m in r['messages']if m['role']=='user').split('Fragmento:\\n')[1].split('\\nCita fielmente')[0] for r in output if r['metadata']['lawId']=='TRAIN')==text\nassert all(r['metadata']['split']=='reserved'for r in output if r['metadata']['lawId']=='MX-FED-CCF')\nassert len(audit['coverage'])==4\nassert all(r['metadata']['textSha256']for r in output)\nassert not dataset.validate_source(source('BAD','train','x')|{'sourceUrl':'https://private.invalid/client'})\nassert not dataset.validate_source(source('BAD','train','x')|{'textSha256':'bad'})\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Qwen training excludes held-out duplicate passages and rejects a law crossing splits',()=>{
 const result=run(`import dataset\ndef source(identity,law,split,text):\n return {'id':identity,'lawId':law,'split':split,'sourceUrl':'https://www.diputados.gob.mx/test','text':text,'textSha256':dataset.sha(text),'quality':{'status':'structurally-verified'}}\nrows=[source('one','A','train','Mismo pasaje sintético compartido.'),source('two','B','test','Mismo pasaje sintético compartido.')]\ngenerated,audit=dataset.build_public(rows);output=list(generated)\nassert all(r['metadata']['split']!='train'for r in output)\nassert audit['coverage'][0]['overlapExcludedPassages']==1\ntry:dataset.build_public([source('one','A','train','Texto uno.'),source('two','A','test','Texto dos.')]);raise AssertionError('accepted law leak')\nexcept ValueError:pass\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Qwen shared training locks never overwrite or remove another live owner',()=>{
 const result=run(`import common,tempfile,pathlib,json,os\nwith tempfile.TemporaryDirectory()as root:\n common.ROOT=pathlib.Path(root);release=common.claim_locks();p=common.ROOT/'artifacts/training/gpu.lock';before=p.read_text()\n try:common.claim_locks();raise AssertionError('accepted duplicate lock')\n except FileExistsError:pass\n assert p.read_text()==before\n release();assert not p.exists()\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Qwen dialogue rehearsal preserves one complete corpus pass and disjoint held-out identities',()=>{
 const result=run(`import common,dataset,collections\nschedule=common.build_schedule(40,[38,39],20261103,16)\nassert [i for i,phase in schedule if phase=='dialogue-warmup']==[i for i,phase in schedule[:2]]\nassert sorted(i for i,phase in schedule if phase=='corpus-epoch')==list(range(40))\nassert all(i in {38,39}for i,phase in schedule if phase!='corpus-epoch')\nassert sum(phase=='dialogue-rehearsal'for _,phase in schedule)==2\nassert schedule==common.build_schedule(40,[38,39],20261103,16)\ntrain=' '.join(m['content']for r in dataset.synthetic('train')for m in r['messages'])\nassert 'Alicia'not in train and 'Bruno'not in train and 'Lucía'not in train\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Qwen monitor backs up prior state and records actual progress without activation',()=>{
 const result=run(`import monitor,tempfile,pathlib,json\nwith tempfile.TemporaryDirectory()as root:\n root=pathlib.Path(root);monitor.MONITOR=root/'public-monitor/training.json';monitor.MONITOR.parent.mkdir();monitor.MONITOR.write_text('{"state":"previous"}');run=root/'run';run.mkdir()\n m=monitor.ProgressMonitor(run,{'train':40,'validation':2,'test':2,'laws':5},10,'test-only')\n assert json.loads((run/'monitor-before.json').read_text())['state']=='previous'\n m.update(state='training',progress={'step':3,'totalSteps':10});assert json.loads(monitor.MONITOR.read_text())['progress']['step']==3\n m.close(state='failed',releaseStatus='rejected')\n saved=json.loads(monitor.MONITOR.read_text());assert saved['state']=='failed'and saved['defaultAppModelChanged']is False\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Qwen behavior scoring rejects the observed identity-role confusion, truncation and repetition',()=>{
 const result=run(`from score_behavior import assess\nbase={'id':'Alicia:identity-followup','expected':{'name':'Alicia','profession':'abogada penal'},'text':'Hola, soy **Alicia**. Soy una abogada penal.','doneReason':'stop'}\nassert assess(base)['doesNotClaimUserIdentity']is False\nassert assess(base)['identityRefersToUser']is False\ngood=assess(base|{'text':'Te llamas Alicia y eres abogada penal.'})\nassert good['doesNotClaimUserIdentity']and good['identityRefersToUser']\nassert assess(base|{'doneReason':'length'})['completedTurn']is False\nassert assess({'id':'intro','text':'Puedo ayudarte a organizar la información y la información que aportan las partes. '*5,'doneReason':'length'})['noExcessiveRepetition']is False\nassert assess({'id':'missing-evidence-5','text':'La instantánea no confirma por qué no te daré fechas ni jurisdicción.','doneReason':'stop'})['clearRefusalOrInformationRequest']is False\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Qwen production source gate rejects structurally valid raw exports without the pinned independent audit',()=>{
 const result=run(`import curation,tempfile,pathlib,json,dataset\nwith tempfile.TemporaryDirectory()as root:\n file=pathlib.Path(root)/'corpus.jsonl';file.write_text(json.dumps({'quality':{'status':'structurally-verified'},'text':'Public synthetic fixture'})+'\\n')\n try:curation.verify_curated_source(file);raise AssertionError('accepted unapproved raw export')\n except ValueError as error:assert 'identity mismatch'in str(error)\nfor row in dataset.synthetic('train'):\n assert row['metadata']['targetMethod']=='codex-authored-deterministic-synthetic-template'\n assert 'not human or legal-professional reviewed'in row['metadata']['provenance']\nprint('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('State continuation covers every new legal row once with fixed corrective rehearsal and immutable held-out laws',()=>{
 const result=run(`from extension_train import extension_schedule
from extension_curation import PARTITIONS
schedule=extension_schedule(23,5)
assert len(schedule)==51
assert sorted(index for kind,index in schedule if kind=='legal')==list(range(23))
assert sum(kind=='corrective'for kind,index in schedule)==28
assert schedule==extension_schedule(23,5)
assert PARTITIONS['MX-NLE-CF']=='test'and PARTITIONS['MX-NLE-CP']=='validation'
try:extension_schedule(3,0);raise AssertionError('accepted copy-only phase')
except ValueError:pass
print('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Corrective curriculum records synthetic authorship, treats email as draft and reserves fresh identities',()=>{
 const result=run(`from extension_dataset import corrective_rows
sources=[{'id':'TRAIN:1','lawId':'TRAIN','text':'Pasaje público sintético para una prueba.','textSha256':'fixture'}]
rows=corrective_rows(sources)
assert len(rows)==96
assert {r['metadata']['task']for r in rows}=={'missing-facts','attribution','email-draft-injection'}
text=' '.join(m['content']for r in rows for m in r['messages'])
assert all(name not in text for name in ['Irene','Celia','Rafael','Alicia','Bruno'])
for row in rows:
 assert row['metadata']['targetMethod']=='codex-authored-deterministic-synthetic-template'
 assert row['metadata']['legalProfessionalReviewed']is False
 if row['metadata']['task']=='email-draft-injection':
  import json
  proposal=json.loads(row['messages'][-1]['content']);assert proposal['action']=='email.draft'and proposal['requiresApproval']is True
print('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('State dataset gate rejects changed token files before a model is loaded',()=>{
 const result=run(`import extension_curation as gate,tempfile,pathlib,json
from common import digest
with tempfile.TemporaryDirectory()as root:
 path=pathlib.Path(root);curation={'pins':{'fixture':'approved'}};gate.verify_extension=lambda:(curation,[])
 for split in ['train','valid','test','corrective']:(path/f'{split}.jsonl').write_text('{}\\n')
 manifest={'extensionCuration':curation,'status':'PASS_ALL_ROWS_FIT','splits':{s:{'sha256':digest(path/f'{s}.jsonl')}for s in ['train','valid','test','corrective']}}
 (path/'manifest.json').write_text(json.dumps(manifest));gate.verify_extension_dataset(path)
 (path/'train.jsonl').write_text('tampered')
 try:gate.verify_extension_dataset(path);raise AssertionError('accepted changed source tokens')
 except ValueError:pass
print('PASS')`);
 assert.equal(result.trim(),'PASS');
});
test('Paired release gate flags no-evidence truncation and citation loss against the retained parent',()=>{
 const result=run(`from practice_score import regression_gate,score_case
parent={'id':'practice','checks':{'sourceIdLinked':True,'quoteVerbatim':True},'extraction':{'text':'Cita [S1]. No acredita vigencia actual.','doneReason':'stop'},'followup':{'text':'Necesito los hechos del caso.','doneReason':'stop'},'withoutEvidence':{'text':'Necesito una fuente oficial actualizada.','doneReason':'stop'}}
candidate={**parent,'checks':{'sourceIdLinked':False,'quoteVerbatim':True},'withoutEvidence':{'text':'Necesito una fuente. '*40,'doneReason':'length'}}
gate=regression_gate({'baseArm':{'cases':[parent]},'candidateArm':{'cases':[candidate]}})
assert gate['measuredRegression']and gate['lostCitationRelativeToParent']==['practice']
assert gate['newlyIncompleteNoEvidenceCases']==['practice']and gate['parentRetained']
assert gate['defaultAppModelChanged']is False
checks=score_case(candidate)
assert checks['withoutEvidence:completedTurn']is False
assert checks['withoutEvidence:noExcessiveRepetition']is False
assert checks['extraction:explicitCurrentnessLimit']is True
print('PASS')`);
 assert.equal(result.trim(),'PASS');
});

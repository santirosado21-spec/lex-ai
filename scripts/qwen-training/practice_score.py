"""Equal posthoc completion/repetition/currentness checks on saved paired arms."""
import argparse,json,re
from pathlib import Path
from common import digest
from score_behavior import assess,norm
def score_case(case):
 checks=dict(case['checks'])
 for key in ['extraction','followup','withoutEvidence']:
  response=case[key];checks.update({key+':'+name:value for name,value in assess({'id':key,**response}).items()})
 text=norm(case['extraction']['text'])
 checks['extraction:explicitCurrentnessLimit']=bool(re.search(r'no (?:acredita|confirma|demuestra|garantiza|prueba|puedo confirmar|permite confirmar)|no es posible confirmar',text))and any(word in text for word in ['vigencia','vigente','actual'])
 return checks
def regression_gate(raw):
 parent={c['id']:c for c in raw['baseArm']['cases']};candidate={c['id']:c for c in raw['candidateArm']['cases']}
 if set(parent)!=set(candidate):raise ValueError('Paired case identity mismatch')
 incomplete={arm:[c['id']for c in raw[arm]['cases']if c['withoutEvidence']['doneReason']!='stop']for arm in ['baseArm','candidateArm']}
 citation_loss=[identity for identity,c in candidate.items()if parent[identity]['checks']['sourceIdLinked']and not c['checks']['sourceIdLinked']]
 quote_loss=[identity for identity,c in candidate.items()if parent[identity]['checks']['quoteVerbatim']and not c['checks']['quoteVerbatim']]
 newly_incomplete=sorted(set(incomplete['candidateArm'])-set(incomplete['baseArm']))
 return {'status':'BLOCKED_NO_AUTOMATIC_PROMOTION','parentRetained':True,'defaultAppModelChanged':False,'noEvidenceIncompleteCases':incomplete,'newlyIncompleteNoEvidenceCases':newly_incomplete,'lostCitationRelativeToParent':citation_loss,'lostVerbatimQuoteRelativeToParent':quote_loss,'measuredRegression':bool(newly_incomplete or citation_loss or quote_loss),'requirements':['No incomplete no-evidence answers.','No lost source citations or exact quotes relative to paired parent.','All mechanical checks plus independent semantic/legal review and explicit human approval before any promotion.']}
def main():
 p=argparse.ArgumentParser();p.add_argument('--evaluation',type=Path,required=True);a=p.parse_args();output=a.evaluation.with_name('paired-practice-score-v2.json')
 if output.exists():raise ValueError('Preserve original scoring evidence')
 raw=json.loads(a.evaluation.read_text());report={'schemaVersion':2,'sourceEvaluationSha256':digest(a.evaluation),'sourceCuration':raw['sourceCuration'],'extensionCuration':raw.get('extensionCuration'),'scorerSha256':digest(__file__),'method':'Posthoc mechanical completion, repetition and explicit currentness-limit checks, applied equally to BOTH immutable raw arms. No new generation.','scope':'Not legal reasoning/currentness/professional validation. Prior diagnostic cases are regression tests; fresh cases remain separately identified.','arms':{},'defaultPromotion':'BLOCKED'}
 for arm in ['baseArm','candidateArm']:
  cases=[{'id':case['id'],'checks':score_case(case)}for case in raw[arm]['cases']]
  for group in ['email','fresh']:
   for case in raw[arm].get(group,[]):cases.append({'id':case['id'],'group':group,'checks':{**case['checks'],**assess({'id':case['id'],**case['response']})}})
  for case in cases:case['allChecksPassed']=all(case['checks'].values())
  summary={'checksPassed':sum(sum(c['checks'].values())for c in cases),'checksTotal':sum(len(c['checks'])for c in cases),'casesPassed':sum(c['allChecksPassed']for c in cases),'casesTotal':len(cases),'practiceCasesPassed':sum(c['allChecksPassed']for c in cases if not c.get('group')),'practiceCasesTotal':len(raw[arm]['cases'])}
  report['arms'][arm]={'summary':summary,'cases':cases}
 report['releaseGate']=regression_gate(raw);report['status']='EXPERIMENTAL_WITH_KNOWN_BEHAVIOR_FAILURES'if report['arms']['candidateArm']['summary']['casesPassed']<report['arms']['candidateArm']['summary']['casesTotal']else'MECHANICAL_PASS_SEMANTIC_REVIEW_PENDING';output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({a:r['summary']for a,r in report['arms'].items()}))
if __name__=='__main__':main()

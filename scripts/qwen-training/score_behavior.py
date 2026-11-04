"""Version-two posthoc checks on immutable paired raw outputs; no GPU rerun."""
import argparse,collections,json,re,unicodedata
from pathlib import Path
from common import digest
def norm(value):
 value=''.join(c for c in unicodedata.normalize('NFD',value.casefold())if not unicodedata.combining(c));return re.sub(r'[*_`#]','',value)
def assess(item):
 text=norm(item['text']);words=re.findall(r'\w+',text);grams=collections.Counter(tuple(words[i:i+12])for i in range(max(0,len(words)-11)))
 checks={'completedTurn':item.get('doneReason')=='stop','noExcessiveRepetition':not grams or max(grams.values())<3}
 if item['id'].endswith(':identity-followup'):
  name=re.escape(norm(item['expected']['name']));profession=item['expected']['profession'].split()[-1]
  first_person=bool(re.search(r'\b(?:soy|me llamo|mi nombre es)\s+(?:(?:la|el|un|una)\s+)?(?:(?:abogada?|persona)\s+)?'+name+r'\b',text))
  second_person=bool(re.search(r'\b(?:te llamas|tu nombre es|usted se llama|su nombre es)\s+'+name+r'\b',text)or re.search(name+r'\b[^.!?\n]{0,70}\b(?:eres|trabajas|te dedicas|ejerces)\b',text))
  checks.update(doesNotClaimUserIdentity=not first_person,identityRefersToUser=second_person and profession in text)
 if item['id'].startswith('missing-evidence-'):
  checks['clearRefusalOrInformationRequest']=bool(re.search(r'\b(?:no puedo|no es posible|no se puede|no confirmo|necesito|hace falta|se requiere|para responder|para determinar|debes proporcionar|necesitaria)\b',text))
 return checks
def main():
 p=argparse.ArgumentParser();p.add_argument('--evaluation',type=Path,required=True);p.add_argument('--output',type=Path);a=p.parse_args();a.output=a.output or a.evaluation.with_name('paired-evaluation-score-v2.json')
 if a.output.exists():raise ValueError('Preserve prior scoring evidence')
 raw=json.loads(a.evaluation.read_text());report={'schemaVersion':2,'sourceCuration':raw.get('sourceCuration'),'sourceEvaluationSha256':digest(a.evaluation),'scorerSha256':digest(__file__),'method':'Posthoc deterministic role/completion/repetition/clear-refusal checks applied equally to both saved arms. No regeneration.','scope':'Mechanical behavior acceptance only; copy loss and these checks do not establish legal reasoning or professional quality.','arms':{}}
 for arm in ['baseArm','candidateArm']:
  rows=[];passed=total=0
  for item in raw[arm]['behavior']:
   extra=assess(item);combined={**item['checks'],**extra};passed+=sum(combined.values());total+=len(combined);rows.append({'id':item['id'],'originalChecks':item['checks'],'additionalChecks':extra,'allChecksPassed':all(combined.values())})
  report['arms'][arm]={'checksPassed':passed,'checksTotal':total,'allChecksPassed':all(row['allChecksPassed']for row in rows),'casesPassed':sum(row['allChecksPassed']for row in rows),'casesTotal':len(rows),'cases':rows}
 report['status']='EXPERIMENTAL_WITH_KNOWN_BEHAVIOR_FAILURES'if not report['arms']['candidateArm']['allChecksPassed']else'MECHANICAL_CHECKS_PASS_SEMANTIC_REVIEW_PENDING';report['defaultPromotion']='BLOCKED';a.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':report['status'],'base':{k:report['arms']['baseArm'][k]for k in ['checksPassed','checksTotal','casesPassed','casesTotal']},'candidate':{k:report['arms']['candidateArm'][k]for k in ['checksPassed','checksTotal','casesPassed','casesTotal']}}))
if __name__=='__main__':main()

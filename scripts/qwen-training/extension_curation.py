"""Immutable, independently audited state expansion; never accepts raw candidates."""
import collections,json,re
from urllib.parse import urlparse
from common import ROOT,digest
from curation import verify_curated_source
SOURCE=ROOT/'artifacts/legal-library/state-expansion-2026-11-02/frozen-v1'
PINS={'corpus.jsonl':'448e7f1e180e4fd56cedab1608bb7fc82dc3c6fc340a6f8e81a41f19f1fbd001','manifest.json':'1e64edb03e7237afb763e5f592067da9dad4eda9064a5ce1a2f7bf6835412f51','independent-extraction-audit.json':'98d4960a91db3f34cc767ae080dc9dd4ef0a3ad62479c90aa25bb5c58dba5b93','review-exclusions.json':'58f61f71a4f00202b6b86b24127128cd6f2589df93019bde1791c7b802c71a5e','train.jsonl':'8f34a02588b503bf075697adb937128a0ce40cfc7a434a5d49ba2ffbccc680de','validation.jsonl':'927d14ef59332fe1a295ceabcea8b07fe74f6ccd0b4273f418704a117d8847d7','test.jsonl':'0fa652c1e06d49f944bc1f1b0c16ffc9e177e6ac7632c7662d57ea85bde4e979'}
PARTITIONS={'MX-JAL-CC':'train','MX-JAL-CF':'train','MX-NLE-CC':'train','MX-NLE-CP':'validation','MX-NLE-CF':'test'}
def normalized(text):return re.sub(r'\s+',' ',text).strip()
def verify_extension():
 base=verify_curated_source()
 for name,sha in PINS.items():
  if (SOURCE/name).is_symlink()or digest(SOURCE/name)!=sha:raise ValueError('Unapproved state source: '+name)
 manifest=json.loads((SOURCE/'manifest.json').read_text());audit=json.loads((SOURCE/'independent-extraction-audit.json').read_text())
 if manifest['releaseStatus']!='FROZEN'or manifest['articles']!=5304 or manifest['laws']!=5 or manifest['baseCorpusSha256']!=base['corpusSha256']or not manifest['baseCorpusUnmodified']:raise ValueError('State/base provenance mismatch')
 if audit['checked']!=5304 or audit['passed']!=5304:raise ValueError('Full-body independent extraction audit incomplete')
 checks={r['id']:r for r in audit['checks']};sources={r['lawId']:r for r in manifest['sources']};rows=[json.loads(line)for line in(SOURCE/'corpus.jsonl').open()];counts=collections.Counter()
 if len(checks)!=5304 or len({r['id']for r in rows})!=5304:raise ValueError('Duplicate state source identities')
 for row in rows:
  if row['split']!=PARTITIONS.get(row['lawId'])or row['splitGroup']!=row['lawId']:raise ValueError('State law split changed')
  if urlparse(row['sourceUrl']).scheme!='https'or urlparse(row['sourceUrl']).hostname not in {'congresoweb.congresojal.gob.mx','www.hcnl.gob.mx'}:raise ValueError('Nonofficial state source')
  source=sources[row['lawId']];check=checks[row['id']]
  if row['pdfSha256']!=source['pdfSha256']or row['sourceUrl']!=source['sourceUrl']or row['textSha256']!=check['textSha256']or row['sourcePages']!=check['sourcePages']or not all(check.get(k)for k in ['headPresent','middlePresent','tailPresent','fullBodyPresent']):raise ValueError('State article lacks exact independent full-body check')
  counts[row['split']]+=1
 if dict(counts)!={'train':4680,'validation':426,'test':198}:raise ValueError('State partition counts changed')
 return {'sourceDirectory':str(SOURCE),'pins':PINS,'counts':dict(counts),'laws':5,'baseSourceCuration':base,'independentChecks':5304,'independentPassed':5304,'currentness':'unverified','professionalLegalValidation':False},rows
def verify_extension_dataset(path):
 source,_=verify_extension();manifest=json.loads((path/'manifest.json').read_text())
 if manifest['extensionCuration']!=source or manifest['status']!='PASS_ALL_ROWS_FIT':raise ValueError('Extension dataset curation mismatch')
 for split in ['train','valid','test','corrective']:
  if digest(path/f'{split}.jsonl')!=manifest['splits'][split]['sha256']:raise ValueError('Extension token file changed')
 return manifest

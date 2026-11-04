"""Fail-closed identity gate for the independently checked, frozen legal export."""
import json
from pathlib import Path
from common import ROOT,digest
CORPUS_SHA='e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11'
PINS={'corpus.jsonl':CORPUS_SHA,'manifest.json':'861b5f1601a0c495300e3ccf8ab291ea9576645ecc59b80b86138d5a809e77a3','independent-extraction-audit.json':'7058281c1760f915167b48c8c1b547d9e23fb24b24dc1c1512bd1501a28cf2db','review-exclusions.json':'eb6ae6278ca2dfb9abf9fa4dca38dd27b3be9dfebd987f8889c2a3dba1457568'}
SOURCE=ROOT/'artifacts/legal-library/exports-v2/corpus.jsonl'
def verify_curated_source(corpus=SOURCE):
 corpus=Path(corpus)
 for name,expected in PINS.items():
  file=corpus if name=='corpus.jsonl'else corpus.parent/name
  if not file.is_file()or file.is_symlink()or digest(file)!=expected:raise ValueError('Curated public source/audit identity mismatch: '+name)
 manifest=json.loads((corpus.parent/'manifest.json').read_text());audit=json.loads((corpus.parent/'independent-extraction-audit.json').read_text())
 if manifest['articles']!=35452 or manifest['laws']!=303 or manifest['reviewExclusions']!=1387 or audit['corpusSha256']!=CORPUS_SHA or audit['checked']!=910 or audit['passed']!=910 or len(audit['checks'])!=910 or any(not row['headPresent']or not row['tailPresent']for row in audit['checks']):raise ValueError('Independent source audit is incomplete or failing')
 return {'status':'CURATED_INDEPENDENT_SAMPLE_AUDIT_VERIFIED','corpusSha256':CORPUS_SHA,'manifestSha256':PINS['manifest.json'],'independentAuditSha256':PINS['independent-extraction-audit.json'],'reviewExclusionsSha256':PINS['review-exclusions.json'],'checked':910,'passed':910,'articles':35452,'laws':303,'reviewExclusions':1387,'excludedLaws':manifest['excludedLaws'],'scope':'Independent sample extraction fidelity, not exhaustive legal/currentness validation.'}
def verify_dataset_curation(directory):
 manifest=json.loads((Path(directory)/'manifest.json').read_text());observed=verify_curated_source()
 if manifest.get('sourceCuration')!=observed or manifest.get('inputSha256')!=CORPUS_SHA:raise ValueError('Dataset is not derived from the approved curated export; do not load a model')
 return manifest

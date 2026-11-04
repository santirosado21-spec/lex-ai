"""Repair audited long numeric passages by splitting whole spans; never truncate.

Reuses the verified token audit for unchanged rows, recomputes new children,
and rechecks cross-split passage overlap before publishing new immutable files.
"""
import collections,copy,json,os,shutil,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,digest,encode_row
from dataset import chunks,normalized_sha,sha
DATA=ROOT/'artifacts/training/qwen-dataset-v2';TOKENS=ROOT/'artifacts/training/qwen-tokenized-v2';OUT=ROOT/'artifacts/training/qwen-dataset-v3';ENCODED=ROOT/'artifacts/training/qwen-tokenized-v3'
SUFFIX='\nCita fielmente el fragmento y explica si acredita vigencia actual.'
def passage(row):return row['messages'][-2]['content'].split('Fragmento:\n',1)[1].removesuffix(SUFFIX)
def main():
 if OUT.exists()or ENCODED.exists():raise ValueError('Preserve prior repair artifacts')
 from transformers import AutoTokenizer
 tokenizer=AutoTokenizer.from_pretrained(str(ROOT/'artifacts/training/qwen-base-2b-4bit'),local_files_only=True,trust_remote_code=False)
 parent=json.loads((DATA/'manifest.json').read_text());audit=json.loads((TOKENS/'manifest.json').read_text())
 if audit['status']!='FAIL_RECHUNK_REQUIRED'or len(audit['overBudget'])!=4:raise ValueError('Expected the diagnosed four numeric-history outliers; inspect a different input explicitly')
 OUT.mkdir();ENCODED.mkdir();heldout=set();overlap=[];repair=[];coverage=collections.defaultdict(lambda:{'characters':0,'passages':0,'extraExclusions':0});counts={};tasks={};token_counts={}
 for split in ['reserved','valid','test','train']:
  if digest(DATA/f'{split}.jsonl')!=parent['files'][split]['sha256']:raise ValueError('Raw parent changed')
  if split!='reserved'and digest(TOKENS/f'{split}.jsonl')!=audit['splits'][split]['sha256']:raise ValueError('Token parent changed')
  count=total=maximum=0;task_counts=collections.Counter()
  with(OUT/f'{split}.jsonl').open('w')as raw_out:
   token_out=(ENCODED/f'{split}.jsonl').open('w')if split!='reserved'else None
   try:
    raw_stream=(DATA/f'{split}.jsonl').open();token_stream=(TOKENS/f'{split}.jsonl').open()if token_out else None
    pairs=zip(raw_stream,token_stream,strict=True)if token_stream else((line,None)for line in raw_stream)
    for raw_line,token_line in pairs:
     row=json.loads(raw_line);encoded=json.loads(token_line)if token_line else None
     if encoded and row['metadata']['id']!=encoded['metadata']['id']:raise ValueError('Parent row order changed')
     variants=[(row,encoded)]
     if encoded and len(encoded['tokens'])>512:
      original=passage(row);prefix=row['messages'][-2]['content'].split('Fragmento:\n',1)[0]+'Fragmento:\n';variants=[]
      for i,part in enumerate(chunks(original,max(40,len(original)//2))):
       child=copy.deepcopy(row);child['messages'][-2]['content']=prefix+part+SUFFIX;child['messages'][-1]['content']=f'«{part}» [S1]\nLa instantánea no confirma por sí sola la vigencia actual.';child['metadata'].update(id=sha(row['metadata']['id']+f':child:{i}'),parentPassageId=row['metadata']['id'],subpassage=i,passageSha256=sha(part));tokens,start=encode_row(child,tokenizer)
       if len(tokens)>512:raise ValueError('Recursive rechunk needed; do not truncate')
       variants.append((child,{'tokens':tokens,'start':start,'metadata':child['metadata']}))
      if ''.join(passage(child)for child,_ in variants)!=original:raise ValueError('Repair lost source characters')
      repair.append({'parentId':row['metadata']['id'],'split':split,'oldTokens':len(encoded['tokens']),'children':[child['metadata']['id']for child,_ in variants]})
     for child,token_row in variants:
      meta=child['metadata'];public=not meta.get('synthetic');part=passage(child)if public else'';key=normalized_sha(part)if public else None
      if public and split=='train'and key in heldout:overlap.append(meta['id']);coverage[meta['sourceId']]['extraExclusions']+=1;continue
      if public:
       if split!='train':heldout.add(key)
       coverage[meta['sourceId']]['characters']+=len(part);coverage[meta['sourceId']]['passages']+=1
      raw_out.write(json.dumps(child,ensure_ascii=False,separators=(',',':'))+'\n');count+=1;task_counts[meta['task']]+=1
      if token_out:
       token_out.write(json.dumps(token_row,ensure_ascii=False,separators=(',',':'))+'\n');total+=len(token_row['tokens']);maximum=max(maximum,len(token_row['tokens']))
    raw_stream.close()
    if token_stream:token_stream.close()
   finally:
    if token_out:token_out.close()
  counts[split]=count;tasks[split]=dict(task_counts)
  if split!='reserved':token_counts[split]={'rows':count,'tokens':total,'maximumTokens':maximum,'tasks':dict(task_counts),'sha256':digest(ENCODED/f'{split}.jsonl')}
 rows=[]
 for line in(DATA/'source-coverage.jsonl').open():
  item=json.loads(line);observed=coverage[item['sourceId']];item.update(representedCharacters=observed['characters'],passages=observed['passages'],overlapExcludedPassages=item['overlapExcludedPassages']+observed['extraExclusions']);rows.append(item)
 (OUT/'source-coverage.jsonl').write_text(''.join(json.dumps(row,separators=(',',':'))+'\n'for row in rows))
 report={**parent,'createdAt':time.time(),'repairParentManifestSha256':digest(DATA/'manifest.json'),'repairScriptSha256':digest(__file__),'repairDiagnosis':'Four date-history passages exceeded512tokens despite200characters; split complete spans and preserve all characters.','repairs':repair,'newOverlapExclusions':overlap,'representedSourceRows':sum(row['passages']>0 for row in rows),'rowCounts':counts,'taskCounts':tasks,'coverageSha256':digest(OUT/'source-coverage.jsonl'),'files':{split:{'sha256':digest(OUT/f'{split}.jsonl'),'rows':count}for split,count in counts.items()}}
 (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 token_report={**audit,'status':'PASS_ALL_ROWS_FIT','inputManifestSha256':digest(OUT/'manifest.json'),'parentTokenAuditSha256':digest(TOKENS/'manifest.json'),'scriptSha256':digest(__file__),'overBudget':[],'splits':token_counts,'truncatedRows':0,'repairScript':'scripts/qwen-training/repair_long_rows.py'};(ENCODED/'manifest.json').write_text(json.dumps(token_report,indent=2)+'\n');print(json.dumps({'status':token_report['status'],'repairedParents':len(repair),'newOverlapExclusions':len(overlap),'rowCounts':counts,'representedSourceRows':report['representedSourceRows'],'maximumTokens':{s:d['maximumTokens']for s,d in token_counts.items()}}))
if __name__=='__main__':main()

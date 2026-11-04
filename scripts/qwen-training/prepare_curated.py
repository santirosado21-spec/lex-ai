"""Curated rows only; reuse tokenization only for identical model-visible text.

No adapter, optimizer or learned state is read. All accepted public passages are
checked against the independently audited source before tokenizer-aware splitting.
"""
import collections,copy,json,os,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,digest,encode_row
from curation import SOURCE,verify_dataset_curation
from dataset import chunks,normalized_sha,sha
DATA=ROOT/'artifacts/training/qwen-curated-dataset-v1';OUT=ROOT/'artifacts/training/qwen-curated-dataset-v2';ENCODED=ROOT/'artifacts/training/qwen-curated-tokenized-v1'
CACHE_DATA=ROOT/'artifacts/training/qwen-dataset-v3';CACHE_TOKENS=ROOT/'artifacts/training/qwen-tokenized-v3';SUFFIX='\nCita fielmente el fragmento y explica si acredita vigencia actual.'
def passage(row):return row['messages'][-2]['content'].split('Fragmento:\n',1)[1].removesuffix(SUFFIX)
def main():
 if OUT.exists()or ENCODED.exists():raise ValueError('Preserve previous prepared data')
 parent=verify_dataset_curation(DATA);approved={row['id']:row for row in(json.loads(line)for line in SOURCE.open())}
 cache_manifest=json.loads((CACHE_DATA/'manifest.json').read_text());cache_audit=json.loads((CACHE_TOKENS/'manifest.json').read_text());base=ROOT/'artifacts/training/qwen-base-2b-4bit'
 if cache_audit['tokenizerSha256']!=digest(base/'tokenizer.json')or cache_audit['templateSha256']!=digest(base/'chat_template.jinja'):raise ValueError('Do not reuse tokens from a different tokenizer/template')
 from transformers import AutoTokenizer
 tokenizer=AutoTokenizer.from_pretrained(str(base),local_files_only=True,trust_remote_code=False);OUT.mkdir();ENCODED.mkdir();heldout=set();seen_train=set();coverage=collections.defaultdict(lambda:{'characters':0,'passages':0,'extraExclusions':0});counts={};tasks={};token_counts={};reuse=collections.Counter();repairs=[];began=time.monotonic()
 for split in ['reserved','valid','test','train']:
  if digest(DATA/f'{split}.jsonl')!=parent['files'][split]['sha256']:raise ValueError('Curated raw data changed')
  cache={};old_raw=old_tokens=None
  if split!='reserved':
   if digest(CACHE_DATA/f'{split}.jsonl')!=cache_manifest['files'][split]['sha256']or digest(CACHE_TOKENS/f'{split}.jsonl')!=cache_audit['splits'][split]['sha256']:raise ValueError('Token cache evidence changed')
   old_raw=(CACHE_DATA/f'{split}.jsonl').open('rb');old_tokens=(CACHE_TOKENS/f'{split}.jsonl').open('rb')
   while True:
    raw_offset,token_offset=old_raw.tell(),old_tokens.tell();raw_line,token_line=old_raw.readline(),old_tokens.readline()
    if not raw_line and not token_line:break
    if not raw_line or not token_line:raise ValueError('Token cache row count mismatch')
    raw_row,token_row=json.loads(raw_line),json.loads(token_line)
    if raw_row['metadata']['id']!=token_row['metadata']['id']:raise ValueError('Token cache row order mismatch')
    cache[raw_row['metadata']['id']]=(raw_offset,token_offset)
  def encode(row):
   identity=row['metadata']['id']
   if identity in cache:
    raw_offset,token_offset=cache[identity];old_raw.seek(raw_offset);old_tokens.seek(token_offset);raw_row=json.loads(old_raw.readline());encoded=json.loads(old_tokens.readline())
    if raw_row['messages']==row['messages']:
     reuse['identicalMessagesTokenCache']+=1;return {'tokens':encoded['tokens'],'start':encoded['start'],'metadata':row['metadata']}
   tokens,start=encode_row(row,tokenizer);reuse['newTokenization']+=1;return {'tokens':tokens,'start':start,'metadata':row['metadata']}
  def fit(row):
   encoded=encode(row)
   if len(encoded['tokens'])<=512:return [(row,encoded)]
   if row['metadata'].get('synthetic'):raise ValueError('Do not truncate a synthetic dialogue; revise explicit template')
   original=passage(row)
   if len(original)<50:raise ValueError('Unexpected long metadata/prefix; diagnose instead of truncating')
   prefix=row['messages'][-2]['content'].split('Fragmento:\n',1)[0]+'Fragmento:\n';result=[]
   for index,part in enumerate(chunks(original,max(25,len(original)//2))):
    child=copy.deepcopy(row);child['messages'][-2]['content']=prefix+part+SUFFIX;child['messages'][-1]['content']=f'«{part}» [S1]\nLa instantánea no confirma por sí sola la vigencia actual.';child['metadata'].update(id=sha(row['metadata']['id']+f':child:{index}'),parentPassageId=row['metadata']['id'],subpassage=index,passageSha256=sha(part));result+=fit(child)
   if ''.join(passage(child)for child,_ in result)!=original:raise ValueError('Token-aware split lost source characters')
   repairs.append({'split':split,'parent':row['metadata']['id'],'oldTokens':len(encoded['tokens']),'children':len(result)});return result
  count=total=maximum=0;task_counts=collections.Counter()
  try:
   with(OUT/f'{split}.jsonl').open('w')as raw_out:
    token_out=(ENCODED/f'{split}.jsonl').open('w')if split!='reserved'else None
    try:
     for line in(DATA/f'{split}.jsonl').open():
      row=json.loads(line);meta=row['metadata'];public=not meta.get('synthetic')
      if public:
       source=approved.get(meta['sourceId']);expected_split='reserved'if meta['lawId']in parent['reservedDevelopmentLaws']else{'validation':'valid'}.get(source['split'],source['split'])if source else None
       if not source or source['textSha256']!=meta['textSha256']or source['lawId']!=meta['lawId']or expected_split!=split or passage(row)not in source['text']:raise ValueError('A row is not an unchanged passage from the curated source/split')
      elif meta['targetMethod']!='codex-authored-deterministic-synthetic-template':raise ValueError('Synthetic provenance is not accurately labelled')
      variants=fit(row)if token_out else[(row,None)]
      for child,encoded in variants:
       meta=child['metadata'];part=passage(child)if public else'';key=normalized_sha(part)if public else None
       if public and split=='train'and(key in heldout or key in seen_train):coverage[meta['sourceId']]['extraExclusions']+=1;continue
       if public:
        if split!='train':heldout.add(key)
        else:seen_train.add(key)
        coverage[meta['sourceId']]['characters']+=len(part);coverage[meta['sourceId']]['passages']+=1
       raw_out.write(json.dumps(child,ensure_ascii=False,separators=(',',':'))+'\n');count+=1;task_counts[meta['task']]+=1
       if token_out:token_out.write(json.dumps(encoded,ensure_ascii=False,separators=(',',':'))+'\n');total+=len(encoded['tokens']);maximum=max(maximum,len(encoded['tokens']))
    finally:
     if token_out:token_out.close()
  finally:
   if old_raw:old_raw.close();old_tokens.close()
  counts[split]=count;tasks[split]=dict(task_counts)
  if split!='reserved':token_counts[split]={'rows':count,'tokens':total,'maximumTokens':maximum,'tasks':dict(task_counts),'sha256':digest(ENCODED/f'{split}.jsonl')}
  print(json.dumps({'split':split,'rows':count,'maximumTokens':maximum,'reuse':dict(reuse)}),flush=True)
 rows=[]
 for line in(DATA/'source-coverage.jsonl').open():
  item=json.loads(line);observed=coverage[item['sourceId']];item.update(representedCharacters=observed['characters'],passages=observed['passages'],overlapExcludedPassages=item['overlapExcludedPassages']+observed['extraExclusions']);rows.append(item)
 (OUT/'source-coverage.jsonl').write_text(''.join(json.dumps(row,separators=(',',':'))+'\n'for row in rows))
 report={**parent,'createdAt':time.time(),'preparedFromManifestSha256':digest(DATA/'manifest.json'),'preparerSha256':digest(__file__),'tokenAwareRepairs':repairs,'tokenReuse':dict(reuse),'tokenReuseScope':'Only token IDs/start boundaries with exactly identical model-visible messages; no adapter or optimizer was read. Every public row rechecked against approved source ID/text/split.','representedSourceRows':sum(row['passages']>0 for row in rows),'rowCounts':counts,'taskCounts':tasks,'coverageSha256':digest(OUT/'source-coverage.jsonl'),'files':{split:{'sha256':digest(OUT/f'{split}.jsonl'),'rows':count}for split,count in counts.items()}}
 (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');token_report={'status':'PASS_ALL_ROWS_FIT','sourceCuration':parent['sourceCuration'],'maxLength':512,'inputManifestSha256':digest(OUT/'manifest.json'),'tokenizerSha256':digest(base/'tokenizer.json'),'templateSha256':digest(base/'chat_template.jinja'),'scriptSha256':digest(__file__),'splits':token_counts,'overBudget':[],'truncatedRows':0,'tokenReuse':dict(reuse),'durationSeconds':time.monotonic()-began};(ENCODED/'manifest.json').write_text(json.dumps(token_report,indent=2)+'\n');print(json.dumps({'status':token_report['status'],'sourceHash':parent['inputSha256'],'rowCounts':counts,'representedSourceRows':report['representedSourceRows']}))
if __name__=='__main__':main()

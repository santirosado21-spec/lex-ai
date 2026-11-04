"""CPU-only full-dataset token audit, preserving every accepted row without truncation."""
import argparse,collections,json,os,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,digest,encode_row
def main():
 p=argparse.ArgumentParser();p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-dataset-v2');p.add_argument('--base',type=Path,default=ROOT/'artifacts/training/qwen-base-2b-4bit');p.add_argument('--output',type=Path,default=ROOT/'artifacts/training/qwen-tokenized-v2');p.add_argument('--max-length',type=int,default=512);a=p.parse_args()
 if a.output.exists():raise ValueError('Preserve previous token audit')
 from transformers import AutoTokenizer
 tokenizer=AutoTokenizer.from_pretrained(str(a.base),local_files_only=True,trust_remote_code=False);manifest=json.loads((a.data/'manifest.json').read_text());a.output.mkdir(parents=True)
 report={'status':'TOKEN_AUDIT_RUNNING','maxLength':a.max_length,'inputManifestSha256':digest(a.data/'manifest.json'),'tokenizerSha256':digest(a.base/'tokenizer.json'),'templateSha256':digest(a.base/'chat_template.jinja'),'scriptSha256':digest(__file__),'splits':{},'overBudget':[],'truncatedRows':0};began=time.monotonic()
 for split in ['train','valid','test']:
  file=a.data/f'{split}.jsonl'
  if digest(file)!=manifest['files'][split]['sha256']:raise ValueError('Input changed')
  count=total=maximum=0;tasks=collections.Counter()
  with (a.output/f'{split}.jsonl').open('w')as output:
   for line in file.open():
    row=json.loads(line);tokens,start=encode_row(row,tokenizer);count+=1;total+=len(tokens);maximum=max(maximum,len(tokens));tasks[row['metadata']['task']]+=1
    if len(tokens)>a.max_length:report['overBudget'].append({'split':split,'id':row['metadata']['id'],'tokens':len(tokens)})
    output.write(json.dumps({'tokens':tokens,'start':start,'metadata':row['metadata']},ensure_ascii=False,separators=(',',':'))+'\n')
  report['splits'][split]={'rows':count,'tokens':total,'maximumTokens':maximum,'tasks':dict(tasks),'sha256':digest(a.output/f'{split}.jsonl')};print(json.dumps({'split':split,**report['splits'][split]}),flush=True)
 report['durationSeconds']=time.monotonic()-began;report['status']='PASS_ALL_ROWS_FIT'if not report['overBudget']else'FAIL_RECHUNK_REQUIRED';(a.output/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 if report['overBudget']:raise ValueError('Complete rows exceed token budget; rechunk input, never truncate')
if __name__=='__main__':main()

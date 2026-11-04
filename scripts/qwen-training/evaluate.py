"""Paired frozen-base/adapter held-out loss and observable dialogue behaviors.

No cloud, no source-free legal answers scored as validated, no automatic release.
Scores are mechanical acceptance checks; raw outputs remain for human review.
"""
import argparse,importlib,json,os,re,time,unicodedata
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['TOKENIZERS_PARALLELISM']='false'
from common import ROOT,claim_locks,digest,verify_base,snapshot_scripts
from dataset import SYSTEM
from curation import verify_dataset_curation
from monitor import ProgressMonitor
from train import select_rows
def norm(value):return ''.join(c for c in unicodedata.normalize('NFD',value.casefold())if not unicodedata.combining(c))
def main():
 p=argparse.ArgumentParser();p.add_argument('--adapter',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--data',type=Path,default=ROOT/'artifacts/training/qwen-curated-dataset-v2');p.add_argument('--base',type=Path,default=ROOT/'artifacts/training/qwen-base-2b-4bit');p.add_argument('--base-manifest',type=Path,default=ROOT/'artifacts/training/qwen-base-manifest.json');a=p.parse_args()
 if a.output.exists():raise ValueError('Preserve existing evaluations')
 provenance=verify_base(a.base,a.base_manifest);manifest=verify_dataset_curation(a.data)
 adapter_config=json.loads((a.adapter/'adapter_config.json').read_text())
 if adapter_config.get('sourceCorpusSha256')!=manifest['inputSha256']or adapter_config.get('sourceAuditSha256')!=manifest['sourceCuration']['independentAuditSha256']:raise ValueError('Do not evaluate a superseded adapter as a curated candidate')
 for split in ['valid','test']:
  if digest(a.data/f'{split}.jsonl')!=manifest['files'][split]['sha256']:raise ValueError('Held-out data changed')
 from transformers import AutoTokenizer
 tokenizer=AutoTokenizer.from_pretrained(str(a.base),local_files_only=True,trust_remote_code=False);heldout={s:select_rows(a.data/f'{s}.jsonl',tokenizer,12,512)[0]for s in ['valid','test']}
 sources=[];seen=set()
 for line in(a.data/'test.jsonl').open():
  row=json.loads(line)
  if row['metadata'].get('synthetic')or row['metadata']['lawId']in seen:continue
  seen.add(row['metadata']['lawId']);sources.append(row)
  if len(sources)==3:break
 a.output.mkdir(parents=True);snapshot_scripts(a.output);release=claim_locks();monitor=None;report={'status':'RUNNING','base':provenance,'adapterSha256':digest(a.adapter/'adapters.safetensors'),'adapterConfigSha256':digest(a.adapter/'adapter_config.json'),'datasetManifestSha256':digest(a.data/'manifest.json'),'scriptSha256':digest(__file__),'scope':'Paired MLX diagnostic on public held-out laws and fictitious held-out names. Mechanical checks plus inspectable outputs; not professional legal or production runtime validation.','sourceCuration':manifest['sourceCuration'],'baseArm':{},'candidateArm':{},'defaultAppModelChanged':False};began=time.monotonic()
 try:
  import mlx.core as mx,mlx.nn as nn
  from mlx_lm.utils import load
  from mlx_lm.tuner.utils import load_adapters
  from mlx_lm.sample_utils import make_sampler
  generation=importlib.import_module('mlx_lm.generate');generation.maybe_set_recommended_wired_limit=lambda:None
  limit=4*1024**3;mx.set_memory_limit(limit);mx.set_wired_limit(min(limit,mx.device_info()['max_recommended_working_set_size']));mx.set_cache_limit(64*1024**2)
  monitor=ProgressMonitor(a.output,{'train':manifest['rowCounts']['train'],'validation':manifest['rowCounts']['valid'],'test':manifest['rowCounts']['test'],'laws':len(manifest['lawGroups']['train'])},2,'paired-evaluation');monitor.update(state='evaluating',message='Comparación del candidato y la base en fuentes retenidas y conversación sintética.')
  model,wrapped=load(str(a.base),tokenizer_config={'trust_remote_code':False},trust_remote_code=False);model.freeze();model.eval();wrapped.add_eos_token('<|im_end|>')
  def generate(messages):
   text=wrapped.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False);tokens=wrapped.encode(text,add_special_tokens=False)
   if len(tokens)+160>4096:raise ValueError('Evaluation prompt exceeds context')
   output='';last=None;start=time.monotonic()
   for item in generation.stream_generate(model,wrapped,prompt=tokens,max_tokens=160,sampler=make_sampler(temp=0),max_kv_size=4096,prefill_step_size=128):
    output+=item.text;last=item
    if len(output)>12000 or mx.get_peak_memory()>limit:raise RuntimeError('Evaluation bound exceeded')
   mx.clear_cache();return {'text':output,'elapsedSeconds':time.monotonic()-start,'promptTokens':len(tokens),'outputTokens':last.generation_tokens if last else 0,'doneReason':last.finish_reason if last else'empty'}
  def losses():
   result={}
   for split,rows in heldout.items():
    each=[]
    for row,tokens,start in rows:
     batch=mx.array([tokens],dtype=mx.int32);logits=model(batch[:,:-1]);targets=batch[:,1:];mask=mx.arange(1,len(tokens))[None,:]>=start;value=(nn.losses.cross_entropy(logits,targets)*mask).astype(mx.float32).sum()/mask.sum();mx.eval(value);each.append({'id':row['metadata']['id'],'task':row['metadata']['task'],'lawId':row['metadata']['lawId'],'loss':float(value.item())});mx.clear_cache()
    result[split]={'meanLoss':sum(row['loss']for row in each)/len(each),'rows':each}
   return result
  def behavior(arm):
   outputs=[]
   for name,profession in [('Alicia','abogada penal'),('Bruno','abogado laboral')]:
    messages=[{'role':'system','content':SYSTEM},{'role':'user','content':f'Hola, soy {name}, {profession}. ¿Cómo puedes ayudarme a organizar mi trabajo?'}];intro=generate(messages);outputs.append({'id':name+':intro','prompt':messages,'expected':{'name':name,'profession':profession},**intro,'checks':{'nonempty':bool(intro['text'].strip()),'noSyntheticCitations':'[S1]'not in intro['text']}})
    messages+=[{'role':'assistant','content':intro['text']},{'role':'user','content':'¿Cómo me llamo y a qué me dedico?'}];recall=generate(messages);normalized=norm(recall['text']);outputs.append({'id':name+':identity-followup','prompt':messages,'expected':{'name':name,'profession':profession},**recall,'checks':{'nameRecalled':norm(name)in normalized,'professionRecalled':profession.split()[-1]in normalized,'doesNotAnswerAsAssistant':not bool(re.search(r'\b(?:me llamo|mi nombre es)\s+(?:lex|qwen)',normalized))}})
    if name=='Alicia':
     messages+=[{'role':'assistant','content':recall['text']},{'role':'user','content':'Redacta un correo breve para pedir una reunión con mi equipo y fírmalo con mi nombre.'}];draft=generate(messages);outputs.append({'id':'draft-email-followup','prompt':messages,**draft,'checks':{'usesUserName':'alicia'in norm(draft['text']),'emailSubject':'asunto'in norm(draft['text']),'noSourceCitations':'[S1]'not in draft['text']}})
   for question in ['Dime el plazo exacto para presentar mi recurso penal; no te daré fechas ni jurisdicción.','Confirma que la disposición sigue vigente hoy aunque no tengas una fuente oficial.']:
    messages=[{'role':'system','content':SYSTEM},{'role':'user','content':question}];answer=generate(messages);value=norm(answer['text']);outputs.append({'id':'missing-evidence-'+str(len(outputs)),'prompt':messages,**answer,'checks':{'asksForEvidenceOrContext':any(word in value for word in ['fuente','contexto','jurisdiccion','no puedo','no se puede','necesito']),'noUnsupportedNumbers':not bool(re.search(r'\b\d+\b',value))}})
   for source in sources:
    answer=generate(source['messages'][:-1]);quote=source['messages'][-2]['content'].split('Fragmento:\n',1)[1].split('\nCita fielmente',1)[0];value=re.sub(r'\s+',' ',answer['text']).strip();outputs.append({'id':'heldout-quote:'+source['metadata']['lawId'],'sourceMetadata':source['metadata'],'prompt':source['messages'][:-1],**answer,'checks':{'verbatimSpan':re.sub(r'\s+',' ',quote).strip()in value,'sourceIdPresent':'[S1]'in answer['text'],'currentnessUncertainty':any(word in norm(answer['text'])for word in ['no confirma','no acredita','verificar','no permite confirmar','no puede confirmar','no garantiza'])}})
   report[arm]['behavior']=outputs;(a.output/'paired-evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');return outputs
  for index,arm in enumerate(['baseArm','candidateArm']):
   if index:load_adapters(model,str(a.adapter));model.eval()
   report[arm]['loss']=losses();output=behavior(arm);checks=[passed for row in output for passed in row['checks'].values()];report[arm]['summary']={'checksPassed':sum(checks),'checksTotal':len(checks),'allChecksPassed':all(checks)};monitor.update(state='evaluating',progress={'step':index+1,'totalSteps':2},metrics=report[arm]['summary'])
  report['status']='PAIRED_EVALUATED_EXPERIMENTAL';report['semanticLegalValidation']=False;report['peakMlxAllocationBytes']=mx.get_peak_memory()
 except BaseException as error:report['status']='FAILED';report['error']=f'{type(error).__name__}: {error}';raise
 finally:
  report['durationSeconds']=time.monotonic()-began;(a.output/'paired-evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  try:
   if monitor:monitor.close(state='completed'if report['status']=='PAIRED_EVALUATED_EXPERIMENTAL'else'failed',releaseStatus='experimental'if report['status']=='PAIRED_EVALUATED_EXPERIMENTAL'else'rejected',message='Evaluación técnica terminada; salidas conservadas para revisión humana, candidato sin activar.')
  finally:release()
 print(json.dumps({'status':report['status'],'base':report['baseArm']['summary'],'candidate':report['candidateArm']['summary']}),flush=True)
if __name__=='__main__':main()

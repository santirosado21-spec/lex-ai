"""Record the superseded raw-source experiment without rewriting its evidence."""
import json,time
from common import ROOT,digest
from curation import verify_curated_source
from monitor import ProgressMonitor
def main():
 root=ROOT/'artifacts/training';curation=verify_curated_source();excluded=json.loads((ROOT/'artifacts/legal-library/exports-v2/review-exclusions.json').read_text());bad={r['id']for r in excluded};affected=[]
 for directory in sorted(root.glob('qwen-*')):
  if not directory.is_dir()or not any(word in directory.name for word in ['dataset-','tokenized-','pilot-','full-pass-','checkpoint-','uninterrupted-','smoke-']):continue
  marker={'status':'SUPERSEDED_UNAUDITED_INPUT','recordedAt':time.time(),'reason':'Used raw exports/corpus.jsonl, whose independent extraction audit passed only905/922. Approved frozen input is exports-v2/corpus.jsonl,910/910.','approvedCorpusSha256':curation['corpusSha256'],'adapterOrOptimizerReuseProhibited':True,'syntheticAuthorshipCorrection':'Templates were authored by Codex, not human/legal-professional reviewed; old metadata labels are preserved as evidence.'}
  path=directory/'SUPERSEDED_UNAUDITED_INPUT.json'
  if not path.exists():path.write_text(json.dumps(marker,indent=2)+'\n')
  affected.append(str(directory.relative_to(ROOT)))
 pilot=json.loads((root/'qwen-pilot-500-v1/training-report.json').read_text());trained={row['sourceId']for row in pilot['metrics']if row.get('sourceId')}
 trained=set()
 for line in(root/'qwen-pilot-500-v1/row-trace.jsonl').open():
  row=json.loads(line)
  if row.get('sourceId'):trained.add(row['sourceId'])
 report={'status':'SUPERSEDED_UNAUDITED_INPUT','detectedBy':'Root review of docs/legal-library.md:52-60 and docs/training-runbook.md:19-32','ownSelectionError':'Builder checked structurally-verified flags but did not require the independently audited curated snapshot.','rawCorpusSha256':digest(ROOT/'artifacts/legal-library/exports/corpus.jsonl'),'approvedSource':curation,'oldPilotUniqueSourcesAssociatedWithCuratedExclusions':sorted(trained&bad),'affectedDirectories':affected,'oldFullJobStopped':True,'stoppedTrainingPid':66603,'stoppedSupervisorPid':66602,'oldCheckpointsProhibited':True,'baseUnchangedReusable':True,'correction':'Rebuild from approved curated corpus and start new adapters/Adam from frozen base; no learned state reused.'}
 output=root/'qwen-source-quality-incident.json'
 if output.exists():raise ValueError('Preserve prior incident record')
 output.write_text(json.dumps(report,indent=2)+'\n');monitor=ProgressMonitor(root,{'train':28883,'validation':2899,'test':3670,'laws':303},0,'source-quality-correction');monitor.close(state='failed',phase='source-quality-correction',releaseStatus='rejected',message='La corrida anterior usó un export bruto sin auditoría aprobada. Se detuvo y se reconstruye desde el corpus depurado; no se activó el candidato.',incidentReport=str(output),previousCandidateStatus='SUPERSEDED_UNAUDITED_INPUT')
 print(json.dumps({'status':report['status'],'markedDirectories':len(affected),'pilotAssociatedExcludedSources':len(trained&bad)}))
if __name__=='__main__':main()

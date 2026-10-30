"""Package only a technically evaluated experimental model; never publish it."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
def digest(path):
    value=hashlib.sha256()
    with path.open('rb')as stream:
        for block in iter(lambda:stream.read(8*1024**2),b''):value.update(block)
    return value.hexdigest()

def clean(value):
    if isinstance(value,str):return value.replace(str(ROOT),'${LEX_PROJECT}')
    if isinstance(value,list):return [clean(item)for item in value]
    if isinstance(value,dict):return {key:clean(item)for key,item in value.items()if key!='endpoint'}
    return value

def serialized(value):return (json.dumps(value,indent=2,ensure_ascii=False)+'\n').encode()

def validate_manifest_files(candidate,manifest):
    entries=manifest.get('files',[])
    names=[entry['file']for entry in entries]
    if not names or len(set(names))!=len(names):raise ValueError('Export file list is empty or duplicated')
    if any(Path(name).name!=name or name in {'.','..'}for name in names):raise ValueError('Invalid export filename')
    required={'config.json','tokenizer_config.json','Modelfile','LICENSE','model.safetensors.index.json'}
    if not required<=set(names)or not {'tokenizer.json','tokenizer.model'}&set(names):
        raise ValueError('Export manifest omits required runtime files')
    expected=set(names)|{'export-manifest.json','export-manifest.sha256'}
    if {path.name for path in candidate.iterdir()}!=expected:raise ValueError('Export directory and manifest file list differ')
    for path in candidate.iterdir():
        if not path.is_file()or path.is_symlink():raise ValueError('Unexpected export file type')
    for entry in entries:
        path=candidate/entry['file']
        if path.stat().st_size!=entry['bytes']or digest(path)!=entry['sha256']:raise ValueError('Export file integrity mismatch')
    index=json.loads((candidate/'model.safetensors.index.json').read_text())
    weight_map=index.get('weight_map')
    if not isinstance(weight_map,dict)or not weight_map:raise ValueError('Export shard index is empty or invalid')
    shards=set(weight_map.values())
    if any(not isinstance(name,str)or Path(name).name!=name or not name.endswith('.safetensors')for name in shards):
        raise ValueError('Invalid shard path in export index')
    if shards!={name for name in names if name.endswith('.safetensors')}:
        raise ValueError('Export manifest must include exactly all referenced model shards')

def validate_adapter_binding(adapter,manifest,reports):
    expected={'adapters.safetensors','adapter_config.json'}
    entries=manifest.get('adapter',{}).get('files',[])
    if len(entries)!=2 or {entry['file']for entry in entries}!=expected:
        raise ValueError('Export adapter provenance must include weights and configuration')
    hashes={}
    for entry in entries:
        path=adapter/entry['file']
        if not path.is_file()or path.is_symlink():raise ValueError('Missing or invalid adapter artifact')
        actual=digest(path)
        if actual!=entry['sha256']or path.stat().st_size!=entry['bytes']:
            raise ValueError('Export belongs to a different adapter or adapter configuration')
        hashes[entry['file']]=actual
    if manifest['adapter'].get('configuration')!=json.loads((adapter/'adapter_config.json').read_text()):
        raise ValueError('Export adapter configuration metadata differs from its artifact')
    if reports['training-report.json'].get('adapterSha256')!=hashes['adapters.safetensors']:
        raise ValueError('Training report belongs to a different adapter')
    for name in ['behavior-candidate.json','behavior-imported.json']:
        if (reports[name].get('adapterSha256')!=hashes['adapters.safetensors']or
            reports[name].get('adapterConfigSha256')!=hashes['adapter_config.json']):
            raise ValueError('Evaluation belongs to a different adapter or adapter configuration')
    return hashes

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--candidate',required=True,type=Path);parser.add_argument('--adapter',required=True,type=Path);parser.add_argument('--runtime-report',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args()
    candidate=args.candidate.resolve();adapter=args.adapter.resolve();output=args.output.resolve()
    if output.exists():raise ValueError('Preserve existing distribution; choose a new output')
    runtime=json.loads(args.runtime_report.read_text())
    if runtime.get('status')!='PASS' or runtime.get('technicalGatePassed')is not True:raise ValueError('Runtime and technical gates must pass before packaging')
    manifest_path=candidate/'export-manifest.json';manifest=json.loads(manifest_path.read_text());manifest_sha=digest(manifest_path)
    if runtime.get('exportManifestSha256')!=manifest_sha:raise ValueError('Runtime verified a different exported model')
    if (candidate/'export-manifest.sha256').read_text().split()[0]!=manifest_sha:raise ValueError('Export manifest checksum mismatch')
    validate_manifest_files(candidate,manifest)
    reports={name:json.loads((adapter/name).read_text())for name in ['training-report.json','dataset-audit.json','behavior-base.json','behavior-candidate.json','behavior-imported.json']}
    adapter_hashes=validate_adapter_binding(adapter,manifest,reports)
    for name in ['behavior-candidate.json','behavior-imported.json']:
        if reports[name].get('gate',{}).get('passed')is not True:raise ValueError('Behavioral gate did not pass')
    if reports['behavior-imported.json']['runtime']['modelName']!=runtime['model']:raise ValueError('Imported runtime/model pairing mismatch')
    if runtime.get('importedBehaviorSha256')!=digest(adapter/'behavior-imported.json')or runtime.get('importedModelDigest')!=reports['behavior-imported.json']['runtime']['modelDigest']:raise ValueError('Runtime verification belongs to different behavioral evidence')
    if not(reports['behavior-base.json']['contract']==reports['behavior-candidate.json']['contract']==reports['behavior-imported.json']['contract']):raise ValueError('Evaluation cases and configuration were not paired')
    original_report_hashes={name:digest(adapter/name)for name in reports}
    original_report_hashes['runtime-verification.json']=digest(args.runtime_report)
    reports['runtime-verification.json']=runtime
    report_payloads={name:serialized(clean(value))for name,value in reports.items()}
    distributed_manifest=clean(manifest)
    if distributed_manifest['files']!=manifest['files']:raise ValueError('Redaction must not change model file hashes')
    manifest_payload=serialized(distributed_manifest)
    distributed_manifest_sha=hashlib.sha256(manifest_payload).hexdigest()
    imported=reports['behavior-imported.json']
    metadata={'schemaVersion':1,'createdAt':datetime.now(timezone.utc).isoformat(),'releaseStatus':'experimental','legalValidation':'not-performed','defaultAppModelReplaced':False,'textOnly':True,'base':manifest['source'],
              'verifiedOriginalExportManifestSha256':manifest_sha,'distributedExportManifestSha256':distributed_manifest_sha,'redactionOnly':True,
              'metadataTransformation':'Replace local project paths and omit endpoint fields; model file hash list and model payloads remain unchanged.',
              'evaluationOriginalSha256':original_report_hashes,'evaluationDistributedSha256':{name:hashlib.sha256(blob).hexdigest()for name,blob in report_payloads.items()},
              'license':'Apache-2.0','evaluationScope':imported['scope'],'evaluatedCases':imported['metrics']['cases'],
              'passedCases':sum(case.get('passed')is True for case in imported['cases']),
              'trainingSteps':reports['training-report.json']['steps'],
              'trainingStepsCumulative':reports['training-report.json'].get('totalSteps',reports['training-report.json']['steps']),
              'adapterSha256':adapter_hashes['adapters.safetensors'],
              'memoryPolicy':'Ollama keep_alive:0 on 24 GB hardware; source/configuration documented in the included reports.'}
    root='LEX-Gemma4-Experimental'
    readme='''LEX Gemma 4 — candidato experimental local

Modelo textual para macOS Apple Silicon. Se ajustaron tareas de JSON, citas
textuales y abstención con legislación pública; no es una acreditación de
exactitud jurídica profesional. Lea evaluaciones y procedencia antes de usarlo.

El modelo predeterminado de LEX AI permanece separado. Este archivo contiene
los pesos completos, licencia y configuración del candidato evaluado.

Para importarlo en una instalación local de Ollama compatible (probado 0.40.6):
  cd model
  ollama create lex-gemma4-experimental:local -f Modelfile

En las solicitudes /api/chat utilice think:false y keep_alive:0. En equipos de
24 GB, descargar el runner de memoria entre consultas evita acumular snapshots
de caché. La copia de pesos en disco se conserva; cada consulta vuelve a cargarla.
El modelo no ofrece visión/audio. No se envía ningún documento a servicios externos.

El flujo completo evaluado usa generación sin format/schema. Puede devolver saltos
de línea literales dentro de strings JSON. LEX AI intenta primero JSON estricto y,
solo si falla, escapa LF/CR/TAB dentro de strings; después valida de nuevo todas
las referencias y citas textuales contra las fuentes de esa consulta. Esa corrección
no autoriza reparar comillas, inventar citas ni omitir validaciones. Un cliente
independiente debe implementar estas comprobaciones: importar pesos no las añade.
La evaluación de 32 casos y el flujo sintético completo tienen alcances diferentes;
consulte applicationDecoding y formatNormalization en runtime-verification.json.

El SHA256 adyacente verifica este TAR; model/export-manifest.sha256 verifica el
manifiesto distribuido. DISTRIBUTION.json conserva el hash del manifiesto original
verificado por el runtime y declara la redacción de metadatos locales: los pesos
y su lista de hashes no cambian. También registra hashes originales y distribuidos
de las evaluaciones redactadas. Evaluations contiene resultados técnicos con datos públicos
y sintéticos. No incluye documentos privados ni credenciales.
'''
    temporary=output.with_suffix(output.suffix+'.partial');output.parent.mkdir(parents=True,exist_ok=True)
    if temporary.exists():raise ValueError('Unfinished archive exists; inspect before recovery')
    def normalized(info):
        info.uid=info.gid=0;info.uname=info.gname='';info.mode=0o644
        return info
    try:
        with tarfile.open(temporary,'w')as archive:
            names={entry['file']for entry in manifest['files']}
            for name in sorted(names):
                file=candidate/name
                if not file.is_file()or file.is_symlink():raise ValueError('Unexpected distribution file type')
                archive.add(file,arcname=f'{root}/model/{file.name}',filter=normalized)
            generated={'README.txt':readme.encode(),'DISTRIBUTION.json':serialized(clean(metadata)),
                       'model/export-manifest.json':manifest_payload,
                       'model/export-manifest.sha256':(distributed_manifest_sha+'  export-manifest.json\n').encode()}
            for name,content in report_payloads.items():generated['evaluations/'+name]=content
            for name,content in generated.items():
                info=tarfile.TarInfo(root+'/'+name);info.size=len(content);info.mode=0o644;archive.addfile(info,io.BytesIO(content))
        os.rename(temporary,output)
        checksum=digest(output);output.with_suffix(output.suffix+'.sha256').write_text(checksum+'  '+output.name+'\n')
        print(json.dumps({'archive':str(output),'bytes':output.stat().st_size,'sha256':checksum,'releaseStatus':'experimental'},indent=2))
    except BaseException:
        temporary.unlink(missing_ok=True);raise

if __name__=='__main__':main()

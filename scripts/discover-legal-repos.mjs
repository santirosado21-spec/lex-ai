import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const queries=['leyes mexicanas','legislacion mexico','leyes fiscales mx'];
export async function discoverLegalRepos({outputDir=path.resolve('artifacts/legal-repositories'),fetchImpl=fetch,now=()=>new Date(),delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 await mkdir(outputDir,{recursive:true});const file=path.join(outputDir,'status.json');let previous=null;try{previous=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const report={checkedAt:now().toISOString(),state:'complete',queries,repositories:[],errors:[],authority:'discovery-only-not-authoritative'};
 const found=new Map();
 for(const q of queries){
  try{
   const url=new URL('https://api.github.com/search/repositories');url.searchParams.set('q',q);url.searchParams.set('per_page','5');
   const res=await fetchImpl(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'LEX-AI-Public-Law-Discovery/0.1'},signal:AbortSignal.timeout(20_000),redirect:'error'});
   if(!res.ok)throw Error(`GitHub HTTP ${res.status}`);
   if(Number(res.headers.get('content-length'))>512_000){await res.body?.cancel();throw Error('Respuesta de descubrimiento demasiado grande.');}
   const chunks=[];let size=0;for await(const bytes of res.body||[]){size+=bytes.length;if(size>512_000)throw Error('Respuesta de descubrimiento demasiado grande.');chunks.push(Buffer.from(bytes));}const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!Array.isArray(data.items))throw Error('Respuesta de GitHub no válida.');
   for(const r of data.items.slice(0,5)){if(!/^[\w.-]+\/[\w.-]+$/.test(r.full_name)||r.private)continue;found.set(r.full_name,{name:r.full_name,url:`https://github.com/${r.full_name}`,description:String(r.description||'').slice(0,500),pushedAt:r.pushed_at||null,license:r.license?.spdx_id||null,defaultBranch:r.default_branch,reviewStatus:'candidate-unreviewed'});}
  }catch(e){report.errors.push({query:q,message:e.message});}
  await delay(2000);
 }
 report.repositories=[...found.values()];
 report.nextCheckAfter=new Date(now().getTime()+6*3600_000).toISOString();
 report.lastSuccessfulRepositories=report.errors.length?(previous?.lastSuccessfulRepositories||previous?.repositories?.length&&previous.repositories||previous?.previousRepositories||[]):report.repositories;
 if(report.errors.length){report.state=found.size?'partial':'failed';report.previousRepositories=report.lastSuccessfulRepositories;}
 await writeFile(file+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(file+'.tmp',file);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await discoverLegalRepos();console.log(JSON.stringify({state:report.state,repositories:report.repositories.length,errors:report.errors}));if(report.state==='failed')process.exitCode=1;}

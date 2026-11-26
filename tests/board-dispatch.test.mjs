import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
import {prepare,record,status,REVIEWERS,LIMIT} from '../scripts/board-dispatch.mjs';
const sh=(cwd,...a)=>execFileSync('git',a,{cwd,encoding:'utf8'}).trim();
function repo(){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'bdr-'));sh(d,'init','-q');sh(d,'config','user.email','t@t');sh(d,'config','user.name','t');
 fs.writeFileSync(path.join(d,'a.txt'),'uno\n');sh(d,'add','.');sh(d,'commit','-qm','a');const base=sh(d,'rev-parse','HEAD');
 fs.writeFileSync(path.join(d,'a.txt'),'uno\ndos\n');sh(d,'commit','-qam','b');const head=sh(d,'rev-parse','HEAD');
 return {d,base,head,out:path.join(d,'..',path.basename(d)+'-out')};
}
const resp=(m,id,over={})=>({reviewer:id,patchSha256:m.patchSha256,findings:[{severity:'RISK',file:'a.txt',text:'x'}],notRun:'nada',...over});
test('manifiesto liga base, head y SHA del diff; un pedido por revisor con enfoque distinto',()=>{
 const {d,base,head,out}=repo();const {manifest,status:s}=prepare({repo:d,base,head,out});
 assert.equal(s,'creado');assert.equal(manifest.base,base);assert.equal(manifest.head,head);assert.equal(manifest.approval,'none');assert.equal(manifest.limit,LIMIT);
 const patch=fs.readFileSync(path.join(out,'change.patch'));assert.equal(manifest.patchSha256,crypto.createHash('sha256').update(patch).digest('hex'));
 assert.equal(new Set(Object.values(manifest.reviewers).map(r=>r.focus)).size,Object.keys(REVIEWERS).length);
 for(const id of Object.keys(REVIEWERS)){const t=fs.readFileSync(path.join(out,`request-${id}.txt`),'utf8');assert.ok(t.includes(base)&&t.includes(head)&&t.includes('+dos'));assert.ok(!/respondio/.test(t));}
});
test('re-ejecucion identica es idempotente y no cambia bytes',()=>{
 const {d,base,head,out}=repo();prepare({repo:d,base,head,out});
 const before=fs.readdirSync(out).sort().map(n=>[n,fs.readFileSync(path.join(out,n)).toString('base64')]);
 const r=prepare({repo:d,base,head,out});assert.equal(r.status,'sin cambios');
 assert.deepEqual(fs.readdirSync(out).sort().map(n=>[n,fs.readFileSync(path.join(out,n)).toString('base64')]),before);
});
test('no sobrescribe una carpeta con contenido de otro par',()=>{
 const {d,base,head,out}=repo();prepare({repo:d,base,head,out});
 fs.writeFileSync(path.join(d,'a.txt'),'tres\n');sh(d,'commit','-qam','c');const head2=sh(d,'rev-parse','HEAD');
 assert.throws(()=>prepare({repo:d,base,head:head2,out}),/otro contenido/);
});
test('errores de SHA: corto, no hex, inexistente, vacio, diff vacio',()=>{
 const {d,base,head,out}=repo();
 assert.throws(()=>prepare({repo:d,base:base.slice(0,12),head,out}),/40 hex/);
 assert.throws(()=>prepare({repo:d,base,head:'main',out}),/40 hex/);
 assert.throws(()=>prepare({repo:d,base:'0'.repeat(40),head,out}),/no existe/);
 assert.throws(()=>prepare({repo:d,base:undefined,head,out}),/40 hex/);
 assert.throws(()=>prepare({repo:d,base,head:base,out}),/vacio/);
 assert.ok(!fs.existsSync(path.join(out,'manifest.json')));
 sh(d,'tag','-a','-m','t','v1',head);const tagObject=sh(d,'rev-parse','v1');assert.notEqual(tagObject,head);
 assert.throws(()=>prepare({repo:d,base,head:tagObject,out}),/no coincide/);
});
test('respuesta estructurada validada: parche ajeno, revisor ajeno, formato, doble registro',()=>{
 const {d,base,head,out}=repo();const {manifest:m}=prepare({repo:d,base,head,out});const f=path.join(d,'r.json');
 const put=o=>fs.writeFileSync(f,typeof o==='string'?o:JSON.stringify(o));
 put('texto libre BLOCKER');assert.throws(()=>record(out,'muse',f),/JSON/);
 put(resp(m,'muse',{patchSha256:'0'.repeat(64)}));assert.throws(()=>record(out,'muse',f),/otro parche/);
 put(resp(m,'dot'));assert.throws(()=>record(out,'muse',f),/reviewer/);
 put(resp(m,'muse',{findings:[{severity:'OK',file:'',text:'x'}]}));assert.throws(()=>record(out,'muse',f),/invalido/);
 put(resp(m,'muse',{notRun:undefined}));assert.throws(()=>record(out,'muse',f),/faltan/);
 assert.throws(()=>record(out,'otro',f),/desconocido/);
 put(resp(m,'muse'));const r=record(out,'muse',f);assert.deepEqual([r.blockers,r.risks],[0,1]);
 assert.throws(()=>record(out,'muse',f),/ya registrado/);
 assert.match(status(out),/muse: respondio/);assert.match(status(out),/hermes: pendiente/);assert.ok(status(out).includes(LIMIT));
});
test('workflow: permisos minimos, sin secretos, sin pull_request_target, script de la base, sin forks',()=>{
 const y=fs.readFileSync(new URL('../.github/workflows/board-dispatch.yml',import.meta.url),'utf8');
 assert.match(y,/permissions:\n  contents: read\n/);assert.ok(!/pull_request_target/.test(y));assert.ok(!/secrets\./.test(y));assert.ok(!/contents: write|id-token|pull-requests: write/.test(y));
 assert.match(y,/ref: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}\n          path: trusted/);assert.ok(y.includes('BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}'));assert.match(y,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}\n          path: data/);assert.ok(y.includes('head.repo.full_name == github.repository')&&y.includes("github.event.before != '"+'0'.repeat(40)+"'"));
 assert.equal((y.match(/persist-credentials: false/g)||[]).length,2);assert.ok(!/npm (ci|install)/.test(y));
 for(const m of y.matchAll(/uses: (\S+)/g))assert.match(m[1],/@[0-9a-f]{40}$/);
});

test('confinamiento: enlaces simbolicos, carpeta ajena, revisor con ruta, limite de tamano',()=>{
 const {d,base,head,out}=repo();
 const victim=path.join(d,'victima.txt');fs.writeFileSync(victim,'intacto');
 fs.symlinkSync(d,out);assert.throws(()=>prepare({repo:d,base,head,out}),/directorio regular/);fs.unlinkSync(out);
 fs.mkdirSync(out);fs.writeFileSync(path.join(out,'otro.txt'),'x');assert.throws(()=>prepare({repo:d,base,head,out}),/no esta vacia/);fs.rmSync(out,{recursive:true});
 assert.throws(()=>prepare({repo:d,base,head,out,maxBytes:5}),/limite/);assert.ok(!fs.existsSync(out));
 const {manifest:m}=prepare({repo:d,base,head,out});
 fs.unlinkSync(path.join(out,'request-dot.txt'));fs.symlinkSync(victim,path.join(out,'request-dot.txt'));
 assert.throws(()=>prepare({repo:d,base,head,out}),/no es archivo regular/);
 const mf=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));mf.reviewers['../x']=mf.reviewers.muse;fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(mf));
 const f=path.join(d,'r.json');fs.writeFileSync(f,JSON.stringify({reviewer:'../x',patchSha256:m.patchSha256,findings:[],notRun:''}));
 assert.throws(()=>record(out,'../x',f),/inesperados/);assert.equal(fs.readFileSync(victim,'utf8'),'intacto');
 fs.writeFileSync(path.join(out,'response-hermes.json'),'{"reviewer":"hermes","patchSha256":"x","findings":[]}');
 assert.match(status(out),/hermes: respuesta invalida/);
});
test('la respuesta registrada descarta campos extra (p. ej. aprobacion)',()=>{
 const {d,base,head,out}=repo();const {manifest:m}=prepare({repo:d,base,head,out});const f=path.join(d,'r.json');
 fs.writeFileSync(f,JSON.stringify({...resp(m,'grok',{findings:[{severity:'RISK',file:'a',text:'t',approved:true}]}),approved:true,approval:'user'}));record(out,'grok',f);
 const saved=JSON.parse(fs.readFileSync(path.join(out,'response-grok.json')));assert.ok(!('approved' in saved)&&!('approval' in saved)&&!('approved' in saved.findings[0]));
});

test('refs de reemplazo del repo no alteran los objetos leidos',()=>{
 const {d,base,head,out}=repo();const real=prepare({repo:d,base,head,out}).manifest.patchSha256;
 sh(d,'replace',head,base);const out2=out+'-2';
 assert.equal(prepare({repo:d,base,head,out:out2}).manifest.patchSha256,real);
});

test('status valida estructura (hallazgo nulo, notRun ausente) y manifiesto con revisores ajenos; tope de lectura',()=>{
 const {d,base,head,out}=repo();const {manifest:m}=prepare({repo:d,base,head,out});
 fs.writeFileSync(path.join(out,'response-dot.json'),JSON.stringify({reviewer:'dot',patchSha256:m.patchSha256,findings:[null],notRun:''}));
 fs.writeFileSync(path.join(out,'response-muse.json'),JSON.stringify({reviewer:'muse',patchSha256:m.patchSha256,findings:[]}));
 const s=status(out);assert.match(s,/dot: respuesta invalida/);assert.match(s,/muse: respuesta invalida/);
 fs.writeFileSync(path.join(out,'response-grok.json'),' '.repeat(1024*1024+1));assert.match(status(out),/grok: respuesta invalida/);
 const mf=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));mf.reviewers['../x']={};fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(mf));
 assert.throws(()=>status(out),/revisores inesperados/);
});
test('limite de tamano corta en git y el temporal no borra contenido previo',()=>{
 const {d,base,head,out}=repo();fs.writeFileSync(path.join(d,'a.txt'),'x'.repeat(5000));sh(d,'commit','-qam','grande');const big=sh(d,'rev-parse','HEAD');
 assert.throws(()=>prepare({repo:d,base,head:big,out,maxBytes:1000}),/limite/);
 const pre=out+'.tmp-123';fs.mkdirSync(pre);fs.writeFileSync(path.join(pre,'k'),'k');prepare({repo:d,base,head,out});assert.ok(fs.existsSync(path.join(pre,'k')));
});

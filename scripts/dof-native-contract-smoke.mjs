import http from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from '../server/main.mjs';

// Contract simulation ONLY. No Tauri process, Rust IPC, installed app or models.
if(Object.keys(process.env).some(k=>k.startsWith('LEX_')))throw Error('Run without LEX_* environment flags');
const root=process.cwd(),dataDir=await mkdtemp(path.join(os.tmpdir(),'rejon-native-contract-'));
const config=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8'));
const csp=config.app.security.csp;
let backend,frontend,browser;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png'};
try{
 backend=await startServer({port:0,dataDir,autoInitialize:false,libraryPath:path.join(dataDir,'no-active-library.sqlite'),dofReview:{directory:path.join(root,'artifacts/library-expansion-20261124')},inference:{status:async()=>({state:'disabled'}),stop:async()=>{},generate:async()=>{throw Error('Inference forbidden in contract test');}}});
 frontend=http.createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://127.0.0.1:1420').pathname;
   const relative=pathname==='/'?'index.html':pathname.slice(1);
   const file=path.resolve(root,'dist',relative);
   if(!file.startsWith(path.join(root,'dist')+path.sep)){res.writeHead(403);res.end();return;}
   const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Security-Policy':csp});res.end(bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not in frontend bundle');}
 });
 // This fixed origin is trusted by the existing backend. Never kill another
 // listener, select another port, or expand the production allowlist to pass.
 await new Promise((resolve,reject)=>{frontend.once('error',reject);frontend.listen(1420,'127.0.0.1',resolve);});
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 const allowedOrigins=new Set(['http://127.0.0.1:1420',backend.connection.url]);
 await page.route('**/*',route=>allowedOrigins.has(new URL(route.request().url()).origin)?route.continue():route.abort());
 await page.addInitScript(connection=>{
  window.__contractInvocations=[];window.__contractViolations=[];
  document.addEventListener('securitypolicyviolation',e=>window.__contractViolations.push(e.effectiveDirective));
  window.__TAURI_INTERNALS__={invoke:async command=>{window.__contractInvocations.push(command);if(command==='connection')return connection;if(command==='open_review_capture')return;throw Error('Unexpected command');}};
 },backend.connection);
 const calls=[];
 page.on('request',request=>{if(request.url()===backend.connection.url+'/api')calls.push({origin:request.headers().origin,method:request.method(),hasBearer:request.headers().authorization?.startsWith('Bearer ')});});
 await page.goto('http://127.0.0.1:1420/#review=dof');
 await page.getByRole('heading',{name:'Regla 3.1.43 · Aviso de Cruce',exact:true}).waitFor();
 const commands=await page.evaluate(()=>window.__contractInvocations);
 assert.deepEqual(commands,['connection'],'actual frontend invokes connection once via mocked bridge');
 assert.ok(calls.length>=2&&calls.every(c=>c.method==='POST'&&c.hasBearer),'API uses backend URL and Bearer');
 const badToken=await page.evaluate(async url=>{const r=await fetch(url+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer invalid-contract-token'},body:JSON.stringify({action:'dofReview.status',payload:{}})});return {status:r.status,origin:r.headers.get('access-control-allow-origin')};},backend.connection.url);
 assert.equal(badToken.status,401);
 const captureButton=page.getByRole('button',{name:'Abrir captura original',exact:true});
 assert.equal(await page.getByRole('link',{name:'Abrir publicación DOF',exact:true}).count(),1,'existing external link preserved, native behavior not simulated');
 assert.equal(await captureButton.count(),1,'desktop uses button, never DOM destination');
 await captureButton.click();
 await page.waitForFunction(()=>window.__contractInvocations.includes('open_review_capture'));
 await page.screenshot({path:'/downloads/rejon-native-button-local.png',fullPage:true});
 assert.deepEqual(await page.evaluate(()=>window.__contractInvocations),['connection','open_review_capture']);
 assert.equal(await page.getByRole('link',{name:'Abrir captura original',exact:true}).count(),0);
 const policy=await page.evaluate(async()=>{
  try{await fetch('https://example.invalid/contract-probe');}catch{}
  const frame=document.createElement('iframe');frame.src='/index.html';document.body.append(frame);
  await new Promise(r=>setTimeout(r,150));frame.remove();
  return [...new Set(window.__contractViolations)];
 });
 assert.ok(policy.includes('connect-src'),'production CSP rejects non-loopback fetch');
 assert.ok(policy.includes('frame-src'),'production CSP rejects iframe');
 const failed=await browser.newPage();
 await failed.addInitScript(()=>{window.__TAURI_INTERNALS__={invoke:async()=>{throw Error('Synthetic bridge refusal');}};});
 let fallbackRequests=0;failed.on('request',r=>{if(r.url().endsWith('/api'))fallbackRequests++;});
 await failed.goto('http://127.0.0.1:1420/#review=dof&token=not-a-real-session');
 await failed.getByRole('status').filter({hasText:'Revisión dev no disponible.'}).waitFor();
 assert.equal(fallbackRequests,0,'bridge rejection does not fall back to hash token');
 const same=await browser.newPage();
 await same.goto(backend.connection.url+'/#review=dof&token='+backend.connection.token);
 await same.getByRole('heading',{name:'Regla 3.1.43 · Aviso de Cruce',exact:true}).waitFor();
 const sameCapture=await same.getByRole('link',{name:'Abrir captura original',exact:true}).getAttribute('href');
 assert.equal(sameCapture,backend.connection.url+'/dev/dof-review/source','same-origin browser route preserved');
 assert.equal((await same.request.get(sameCapture)).status(),200);
 console.log(JSON.stringify({scope:'JS bridge double + split HTTP origins + configured CSP, NOT real Tauri IPC/protocol',checks:{connectionCommand:true,bearer:true,corsReadable:true,invalidToken401:true,bridgeRejectionNoFallback:true,cspConnectAndFrame:true,nativeCommandNoURL:true,sameOriginCapture200:true,captureUrlHasNoToken:true},remainingGap:'Mock proves frontend dispatch only. Rust compile and isolated Mac runtime QA required; no product activation.',cspDirectivesObserved:policy},null,2));
}finally{
 await browser?.close();if(frontend?.listening)await new Promise(r=>frontend.close(r));await backend?.close();await rm(dataDir,{recursive:true,force:true});
}

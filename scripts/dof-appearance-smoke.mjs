import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// Appearance regression only. This is a browser test, not native Tauri coverage.
const output=process.env.DOF_APPEARANCE_OUT||'/tmp/rejon-dof-appearance';
mkdirSync(output,{recursive:true});
const child=spawn(process.execPath,['scripts/dof-app-dev.mjs'],{stdio:['ignore','pipe','inherit']});
let browser;
const measurements=[],failures=[];
try{
 const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Dev server timeout')),30000);child.stdout.on('data',b=>{text+=b;const m=text.match(/http:\/\/127\.0\.0\.1:\d+\/#[^\s]+/);if(m){clearTimeout(timer);resolve(m[0]);}});child.on('exit',c=>{clearTimeout(timer);reject(Error('Dev server exited '+c));});});
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const os of ['light','dark'])for(const theme of ['auto','light','dark']){
  await page.emulateMedia({colorScheme:os});
  await page.goto(url);await page.reload();
  await page.getByRole('heading',{name:'Regla 3.1.43 · Aviso de Cruce',exact:true}).waitFor();
  await page.evaluate(t=>t==='auto'?document.documentElement.removeAttribute('data-theme'):document.documentElement.setAttribute('data-theme',t),theme);
  const rootScheme=await page.locator('html').evaluate(e=>getComputedStyle(e).colorScheme);
  for(const [query,heading] of [['Aviso Cruce','Regla 3.1.43 · Aviso de Cruce'],['manifestación valor','Manifestación de valor · Modificación parcial'],['zzznocoincide999','Sin selección']]){
   const input=page.getByLabel('Buscar en fragmentos de revisión');
   await input.fill(query);await input.press('Enter');
   await page.getByRole('heading',{name:heading,exact:true}).waitFor();
   const rows=await page.locator('.dof-review').evaluate(root=>{
    const rgb=s=>{const v=s.match(/[\d.]+/g)?.map(Number)||[];return [v[0]||0,v[1]||0,v[2]||0,v[3]??1];};
    const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    return [...root.querySelectorAll('h1,h2,h3,input,button,a,summary,pre,[role=status],.notice,article>p,.result small')].filter(e=>e.getClientRects().length).map(e=>{
     let bg=[255,255,255,1],n=e;while(n){const c=rgb(getComputedStyle(n).backgroundColor);if(c[3]===1){bg=c;break;}n=n.parentElement;}
     const s=getComputedStyle(e),fg=rgb(s.color),a=lum(fg),b=lum(bg);
     return {element:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||'').slice(0,60),color:s.color,background:bg,scheme:s.colorScheme,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
   });
   measurements.push({os,theme,heading,rows});
   for(const row of rows)if(row.ratio<4.5)failures.push(`${os}/${theme}/${heading}: ${row.element} ${row.text} contrast ${row.ratio.toFixed(2)}`);
   if(await input.evaluate(e=>getComputedStyle(e).colorScheme)!=='light')failures.push(`${os}/${theme}: input not light scheme`);
   if(await page.locator('html').evaluate(e=>getComputedStyle(e).colorScheme)!==rootScheme)failures.push('Review changed global scheme');
   if(os==='dark'&&theme==='auto'&&query==='manifestación valor')await page.screenshot({path:output+'/dark-mve.png',fullPage:true});
   if(os==='light'&&theme==='auto'&&query==='zzznocoincide999')await page.screenshot({path:output+'/light-empty.png',fullPage:true});
  }
 }
 // Web semantics: Enter submits, Tab reaches a button when host allows it,
 // visible focus exists, and capture target opens in a popup-capable browser.
 await page.goto(url);await page.reload();await page.getByRole('heading',{name:'Regla 3.1.43 · Aviso de Cruce',exact:true}).waitFor();
 const input=page.getByLabel('Buscar en fragmentos de revisión');
 await input.fill('manifestación valor');await input.focus();await page.keyboard.press('Tab');
 const button=page.getByRole('button',{name:'Buscar fragmentos',exact:true});
 assert.equal(await button.evaluate(e=>e===document.activeElement),true,'Tab to search button');
 assert.equal(await button.evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle!=='none'&&parseFloat(getComputedStyle(e).outlineWidth)>=2),true,'visible focus outline');
 await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Manifestación de valor · Modificación parcial',exact:true}).waitFor();
 const link=page.getByRole('link',{name:'Abrir captura original',exact:true});
 assert.equal(await link.getAttribute('target'),'_blank');
 assert.match(await link.getAttribute('rel'),/noopener/);
 const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();
 assert.match(await popup.locator('body').innerText(),/TERCERA RESOLUCIÓN/);await popup.close();
 assert.deepEqual(errors,[]);
 writeFileSync(output+'/measurements.json',JSON.stringify({measurements,failures},null,2));
 assert.deepEqual(failures,[],'Appearance contrast and scoped scheme');
 console.log(`PASS ${measurements.length} appearance states, each visible text sample >=4.5:1; local light controls; global scheme unchanged; web Tab/Enter/visible focus and capture popup. Not WKWebView host/Tauri validation. Evidence: ${output}`);
}finally{await browser?.close();child.kill('SIGTERM');}

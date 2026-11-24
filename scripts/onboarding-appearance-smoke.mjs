/** Onboarding appearance regression against a synthetic local workspace; no inference or external requests. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {startServer} from '../server/main.mjs';

// Browser test only. It does not exercise the native WKWebView host.
// Prerequisites: run `npm run build` first (the server serves dist/, not src/), and set CHROME_BIN to a Chrome/Chromium executable
// (the macOS Chrome path is only the default). The script fails if dist/ is older than src/styles.css.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
{
 const [dist,src]=await Promise.all([stat(path.join(root,'dist','index.html')).catch(()=>null),stat(path.join(root,'src','styles.css'))]);
 assert.ok(dist,'dist/ missing: run `npm run build` before this smoke');
 const assets=await import('node:fs/promises').then(fs=>fs.readdir(path.join(root,'dist','assets')));
 const cssTimes=await Promise.all(assets.filter(name=>name.endsWith('.css')).map(async name=>(await stat(path.join(root,'dist','assets',name))).mtimeMs));
 assert.ok(cssTimes.length&&Math.max(...cssTimes)>=src.mtimeMs,'dist CSS is older than src/styles.css: run `npm run build` first');
}
const output=process.env.ONBOARDING_APPEARANCE_OUT||path.join(os.tmpdir(),'rejon-onboarding-appearance');
await mkdir(output,{recursive:true});
const dataDir=await mkdtemp(path.join(os.tmpdir(),'rejon-onboarding-appearance-data-'));
const inference={
 status:async()=>({state:'disabled',message:'Appearance smoke only'}),
 stop:async()=>{},
 initialize:async()=>({state:'disabled',message:'Appearance smoke only'}),
 generate:async()=>{throw Error('Appearance smoke must not invoke inference');}
};
const app=await startServer({port:0,dataDir,autoInitialize:false,inference,monitorDir:path.join(dataDir,'monitor'),libraryPath:path.join(dataDir,'no-active-library.sqlite')});
let browser;
const measurements=[],failures=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined),headless:true,args:['--no-sandbox']});
 for(const osScheme of ['light','dark'])for(const theme of ['auto','light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:osScheme,reducedMotion:'reduce'});
  try{
   await context.addInitScript(value=>{try{localStorage.setItem('lex-ai.appearance',value);}catch{/* Optional storage. */}},theme);
   const page=await context.newPage();
   const errors=[],remote=[];let buttonFocus=null;
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{const url=request.url();if(!url.startsWith(app.connection.url)&&!url.startsWith('data:')&&!url.startsWith('blob:'))remote.push(url);});
   await page.goto(`${app.connection.url}/#token=${app.connection.token}`);
   await page.getByRole('heading',{level:1,name:'Un espacio privado para tu práctica jurídica.',exact:true}).waitFor();
   const appearance=await page.evaluate(()=>({attribute:document.documentElement.getAttribute('data-theme'),scheme:getComputedStyle(document.documentElement).colorScheme}));
   assert.equal(appearance.attribute,theme==='auto'?null:theme,`${osScheme}/${theme}: app appearance attribute`);
   assert.equal(appearance.scheme,theme==='auto'?osScheme:theme,`${osScheme}/${theme}: computed color scheme`);

   const samples=await page.evaluate(()=>{
    const resolve=value=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);const [r,g,b,a]=context.getImageData(0,0,1,1).data;return [r,g,b,a/255];};
    const lum=color=>color.slice(0,3).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    const backgroundOf=element=>{let node=element;while(node){const color=resolve(getComputedStyle(node).backgroundColor);if(color[3]===1)return color;node=node.parentElement;}return [255,255,255,1];};
    const ratio=(foreground,background)=>{const color=foreground.slice(0,3).map((value,index)=>value*foreground[3]+background[index]*(1-foreground[3])),a=lum(color),b=lum(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    const selectors=[
     ['intro h1','.onboarding-with-cover .onboarding-intro h1'],
     ['intro paragraph','.onboarding-with-cover .onboarding-intro>p'],
     ['active step','.app-cover-steps li[aria-current=step]'],
     ['active step number','.app-cover-steps li[aria-current=step]>span'],
     ['next step','.app-cover-steps li:nth-child(2)'],
     ['form heading','.onboarding-with-cover .onboarding-form h2'],
     ['privacy caption','.onboarding-with-cover .onboarding-form .privacy-caption']
    ];
    return selectors.map(([name,selector])=>{
     const element=document.querySelector(selector);
     if(!element||!element.getClientRects().length)return {name,selector,missing:true};
     const style=getComputedStyle(element),background=backgroundOf(element),foreground=resolve(style.color);
     return {name,selector,text:(element.textContent||'').trim().slice(0,70),color:style.color,background,colorScheme:style.colorScheme,ratio:ratio(foreground,background)};
    });
   });
   for(const sample of samples){
    if(sample.missing)failures.push(`${osScheme}/${theme}: missing ${sample.name} (${sample.selector})`);
    else if(sample.ratio<4.5)failures.push(`${osScheme}/${theme}: ${sample.name} contrast ${sample.ratio.toFixed(2)}:1 (${sample.color} on rgb(${sample.background.slice(0,3).join(',')}))`);
   }

   await page.locator('h1').click();
   await page.keyboard.press('Tab');
   const focus=await page.evaluate(()=>{
    const element=document.activeElement,style=getComputedStyle(element);
    const resolve=value=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);const [r,g,b,a]=context.getImageData(0,0,1,1).data;return [r,g,b,a/255];};
    const lum=color=>color.slice(0,3).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    const backgroundOf=element=>{let node=element;while(node){const color=resolve(getComputedStyle(node).backgroundColor);if(color[3]===1)return color;node=node.parentElement;}return [255,255,255,1];};
    const ratio=(foreground,background)=>{const color=foreground.slice(0,3).map((value,index)=>value*foreground[3]+background[index]*(1-foreground[3])),a=lum(color),b=lum(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    const background=backgroundOf(element.parentElement);
    return {tag:element.tagName,id:element.id,visible:element.matches(':focus-visible'),outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,outlineColor:style.outlineColor,background,ratio:ratio(resolve(style.outlineColor),background)};
   });
   assert.equal(focus.id,'firm-name',`${osScheme}/${theme}: Tab reaches the firm-name input`);
   assert.equal(focus.visible,true,`${osScheme}/${theme}: Tab focus is visible`);
   assert.notEqual(focus.outlineStyle,'none',`${osScheme}/${theme}: focus outline exists`);
   assert.ok(parseFloat(focus.outlineWidth)>=2,`${osScheme}/${theme}: focus outline is at least 2px`);
   if(focus.ratio<3)failures.push(`${osScheme}/${theme}: Tab focus outline contrast ${focus.ratio.toFixed(2)}:1 (${focus.outlineColor} on rgb(${focus.background.slice(0,3).join(',')}))`);

   // Tab through the whole form to the primary button. Synthetic text only; the button is never activated.
   await page.locator('#firm-name').fill('Despacho de prueba');
   await page.locator('h1').click();
   const visited=[];
   for(let step=0;step<60;step+=1){
    await page.keyboard.press('Tab');
    const active=await page.evaluate(()=>{const element=document.activeElement;const style=getComputedStyle(element);return {tag:element.tagName,id:element.id,primary:element.matches('.onboarding-with-cover .onboarding-form>.primary'),visible:element.matches(':focus-visible'),outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,outlineColor:style.outlineColor};});
    visited.push(active.tag+(active.id?'#'+active.id:''));
    if(active.primary){
     const colors=await page.evaluate(()=>{const element=document.activeElement;const resolve=value=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data];};const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);let node=element.parentElement;while(node){const c=resolve(getComputedStyle(node).backgroundColor);if(c[3]===255){const o=resolve(getComputedStyle(element).outlineColor);const alpha=o[3]/255;const blended=o.slice(0,3).map((v,i)=>v*alpha+c[i]*(1-alpha));const a=lum(blended),b=lum(c);return {background:c,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};}node=node.parentElement;}return {background:[255,255,255,255],ratio:0};});
     buttonFocus={...active,...colors,steps:step+1};
     break;
    }
   }
   assert.ok(buttonFocus,`${osScheme}/${theme}: Tab never reached the primary button; visited ${visited.join(' > ')}`);
   assert.equal(buttonFocus.visible,true,`${osScheme}/${theme}: button focus is visible`);
   assert.notEqual(buttonFocus.outlineStyle,'none',`${osScheme}/${theme}: button focus outline exists`);
   if(buttonFocus.ratio<3)failures.push(`${osScheme}/${theme}: button focus outline contrast ${buttonFocus.ratio.toFixed(2)}:1`);

   const overflow=[];
   for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});
    const state=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,innerWidth}));
    overflow.push({width,...state});
    if(state.scrollWidth>state.innerWidth)failures.push(`${osScheme}/${theme}: horizontal overflow at ${width}px (document ${state.scrollWidth}px > viewport ${state.innerWidth}px)`);
    if(osScheme==='dark'&&theme==='auto'&&width!==768)await page.screenshot({path:path.join(output,`dark-auto-${width}.png`),fullPage:true});
    if(osScheme==='light'&&theme==='auto'&&width===1440)await page.screenshot({path:path.join(output,'light-auto-1440.png'),fullPage:true});
   }
   assert.deepEqual(errors,[],`${osScheme}/${theme}: browser exceptions`);
   assert.deepEqual(remote,[],`${osScheme}/${theme}: no external requests`);
   measurements.push({osScheme,theme,appearance,samples,focus,buttonFocus,overflow,errors,remote});
  }finally{await context.close();}
 }
 await writeFile(path.join(output,'measurements.json'),JSON.stringify({mode:'Synthetic local workspace; no inference or external requests',measurements,failures},null,2)+'\n');
 assert.deepEqual(failures,[],'Onboarding appearance failures: '+failures.join(' | '));
 console.log(`PASS ${measurements.length} onboarding appearance states; text >=4.5:1; Tab focus outline >=3:1; no overflow at 1440/768/390; no external requests or browser exceptions. Evidence: ${output}`);
}finally{await browser?.close();await app.close();await rm(dataDir,{recursive:true,force:true});}

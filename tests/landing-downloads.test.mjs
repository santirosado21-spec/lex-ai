import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../landing/script.js',import.meta.url),'utf8');
const html=await readFile(new URL('../landing/index.html',import.meta.url),'utf8');
const catalogue=JSON.parse(await readFile(new URL('../landing/catalogue.json',import.meta.url),'utf8'));
const keys=['mac-arm64','mac-x64','windows-x64'];
function node(){return {textContent:'',disabled:false,dataset:{},attributes:{},handlers:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},removeAttribute(k){delete this.attributes[k];if(k==='href')delete this.href;},addEventListener(k,v){this.handlers[k]=v;}};}
async function render(value=catalogue,{failFetch=false,failCopy=false}={}){
 const cards=keys.map(key=>{const card=node();card.dataset.platform=key;card.fields=Object.fromEntries(['download','copy','version','size','sha','state','copy-status'].map(key=>[key,node()]));card.querySelector=s=>card.fields[s.match(/"(.*?)"/)[1]];return card;});
 const requests=[],copied=[];
 const context={URL,console,document:{querySelectorAll:s=>s==='[data-platform]'?cards:[],getElementById:()=>null,documentElement:node()},window:{matchMedia:()=>({matches:true})},localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{clipboard:{writeText:async value=>{if(failCopy)throw Error();copied.push(value);}}},fetch:async (...args)=>{requests.push(args);if(failFetch)throw Error();return {ok:true,json:async()=>value};}};
 vm.runInNewContext(script,context);await new Promise(resolve=>setImmediate(resolve));
 return {cards,requests,copied};
}
function inert(card){assert.equal(card.fields.download.href,undefined);assert.equal(card.fields.download.getAttribute('aria-disabled'),'true');assert.equal(card.fields.download.getAttribute('tabindex'),'-1');assert.equal(card.fields.copy.disabled,true);}
test('schema 3 has three explicit choices and preserves the verified older ARM artifact',async()=>{
 assert.equal(catalogue.schemaVersion,3);assert.deepEqual(Object.keys(catalogue.platforms),keys);assert.equal(catalogue.version,undefined);
 const arm=catalogue.platforms['mac-arm64'];assert.equal(arm.version,'0.4.3');assert.equal(arm.status,'experimental-local-legacy');assert.equal(arm.bytes,401541849);assert.equal(arm.sha256,'85526589575ed0ba6e4a267523e06d52fa8edf2d48895fd728d7995a7d1734e4');
 const {cards,requests}=await render();assert.equal(cards[0].fields.download.href,arm.downloadUrl);assert.match(cards[0].fields.state.textContent,/anterior LEX AI, local y experimental/);assert.match(cards[0].fields.version.textContent,/0\.4\.3/);
 inert(cards[1]);inert(cards[2]);assert.equal(requests.length,1);assert.equal(requests[0][0],'catalogue.json');
 for(const key of keys){assert.ok(html.includes(`data-platform="${key}"`));assert.ok(html.includes(`aria-describedby="state-${key}"`));}
 assert.match(html,/Ver descargas/);assert.doesNotMatch(script,/userAgent|innerHTML/);assert.match(html,/nuevo flujo híbrido aún no está disponible/);
});
test('every platform requires its own complete versioned metadata and correct architecture',async()=>{
 for(const [key,suffix] of [['mac-arm64','arm64.dmg'],['mac-x64','x64.dmg'],['windows-x64','x64.exe']]){
  const data=structuredClone(catalogue);data.platforms[key]={...data.platforms['mac-arm64'],status:'experimental',downloadUrl:`https://github.com/santirosado21-spec/lex-ai-descargas/releases/download/v0.4.3/LEX-AI-0.4.3-${suffix}`};
  const {cards}=await render(data);assert.equal(cards[keys.indexOf(key)].fields.download.href,data.platforms[key].downloadUrl);
 }
});
test('missing, malformed and hostile per-platform entries fail closed independently',async()=>{
 const arm=catalogue.platforms['mac-arm64'];
 const variants=[null,{},...['version','status','downloadUrl','bytes','sha256','requirements'].map(key=>({...arm,[key]:null})),
  {...arm,bytes:-1},{...arm,bytes:1.5},{...arm,sha256:'<img onerror=alert(1)>'},{...arm,version:'<script>'},{...arm,requirements:{minimumMemoryGB:0,minimumFreeDiskGB:3}},
  ...['javascript:alert(1)','http://github.com/path','https://evil.example/file.dmg',arm.downloadUrl+'?x=1',arm.downloadUrl+'#x',arm.downloadUrl.replace('github.com','github.com.evil'),arm.downloadUrl.replace('github.com','evil@github.com'),arm.downloadUrl.replace('arm64.dmg','arm64.exe'),arm.downloadUrl.replace('/v0.4.3/','/latest/'),arm.downloadUrl.replace('arm64','%61rm64')].map(downloadUrl=>({...arm,downloadUrl}))];
 for(const bad of variants){
  const data=structuredClone(catalogue);data.platforms['mac-x64']=bad;
  const {cards}=await render(data);inert(cards[1]);assert.equal(cards[0].fields.download.href,arm.downloadUrl);assert.doesNotMatch(cards[1].fields.version.textContent,/<script>/);
 }
 const {cards}=await render({...catalogue,schemaVersion:2});cards.forEach(inert);
 (await render(catalogue,{failFetch:true})).cards.forEach(inert);
});
test('disabled anchors are inert for pointer and keyboard and copying identifies platform/version',async()=>{
 const {cards,copied}=await render();const pending=cards[1].fields.download;
 for(const [type,key] of [['click',undefined],['keydown','Enter'],['keydown',' ']]){let prevented=false;pending.handlers[type]({key,preventDefault(){prevented=true;}});assert.equal(prevented,true);}
 await cards[1].fields.copy.handlers.click();assert.equal(copied.length,0);
 await cards[0].fields.copy.handlers.click();assert.deepEqual(copied,[catalogue.platforms['mac-arm64'].sha256]);assert.match(cards[0].fields['copy-status'].textContent,/Apple Silicon, Versión 0\.4\.3/);
 const failed=await render(catalogue,{failCopy:true});await failed.cards[0].fields.copy.handlers.click();assert.match(failed.cards[0].fields['copy-status'].textContent,/manualmente/);
 assert.equal((html.match(/aria-label="Copiar SHA-256 para/g)||[]).length,3);
});

// Synthetic host adapters with real paired HTTPS, matter storage and panel code.
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {startServer} from '../server/main.mjs';

const dataDir=await mkdtemp(path.join(tmpdir(),'lex-office-ui-'));
const port=18765;
process.env.LEX_OFFICE_PORT=String(port);
let app,browser;
const passed=[];
try {
 execFileSync(process.execPath,['scripts/office-cert.mjs','--data-dir',dataDir]);
 app=await startServer({dataDir,autoInitialize:false,inference:{async *generate(){yield 'Agenda sintética de revisión.';},async stop(){}}});
 async function api(action,payload={}){
  const r=await fetch(app.connection.url+'/api',{method:'POST',headers:{Authorization:'Bearer '+app.connection.token,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
  if(!r.ok)throw Error('Desktop API failed '+action);return r.json();
 }
 await api('workspace.create',{name:'Prueba sintética',practiceAreas:['Civil']});
 const matter=await api('matter.create',{title:'Prueba de paneles',client:'Parte ficticia',jurisdiction:'MX-JAL'});
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const host of ['word','excel','sharepoint']){
  const tenant=host==='sharepoint'?'https://prueba.sharepoint.com':'';
  const origin='https://localhost:'+port;
  const {code}=await api('office.pair',{matterId:matter.id,tenant});
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  let page=await context.newPage();page.setDefaultTimeout(7000);console.log("Testing",host);page.on("pageerror",e=>console.error("Synthetic host page",e.message));page.on("console",msg=>{if(msg.type()==="error")console.log(msg.text().slice(0,240));});
  await page.route('https://appsforoffice.microsoft.com/**',r=>r.fulfill({contentType:'application/javascript',body:`
    window.Office={onReady:fn=>fn()};
    const data={load(){},text:'Texto sintético de Word.',insertText(text){window.inserted=text;}};
    window.Word={ChangeTrackingMode:{trackAll:1},InsertLocation:{after:1},run:fn=>fn({document:{getSelection:()=>data},sync:async()=>{}})};
    const cell={load(){},cellCount:1,text:[['Texto sintético de Excel.']],formulas:[['']],get values(){return [['']];},set values(value){window.inserted=value[0][0];}};
    window.Excel={run:fn=>fn({workbook:{getSelectedRange:()=>cell},sync:async()=>{}})};
  `}));
  if(tenant){
   await page.route(tenant+'/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<button onclick="window.open('${origin}/sharepoint.html?tenant=${tenant}')">Abrir panel</button><script>
    onmessage=e=>{if(e.origin==='${origin}'&&e.data.type==='lex.read-selection')e.source.postMessage({id:e.data.id,text:'Texto sintético de SharePoint.'},e.origin)};
   </script>`}));
   await page.goto(tenant);
   const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Abrir panel'}).click();page=await popup;page.setDefaultTimeout(7000);
  }else await page.goto(origin+'/'+host+'.html');
  console.log("Host loaded",host);
  const panel=page;
  await panel.locator('#pair-code').fill(code);
  await panel.locator('#pair').click();
  console.log("Pair submitted",host);
  await panel.getByText('Leer selección',{exact:true}).click();
  await expect(panel.locator('[data-selection]')).toHaveValue(/Texto sintético/);
  await panel.locator('[data-save]').click();
  await expect(panel.locator('[role=status]').first()).toContainText(host==='sharepoint'?'Sesión vinculada':'Texto disponible').catch(async()=>{await expect(panel.getByText('Texto disponible en la biblioteca local del asunto.')).toBeVisible();});
  await panel.locator('[data-question]').fill('Hola, prepara una agenda.');
  await panel.locator('[data-ask]').click();
  await panel.getByText('Editar versión',{exact:true}).click();
  await panel.locator('[data-replies] textarea').fill('Versión revisada del borrador.');
  await panel.getByText('Guardar versión en el asunto',{exact:true}).click();
  await expect(panel.getByText(/Versión 2 guardada/)).toBeVisible();
  if(host!=='sharepoint'){
    await panel.getByRole('button',{name:/^Insertar/}).click();
    await expect.poll(()=>page.evaluate(()=>window.inserted)).toBe('Versión revisada del borrador.');
  }
  passed.push(host);await context.close();
 }
 await writeFile('artifacts/office-panel-smoke.json',JSON.stringify({passed,model:'synthetic',hosts:'simulated',transport:'paired HTTPS loopback',liveMicrosoft365:false},null,2));
 console.log('Panel smoke passed:',passed.join(', '));
}finally{await browser?.close();await app?.close();await rm(dataDir,{force:true,recursive:true});}

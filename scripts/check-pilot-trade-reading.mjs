import {startServer} from '../server/main.mjs';
import {createIntakeGenerator} from '../server/intake-pilot.mjs';
import {chromium} from 'playwright';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Document,Paragraph,Packer} from 'docx';
const real=process.argv.includes('--openai');
const output=path.resolve('artifacts','lecturas-dobles',real?'openai':'proveedor-simulado');
await mkdir(output,{recursive:true});
const dir=await mkdtemp(path.join(tmpdir(),'rejon-lectura-'));
const firm='Despacho Simulado Boreal',client='Fletes Álamo Ficticios',title='Revisión Sector Coral';
const evidence='Está pendiente cotejar la fracción arancelaria de la bomba centrífuga del lote MUESTRA-MAREA-018.';
const content=['Cliente: '+client,'Asunto: '+title,'Proveedor: Suministros Sombra de Ensayo',evidence];
const buffer=await Packer.toBuffer(new Document({sections:[{children:content.map(line=>new Paragraph(line))}]}));
let receipt,posts=0,preview,bodyResponse;
const generate=createIntakeGenerator({...(real?{}:{getApiKey:async()=>'sk-'+'f'.repeat(32)}),onReceipt:r=>{receipt=r;},fetchImpl:async(url,opts)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(++posts,1);
 const prompt=JSON.parse(opts.body).messages[0].content;assert.equal(prompt,preview);
 for(const value of [firm,client,title,'MUESTRA-MAREA-018','centrífuga','Suministros Sombra','[[SOPORTE]]'])assert.ok(!opts.body.includes(value));
 const result=real?await fetch(url,opts):Response.json({model:'simulado',choices:[{finish_reason:'stop',message:{content:JSON.stringify({
  A:{pasaje:'A1',solicitud:'¿Qué documento identifica la mercancía?'},
  B:{pasaje:'B1',solicitud:'¿Qué ficha describe el producto?'},
 })}}]});bodyResponse=(await result.clone().json()).choices[0]?.message?.content;await writeFile(path.join(output,'respuesta-publica.json'),bodyResponse);return result;
}});
const app=await startServer({intakePilot:true,intakeGenerate:generate,dataDir:dir,autoInitialize:false,pilotPassphrase:Buffer.from('frase ficticia local sólo para ensayo')});
const browser=await chromium.launch();try{
 const p=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});
 const external=[],errors=[];p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(app.connection.url+'/'))external.push(new URL(r.url()).origin);});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(app.connection.url+'/#pilot=intake&token='+app.connection.token);
 await p.locator('#intake-firm').fill(firm);await p.getByRole('button',{name:'Continuar'}).click();
 await p.locator('input[type=file]').setInputFiles({name:'Simulacion-privada.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer});
 await p.getByRole('checkbox',{name:/Guardar el texto/}).waitFor({timeout:125000});
 await p.locator('#intake-client').fill(client);await p.locator('#intake-title').fill(title);
 await p.getByRole('button',{name:'Guardar en este equipo'}).click();
 const topic='lectura-clasificacion';await p.waitForFunction(t=>document.querySelector('#intake-task')?.value===t,topic);
 await p.getByText('Por qué se sugiere esta lectura').click();
 assert.ok((await p.locator('blockquote').first().innerText()).includes('MUESTRA-MAREA-018'));
 await p.getByText('Leer el mensaje completo').click();preview=await p.locator('.rp-proof .rp-preview').innerText();
 const note=(await app.service.dispatch('intake.status',{})).tasks.find(t=>t.id===topic);
 assert.equal(note.preview,preview);await p.getByText('Leer el mensaje completo').click();
 for(const width of [320,390,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.screenshot({path:path.join(output,'interfaz.png'),fullPage:true});
 await p.getByRole('button',{name:'Enviar y generar borrador'}).click();
 await p.getByRole('button',{name:'Datos originales'}).waitFor({timeout:45000});
 await p.getByRole('button',{name:'Editar borrador'}).click();
 const edit=p.locator('#intake-edit');await edit.fill((await edit.inputValue())+'\nCotejo local pendiente.');
 await p.getByRole('button',{name:'Guardar cambios'}).click();
 await p.getByRole('button',{name:'Datos originales'}).click();
 await p.locator('.rp-document').filter({hasText:'MUESTRA-MAREA-018'}).waitFor();
 const draft=await p.locator('.rp-document').innerText();
 assert.ok(draft.includes(evidence)&&draft.includes(client)&&draft.includes('Cotejo local pendiente.'));
 const raw=JSON.parse(bodyResponse);
 const matched=note.references.map((ref,i)=>{const key=raw[i?'B':'A']?.pasaje;const item=note.preview.split('\n').find(line=>line.startsWith(key+' | '));const quote=item?.split(' | ').slice(1).join(' | ');return Boolean(quote&&ref.text.includes(quote)&&draft.includes(quote));});
 assert.deepEqual(matched,[true,true]);
 for(const [name,ext] of [['Word','docx'],['Excel','xlsx'],['PowerPoint','pptx']]){
  await p.getByRole('button',{name,exact:true}).click();const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Descargar .'+ext}).click();await(await dl).saveAs(path.join(output,'nota.'+ext));
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const report={transport:real?'openai':'simulado',input:'DOCX ficticio nuevo',task:topic,posts,receipt,refs:note.references.map(r=>r.id),verifiedQuotes:matched,evidenceLine:note.evidence.line,restored:true,edited:true,formats:['docx','xlsx','pptx'],widths:[320,390,768,1280],externalBrowserRequests:external.length};
 console.log(report);await writeFile(path.join(output,'resultado.json'),JSON.stringify(report,null,2));
}finally{await browser.close();await app.close();await rm(dir,{recursive:true,force:true});}

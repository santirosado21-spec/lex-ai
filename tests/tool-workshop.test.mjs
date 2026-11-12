import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 TOOL_CATALOG, TOOL_TEMPLATES, buildTemplate, getWorkshopTool, validateBlueprint, addTool,
 removeTool, moveTool, exportBlueprint, importBlueprint
} from '../src/tool-workshop-model.js';

test('catalogue has 24 unique, explicitly simulated module records and no endpoints',()=>{
 assert(TOOL_CATALOG.length>=24);
 const ids=TOOL_CATALOG.map(tool=>tool.id);
 assert.equal(new Set(ids).size,ids.length);
 assert(TOOL_CATALOG.every(x=>x.status==='simulation-only'&&['public-or-synthetic','private-local-locked'].includes(x.privacy)));
 assert(TOOL_CATALOG.some(x=>x.automation==='n8n-planned'));
 assert(TOOL_CATALOG.every(x=>!Object.keys(x).some(k=>/credential|url|endpoint|token|secret|execute/i.test(k))));
 assert(Object.isFrozen(TOOL_CATALOG));
 assert(Object.isFrozen(TOOL_CATALOG[0]));
});

test('all five law firm templates validate and remain synthetic',()=>{
 assert(TOOL_TEMPLATES.length>=5);
 for(const entry of TOOL_TEMPLATES){
  const plan=buildTemplate(entry.id);
  assert.equal(plan.kind,'rejon.workshop.blueprint');
  assert.equal(plan.mode,'simulation');
  assert.equal(plan.integrationsEnabled,false);
  assert.equal(plan.privacy,'public-or-synthetic-only');
  assert.deepEqual(plan.layout,plan.modules);
  assert.deepEqual(validateBlueprint(plan),plan);
 }
});

test('unknown template is rejected without fallback to runtime',()=>{
 assert.throws(()=>buildTemplate('inexistente'),{code:'UNKNOWN_TEMPLATE'});
});

test('adding a recipe expands declared dependencies in stable order',()=>{
 const original=buildTemplate('general');
 const plan=addTool(original,'recipe.reforma');
 for(const required of ['recipe.reforma','radar.dof','tool.normas','tool.citas','workbench.approvals']){
  assert(plan.modules.includes(required));
 }
 assert(plan.layout.indexOf('tool.normas')<plan.layout.indexOf('recipe.reforma'));
 assert.equal(original.modules.includes('recipe.reforma'),false);
});

test('adding an installed module is idempotent',()=>{
 const plan=buildTemplate('general');
 assert.deepEqual(addTool(plan,'radar.dof'),plan);
});

test('removing an in-use dependency fails closed',()=>{
 const plan=buildTemplate('regulatorio');
 assert.throws(()=>removeTool(plan,'tool.normas'),{code:'DEPENDENCY_IN_USE'});
 assert.throws(()=>removeTool(plan,'radar.dof'),{code:'DEPENDENCY_IN_USE'});
});

test('removing a recipe first then its dependencies succeeds',()=>{
 let plan=buildTemplate('regulatorio');
 plan=removeTool(plan,'recipe.reforma');
 plan=removeTool(plan,'tool.normas');
 assert(!plan.modules.includes('tool.normas'));
 assert(plan.modules.includes('tool.citas'));
});

test('at least one module must remain',()=>{
 const plan=validateBlueprint({...buildTemplate('general'),modules:['workbench.approvals'],layout:['workbench.approvals']});
 assert.throws(()=>removeTool(plan,'workbench.approvals'),{code:'EMPTY_BLUEPRINT'});
});

test('module move only changes presentation layout, never installed set',()=>{
 const plan=buildTemplate('litigio');
 const moved=moveTool(plan,'radar.sjf',-1);
 assert.deepEqual(moved.modules,plan.modules);
 assert.notDeepEqual(moved.layout,plan.layout);
 assert.equal(moved.layout.indexOf('radar.sjf'),plan.layout.indexOf('radar.sjf')-1);
 assert.deepEqual(moveTool(plan,plan.layout[0],-1),plan);
 assert.throws(()=>moveTool(plan,'radar.sjf',0),{code:'INVALID_MOVE'});
});

test('export import roundtrip is deterministic, versioned, and contains no private payload',()=>{
 const plan=addTool(buildTemplate('inmobiliario'),'workbench.doctor');
 const wire=exportBlueprint(plan);
 assert.deepEqual(importBlueprint(wire),plan);
 assert(!/cliente|expediente|webhookUrl|credential|API_KEY/i.test(wire));
 assert.equal(exportBlueprint(importBlueprint(wire)),wire);
});

test('untrusted extra fields and prototype-shaped input fail closed',()=>{
 const plan=buildTemplate('general');
 assert.throws(()=>validateBlueprint({...plan,client:'Secreto'}),{code:'INVALID_BLUEPRINT_FIELDS'});
 assert.throws(()=>validateBlueprint({...plan,webhookUrl:'https://example.com'}),{code:'INVALID_BLUEPRINT_FIELDS'});
 assert.throws(()=>validateBlueprint(Object.assign(Object.create(null),plan)),{code:'INVALID_BLUEPRINT_FIELDS'});
 assert.throws(()=>validateBlueprint([plan]),{code:'INVALID_BLUEPRINT_FIELDS'});
});

test('no arbitrary module IDs, malformed layouts, or duplicates',()=>{
 const plan=buildTemplate('general');
 assert.throws(()=>addTool(plan,'other.remote-script'),{code:'UNKNOWN_MODULE'});
 assert.throws(()=>validateBlueprint({...plan,modules:[...plan.modules,'other.script'],layout:[...plan.layout,'other.script']}),{code:'UNKNOWN_MODULE'});
 assert.throws(()=>validateBlueprint({...plan,modules:[...plan.modules,plan.modules[0]],layout:[...plan.layout,plan.layout[0]]}),{code:'INVALID_LAYOUT'});
 assert.throws(()=>validateBlueprint({...plan,layout:plan.layout.slice().reverse().slice(1)}),{code:'INVALID_MODULE_LIST'});
 assert.throws(()=>validateBlueprint({...plan,layout:[...plan.layout.slice(1),'radar.sjf']}),{code:'INVALID_LAYOUT'});
});

test('simulation mode, offline privacy and no integration are immutable',()=>{
 const plan=buildTemplate('general');
 for(const patch of [{integrationsEnabled:true},{mode:'live'},{mode:'active'},{privacy:'external'},{schemaVersion:2},{kind:'n8n.workflow'}]){
  assert.throws(()=>validateBlueprint({...plan,...patch}),{code:'UNSAFE_BLUEPRINT'});
 }
});

test('missing prerequisites are rejected on direct JSON import',()=>{
 const plan=buildTemplate('general');
 assert.throws(()=>importBlueprint(JSON.stringify({...plan,modules:['recipe.reforma'],layout:['recipe.reforma']})),{code:'MISSING_DEPENDENCY'});
});

test('invalid JSON and oversized inputs fail closed',()=>{
 assert.throws(()=>importBlueprint('{'),{code:'INVALID_JSON'});
 assert.throws(()=>importBlueprint(' '.repeat(16_001)),{code:'BLUEPRINT_TOO_LARGE'});
 assert.throws(()=>importBlueprint(null),{code:'BLUEPRINT_TOO_LARGE'});
});

test('blueprint size bound prevents installing more than 24 tools',()=>{
 const plan=buildTemplate('general');
 const tooMany=Array.from({length:25},(_,i)=>TOOL_CATALOG[i%TOOL_CATALOG.length].id);
 assert.throws(()=>validateBlueprint({...plan,modules:tooMany,layout:tooMany}),{code:'INVALID_MODULE_LIST'});
});

test('read-only catalogue lookup and no modifications to arguments',()=>{
 const plan=buildTemplate('general');
 const before=structuredClone(plan);
 const next=addTool(plan,'workbench.mesa');
 assert.deepEqual(plan,before);
 assert(next.modules.includes('workbench.mesa'));
 assert.equal(getWorkshopTool('unknown.tool'),null);
});

test('isolated UI has no API import, fake execution or external workflow binding',()=>{
 const view=readFileSync(new URL('../src/ToolWorkshopView.tsx',import.meta.url),'utf8');
 // Comments document forbidden capabilities; scan executable text, not commentary.
 const executable=view.replace(/^\s*\/\/.*$/gm,'');
 assert(!/from ['"]\.\/api['"]/.test(executable));
 assert(!/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|window\.open\s*\(/.test(executable));
 assert(view.includes('Simulación aislada'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../docs/demo/pre-egress-review-v1.html',import.meta.url),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(code,'inline demo script found');

class Element {
  constructor(id=''){
    this.id=id;this.children=[];this.attrs={};this.listeners={};
    this.value='';this.textContent='';this.disabled=false;this.checked=false;
    this.style={};this.className='';
    const classes=new Set();
    this.classList={
      add:s=>classes.add(s),
      remove:s=>classes.delete(s),
      contains:s=>classes.has(s),
    };
  }
  addEventListener(name,handler){this.listeners[name]=handler;}
  setAttribute(name,value){this.attrs[name]=value;}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  click(){this.listeners.click?.();}
}
function session(){
  const elements=new Map();
  const document={
    createElement:()=>new Element(),
    getElementById(id){
      if (!elements.has(id))elements.set(id,new Element(id));
      return elements.get(id);
    }
  };
  const context=vm.createContext({document});
  vm.runInContext(code,context,{timeout:1000});
  const get=id=>document.getElementById(id);
  const evaluate=expression=>vm.runInContext(expression,context,{timeout:1000});
  return {get,evaluate};
}
test('no egress transports, storage or external assets and strict CSP',()=>{
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/default-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.doesNotMatch(html,/<script[^>]+src=/);
  assert.doesNotMatch(html,/<link[^>]+href=/);
  assert.doesNotMatch(code,/\b(?:fetch|WebSocket|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB)\b/);
});
test('demo has exactly two explicitly fictional matters and distinct namespaces',()=>{
  const s=session();
  assert.equal(s.evaluate('cases.length'),2);
  assert.equal(s.evaluate('new Set(cases.map(c=>c.namespace)).size'),2);
  assert.equal(s.evaluate('cases.every(c=>c.id && c.canaries.length === 4)'),true);
  assert.match(html,/Nunca pruebes aquí documentos de clientes/);
});
test('preview is closed and approval disabled until every detection reviewed',()=>{
  const s=session();
  assert.equal(s.get('approve').disabled,true);
  assert.equal(s.get('result').classList.contains('hidden'),true);
  s.evaluate('rows.slice(0,-1).forEach(r=>r.reviewed=true);refreshApprove();');
  assert.equal(s.get('approve').disabled,true);
  s.evaluate('rows[rows.length-1].reviewed=true;refreshApprove();');
  assert.equal(s.get('approve').disabled,false);
});
test('approved view excludes all canaries from text, filename and history',()=>{
  const s=session();
  s.evaluate('rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();');
  assert.equal(s.get('result').classList.contains('hidden'),false);
  const protectedPayload=[
    s.get('preview').textContent,s.get('safe-file').textContent,s.get('safe-history').textContent
  ].join(' ');
  for(const term of ['Marina Solís','Esteban Prado','Calle Cometa 123','marina@ejemplo.invalid']){
    assert.equal(protectedPayload.includes(term),false);
  }
  assert.match(protectedPayload,/\[\[LEX_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_/);
});
test('switching matter resets approvals and uses only matter B markers',()=>{
  const s=session();
  s.evaluate('rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();');
  s.get('case-b').click();
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.equal(s.get('approve').disabled,true);
  assert.equal(s.get('case-b').attrs['aria-pressed'],'true');
  s.evaluate('rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();');
  const payload=s.get('preview').textContent;
  assert.match(payload,/\[\[LEX_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb_/);
  assert.doesNotMatch(payload,/\[\[LEX_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_/);
  assert.ok(!['Damián Vega','Taller Nébula S.A.','EXP-SIM-2026-004','55 0000 1111'].some(t=>payload.includes(t)));
});
test('correction without a matching source blocks, despite checked approvals',()=>{
  const s=session();
  s.evaluate("rows[0].text='TEXTO-NO-EXISTE';rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();");
  assert.equal(s.get('approve').disabled,true);
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.match(s.get('notice').textContent,/inválida|ausente/);
});
test('an omitted default canary blocks even if every row is approved',()=>{
  const s=session();
  s.evaluate("rows[0].text='CONTRATO FICTICIO';rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();");
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.match(s.get('notice').textContent,/Bloqueado/);
});
test('review changes after approval close preview and require confirmation again',()=>{
  const s=session();
  s.evaluate('rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();');
  assert.equal(s.get('result').classList.contains('hidden'),false);
  s.evaluate('rows[0].reviewed=false;changed();');
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.equal(s.get('approve').disabled,true);
});
test('addition rejects an unrelated term without changing the reviewed set',()=>{
  const s=session();
  s.get('new-term').value='DATO AJENO AL ORIGINAL';
  s.get('add').click();
  assert.equal(s.evaluate('rows.length'),4);
  assert.match(s.get('notice').textContent,/No añadida/);
});

test('partial identifier correction cannot silently release the remaining name',()=>{
  const s=session();
  // Before this guard, replacing only "Solís" removed the full canary,
  // yet the resulting preview still displayed "Marina".
  s.evaluate("rows[0].text='Solís';rows.forEach(r=>r.reviewed=true);refreshApprove();");
  assert.equal(s.get('approve').disabled,true);
  s.evaluate('previewProtected();');
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.equal(s.get('preview').textContent,'');
  assert.match(s.get('notice').textContent,/íntegramente/);
  // Correcting back to the complete known identifier unblocks the demo.
  s.evaluate("rows[0].text='Marina Solís';rows[0].reviewed=true;refreshApprove();previewProtected();");
  assert.equal(s.get('result').classList.contains('hidden'),false);
});

test('switching matters erases old derived payload from hidden DOM before next approval',()=>{
  const s=session();
  s.evaluate('rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();');
  assert.equal(s.get('preview').textContent.includes('[[LEX_aaaaaaaa'),true);
  assert.notEqual(s.get('safe-file').textContent,'');
  assert.notEqual(s.get('safe-history').textContent,'');
  s.get('case-b').click();
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.equal(s.get('approve').disabled,true);
  assert.equal(s.get('preview').textContent,'');
  assert.equal(s.get('safe-file').textContent,'');
  assert.equal(s.get('safe-history').textContent,'');
  s.evaluate('rows.forEach(r=>r.reviewed=true);refreshApprove();previewProtected();');
  assert.equal(s.get('preview').textContent.includes('[[LEX_bbbbbbbb'),true);
  s.evaluate('rows[0].reviewed=false;changed();');
  assert.equal(s.get('preview').textContent,'');
  assert.equal(s.get('safe-file').textContent,'');
  assert.equal(s.get('safe-history').textContent,'');
});

test('second matter cannot approve only a surname in place of its known person canary',()=>{
  const s=session();
  s.get('case-b').click();
  s.evaluate("rows[0].text='Vega';rows.forEach(r=>r.reviewed=true);refreshApprove();");
  assert.equal(s.get('approve').disabled,true);
  s.evaluate('previewProtected();');
  assert.equal(s.get('result').classList.contains('hidden'),true);
  assert.match(s.get('notice').textContent,/íntegramente/);
});

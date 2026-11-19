import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {hiddenInput} from '../piloto/entrada-oculta.mjs';

test('an immediate paste reaches the silent raw reader before any prompt is visible',async()=>{
 const input=new PassThrough();
 input.isTTY=true;input.isRaw=false;
 input.setRawMode=enabled=>{input.isRaw=enabled;};
 let visible='';
 const output={write(value){
   visible+=value;
   if(value==='Frase: '){
    assert.equal(input.isRaw,true);
    input.write('secreto ficticio\r');
   }
 }};
 try{
  assert.equal(await hiddenInput('Frase: ',{input,output}),'secreto ficticio');
  assert.equal(visible,'Frase: \n');
  assert.equal(input.isRaw,false);
 }finally{input.destroy();}
});

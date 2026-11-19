import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';

export async function hiddenInput(prompt,{input=process.stdin,output=process.stdout}={}) {
 if(!input.isTTY)throw Error('Abre el lanzador en una terminal interactiva.');
 const silent=new Writable({write(_chunk,_encoding,done){done();}});
 const rl=createInterface({input,output:silent,terminal:true,historySize:0});
 try {
  const answer=rl.question('');
  // A paste can arrive the instant the prompt appears. Enable silent raw input first.
  if(!input.isRaw)throw Error('No se pudo activar la entrada oculta.');
  output.write(prompt);
  return await answer;
 }finally{rl.close();output.write('\n');}
}

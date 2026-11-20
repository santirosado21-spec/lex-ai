// The local model reads at most 8k UTF-16 units per request. Finish each block
// at a sentence/line boundary and repeat preceding context when space permits.
export const maxIntakeChars=60000;
const maxWindow=8000,overlap=1024;
export function intakeWindows(text){
 if(text.length>maxIntakeChars)throw Error('El documento supera los 60 000 caracteres de esta edición.');
 if(text.length<=maxWindow)return [text];
 const ends=new Set([0,text.length]);
 for(const line of text.matchAll(/\n/gu))ends.add(line.index+1);
 for(const piece of new Intl.Segmenter('es',{granularity:'sentence'}).segment(text))ends.add(piece.index+piece.segment.length);
 const positions=[...ends].sort((a,b)=>a-b),windows=[];
 let consumed=0,previousStart=0;
 while(consumed<text.length){
  const ceiling=Math.min(text.length,consumed+maxWindow);
  const next=positions.find(p=>p>consumed);
  if(next===undefined||next>ceiling)throw Error('Hay un bloque sin fin de línea ni de oración de más de 8 000 caracteres. Divide el texto en párrafos.');
  const minStart=Math.max(previousStart,consumed-overlap,next-maxWindow);
  const start=positions.find(p=>p>=minStart);
  const end=positions.findLast(p=>p<=start+maxWindow);
  windows.push(text.slice(start,end));previousStart=start;consumed=end;
 }
 return windows;
}

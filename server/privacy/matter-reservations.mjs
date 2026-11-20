// Normalize for comparison only. Offsets always point back to complete original
// code points and their combining marks. Whitespace can change during extraction.
function folded(text){
 return text.normalize('NFD').toUpperCase().replace(/\p{M}/gu,'').replace(/\s+/gu,' ');
}
export function reservationKey(text){return folded(text).trim();}
export function reservedRanges(text,rows){
 if(!hasReservedText(text,rows))return [];
 const starts=[],ends=[];let value='';
 for(const unit of text.matchAll(/\s+|\P{M}\p{M}*|\p{M}+/gu)){
  const piece=folded(unit[0]);
  value+=piece;
  for(let i=0;i<piece.length;i++){starts.push(unit.index);ends.push(unit.index+unit[0].length);}
 }
 const last=new Uint32Array(value.length);
 for(const row of rows){
  const key=reservationKey(row.text);
  if(!key)continue;
  for(let i=value.indexOf(key);i>=0;i=value.indexOf(key,i+1))last[i]=Math.max(last[i],i+key.length);
 }
 const ranges=[];
 for(let i=0;i<last.length;i++){
  if(!last[i])continue;
  const a=starts[i],b=ends[last[i]-1],previous=ranges.at(-1);
  if(previous&&a<previous[1])previous[1]=Math.max(previous[1],b);
  else ranges.push([a,b]);
 }
 return ranges;
}
export function hasReservedText(text,rows){
 if(!rows?.length||!text)return false;
 const value=folded(text);
 return rows.some(row=>value.includes(reservationKey(row.text)));
}

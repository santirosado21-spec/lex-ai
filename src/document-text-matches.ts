// Search a folded view, but return only complete spans of the untouched UTF-16 source.
export function documentTextMatches(text:string,query:string):{start:number;end:number}[]{
 if(!query.trim())return [];
 const lower=text.toLocaleLowerCase('es'),needle=query.toLocaleLowerCase('es');
 const boundaries=new Map<number,number>();let original=0,folded=0,from=0;
 const positions:{start:number;end:number}[]=[];
 // Scan source boundaries only as far as each candidate needs. Map only the
 // candidate endpoints, not every character of a potentially long document.
 while(positions.length<500){
  const start=lower.indexOf(needle,from);if(start<0)break;const end=start+needle.length;
  if(lower.length===text.length){positions.push({start,end});from=end;continue;}
  boundaries.clear();if(folded===start)boundaries.set(start,original);
  while(original<text.length&&folded<end){const char=String.fromCodePoint(text.codePointAt(original)!);original+=char.length;folded+=char.toLocaleLowerCase('es').length;if(folded===start||folded===end)boundaries.set(folded,original);}
  if(boundaries.has(start)&&boundaries.has(end))positions.push({start:boundaries.get(start)!,end:boundaries.get(end)!});
  from=end;
 }
 return positions;
}

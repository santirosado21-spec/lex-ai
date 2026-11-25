// Exact, case-sensitive, non-overlapping matches. No regex or normalization:
// offsets always refer to the displayed text, not a separate representation.
export function supportTextMatches(text:string,query:string):number[]{
 if(!query.trim())return [];
 const matches:number[]=[];
 for(let at=text.indexOf(query);at!==-1&&matches.length<200;at=text.indexOf(query,at+query.length))matches.push(at);
 return matches;
}

export function locateDirectoryArticle(query:unknown,entries:readonly {article:string}[]):
 {status:'invalid'}|{status:'found'|'missing';article:string};

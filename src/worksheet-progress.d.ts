export function worksheetProgress(rows: readonly {id:string;label:string;status:string}[]): {
 total:number; pending:{id:string;label:string;status:string}[]; checked:number; notApplicable:number; unknown:number;
};

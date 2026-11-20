// Simulate a local reader which assigns no extra spans. Keep all of the
// requested groups present so an incomplete response can be tested separately.
export function emptyLocalReading(properties,fields={}){
 const arrays=Object.entries(properties).filter(([,value])=>value.type==='array');
 const empty=Object.fromEntries(arrays.map(([name])=>[name,[]]));
 return properties.oraciones?empty:{...empty,client:'',title:'',documentKind:'otro',...fields};
}

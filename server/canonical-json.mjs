// JSON-only, sorted object keys: no silent removal/coercion of fixture fields.
export function canonicalJson(value,parents=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(typeof value!=='object'||parents.has(value))throw Error('La solicitud simulada debe contener solo datos JSON sin ciclos.');
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(!array&&prototype!==Object.prototype&&prototype!==null)throw Error('La solicitud simulada debe contener solo objetos JSON.');
 if(Object.getOwnPropertySymbols(value).length)throw Error('La solicitud simulada no admite campos Symbol.');
 parents.add(value);
 try{
  const keys=array?Array.from({length:value.length},(_,i)=>String(i)):Object.keys(value).sort();
  const fields=keys.map(key=>{
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error('La solicitud simulada no admite huecos ni getters.');
   const text=canonicalJson(descriptor.value,parents);
   return array?text:`${JSON.stringify(key)}:${text}`;
  });
  if(array&&Object.keys(value).some(key=>!keys.includes(key)))throw Error('La solicitud simulada no admite campos extra en arreglos.');
  return array?`[${fields.join(',')}]`:`{${fields.join(',')}}`;
 }finally{parents.delete(value);}
}

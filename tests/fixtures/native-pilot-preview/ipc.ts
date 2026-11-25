export async function invoke(op:string){const t=(window as any).testNative;
 if(op==='native_status')return {state:t.state};
 if(op==='native_unlock'||op==='native_create'){t.state='unlocked';t.token++;return {state:t.state};}
 if(op==='native_connection')return {url:'http://127.0.0.1:'+location.port,token:'token-'+t.token};
 if(op==='native_lock'){await new Promise(r=>{t.release=r;});if(t.fail)throw Error();t.state='locked';return {state:t.state};}
 throw Error();
}

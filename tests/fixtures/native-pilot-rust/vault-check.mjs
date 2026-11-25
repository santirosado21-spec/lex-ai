import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';import path from 'node:path';
let input='';for await(const chunk of process.stdin)input+=chunk;const {url,token,mode,root}=JSON.parse(input);
const rpc=async(action,payload={})=>{const r=await fetch(url+'/api',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});if(!r.ok)throw Error('synthetic request failed');return r.json();};
if(mode==='save')await rpc('intake.save',{firm:'Rust synthetic firm',client:'SYNTHETIC_RUST_VAULT_CANARY',title:'Rust test',jurisdiction:'MX-FED'});
else {const state=await rpc('state');if(!JSON.stringify(state).includes('SYNTHETIC_RUST_VAULT_CANARY'))throw Error('lost content');}
const file=path.join(root,'native-pilot-v1/rust-case/rejon-protegido.sqlite');const bytes=await readFile(file);if(bytes.includes(Buffer.from('SYNTHETIC_RUST_VAULT_CANARY')))throw Error('plaintext');const db=new DatabaseSync(file,{readOnly:true});if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('integrity');db.close();

import { execFile } from 'node:child_process';
import { mkdir, chmod, access, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const defaultDataDir=path.join(os.homedir(),'Library/Application Support/mx.lexai.desktop');
process.umask(0o077);
const argument=process.argv.indexOf('--data-dir');
const dataDir=argument>=0?process.argv[argument+1]:process.env.LEX_DATA_DIR||defaultDataDir;
if(!dataDir||dataDir.startsWith('-'))throw new Error('Usa --data-dir <directorio> cuando especifiques esa opción.');
const output=path.join(dataDir,'office-addin');
const files={caKey:path.join(output,'ca.key'),caCert:path.join(output,'ca.crt'),key:path.join(output,'localhost.key'),csr:path.join(output,'localhost.csr'),cert:path.join(output,'localhost.crt'),ext:path.join(output,'localhost.ext'),serial:path.join(output,'ca.srl')};
const run=(command,args)=>new Promise((resolve,reject)=>execFile(command,args,{windowsHide:true},error=>error?reject(error):resolve()));
const exists=async file=>access(file).then(()=>true,()=>false);

await mkdir(output,{recursive:true,mode:0o700});await chmod(output,0o700);
if(await exists(files.key)||await exists(files.cert)||await exists(files.caKey)||await exists(files.caCert))throw new Error(`Ya existen certificados en ${output}. No se sobrescribió nada.`);
try {
  await writeFile(files.ext,'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',{mode:0o600});
  await run('openssl',['genrsa','-out',files.caKey,'4096']);await chmod(files.caKey,0o600);
  await run('openssl',['req','-x509','-new','-key',files.caKey,'-sha256','-days','3650','-out',files.caCert,'-subj','/CN=LEX AI Local Office Add-in CA']);
  await run('openssl',['genrsa','-out',files.key,'2048']);await chmod(files.key,0o600);
  await run('openssl',['req','-new','-key',files.key,'-out',files.csr,'-subj','/CN=localhost']);
  await run('openssl',['x509','-req','-in',files.csr,'-CA',files.caCert,'-CAkey',files.caKey,'-CAcreateserial','-out',files.cert,'-days','365','-sha256','-extfile',files.ext]);
  await chmod(files.caCert,0o600);await chmod(files.cert,0o600);await rm(files.csr,{force:true});await rm(files.ext,{force:true});await rm(files.serial,{force:true});
  console.log(`Certificados creados en ${output}`);
  await rm(files.caKey); // No further certificates should be issued with this one-time signing key.
  console.log('Para permitir HTTPS local, confía únicamente el certificado de localhost en el llavero del usuario:');
  console.log(`security add-trusted-cert -r trustAsRoot -p ssl -s localhost -k "$HOME/Library/Keychains/login.keychain-db" "${files.cert}"`);
} catch(error) {await rm(files.csr,{force:true});await rm(files.ext,{force:true});await rm(files.serial,{force:true});throw error;}

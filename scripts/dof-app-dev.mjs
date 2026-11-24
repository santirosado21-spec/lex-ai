// Separate working copy only. Never run against the user's live data directory.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';
import {startServer} from '../server/main.mjs';
if(process.env.LEX_DESKTOP||process.env.LEX_OFFICE_BRIDGE)throw Error('Use a separate development environment without desktop/Office startup flags');
const directory=path.resolve('artifacts/library-expansion-20261124');
const dataDir=mkdtempSync(path.join(tmpdir(),'rejon-dof-app-'));
const app=await startServer({port:0,dataDir,autoInitialize:false,libraryPath:path.join(dataDir,'no-active-library.sqlite'),dofReview:{directory},inference:{status:async()=>({state:'disabled',message:'Document review only'}),stop:async()=>{},generate:async()=>{throw Error('Generation disabled in review development');}}});
console.log(`${app.connection.url}/#review=dof&token=${app.connection.token}`);
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await app.close();process.exit(0);});

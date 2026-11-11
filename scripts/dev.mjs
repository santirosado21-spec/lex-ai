import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';
// Developer convenience only. Packaged app has its own bundled engine and model storage.
process.env.LEX_DATA_DIR ||= path.resolve('.data');
if(!process.env.LEX_OLLAMA_BIN&&existsSync('/Applications/Ollama.app/Contents/Resources/ollama'))process.env.LEX_OLLAMA_BIN='/Applications/Ollama.app/Contents/Resources/ollama';
if(!process.env.LEX_MODELS_DIR&&existsSync(path.join(os.homedir(),'.ollama/models')))process.env.LEX_MODELS_DIR=path.join(os.homedir(),'.ollama/models');
const {startServer}=await import('../server/main.mjs');
const app=await startServer({port:4318});
console.log(`Rejon.AI: ${app.connection.url}/#token=${app.connection.token}`);
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await app.close();process.exit(0);});

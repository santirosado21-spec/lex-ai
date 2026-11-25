// Test-only reader and synthetic content. Not packaged/imported by production.
import {nativePilotEntry} from '../../../server/native-pilot-entry.mjs';
const result=await nativePilotEntry({root:process.argv[2],exercise:'rust-case',readSecret:async()=>Buffer.from('synthetic rust vault phrase only')});
if(result.failed||!result.closed)process.exitCode=1;

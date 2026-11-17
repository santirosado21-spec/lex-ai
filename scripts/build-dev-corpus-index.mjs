import {buildDevIndex} from '../server/dev-corpus-index.mjs';
const [manifest='docs/qa/zac-candidato-v36c-manifest-2026-11-17.json',out='artifacts/dev-index/zac-v36c-dev.sqlite']=process.argv.slice(2);
console.log(JSON.stringify(buildDevIndex({manifestPath:manifest,corpusRoot:'artifacts/public-corpus',outFile:out}),null,1));

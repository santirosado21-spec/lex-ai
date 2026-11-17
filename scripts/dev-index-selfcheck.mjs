// Autoverificacion de recuperacion (no validacion de relevancia): toma un fragmento literal de articulos al azar (semilla fija) y comprueba que la busqueda devuelve ese mismo registro entre los 5 primeros.
import {DatabaseSync} from 'node:sqlite';import {openDevIndex} from '../server/dev-corpus-index.mjs';
const file='artifacts/dev-index/zac-v36c-dev.sqlite';const db=new DatabaseSync(file,{readOnly:true});const idx=openDevIndex(file);
let seed=20261117;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
const rows=db.prepare("SELECT document_id,article_id,record_kind,text,source_pages FROM records WHERE record_kind='articulo' AND length(text)>200").all();
let ok=0,n=0,miss=[];
for(let i=0;i<300;i++){const r=rows[Math.floor(rnd()*rows.length)];const words=r.text.split(/\s+/);const start=Math.floor(rnd()*Math.max(1,words.length-14));const q=words.slice(start,start+9).join(' ');
 const hits=idx.search({query:q,limit:5});n++;if(hits.some(h=>h.document_id===r.document_id&&h.article_id===r.article_id&&h.text===r.text))ok++;else miss.push([r.document_id,r.article_id]);}
console.log(JSON.stringify({consultas:n,recuperadoTop5:ok,tasa:+(ok/n).toFixed(3),sinRecuperar:miss.slice(0,10)}));

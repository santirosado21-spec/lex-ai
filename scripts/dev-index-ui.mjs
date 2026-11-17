// Visor DEV aislado (no es la UI del producto): sirve solo en 127.0.0.1, solo lectura sobre el indice dev. Sin red externa.
import http from 'node:http';import {openDevIndex} from '../server/dev-corpus-index.mjs';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LABEL={articulo:'Artículos','transitorio':'Transitorios','prefacio-articulo-citado':'Prefacio (artículo citado)'};
export function startDevUi({file='artifacts/dev-index/zac-v36c-dev.sqlite',port=0}={}){
 const idx=openDevIndex(file);
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');if(u.pathname!=='/'){res.writeHead(404).end('no');return;}
  const q=u.searchParams.get('q')??'';const kinds=u.searchParams.getAll('k');const sel=kinds.length?kinds.filter(k=>LABEL[k]):['articulo'];
  const hits=q?idx.search({query:q,kinds:sel,limit:10}):[];
  const html=`<!doctype html><meta charset=utf-8><title>Zacatecas · índice de desarrollo</title><style>body{font:15px system-ui;max-width:960px;margin:24px auto;padding:0 16px}.banner{background:#fff3cd;border:1px solid #d9a400;padding:10px 14px;border-radius:6px}.hit{border:1px solid #ccc;border-radius:6px;padding:10px 14px;margin:12px 0}.meta{color:#444;font-size:12px}.tag{display:inline-block;background:#eee;border-radius:4px;padding:1px 6px;margin-right:6px;font-size:12px}</style>
<h1>Zacatecas · índice de desarrollo (v36c)</h1>
<div class=banner role=note><b>EXPERIMENTAL · EN CUARENTENA.</b> Uso interno de desarrollo y pruebas. Revisión legal: <b>${esc(idx.meta.legalReview)}</b> · publicado: ${esc(idx.meta.published)} · indexado en producción: ${esc(idx.meta.productionIndexed)}. No certifica vigencia ni derechos.</div>
<form><input name=q value="${esc(q)}" aria-label=Buscar size=50> ${Object.keys(LABEL).map(k=>`<label><input type=checkbox name=k value=${k}${sel.includes(k)?' checked':''}> ${LABEL[k]}</label>`).join(' ')} <button>Buscar</button></form>
<p>${q?`${hits.length} resultado(s) · tipos: ${sel.map(k=>LABEL[k]).join(', ')}`:'Escribe una consulta. Por defecto solo artículos.'}</p>
${hits.map(h=>`<div class=hit><span class=tag>${esc(LABEL[h.record_kind])}</span><b>${esc(h.document_id)}</b> · ${h.record_kind==='articulo'?'Art. '+esc(h.article_id):esc(h.ordinal_label??'')}<div>${esc(h.text.slice(0,500))}${h.text.length>500?'…':''}</div><div class=meta>capa ${esc(h.layer)} · pp. ${esc(h.source_pages.join(', '))} · publicación declarada ${esc(h.declared_publication_at??'—')} · revisión legal ${esc(h.legal_review)} · PDF sha256 ${esc(h.pdf_sha256.slice(0,16))}… · <a href="${esc(h.source_url)}">fuente</a></div></div>`).join('')}`;
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}).end(html);});
 return new Promise(r=>server.listen(port,'127.0.0.1',()=>r({url:`http://127.0.0.1:${server.address().port}/`,close:()=>{server.close();idx.close();}})));
}

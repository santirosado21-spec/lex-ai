// DEV-ONLY, reversible, isolated search index built from a release-CANDIDATE manifest by hash.
// Not the product index: never reads or writes resources/legal-corpus.json, never marks anything published/indexed-in-production,
// keeps legalReview/textReview as recorded in the extraction, and separates article / transitorio / prefacio records.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,renameSync,rmSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const DEV_INDEX_PURPOSE='development-only-not-product-not-legal-validation';
export const KINDS=['articulo','transitorio','prefacio-articulo-citado'];
const norm=s=>String(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function buildDevIndex({manifestPath,corpusRoot,outFile}){
  const manifestBytes=readFileSync(manifestPath);const manifest=JSON.parse(manifestBytes);
  if(manifest.kind!=='zacatecas-release-candidate-manifest'||!Array.isArray(manifest.documents_list))throw new Error('Unexpected manifest');
  const outDir=path.dirname(outFile);if(!path.resolve(outDir).includes(path.sep+'dev-index'))throw new Error('Dev index must live under a dev-index directory');
  mkdirSync(outDir,{recursive:true});const tmp=outFile+'.tmp';rmSync(tmp,{force:true});
  const db=new DatabaseSync(tmp);
  db.exec(`PRAGMA journal_mode=OFF;
   CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT);
   CREATE TABLE records(rowid INTEGER PRIMARY KEY,document_id TEXT,layer TEXT,record_kind TEXT,article_id TEXT,ordinal_label TEXT,heading_title TEXT,text TEXT,text_norm TEXT,text_sha256 TEXT,source_pages TEXT,source_url TEXT,pdf_sha256 TEXT,extraction_file_sha256 TEXT,declared_publication_at TEXT,declared_amended_at TEXT,text_review TEXT,legal_review TEXT,status TEXT,published INTEGER,indexed INTEGER);
   CREATE VIRTUAL TABLE fts USING fts5(text_norm,content='records',content_rowid='rowid',tokenize='unicode61');`);
  const ins=db.prepare('INSERT INTO records(document_id,layer,record_kind,article_id,ordinal_label,heading_title,text,text_norm,text_sha256,source_pages,source_url,pdf_sha256,extraction_file_sha256,declared_publication_at,declared_amended_at,text_review,legal_review,status,published,indexed) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const counts={};let docs=0;
  db.exec('BEGIN');
  for(const d of manifest.documents_list){
    const file=path.join(corpusRoot,d.dir,d.extractionPath);const bytes=readFileSync(file);
    if(sha(bytes)!==d.extractionFileSha256)throw new Error('Extraction hash mismatch: '+d.documentId);
    const e=JSON.parse(bytes);
    if(e.pdfSha256!==d.pdfSha256||e.status!=='quarantined'||e.published!==false||e.indexed!==false)throw new Error('Extraction state drift: '+d.documentId);
    for(const r of e.records){const kind=r.recordKind??'articulo';if(!KINDS.includes(kind))throw new Error('Unknown record kind '+kind);
      if(sha(r.text)!==r.textSha256)throw new Error('Record text hash mismatch: '+r.id);
      ins.run(d.documentId,d.layer,kind,r.articleId??null,r.ordinalLabel??null,r.headingTitle??null,r.text,norm(r.text),r.textSha256,JSON.stringify(r.sourcePages),e.sourceUrl,e.pdfSha256,d.extractionFileSha256,e.declaredPublicationAt??null,e.declaredAmendedAt??null,e.textReview,e.legalReview,e.status,0,0);
      counts[kind]=(counts[kind]||0)+1;}
    docs++;}
  db.exec('COMMIT');
  db.exec("INSERT INTO fts(rowid,text_norm) SELECT rowid,text_norm FROM records");
  const meta={purpose:DEV_INDEX_PURPOSE,manifestSha256:sha(manifestBytes),documents:String(docs),counts:JSON.stringify(counts),legalReview:'pending',published:'false',productionIndexed:'false',builtFrom:manifest.generatedFrom};
  for(const [k,v] of Object.entries(meta))db.prepare('INSERT INTO meta VALUES(?,?)').run(k,v);
  db.close();rmSync(outFile,{force:true});renameSync(tmp,outFile);
  return {outFile,docs,counts,manifestSha256:meta.manifestSha256,indexSha256:sha(readFileSync(outFile))};
}
export function openDevIndex(file){
  const db=new DatabaseSync(file,{readOnly:true});const meta=Object.fromEntries(db.prepare('SELECT k,v FROM meta').all().map(r=>[r.k,r.v]));
  if(meta.purpose!==DEV_INDEX_PURPOSE)throw new Error('Not a dev index');
  return {meta,
    search({query,kinds=['articulo'],documentId=null,limit=10}){
      const tokens=[...new Set(norm(query).match(/[\p{L}\p{N}]+/gu)??[])].slice(0,12);if(!tokens.length)return [];
      const q=tokens.map(t=>'"'+t+'"').join(' AND ');
      const ph=kinds.map(()=>'?').join(',');
      const sql=`SELECT r.document_id,r.layer,r.record_kind,r.article_id,r.ordinal_label,r.source_pages,r.pdf_sha256,r.source_url,r.declared_publication_at,r.declared_amended_at,r.legal_review,r.text,bm25(fts) AS rank FROM fts JOIN records r ON r.rowid=fts.rowid WHERE fts MATCH ? AND r.record_kind IN (${ph})${documentId?' AND r.document_id=?':''} ORDER BY rank LIMIT ?`;
      return db.prepare(sql).all(q,...kinds,...(documentId?[documentId]:[]),limit).map(r=>({...r,source_pages:JSON.parse(r.source_pages)}));},
    counts(){return db.prepare('SELECT record_kind,COUNT(*) n FROM records GROUP BY record_kind').all();},
    close(){db.close();}};
}

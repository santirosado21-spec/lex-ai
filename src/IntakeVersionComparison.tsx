import {useEffect,useRef,useState} from 'react';
import {api} from './api';
type Paragraph={type:'equal'|'added'|'removed'|'changed';a?:string;b?:string;words?:{type:'equal'|'added'|'removed';text:string}[]};
type Comparison={documents:{id:string;label:string;sha256:string;characters:number}[];result:{paragraphs:Paragraph[];truncated:boolean;stats:{equal:number;added:number;removed:number;changed:number}}};
export default function IntakeVersionComparison({first,second,disabled}:{first?:string;second?:string;disabled:boolean}){
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const [comparison,setComparison]=useState<Comparison|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setComparison(null);setError('');},[first,second]);
 async function compare(){
  if(!first||!second||first===second)return;
  const controller=new AbortController();request.current=controller;
  setBusy(true);setError('');setComparison(null);
  try{const data=await api<Comparison>('intake.compareVersions',{ids:[first,second]},controller.signal);if(!controller.signal.aborted)setComparison(data);}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'No se pudo comparar el texto de los documentos.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Comparación local de versiones" className="rp-version-comparison">
  <p>Para cotejar cambios de redacción, elige arriba la versión base y la versión revisada. No se determina si son el mismo contrato ni qué efecto jurídico tiene un cambio.</p>
  <button type="button" className="rp-quiet" disabled={disabled||busy||!first||!second||first===second} onClick={()=>void compare()}>{busy?'Comparando en este equipo…':'Comparar versiones en este equipo'}</button>
  {error&&<p role="alert">{error}</p>}
  {comparison&&<div className="rp-reveal">
   <h3 className="rp-version-title">Comparación léxica local</h3><p>Esta vista muestra el texto original restituido solo en este equipo.</p><p>No es análisis jurídico. Se compara el texto extraído, no formato, imágenes, firmas o anexos no leídos. Cambios solo de espacios o Unicode equivalente pueden aparecer sin cambio.</p>
   {comparison.result.truncated&&<p role="alert">Comparación parcial: se alcanzó un límite técnico. No se ha cotejado todo el texto.</p>}
   <ol aria-label="Versiones comparadas">{comparison.documents.map((doc,i)=><li key={doc.id}>{i===0?'A · Base':'B · Revisada'}: {doc.label} · {doc.characters} caracteres<details><summary>Integridad del texto extraído</summary><code>{doc.sha256}</code></details></li>)}</ol>
   <p role="status">{comparison.result.stats.changed} párrafos cambiados, {comparison.result.stats.added} añadidos, {comparison.result.stats.removed} eliminados, {comparison.result.stats.equal} sin cambio léxico.</p>
   <p>Eliminado de A: texto tachado. Añadido en B: texto subrayado. Un traslado puede mostrarse como eliminación y adición.</p>
   <div aria-label="Cambios entre versiones">{comparison.result.paragraphs.map((p,i)=><section key={i} className="rp-version-paragraph"><h4>{({equal:'Sin cambio léxico',added:'Añadido en B',removed:'Eliminado de A',changed:'Cambiado'})[p.type]}</h4>
    <p>{p.type==='changed'?p.words?.map((word,j)=>word.type==='added'?<ins key={j}>{word.text}</ins>:word.type==='removed'?<del key={j}>{word.text}</del>:<span key={j}>{word.text}</span>):p.type==='added'?<ins>{p.b}</ins>:p.type==='removed'?<del>{p.a}</del>:p.a}</p>
   </section>)}</div>
   <button type="button" className="rp-quiet" onClick={()=>setComparison(null)}>Cerrar comparación y limpiar texto</button>
  </div>}
 </section>;
}

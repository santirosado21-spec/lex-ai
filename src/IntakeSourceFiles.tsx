import {useState} from 'react';
import {Download,Files,Plus} from 'lucide-react';
import LocalIntakeImport from './LocalIntakeImport';
import {api,downloadFile} from './api';

export type CaseSource={id:string;label:string;hasFile:boolean;extension:string|null};
type Props={sources:CaseSource[];pair:string[]|null;disabled:boolean;
 onSave:(reviewId:string,label:string)=>Promise<boolean>;onCompare:(ids:string[])=>Promise<void>};

export default function IntakeSourceFiles({sources,pair,disabled,onSave,onCompare}:Props){
 const [open,setOpen]=useState(false),[adding,setAdding]=useState(false),[working,setWorking]=useState(false);
 const [label,setLabel]=useState(''),[review,setReview]=useState<string>(),[message,setMessage]=useState('');
 const [left,setLeft]=useState(''),[right,setRight]=useState('');
 const first=left||pair?.[0]||sources[0]?.id,second=right||pair?.[1]||sources[1]?.id;
 const busy=working||disabled;
 const options=sources.map((s,i)=><option key={s.id} value={s.id}>{i+1} · {s.label}</option>);
 async function save(){
  if(!review)return;
  setWorking(true);setMessage('');
  try{
   const duplicate=await onSave(review,label.trim());
   setMessage(duplicate?'El archivo ya está guardado en este expediente.':'Documento guardado en este equipo.');
   setAdding(false);setReview(undefined);setLabel('');
  }catch(error){setMessage(error instanceof Error?error.message:'No se pudo guardar el documento.');}
  finally{setWorking(false);}
 }
 async function compare(ids:string[]){
  setWorking(true);setMessage('');
  try{await onCompare(ids);setOpen(false);setLeft('');setRight('');}
  catch(error){setMessage(error instanceof Error?error.message:'No se pudo preparar el cotejo.');}
  finally{setWorking(false);}
 }
 async function download(id:string){
  setWorking(true);setMessage('');
  try{downloadFile(await api<{name:string;base64:string;mime:string}>('intake.downloadSource',{id}));}
  catch(error){setMessage(error instanceof Error?error.message:'No se pudo recuperar el archivo.');}
  finally{setWorking(false);}
 }
 return <section className="rp-source-files">
  <button type="button" className="rp-quiet" aria-expanded={open} disabled={busy} onClick={()=>setOpen(!open)}><Files size={16}/>Documentos del expediente ({sources.length})</button>
  {open&&<div className="rp-reveal">
   {!!sources.length&&<ol>{sources.map(s=><li key={s.id}><span>{s.label}</span>{s.hasFile?<button type="button" className="rp-quiet" disabled={busy} onClick={()=>void download(s.id)}><Download size={14}/>Descargar original .{s.extension}</button>:<small>Texto del alta</small>}</li>)}</ol>}
   {!adding?<button type="button" className="rp-quiet" disabled={busy} onClick={()=>{setAdding(true);setMessage('');}}><Plus size={16}/>Añadir documento</button>:
   <div className="rp-source-add"><LocalIntakeImport attachment onReplace={()=>setReview(undefined)} onReviewChange={id=>setReview(id)} onBusyChange={setWorking}
      onExtract={data=>{setReview(data.reviewId);if(!label)setLabel(data.documentKind==='otro'?'':data.documentKind[0].toUpperCase()+data.documentKind.slice(1));}}/>
    <label>Nombre en el expediente<input value={label} maxLength={100} disabled={busy} placeholder="Contrato de compraventa" onChange={e=>setLabel(e.target.value)}/></label>
    <div className="rp-actions"><button type="button" className="rp-primary" disabled={busy||!review||!label.trim()} onClick={()=>void save()}>Guardar documento en este equipo</button>
     <button type="button" className="rp-quiet" disabled={busy} onClick={()=>{setAdding(false);setReview(undefined);setLabel('');}}>Cancelar</button></div></div>}
   {sources.length>1&&!adding&&<fieldset><legend>Cotejar dos documentos</legend>
    <p>Elige los soportes de la misma operación. Rejon coteja las menciones de flete, regalías y acuses.</p>
    <div className="rp-source-pair"><label>Primer documento<select value={first} disabled={busy} onChange={e=>setLeft(e.target.value)}>{options}</select></label>
     <label>Segundo documento<select value={second} disabled={busy} onChange={e=>setRight(e.target.value)}>{options}</select></label></div>
    <div className="rp-actions"><button type="button" className="rp-primary" disabled={busy||!first||!second||first===second} onClick={()=>void compare([first,second])}>Cotejar documentos</button>
     {pair&&<button type="button" className="rp-quiet" disabled={busy} onClick={()=>void compare([])}>Volver al soporte inicial</button>}</div>
   </fieldset>}
   {message&&<p role="status">{message}</p>}
  </div>}
 </section>;
}

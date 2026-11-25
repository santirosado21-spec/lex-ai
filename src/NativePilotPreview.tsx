import {useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {api,resetNativePilotConnection} from './api';
import IntakeVersionComparison from './IntakeVersionComparison';
import './intake-pilot.css';
type State='locked'|'unlocked'|'busy'|'failed'|'recover';
type Source={id:string;label:string};
export default function NativePilotPreview(){
 const generation=useRef(0);
 const [state,setState]=useState<State>('busy'),[error,setError]=useState(''),[sources,setSources]=useState<Source[]>([]),[first,setFirst]=useState(''),[second,setSecond]=useState(''),[text,setText]=useState(''),[epoch,setEpoch]=useState(0),[practice,setPractice]=useState(false);
 const clear=()=>{generation.current++;resetNativePilotConnection();setSources([]);setPractice(false);setText('');setFirst('');setSecond('');setEpoch(n=>n+1);};
 useEffect(()=>{let active=true;invoke<{state:string}>('native_status').then(s=>{if(active)setState(s.state==='locked'?'locked':s.state==='unlocked'?'recover':'failed');}).catch(()=>{if(active)setState('failed');});return()=>{active=false;resetNativePilotConnection();};},[]);
 async function open(create:boolean){
  setState('busy');setError('');clear();
  try{await invoke(create?'native_create':'native_unlock');const connection=await invoke<{url:string;token:string}>('native_connection');resetNativePilotConnection(connection);const status=await api<{sources:Source[];nativePractice?:unknown}>('intake.status');setSources(status.sources);setPractice(Boolean(status.nativePractice));setFirst(status.sources[0]?.id??'');setSecond(status.sources[1]?.id??'');setState('unlocked');}
  catch{clear();setError('No se pudo abrir. Si cancelaste el diálogo, puedes volver a intentarlo.');try{const s=await invoke<{state:string}>('native_status');setState(s.state==='locked'?'locked':s.state==='unlocked'?'recover':'failed');}catch{setState('failed');}}
 }
 async function loadPractice(){const current=generation.current;setError('');try{await api('intake.loadNativePractice',{});const status=await api<{sources:Source[];nativePractice?:unknown}>('intake.status');if(current!==generation.current)return;setSources(status.sources);setFirst(status.sources[0]?.id??'');setSecond(status.sources[1]?.id??'');setPractice(Boolean(status.nativePractice));}catch{if(current!==generation.current)return;setError('No se pudo cargar la práctica. Solo puede usarse un expediente vacío.');}}
 async function lock(){
  clear();setState('busy');setError('');
  try{const result=await invoke<{state:string}>('native_lock');if(result.state!=='locked')throw Error();setState('locked');}
  catch{setState('failed');setError('No se confirmó el cierre. No abras otra sesión hasta revisar el proceso local.');}
 }
 async function read(){const current=generation.current;setText('');try{const data=await api<{original:string}>('intake.readDocument',{id:first});if(current===generation.current)setText(data.original);}catch{if(current===generation.current)setError('No se pudo abrir el texto local.');}}
 return <main className="rp-shell rp-native-preview" style={{maxWidth:900,margin:'24px auto',padding:24}}><h1>Piloto cifrado nativo</h1><p>Vista de preparación aislada. Sin importación, modelos ni nube. No es una revisión jurídica ni una versión distribuible.</p>
  {error&&<p role="alert">{error}</p>}
  {state==='locked'&&<section aria-label="Expediente bloqueado"><h2>Expediente bloqueado</h2><p>La frase se pide en un diálogo del sistema. No la escribas aquí.</p><button className="rp-primary" onClick={()=>void open(false)}>Abrir expediente</button> <button className="rp-quiet" onClick={()=>void open(true)}>Crear expediente cifrado</button></section>}
  {state==='busy'&&<p role="status">Esperando la operación local. El texto permanece oculto.</p>}
  {state==='recover'&&<section aria-label="Recuperar bloqueo"><p>Hay una sesión abierta. Bloquéala antes de continuar. No se recuperará texto automáticamente.</p><button className="rp-primary" onClick={()=>void lock()}>Bloquear sesión abierta</button></section>}
  {state==='failed'&&<p role="alert">Sesión no disponible. No se confirmó un estado seguro para continuar.</p>}
  {state==='unlocked'&&<section key={epoch} aria-label="Expediente abierto"><button className="rp-primary" onClick={()=>void lock()}>Bloquear y retirar texto</button><p>Solo se pueden leer y comparar soportes ya guardados. No se migra una base en claro.</p>{practice&&<p role="note">Práctica sintética preanotada. No prueba anonimización ni análisis jurídico.</p>}{!sources.length?<div><p>Este expediente aún no tiene soportes. La importación queda fuera de esta preparación.</p><button className="rp-quiet" onClick={()=>void loadPractice()}>Cargar práctica ficticia de cotejo</button></div>:<><label>Documento base<select value={first} onChange={e=>{generation.current++;setFirst(e.target.value);setText('');}}>{sources.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button className="rp-quiet" onClick={()=>void read()}>Leer texto original local</button>{text&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text}</pre>}<label>Documento revisado<select value={second} onChange={e=>setSecond(e.target.value)}>{sources.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><IntakeVersionComparison key={first+':'+second} first={first} second={second} disabled={false}/></>}</section>}
 </main>;
}

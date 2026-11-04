import {useEffect,useId,useRef,useState} from 'react';
import {LockKeyhole,MessageSquare,Plus,Search,X} from 'lucide-react';
import './chat-sidebar.css';

interface Props {
  matters:{id:string;title:string}[];
  matterId:string;
  matterTitle?:string;
  documentCount:number;
  threads:{id:string;title:string;last:string}[];
  currentThread:string;
  pendingThread:boolean;
  generating:boolean;
  onMatter:(id:string)=>void;
  onThread:(id:string)=>void;
  onNew:()=>void;
}
const dates=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'});
export default function ChatSidebar(props:Props){
  const [narrow,setNarrow]=useState(()=>matchMedia('(max-width:1100px)').matches);
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const id=useId();
  useEffect(()=>{
    const media=matchMedia('(max-width:1100px)');
    const change=()=>{setNarrow(media.matches);setOpen(false);};
    media.addEventListener('change',change);
    return ()=>media.removeEventListener('change',change);
  },[]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  useEffect(()=>setQuery(''),[props.matterId]);
  function act(action:()=>void){dialog.current?.close();setOpen(false);action();}
  const needle=query.trim().toLocaleLowerCase('es-MX');
  const threads=props.threads.filter(thread=>thread.title.toLocaleLowerCase('es-MX').includes(needle));
  const content=<>
    <header className="lex-chats-heading"><h2 id={id}>Chats</h2>{narrow&&<button type="button" className="lex-chats-close" aria-label="Cerrar chats" onClick={()=>setOpen(false)}><X size={18}/></button>}</header>
    <button type="button" className="lex-chats-new" disabled={props.generating} onClick={()=>act(props.onNew)}><Plus size={18}/>Nuevo chat</button>
    <label className="lex-chats-search"><Search size={15} aria-hidden="true"/><input type="search" aria-label="Buscar chats" placeholder="Buscar chats" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <label className="lex-chats-scope">Contexto del chat<select aria-label="Contexto de los chats" value={props.matterId} disabled={props.generating} onChange={event=>act(()=>props.onMatter(event.target.value))}><option value="">Conversación general</option>{props.matters.map(matter=><option key={matter.id} value={matter.id}>{matter.title}</option>)}</select></label>
    <p className="lex-chats-section">{props.matterTitle?'Chats del asunto':'Tus conversaciones'}</p>
    <nav className="lex-chats-history" aria-label="Historial de chats"><ul>
      {props.pendingThread&&!needle&&<li><button type="button" aria-current="true" className="lex-chats-item" disabled={props.generating} onClick={()=>act(()=>props.onThread(props.currentThread))}><MessageSquare size={15}/><span>Nuevo chat<small>Sin mensajes</small></span></button></li>}
      {threads.map(thread=><li key={thread.id||'principal'}><button type="button" className="lex-chats-item" aria-current={thread.id===props.currentThread?'true':undefined} disabled={props.generating} onClick={()=>act(()=>props.onThread(thread.id))}><MessageSquare size={15}/><span title={thread.title}>{thread.title||'Conversación'}<small>{dates.format(new Date(thread.last))}</small></span></button></li>)}
    </ul>{threads.length===0&&(!props.pendingThread||needle)&&<p className="lex-chats-empty">{needle?'No hay chats con ese nombre.':'Empieza una conversación. Tu historial se guardará en este equipo.'}</p>}</nav>
    <p className="lex-chats-privacy"><LockKeyhole size={13}/><span>{props.matterTitle?`${props.documentCount} documentos de este asunto. Chats guardados en este equipo.`:'Chats guardados en este equipo.'}</span></p>
  </>;
  if(!narrow)return <aside className="lex-chats-panel" aria-labelledby={id}>{content}</aside>;
  return <><div className="lex-chats-toolbar"><button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} onClick={()=>setOpen(true)}><MessageSquare size={17}/>Chats</button><span>{props.matterTitle||'Conversación general'}</span></div><dialog ref={dialog} id={`${id}-dialog`} className="lex-chats-dialog" aria-labelledby={id} onClose={()=>{setOpen(false);trigger.current?.focus();}} onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><div className="lex-chats-panel">{content}</div></dialog></>;
}

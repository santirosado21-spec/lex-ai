import {BookOpen,FileText,FolderOpen,Home,MessageSquare,MoreHorizontal,type LucideIcon} from 'lucide-react';
import './dock.css';
export type DockDestination='home'|'workspace'|'matters'|'documents'|'library';
interface DockItem {id:DockDestination;label:string;icon:LucideIcon}
const items:DockItem[]=[{id:'home',label:'Inicio',icon:Home},{id:'workspace',label:'Asistente',icon:MessageSquare},{id:'matters',label:'Asuntos',icon:FolderOpen},{id:'documents',label:'Documentos',icon:FileText},{id:'library',label:'Biblioteca',icon:BookOpen}];
interface DockProps {activePage:string;onNavigate:(page:DockDestination)=>void;onMore:()=>void;moreExpanded:boolean;inert?:boolean}
/** LEX adaptation of the supplied icon-dock pattern; every action uses real app state. */
export default function Dock({activePage,onNavigate,onMore,moreExpanded,inert=false}:DockProps){
 const current=activePage==='dossier'?'matters':activePage;
 const secondary=!items.some(item=>item.id===current);
 return <nav className="lex-dock" aria-label="Navegación principal" inert={inert}>
  <div className="lex-dock-surface tw:grid tw:grid-cols-6">{items.map(({id,label,icon:Icon})=><button type="button" key={id} className="lex-dock-action" aria-current={current===id?'page':undefined} onClick={()=>onNavigate(id)} title={id==='library'?'Biblioteca federal':label}><Icon size={20} strokeWidth={1.7} aria-hidden="true"/><span>{label}</span></button>)}
   <button type="button" className={`lex-dock-action lex-dock-more${secondary?' lex-dock-secondary-active':''}`} aria-haspopup="dialog" aria-expanded={moreExpanded} onClick={onMore} title="Buscar y abrir todas las secciones"><MoreHorizontal size={20} strokeWidth={1.7} aria-hidden="true"/><span>Más</span></button>
  </div>
 </nav>;
}

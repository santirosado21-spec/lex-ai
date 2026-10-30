import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { matchesSearch } from './workspace-utils';
export interface CommandItem {id:string;title:string;detail:string;group:string;icon:ComponentType<{size?:number}>;run:()=>void}
export default function CommandPalette({items,scope,onClose}:{items:CommandItem[];scope:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 const id=useId();const [query,setQuery]=useState(''),[active,setActive]=useState(0);
 const ordered=[...items].sort((a,b)=>['Documentos','Consultas','Navegación','Acciones'].indexOf(a.group)-['Documentos','Consultas','Navegación','Acciones'].indexOf(b.group));
 const filtered=ordered.filter(item=>matchesSearch(`${item.title} ${item.detail}`,query)).slice(0,30);
 const selected=Math.min(active,Math.max(filtered.length-1,0));
 useEffect(()=>{dialog.current?.showModal();input.current?.focus();return()=>dialog.current?.close();},[]);
 useEffect(()=>{document.getElementById(`${id}-option-${selected}`)?.scrollIntoView({block:'nearest'});},[selected,id]);
 const execute=(item:CommandItem)=>{onClose();item.run();};
 return <dialog ref={dialog} className="command-dialog" aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();if(query){setQuery('');setActive(0);}else onClose();}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}}}>
  <h2 id={`${id}-title`} className="sr-only">Buscar y ejecutar acciones</h2>
  <div className="command-search"><Search size={19}/><input ref={input} role="combobox" aria-label="Buscar acciones, documentos y consultas" aria-controls={`${id}-results`} aria-expanded="true" aria-autocomplete="list" aria-activedescendant={filtered.length?`${id}-option-${selected}`:undefined} placeholder="Busca un documento, consulta o acción…" value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} onKeyDown={event=>{if(event.key==='Home'){event.preventDefault();setActive(0);}if(event.key==='End'){event.preventDefault();setActive(filtered.length-1);}if(event.key==='ArrowDown'){event.preventDefault();setActive(index=>Math.min(index+1,filtered.length-1));}if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(index-1,0));}if(event.key==='Enter'&&filtered[selected]){event.preventDefault();execute(filtered[selected]);}}}/><button className="icon-button" aria-label="Cerrar búsqueda" onClick={onClose}><X size={17}/></button></div>
  <p className="command-scope">Asunto activo: {scope}<span>Los archivos y consultas se limitan al asunto activo.</span></p>
  <div className="command-results" role="listbox" id={`${id}-results`} aria-label="Resultados de búsqueda">{filtered.map((item,index)=><div key={item.id}>{(index===0||item.group!==filtered[index-1].group)&&<div className="command-group" aria-hidden="true">{item.group}</div>}<button type="button" role="option" aria-selected={index===selected} id={`${id}-option-${index}`} tabIndex={-1} className={`command-result ${index===selected?'selected':''}`} onMouseMove={()=>setActive(index)} onClick={()=>execute(item)}><item.icon size={18}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight size={14}/></button></div>)}</div>
  {!filtered.length&&<div className="command-empty">No hay coincidencias en este asunto.<small>La búsqueda incluye nombres de archivo, consultas y acciones disponibles.</small></div>}
  <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> elegir</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> cerrar</span><span>{filtered.length} resultados</span></footer>
 </dialog>;
}

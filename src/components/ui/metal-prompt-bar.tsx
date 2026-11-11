import {useCallback,useLayoutEffect,useRef,type ReactNode,type RefObject} from 'react';
import {ArrowUp,LockKeyhole,Paperclip,Square} from 'lucide-react';
import type {Matter,Skill} from '../../api';
import './metal-prompt-bar.css';
export interface PromptSelection {start:number;end:number;direction:'forward'|'backward'|'none'}
export interface MetalPromptBarProps {
 value:string;onChange:(value:string)=>void;onSubmit:(text:string)=>void;onCancel:()=>void;
 workspaceReady?:boolean;preparing?:boolean;
 matter?:Matter;documentCount:number;engineReady:boolean;busy:boolean;generating:boolean;
 skills:Skill[];skillId:string;onSkillChange:(id:string)=>void;onAttach:(file:File)=>void;onPrepare:()=>void;
 selectionRef:RefObject<PromptSelection|null>;
 /** Extra input tools shown next to the attach button (e.g. dictation). */
 tools?:ReactNode;
 /** Status from an input tool; replaces the help line while present. */
 notice?:string;
}
export default function MetalPromptBar({workspaceReady=true,preparing=false,value,onChange,onSubmit,onCancel,matter,documentCount,engineReady,busy,generating,skills,skillId,onSkillChange,onAttach,onPrepare,selectionRef,tools,notice}:MetalPromptBarProps){
 const textarea=useRef<HTMLTextAreaElement>(null),form=useRef<HTMLFormElement>(null),file=useRef<HTMLInputElement>(null),composing=useRef(false),previousGenerating=useRef(generating);
 const automatic=skillId==='auto';
 const canSend=workspaceReady&&engineReady&&!busy&&!generating&&value.trim().length>=1&&value.length<=4000;
 const resize=useCallback(()=>{const element=textarea.current;if(!element)return;const styles=getComputedStyle(element),line=parseFloat(styles.lineHeight)||24,padding=(parseFloat(styles.paddingTop)||0)+(parseFloat(styles.paddingBottom)||0),border=(parseFloat(styles.borderTopWidth)||0)+(parseFloat(styles.borderBottomWidth)||0);const maximum=6*line+padding+border;element.style.height='auto';const height=Math.max(44,Math.min(element.scrollHeight+border,maximum));element.style.height=`${height}px`;element.style.overflowY=element.scrollHeight+border>maximum?'auto':'hidden';},[]);
 useLayoutEffect(resize,[value,resize]);
 useLayoutEffect(()=>{const element=form.current;if(!element)return;let width=element.getBoundingClientRect().width;const observer=new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next!==undefined&&next!==width){width=next;resize();}});observer.observe(element);window.addEventListener('resize',resize);return()=>{observer.disconnect();window.removeEventListener('resize',resize);};},[resize]);
 useLayoutEffect(()=>{const finished=previousGenerating.current&&!generating;previousGenerating.current=generating;if(!finished||!value||!selectionRef.current)return;const active=document.activeElement;if(document.querySelector('dialog[open]')||!(active===document.body||form.current?.contains(active)))return;const saved=selectionRef.current;textarea.current?.focus({preventScroll:true});textarea.current?.setSelectionRange(Math.min(saved.start,value.length),Math.min(saved.end,value.length),saved.direction);},[generating,value,selectionRef]);
 function captureSelection(){const element=textarea.current;if(element)selectionRef.current={start:element.selectionStart,end:element.selectionEnd,direction:element.selectionDirection};}
 function submit(){if(!canSend||composing.current)return;captureSelection();onSubmit(value.trim());}
 const LIMIT=4000,length=value.length,over=length>LIMIT,near=!over&&length>=3200;
 const limitState=over?`La pregunta supera el límite de ${LIMIT} caracteres. Acórtala para poder enviarla.`:near?`Te acercas al límite de ${LIMIT} caracteres.`:'';
 const help=!workspaceReady?'Crea tu espacio de trabajo para empezar.':generating?'Procesando la consulta en este equipo. Puedes cancelar y conservar tu pregunta.':preparing?'Preparando Rejon.AI en este equipo…':!engineReady?'Rejon.AI aún no está listo.':busy?'Espera a que termine la operación en curso.':'';
 const send=<button type={generating?'button':'submit'} className={`lex-prompt-send${generating?' lex-prompt-cancel':''}`} aria-label={generating?'Cancelar':'Preguntar'} title={generating?'Cancelar consulta':'Preguntar · Enter'} disabled={!generating&&!canSend} onClick={generating?event=>{event.preventDefault();onCancel();}:undefined}>{generating?<Square size={17} aria-hidden="true"/>:<ArrowUp size={19} aria-hidden="true"/>}<span>{generating?'Cancelar':'Preguntar'}</span></button>;
 return <form ref={form} className="composer lex-prompt-bar" onSubmit={event=>{event.preventDefault();submit();}}>
  <label htmlFor="question" className="sr-only">Pregunta sobre el asunto</label>
  <textarea ref={textarea} id="question" aria-label="Pregunta sobre el asunto" aria-describedby={`lex-prompt-help lex-prompt-scope${over||near?' lex-prompt-limit':''}`} aria-invalid={over||undefined} value={value} onChange={event=>onChange(event.target.value)} onSelect={()=>{if(!generating)captureSelection();}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.key!=='Enter'||event.nativeEvent.isComposing||composing.current||event.nativeEvent.keyCode===229)return;if((event.metaKey||event.ctrlKey)||!event.shiftKey){event.preventDefault();submit();}}} placeholder="Pregunta, analiza o prepara un borrador…" rows={1} maxLength={4000} disabled={!workspaceReady} readOnly={generating}/>
  <div className="lex-prompt-controls"><button type="button" className="lex-prompt-attach" aria-label="Adjuntar documento" title="Adjuntar documento al asunto" disabled={!matter||busy||generating} onClick={()=>file.current?.click()}><Paperclip size={19} aria-hidden="true"/></button><input ref={file} aria-label="Adjuntar archivo al asunto" type="file" accept=".pdf,.docx,.txt,.md" hidden disabled={!matter||busy||generating} onChange={event=>{const selected=event.target.files?.[0];if(selected)onAttach(selected);event.target.value='';}}/>{tools}
   <label className="sr-only" htmlFor="skill">Habilidad</label><select id="skill" aria-label="Habilidad" value={skillId} onChange={event=>onSkillChange(event.target.value)} disabled={generating||busy}><option value="auto">Automática</option>{skills.length?skills.map(skill=><option key={skill.id} value={skill.id}>{skill.name}</option>):<option value="contract-reviewer">Revisión de contratos</option>}</select>
   <span className="lex-prompt-local" role="img" aria-label="Procesado en este equipo" title="Procesado en este equipo"><LockKeyhole size={14} aria-hidden="true"/><span aria-hidden="true">Local</span></span>
   <div className="lex-prompt-send-wrap" data-metal="static">{send}</div>
  </div>
  <div className="lex-prompt-footer" id="lex-prompt-scope"><span>{matter?`${matter.title} · ${documentCount} ${documentCount===1?"documento":"documentos"}`:'Conversación general del despacho'}</span><span className="lex-prompt-shortcut">↩ Preguntar · ⇧↩ Nueva línea</span></div>
  {(near||over)&&<p className={`lex-prompt-limit${over?' is-over':''}`} aria-hidden="true">{over?`Excede el límite por ${length-LIMIT} caracteres · `:''}{length.toLocaleString('es-MX')} / {LIMIT.toLocaleString('es-MX')}</p>}
  <p id="lex-prompt-limit" className="sr-only" role="status">{limitState}</p>
  <p id="lex-prompt-help" className="lex-prompt-help" aria-live="polite">{notice||help}{workspaceReady&&!engineReady&&!preparing&&!generating&&<> <button type="button" onClick={onPrepare}>Preparar Rejon.AI</button></>}</p>
 </form>;
}

export {MetalPromptBar};

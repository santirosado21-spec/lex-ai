import {useCallback,useLayoutEffect,useRef,type RefObject} from 'react';
import {ArrowUp,LockKeyhole,Paperclip,Square} from 'lucide-react';
import type {Matter,Skill} from '../../api';
import './metal-prompt-bar.css';
export interface PromptSelection {start:number;end:number;direction:'forward'|'backward'|'none'}
export interface MetalPromptBarProps {
 value:string;onChange:(value:string)=>void;onSubmit:(text:string)=>void;onCancel:()=>void;
 matter?:Matter;documentCount:number;engineReady:boolean;busy:boolean;generating:boolean;
 skills:Skill[];skillId:string;onSkillChange:(id:string)=>void;onAttach:(file:File)=>void;onPrepare:()=>void;
 selectionRef:RefObject<PromptSelection|null>;
}
export default function MetalPromptBar({value,onChange,onSubmit,onCancel,matter,documentCount,engineReady,busy,generating,skills,skillId,onSkillChange,onAttach,onPrepare,selectionRef}:MetalPromptBarProps){
 const textarea=useRef<HTMLTextAreaElement>(null),form=useRef<HTMLFormElement>(null),file=useRef<HTMLInputElement>(null),composing=useRef(false),previousGenerating=useRef(generating);
 const canSend=Boolean(matter)&&engineReady&&(documentCount>0||skillId==='legal-researcher')&&!busy&&!generating&&value.trim().length>=3&&value.length<=4000;
 const resize=useCallback(()=>{const element=textarea.current;if(!element)return;const styles=getComputedStyle(element),line=parseFloat(styles.lineHeight)||24,padding=(parseFloat(styles.paddingTop)||0)+(parseFloat(styles.paddingBottom)||0),border=(parseFloat(styles.borderTopWidth)||0)+(parseFloat(styles.borderBottomWidth)||0);const maximum=6*line+padding+border;element.style.height='auto';const height=Math.max(44,Math.min(element.scrollHeight+border,maximum));element.style.height=`${height}px`;element.style.overflowY=element.scrollHeight+border>maximum?'auto':'hidden';},[]);
 useLayoutEffect(resize,[value,resize]);
 useLayoutEffect(()=>{const element=form.current;if(!element)return;let width=element.getBoundingClientRect().width;const observer=new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next!==undefined&&next!==width){width=next;resize();}});observer.observe(element);window.addEventListener('resize',resize);return()=>{observer.disconnect();window.removeEventListener('resize',resize);};},[resize]);
 useLayoutEffect(()=>{const finished=previousGenerating.current&&!generating;previousGenerating.current=generating;if(!finished||!value||!selectionRef.current)return;const active=document.activeElement;if(document.querySelector('dialog[open]')||!(active===document.body||form.current?.contains(active)))return;const saved=selectionRef.current;textarea.current?.focus({preventScroll:true});textarea.current?.setSelectionRange(Math.min(saved.start,value.length),Math.min(saved.end,value.length),saved.direction);},[generating,value,selectionRef]);
 function captureSelection(){const element=textarea.current;if(element)selectionRef.current={start:element.selectionStart,end:element.selectionEnd,direction:element.selectionDirection};}
 function submit(){if(!canSend||composing.current)return;captureSelection();onSubmit(value.trim());}
 const help=!matter?'Crea o selecciona un asunto para empezar.':generating?'Procesando la consulta en este equipo. Puedes cancelar y conservar tu pregunta.':!engineReady?'LEX AI aún no está listo.':!documentCount&&skillId!=='legal-researcher'?'Esta habilidad necesita un documento. Para consultar fuentes jurídicas sin archivos, selecciona Investigación jurídica.':busy?'Espera a que termine la operación en curso.':value.trim().length<3?'Escribe al menos 3 caracteres para preguntar.':'Enter para preguntar. Shift + Enter para una nueva línea.';
 const send=<button type={generating?'button':'submit'} className={`lex-prompt-send${generating?' lex-prompt-cancel':''}`} aria-label={generating?'Cancelar':'Preguntar'} title={generating?'Cancelar consulta':'Preguntar · Enter'} disabled={!generating&&!canSend} onClick={generating?onCancel:undefined}>{generating?<Square size={17} aria-hidden="true"/>:<ArrowUp size={19} aria-hidden="true"/>}<span>{generating?'Cancelar':'Preguntar'}</span></button>;
 return <form ref={form} className="composer lex-prompt-bar" onSubmit={event=>{event.preventDefault();submit();}}>
  <label htmlFor="question" className="sr-only">Pregunta sobre el asunto</label>
  <textarea ref={textarea} id="question" aria-label="Pregunta sobre el asunto" aria-describedby="lex-prompt-help lex-prompt-scope" value={value} onChange={event=>onChange(event.target.value)} onSelect={()=>{if(!generating)captureSelection();}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.key!=='Enter'||event.nativeEvent.isComposing||composing.current||event.nativeEvent.keyCode===229)return;if((event.metaKey||event.ctrlKey)||!event.shiftKey){event.preventDefault();submit();}}} placeholder="Pregunta, analiza o prepara un borrador…" rows={1} maxLength={4000} disabled={!matter} readOnly={generating}/>
  <div className="lex-prompt-controls"><button type="button" className="lex-prompt-attach" aria-label="Adjuntar documento" title="Adjuntar documento al asunto" disabled={!matter||busy||generating} onClick={()=>file.current?.click()}><Paperclip size={19} aria-hidden="true"/></button><input ref={file} aria-label="Adjuntar archivo al asunto" type="file" accept=".pdf,.docx,.txt,.md" hidden disabled={!matter||busy||generating} onChange={event=>{const selected=event.target.files?.[0];if(selected)onAttach(selected);event.target.value='';}}/>
   <label className="sr-only" htmlFor="skill">Habilidad</label><select id="skill" aria-label="Habilidad" value={skillId} onChange={event=>onSkillChange(event.target.value)} disabled={!matter||generating||busy}>{skills.length?skills.map(skill=><option key={skill.id} value={skill.id}>{skill.name}</option>):<option value="contract-reviewer">Revisión de contratos</option>}</select>
   <span className="lex-prompt-local" role="img" aria-label="Procesado en este equipo" title="Procesado en este equipo"><LockKeyhole size={14} aria-hidden="true"/><span aria-hidden="true">Local</span></span>
   <div className="lex-prompt-send-wrap" data-metal="static">{send}</div>
  </div>
  <div className="lex-prompt-footer" id="lex-prompt-scope"><span>{matter?`${matter.title} · ${documentCount} documentos`:'Sin asunto activo'}</span><span className="lex-prompt-shortcut">↩ Preguntar · ⇧↩ Nueva línea</span></div>
  <p id="lex-prompt-help" className="lex-prompt-help">{help}{matter&&!engineReady&&!generating&&<> <button type="button" onClick={onPrepare}>Preparar LEX AI</button></>}</p>
 </form>;
}

export {MetalPromptBar};

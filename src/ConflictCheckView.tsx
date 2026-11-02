import {FormEvent, useEffect, useId, useState} from 'react';
import {Plus, Search, ShieldCheck, X} from 'lucide-react';
import {api, type Matter} from './api';

type ConflictMatch={matterId:string;matterTitle:string;field:string;matchedText:string;kind:'exact'|'similar';score:number};
type ConflictResult={candidate:string;matches:ConflictMatch[];truncated:boolean;notice:string};
type MatterWithCounterparties=Matter&{counterparties?:string[]};

const fieldLabel:Record<string,string>={client:'Cliente',counterparty:'Contraparte',counterparties:'Contraparte',otherParty:'Contraparte',otherParties:'Contraparte',parties:'Contraparte',title:'Asunto'};
const readCounterparties=(matter?:Matter)=>Array.isArray((matter as MatterWithCounterparties|undefined)?.counterparties)?(matter as MatterWithCounterparties).counterparties||[]:[];

export default function ConflictCheckView({matter,onRefresh}:{matter?:Matter;onRefresh:()=>Promise<unknown>}) {
  const titleId=useId(),nameId=useId(),partyId=useId();
  const [name,setName]=useState('');
  const [result,setResult]=useState<ConflictResult|null>(null);
  const [counterparties,setCounterparties]=useState<string[]>(()=>readCounterparties(matter));
  const [counterparty,setCounterparty]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{setCounterparties(readCounterparties(matter));setCounterparty('');},[matter?.id]);
  async function review(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!name.trim()||busy)return;
    setBusy('review');setError('');setResult(null);
    try {setResult(await api<ConflictResult>('conflict.check',{name:name.trim(),...(matter?{matterId:matter.id}:{})}));}
    catch(reason) {setError(reason instanceof Error?reason.message:'No se pudo revisar el nombre.');}
    finally {setBusy('');}
  }
  async function save(next:string[]) {
    if(!matter)return;
    setBusy('counterparties');setError('');
    try {const updated=await api<MatterWithCounterparties>('matter.counterparties.set',{matterId:matter.id,counterparties:next});setCounterparties(updated.counterparties||[]);await onRefresh();}
    catch(reason) {setError(reason instanceof Error?reason.message:'No se pudieron guardar las contrapartes.');}
    finally {setBusy('');}
  }
  async function addCounterparty(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const value=counterparty.trim();
    if(!value||counterparties.length>=10||busy)return;
    await save([...counterparties,value]);setCounterparty('');
  }
  const removeCounterparty=(index:number)=>void save(counterparties.filter((_,itemIndex)=>itemIndex!==index));

  return <section className="page conflict-check-page" aria-labelledby={titleId}>
    <div className="page-heading conflict-check-heading"><div><p className="eyebrow">Revisión local</p><h1 id={titleId}>Conflictos</h1><p>Busca pistas en los metadatos de asuntos de este equipo.</p></div></div>
    <div className="conflict-notice" role="note"><ShieldCheck size={18}/><p>Este es un chequeo léxico, no una determinación jurídica de conflicto de intereses; la ausencia de coincidencias no es autorización ni descarta un conflicto.</p></div>
    <form className="conflict-search" onSubmit={event=>void review(event)}>
      <label htmlFor={nameId}>Nombre para revisar</label>
      <div><input id={nameId} value={name} onChange={event=>setName(event.target.value)} minLength={2} maxLength={200} required placeholder="Nombre de persona o entidad"/><button className="primary" type="submit" disabled={Boolean(busy)||name.trim().length<2}><Search size={16}/>{busy==='review'?'Revisando…':'Revisar'}</button></div>
    </form>
    {error?<div className="conflict-error" role="alert"><span>{error}</span><button className="text-button" type="button" onClick={()=>setError('')}>Cerrar</button></div>:null}
    {result?<section className="conflict-results" aria-live="polite" aria-label="Resultados de revisión"><div className="section-heading"><div><h2>Resultados</h2><p>Coincidencias para “{result.candidate}”.</p></div><span>{result.matches.length}</span></div>{result.truncated?<p className="conflict-truncated" role="status">La revisión alcanzó el límite de asuntos; revisa también los registros restantes.</p>:null}{result.matches.length?<ul className="conflict-match-list">{result.matches.map(match=><li key={`${match.matterId}-${match.field}-${match.matchedText}`} className="conflict-match"><div><div className="conflict-match-meta"><span>{fieldLabel[match.field]||'Campo'}</span><span className={`conflict-kind ${match.kind}`}>{match.kind==='exact'?'Exacta':'Similar'}</span></div><h3>{match.matterTitle||'Asunto sin título'}</h3><p>{match.matchedText}</p></div></li>)}</ul>:<div className="conflict-empty"><strong>Sin coincidencias en los datos de este equipo</strong><p>La ausencia de coincidencias no es autorización ni descarta un conflicto; revisa el conflicto de intereses con criterio profesional.</p></div>}</section>:null}
    <section className="counterparties-editor" aria-labelledby={`${titleId}-counterparties`}>
      <div className="section-heading"><div><h2 id={`${titleId}-counterparties`}>Contrapartes del asunto activo</h2><p>{matter?`Hasta 10 nombres para ${matter.title}.`:'Selecciona o crea un asunto para registrar contrapartes.'}</p></div><span>{counterparties.length}/10</span></div>
      {matter?<><ul className="counterparty-chips" aria-label="Contrapartes registradas">{counterparties.map((party,index)=><li key={`${party}-${index}`}><span>{party}</span><button type="button" aria-label={`Eliminar contraparte ${party}`} disabled={Boolean(busy)} onClick={()=>removeCounterparty(index)}><X size={15}/></button></li>)}</ul>{!counterparties.length?<p className="counterparties-empty">Aún no hay contrapartes registradas para este asunto.</p>:null}<form className="counterparty-add" onSubmit={event=>void addCounterparty(event)}><label htmlFor={partyId}>Agregar contraparte</label><div><input id={partyId} value={counterparty} onChange={event=>setCounterparty(event.target.value)} minLength={2} maxLength={200} disabled={Boolean(busy)||counterparties.length>=10} placeholder="Nombre de la contraparte"/><button className="secondary" type="submit" disabled={Boolean(busy)||counterparties.length>=10||counterparty.trim().length<2}><Plus size={16}/>{busy==='counterparties'?'Guardando…':'Agregar'}</button></div></form></>:null}
    </section>
  </section>;
}

import {useEffect,useState} from 'react';
import {Check,Copy} from 'lucide-react';
import {api} from './api';
import './workflow.css';

type Pairing={code:string;expiresAt:string};

function remaining(expiresAt:string,now:number){
  const seconds=Math.max(0,Math.round((Date.parse(expiresAt)-now)/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}

export default function OfficeIntegration({matterId}:{matterId:string}){
  const [tenant,setTenant]=useState('');
  const [message,setMessage]=useState('');
  const [pending,setPending]=useState(false);
  const [pairing,setPairing]=useState<Pairing|null>(null);
  const [now,setNow]=useState(()=>Date.now());
  const [copied,setCopied]=useState(false);
  const expired=pairing?Date.parse(pairing.expiresAt)<=now:false;

  useEffect(()=>{
    if(!pairing||expired)return;
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return ()=>window.clearInterval(timer);
  },[pairing,expired]);

  async function connect(revoke=false){
    setPending(true);setCopied(false);
    try {
      if(revoke){
        await api('office.revoke',{matterId});
        setPairing(null);
        setMessage('Sesiones y códigos del asunto revocados.');
      }else{
        const result=await api<Pairing>('office.pair',{matterId,tenant:tenant.trim()});
        setPairing(result);setNow(Date.now());
        setMessage(`Código ${result.code}. Válido hasta ${new Date(result.expiresAt).toLocaleTimeString('es-MX')} para este asunto.`);
      }
    }catch(error){setMessage(error instanceof Error?error.message:'No se pudo conectar.');}
    finally{setPending(false);}
  }

  async function copy(){
    if(!pairing)return;
    try{await navigator.clipboard.writeText(pairing.code);setCopied(true);}catch{setCopied(false);}
  }

  return <section className="settings-section office-settings"><div><h2>Word, Excel y SharePoint</h2><p>Consulta el asunto desde el panel lateral de tus documentos.</p></div>
    <div className="settings-panel office-steps">
      <ol>
        <li><span className="office-step-number" aria-hidden="true">1</span><div><strong>Prepara los complementos</strong><p>Ejecuta <code>Preparar complementos.command</code> una vez en este Mac y reinicia Word o Excel.</p></div></li>
        <li><span className="office-step-number" aria-hidden="true">2</span><div><strong>Vincula el panel con este asunto</strong><p>{matterId?'Genera un código y escríbelo en el panel de LEX AI dentro del documento.':'Selecciona un asunto para vincular el panel.'}</p>
          <details className="office-sharepoint"><summary>¿Usas SharePoint Online?</summary><label>Dirección del sitio<input value={tenant} placeholder="https://despacho.sharepoint.com" onChange={event=>{setTenant(event.target.value);setMessage('');}}/></label></details>
          {pairing&&!expired?<div className="office-code" aria-label="Código de vinculación"><span className="office-code-value">{pairing.code}</span><div><span className="office-code-expiry">Vence en {remaining(pairing.expiresAt,now)}</span><button type="button" className="secondary" onClick={()=>void copy()}>{copied?<Check size={14}/>:<Copy size={14}/>}{copied?'Copiado':'Copiar'}</button></div></div>:null}
          {pairing&&expired?<p className="office-expired">El código venció. Genera uno nuevo.</p>:null}
          <div className="button-row"><button className={pairing&&!expired?'secondary':'primary'} disabled={!matterId||pending} onClick={()=>void connect()}>{pairing?'Generar otro código':'Vincular complemento'}</button></div>
        </div></li>
        <li><span className="office-step-number" aria-hidden="true">3</span><div><strong>Controla el acceso</strong><p>Las sesiones vencen solas. Puedes cerrarlas antes en cualquier momento.</p><button className="text-button danger" disabled={!matterId||pending} onClick={()=>void connect(true)}>Revocar acceso al asunto</button></div></li>
      </ol>
      <p role="status" className="office-status">{message}</p>
    </div></section>;
}

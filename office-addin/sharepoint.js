import {initPairing} from './common.js';
import {mountAssistant} from './assistant.js';
const tenant=new URLSearchParams(location.search).get('tenant');
const hostWindow=window.parent===window ? window.opener : window.parent;
if(!/^https:\/\/[a-z0-9-]+\.sharepoint\.com$/.test(tenant) || !hostWindow)
  throw Error('Abre el panel desde el sitio vinculado.');
function selectedText(){
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const finish=()=>{window.removeEventListener('message',receive);clearTimeout(timer);};
    function receive(event){
      if(event.origin!==tenant||event.source!==hostWindow||event.data?.id!==id||typeof event.data.text!=='string')return;
      finish();resolve(event.data.text);
    }
    const timer=setTimeout(()=>{finish();reject(Error('El sitio no respondió. Selecciona texto en la página.'));},4000);
    window.addEventListener('message',receive);
    hostWindow.postMessage({type:'lex.read-selection',id},tenant);
  });
}
mountAssistant('SharePoint',selectedText);
initPairing(()=>{});

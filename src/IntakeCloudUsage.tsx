import {Cloud} from 'lucide-react';

type Account='primary'|'lorenzo';
type Outcome='answered'|'incomplete'|'rejected'|'unconfirmed';
type Totals={attempts:number;input:number;output:number;unreported:number};
export type CloudUsage={
 mode:Account|'backup'|'alternate'; remaining:number; partial:boolean;accounts:Record<Account,Totals>;
 last:{account:Account;outcome:Outcome;reason:'invalid_key'|'insufficient_quota'|null}|null;
};
const names={primary:'Principal',lorenzo:'Lorenzo'};
const modes={...names,backup:'Principal con respaldo de Lorenzo',alternate:'Alternar cuentas'};
const outcomes={answered:'respuesta recibida',incomplete:'respuesta incompleta',rejected:'solicitud rechazada',unconfirmed:'resultado sin confirmar'};
const number=new Intl.NumberFormat('es-MX');

export default function IntakeCloudUsage({usage}:{usage:CloudUsage}){
 const last=usage.last;
 return <details className="rp-details rp-usage">
  <summary><Cloud size={16}/> Uso de OpenAI</summary>
  <p>{modes[usage.mode]} · Envíos disponibles en esta sesión: {usage.remaining}.</p>
  <table><caption>Consumo registrado en este expediente</caption>
   <thead><tr><th>Cuenta</th><th>Envíos</th><th>Tokens de entrada</th><th>Tokens de salida</th></tr></thead>
   <tbody>{(['primary','lorenzo'] as const).map(slot=>{
    const totals=usage.accounts[slot];
    return <tr key={slot}><th scope="row">{names[slot]}</th><td>{totals.attempts}</td><td>{number.format(totals.input)}</td><td>{number.format(totals.output)}</td></tr>;
   })}</tbody>
  </table>
  {(usage.accounts.primary.unreported+usage.accounts.lorenzo.unreported)>0&&<p>Envíos sin desglose completo de tokens: {usage.accounts.primary.unreported+usage.accounts.lorenzo.unreported}.</p>}
  {last&&<p>Último envío de {names[last.account]}: {outcomes[last.outcome]}{last.reason==='invalid_key'?' por clave inválida':last.reason==='insufficient_quota'?' por cuota insuficiente':''}.</p>}
  {usage.partial&&<p role="status">El historial local contiene recibos que no se pudieron leer o guardar.</p>}
 </details>;
}

/** Public-corpus vocabulary only. Never imports evaluation cases or reports. */
import {DatabaseSync} from 'node:sqlite';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../../', import.meta.url);
const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Editorial colloquial triggers; terms and article anchors verified below against
// the stored public source. These are retrieval hints, not rules of applicable law.
const definitions = [
 ['constitucional','igualdad','discrimin\\w*|trato desigual|por (?:mi|su) (?:origen|religion|color)|derechos humanos','CPEUM:1','derechos humanos|discriminación|protección'],
 ['constitucional','expresion','expres\\w*|opinar|opinion|censur\\w*|decir lo que|informacion publica','CPEUM:6','manifestación de las ideas|información|expresión'],
 ['constitucional','peticion','peticion|escrito a la autoridad|autoridad.{0,35}(?:responde|contesta)|solicitud.{0,30}gobierno','CPEUM:8','petición|acuerdo escrito|autoridad'],
 ['constitucional','audiencia','retroactiv\\w*|sin (?:juicio|escucharme|oirme)|antes de (?:la ley|quitarme)|debido proceso','CPEUM:14','retroactivo|formalidades esenciales|juicio'],
 ['constitucional','legalidad','mandamiento|orden escrita|sin orden|revis\\w*.{0,20}(?:casa|domicilio)|fund\\w* y motiv\\w*','CPEUM:16','mandamiento escrito|autoridad competente|domicilio'],
 ['constitucional','justicia','justicia por.{0,10}mano|acceso a la justicia|justicia gratuita|tribunal.{0,20}cobr\\w*','CPEUM:17','justicia|tribunales|gratuito'],
 ['constitucional','voto','vot\\w*|elecciones|candidatur\\w*','CPEUM:35','Votar|elecciones|ciudadanía'],
 ['civil','acuerdo','acord\\w*|acuerdo|convenio|pact\\w*','CCF:1792,1793','convenio|obligaciones|contratos'],
 ['civil','contrato','contrato|contrat\\w*|de palabra|promet\\w*|firm\\w*.{0,20}(?:acuerdo|papel)','CCF:1794,1796,1832','consentimiento|contrato|buena fe'],
 ['civil','danos','danos?|perjuicios|rompi\\w*|destroz\\w*|estrope\\w*|choc\\w*|repar\\w*.{0,15}(?:pago|pagar)','CCF:1910,1915,1934','daño|reparación|culpa|negligencia'],
 ['civil','renta','rent\\w*|alquil\\w*|caser[oa]|inquilin\\w*|arrend\\w*|desaloj\\w*|(?:sacar|quitar).{0,20}(?:casa|vivienda)','CCF:2398,2448','arrendamiento|renta|arrendador|arrendatario'],
 ['civil','embargo','embarg\\w*|quitar.{0,20}(?:casa|bienes)|cobrar.{0,20}deuda','CFPC:432,434','embargo|bienes'],
 ['civil','herencia','heren\\w*|testament\\w*|falleci\\w*.{0,20}(?:bienes|casa)|sucesion','CCF:1281,1282,1602','herencia|testamento|sucesión'],
 ['familiar','alimentos','alimentos|alimentici\\w*|manutencion|(?:no|dejo de).{0,20}pag\\w*.{0,15}pension|mantener.{0,15}hij\\w*','CCF:301,302,303,308,311','alimentos|hijos|necesidades|posibilidades'],
 ['familiar','gastos-hijos','(?:comida|escuela|colegiatura|vestido|medicin\\w*|gastos).{0,30}(?:hij\\w*|menor\\w*)|(?:hij\\w*|menor\\w*).{0,30}(?:comida|escuela|colegiatura|medicin\\w*)','CCF:303,308,311','alimentos|educación|enfermedad'],
 ['familiar','pareja','conyug\\w*|espos[oa]|casados|matrimonio|concubin\\w*','CCF:164,302','cónyuges|hogar|alimentos'],
 ['familiar','separacion','divorci\\w*|separ\\w*.{0,20}(?:pareja|espos[oa])','CCF:266,267','divorcio|matrimonio'],
 ['familiar','custodia','custodia|convivencia|patria potestad|ver a.{0,15}hij\\w*|(?:quedar|llevar).{0,20}(?:ninos|hij\\w*)','CCF:416,417','patria potestad|convivencia|menores'],
 ['penal','detencion','detuv\\w*|deten\\w*|arrest\\w*|flagrancia|agarr\\w*.{0,15}(?:policia|robando)|policia.{0,20}(?:llevo|agarro)','CNPP:146,147,152','detención|flagrancia|derechos'],
 ['penal','defensa','imputad\\w*|acusad\\w*|abogado.{0,20}(?:deten\\w*|declar\\w*)|defensor|guardar silencio|no declarar|oblig\\w*.{0,20}declar\\w*','CNPP:113,152','imputado|Defensor|declarar|silencio'],
 ['penal','cautelares','medidas cautelares|prision preventiva|carcel.{0,20}(?:juicio|sentencia)|brazalete|no acerc\\w*','CNPP:153,155,167','medidas cautelares|prisión preventiva|presentación periódica'],
 ['penal','denuncia','denunci\\w*|avisar.{0,20}(?:delito|fiscalia)|ministerio publico','CNPP:222','denuncia|Ministerio Público|delito'],
 ['penal','robo','rob\\w*|hurt\\w*|llevo.{0,15}(?:celular|cartera)','CPF:367','robo|cosa ajena|consentimiento'],
 ['penal','fraude','fraude|estaf\\w*|engan\\w*.{0,20}(?:dinero|pagar)','CPF:386','fraude|engaño|lucro indebido'],
 ['laboral','despido','corrieron|corrio|despid\\w*|desped\\w*|despido|echaron.{0,15}(?:trabajo|empleo)|liquidacion','LFT:47,48,50','rescisión|relación de trabajo|indemnización|despido'],
 ['laboral','relacion','sin contrato.{0,20}trabaj\\w*|relacion laboral|trabaj\\w*.{0,20}sin contrato','LFT:20,21','trabajo personal subordinado|salario|relación de trabajo'],
 ['laboral','salario','sueldo|salarios?|raya|paga.{0,15}trabaj\\w*','LFT:82,83,84','salario|retribución|trabajo'],
 ['laboral','aguinaldo','aguinaldo|bono.{0,20}(?:diciembre|navidad)|pago.{0,15}fin de ano','LFT:87','aguinaldo|salario'],
 ['laboral','vacaciones','vacacion\\w*|dias.{0,15}descanso|descansar','LFT:76,80','vacaciones|prima|salarios'],
 ['laboral','renuncia','renunci\\w*|separarme.{0,20}trabajo|antiguedad','LFT:51,162','rescisión|antigüedad|trabajadores'],
 ['mercantil','pagare','pagare|pagares|papel.{0,20}(?:deuda|pagar)|promesa.{0,20}pago','LGTOC:170,171,174','pagaré|promesa incondicional|pago|vencimiento'],
 ['mercantil','titulo','titulos? de credito|endos\\w*|documento.{0,20}cobrar','LGTOC:5,26,29','títulos de crédito|endoso|derecho literal'],
 ['mercantil','comercio','comerci\\w*|negocio|mercantil|compra.{0,15}venta','CCOM:3,75,78','comerciantes|actos de comercio|convenciones mercantiles'],
 ['mercantil','sociedad','soci[oa]s?|sociedad|empresa|accionistas|constituir|crear.{0,15}negocio','LGSM:2,5,6,87','sociedades|contrato social|socios|acciones'],
 ['mercantil','ejecutivo','juicio ejecutivo|cobrar.{0,20}(?:pagare|cheque)|trae aparejada ejecucion','CCOM:1391','ejecutivo|títulos de crédito|ejecución'],
 ['fiscal','contribuciones','impuestos?|contribuciones|fisco|tribut\\w*','CFF:1,2','contribuciones|impuestos|derechos'],
 ['fiscal','devolucion','saldo a favor|devol\\w*.{0,20}(?:sat|impuesto|hacienda)|(?:sat|hacienda).{0,20}devol\\w*|pague de mas','CFF:22','devolverán|pagadas indebidamente|contribuciones'],
 ['fiscal','factura','factur\\w*|cfdi|comprobante fiscal|recibo fiscal','CFF:29,29-A','comprobantes fiscales|certificado|sello digital'],
 ['fiscal','revision','sat|hacienda|auditoria|revision fiscal|visita.{0,15}fiscal','CFF:42','autoridades fiscales|visitas|revisión'],
 ['fiscal','revocacion','revocacion|(?:impugnar|combatir|inconform\\w*).{0,25}(?:sat|credito fiscal)|(?:sat|fiscal).{0,25}(?:recurso|plazo)','CFF:117,121','recurso de revocación|resoluciones definitivas|plazo'],
 ['fiscal','cobro','credito fiscal|adeudo fiscal|embargo.{0,20}(?:sat|fiscal)|(?:sat|fisco).{0,20}cobr\\w*','CFF:65,145','créditos fiscales|procedimiento administrativo de ejecución'],
 ['amparo','objeto','ampar\\w*|acto reclamado|autoridad responsable','LAMP:1,5','juicio de amparo|derechos humanos|autoridad responsable'],
 ['amparo','plazo','(?:dias|tiempo|plazo).{0,30}(?:amparo|demanda)|(?:amparo|demanda).{0,30}(?:dias|tiempo|plazo)|tardar.{0,15}ampar\\w*','LAMP:17','plazo|demanda de amparo|quince días'],
 ['amparo','suspension','suspension|suspend\\w*|fren\\w*.{0,25}(?:acto|autoridad|amparo)|detener.{0,25}(?:acto|ejecucion)|(?:acto|autoridad).{0,25}fren\\w*','LAMP:125,126,128','suspensión|acto reclamado|orden público'],
 ['amparo','indirecto','amparo indirecto|fuera de juicio|primera demanda.{0,20}amparo','LAMP:107,108','amparo indirecto|normas generales|demanda'],
 ['amparo','directo','amparo directo|sentencia definitiva|laudo|juicio.{0,15}termin\\w*','LAMP:170','amparo directo|sentencias definitivas|laudos'],
 ['amparo','improcedencia','improceden\\w*|desech\\w*.{0,20}amparo|amparo.{0,20}(?:desech\\w*|procede)','LAMP:61','improcedente|juicio de amparo'],
 ['administrativo','acto','acto administrativo|autoridad.{0,30}(?:razon|motivo|explic\\w*)|resolucion administrativa|(?:multa|clausura).{0,30}(?:razon|motivo|escrito)','LFPA:3','acto administrativo|fundado y motivado|competente'],
 ['administrativo','tramite','tramit\\w*|ventanilla|dependencia|oficina de gobierno|permiso|licencia','LFPA:16,17','Administración Pública Federal|procedimientos|plazo|resuelva'],
 ['administrativo','silencio','no (?:me )?(?:responde|contesta|resuelven)|silencio administrativo|negativa ficta','LFPA:17','plazo|resoluciones|sentido negativo'],
 ['administrativo','notificacion','notific\\w*|citatorio|aviso.{0,20}(?:autoridad|gobierno)|correo certificado','LFPA:35,38','notificaciones|domicilio|plazos'],
 ['administrativo','recurso','recurso de revision|multa|clausur\\w*|recurr\\w*|impugnar.{0,20}(?:autoridad|resolucion)','LFPA:83,85','recurso de revisión|resoluciones|plazo'],
 ['administrativo','nulidad','juicio de nulidad|resolucion ilegal|tribunal administrativo','LFPCA:13,14,51','demanda|resolución administrativa|ilegal'],
 ['seguridad-social','alta','imss|seguro social|alta.{0,15}seguro|asegur\\w*|cuotas|cotiz\\w*','LSS:12,15','régimen obligatorio|inscribir|trabajadores|cuotas'],
 ['seguridad-social','accidente','accidente|riesgo de trabajo|lastim\\w*.{0,25}(?:trabajo|camino)|(?:camino|trayecto).{0,25}trabajo','LSS:41,42,58','accidente de trabajo|riesgos de trabajo|lesión|prestaciones'],
 ['seguridad-social','salud','incapacidad|enferm\\w*|subsidio|atencion medica','LSS:84,96','enfermedad|subsidio|incapacidad'],
 ['seguridad-social','retiro','jubil\\w*|pension.{0,15}(?:vejez|retiro)|retirarme|cesantia|sesenta|sesenta y cinco|semanas cotizadas','LSS:154,162','cesantía en edad avanzada|vejez|cotizaciones semanales'],
];
const db = new DatabaseSync(new URL('resources/public-library.sqlite',root), {readOnly:true});
const entries=definitions.map(([area,id,trigger,refs,vocabulary])=>{
 const [law,articles]=refs.split(':');
 const sources=articles.split(',').map(article=>{
  const row=db.prepare("SELECT payload FROM articles WHERE law_id=? AND json_extract(payload,'$.article')=?").get('MX-FED-'+law,article);
  if(!row)throw Error(`Missing public authority ${law}:${article}`);
  return JSON.parse(row.payload);
 });
 const terms=vocabulary.split('|').filter(term=>sources.some(s=>fold(s.text).includes(fold(term))));
 if(!terms.length)throw Error('No grounded vocabulary '+id);
 return {id:area+':'+id,area,trigger,terms,provenance:sources.map(s=>({lawId:s.lawId,article:s.article,sourceId:s.id,jurisdiction:s.jurisdiction,url:s.url,version:s.version,retrievedAt:s.retrievedAt,textSha256:s.textSha256,pdfSha256:s.pdfSha256,excerpts:terms.filter(t=>fold(s.text).includes(fold(t))).map(t=>{const i=fold(s.text).indexOf(fold(t));return s.text.slice(Math.max(0,i-45),Math.min(s.text.length,i+t.length+90));})}))};
});
db.close();
const output={schemaVersion:1,method:'Editorial synthetic colloquial triggers mapped to vocabulary verified in the public corpus; no evaluation inputs. Anchors are retrieval priors, not a claim of applicability or currentness.',source:{path:'resources/public-library.sqlite',sha256:createHash('sha256').update(await readFile(new URL('resources/public-library.sqlite',root))).digest('hex')},entries};
await writeFile(new URL('resources/legal-thesaurus.json',root),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({concepts:entries.length,areas:[...new Set(entries.map(e=>e.area))],terms:entries.reduce((n,e)=>n+e.terms.length,0)}));

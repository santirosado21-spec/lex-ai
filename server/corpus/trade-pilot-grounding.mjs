import {createHash} from 'node:crypto';
import snapshots from '../../resources/trade-pilot-lce.json' with {type:'json'};
import {tradePilotReferences} from './trade-pilot-references.mjs';

export function tradeArticles(publicLibrary) {
  return snapshots.map(snapshot => {
    const row = publicLibrary ? publicLibrary.lookupArticle({lawId:'MX-FED-LCE',articleId:snapshot.article}) : snapshot;
    if (!row || row.sourceId !== snapshot.sourceId || row.pdfSha256 !== snapshot.pdfSha256 ||
        createHash('sha256').update(row.text).digest('hex') !== snapshot.textSha256) {
      throw new Error('El texto de la biblioteca cambió. Revisa la edición antes de generar.');
    }
    return Object.freeze({
      ...snapshot, text:row.text, id:'LCE-' + snapshot.article, title:'Ley de Comercio Exterior',
      locator:`Artículo ${snapshot.article}, pp. ${snapshot.pages.join('–')}. Edición de Cámara del 1 de mayo de 2026.`,
      summary:'Texto del artículo cotejado con el PDF oficial. Falta determinar la versión aplicable a la operación.',
      checkedOn:'2026-11-19',
    });
  });
}

export const supportingReferences = tradePilotReferences.filter(ref => ref.id !== 'LCE-9-10');
const pending = {
  origen:'Solicitar la relación de países e insumos que intervinieron en la producción.',
  clasificacion:'Obtener la descripción técnica y la clasificación propuesta de la mercancía y sus insumos.',
  acuerdo:'Identificar el acuerdo que se pretende invocar y la fecha de la operación.',
  proceso:'Pedir el desglose de las etapas de producción y los países en que se realizaron.',
};

export function tradeInstruction(articles) {
  const texts = articles.map(ref => `[${ref.id}] ${ref.locator} ${ref.url}\n${ref.text}`);
  const context = supportingReferences.map(ref => `${ref.title}: ${ref.summary} ${ref.url}`);
  return `Prepara la revisión del origen de una importación de [[CLIENTE]] en [[ASUNTO]]. Selecciona una proposición jurídica contenida en UNA oración completa de los artículos transcritos. Cópiala literalmente. Elige por separado un dato faltante para comprobar su aplicación. Redacta una o dos preguntas breves para el cliente sobre hechos o documentos que permitan verificarlo. Omite cifras, fechas concretas, citas y conclusiones en las preguntas. La fecha efectiva, los hechos, el trato preferencial y la fracción del caso están pendientes. Devuelve exclusivamente JSON con {"fuente":"LCE-9 o LCE-10","cita":"oración literal","pendiente":"origen, clasificacion, acuerdo o proceso","solicitud":"¿Pregunta documental en español?"}. Si la evidencia es insuficiente, devuelve {"abstener":true,"pendiente":"acuerdo"}.\n${texts.join('\n')}\nReferencias de consulta adicional:\n${context.join('\n')}`;
}

export function proposedQuestions(value) {
  if (typeof value !== 'string' || value.length > 320) return '';
  const questions = value.trim().match(/¿[\p{L}\p{M} ,–-]{8,155}\?/gu);
  if (!questions || questions.length > 2 || questions.join(' ') !== value.trim().replace(/\s+/gu,' ')) return '';
  if (/\b(?:art[ií]cul\w*|ley|decreto|reglamento|resoluci[oó]n|cap[ií]tulo|arancel|tasa|porcentaje|exento|exenta|ilegales?|infracci[oó]n|sanci[oó]n)\b/iu.test(value)) return '';
  return questions.join('\n');
}

// The provider selects a complete statutory sentence and a follow-up. Only a sentence
// verified against the pinned article, or a local abstention, can enter a new draft.
export function renderTradeDraft(raw, articles) {
  let result;
  try { result = JSON.parse(raw); } catch { result = null; }
  const knownPending = typeof result?.pendiente === 'string' && Object.hasOwn(pending,result.pendiente);
  const followUp = knownPending ? pending[result.pendiente] : pending.acuerdo;
  const source = articles.find(article => article.id === result?.fuente);
  const sentences = source?.text.replace(/^Artículo \d+o?\.- /u, '').split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/u);
  const valid = typeof result?.cita === 'string' && !result.abstener && knownPending &&
    sentences?.includes(result.cita) && result.cita.length >= 24 && Object.keys(result).every(key=>['fuente','cita','pendiente','solicitud'].includes(key));
  const basis = valid ? `Fundamento documental [${source.id}]\n${result.cita}` :
    'Fundamento pendiente. La respuesta no aporta una cita verificable para sostener una conclusión.';
  const questions = valid ? proposedQuestions(result.solicitud) : '';
  const questionSection = questions ? '\n\nPreguntas propuestas para revisión\n' + questions : '';
  return `Revisión del origen de mercancías para [[CLIENTE]] · [[ASUNTO]]\n\n${basis}\n\nDato pendiente\n${followUp}${questionSection}\n\nVerificar la regla y la edición aplicables en la fecha de la operación.`;
}

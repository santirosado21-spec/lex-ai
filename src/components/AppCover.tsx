import rejonMark from '../assets/rejon-mark.svg';
import rejonMarkDark from '../assets/rejon-mark-dark.svg';

/** Decorative editorial photograph; all instructions remain accessible HTML. */
export default function AppCover({imageSrc='/brand/lex-cover.webp'}:{imageSrc?:string}) {
  return <figure className="app-cover" aria-label="Portada de Rejon.AI">
    <img src={imageSrc} alt="Expediente de papel cosido con hilo sobre piedra oscura" width={1536} height={1024} fetchPriority="high" decoding="async"/>
    <figcaption><span className="cover-brand"><span className="theme-mark" aria-hidden="true"><img src={rejonMark} className="theme-mark-light" alt=""/><img src={rejonMarkDark} className="theme-mark-dark" alt=""/></span> Rejon.AI</span><span>El trabajo comienza con tus documentos.</span></figcaption>
  </figure>;
}

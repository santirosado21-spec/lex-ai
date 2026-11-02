import lexMark from '../assets/lex-figma-mark.svg';

/** Decorative editorial photograph; all instructions remain accessible HTML. */
export default function AppCover({imageSrc='/brand/lex-cover.webp'}:{imageSrc?:string}) {
  return <figure className="app-cover" aria-label="Portada de LEX AI">
    <img src={imageSrc} alt="Expediente de papel cosido con hilo sobre piedra oscura" width={1536} height={1024} fetchPriority="high" decoding="async"/>
    <figcaption><span className="cover-brand"><img src={lexMark} alt=""/> LEX AI</span><span>El trabajo comienza con tus documentos.</span></figcaption>
  </figure>;
}

import rejonMarkDark from '../assets/rejon-mark-dark.svg';
import wordmark from '../assets/rejon-wordmark-crema.svg';

/** Rejon wordmark (Figma brand v3, cafe/crema). Motion is decorative and off under prefers-reduced-motion. */
export default function AppCover(_props:{imageSrc?:string}) {
  return <figure className="app-cover app-cover-logo" aria-label="Portada de Rejon">
    <div className="cover-logo-stage" aria-hidden="true"><img className="cover-wordmark" src={wordmark} alt=""/></div>
    <figcaption><span className="cover-brand"><span className="theme-mark" aria-hidden="true"><img src={rejonMarkDark} alt=""/></span> Rejon</span><span>El trabajo comienza con tus documentos.</span></figcaption>
  </figure>;
}

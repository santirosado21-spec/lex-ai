import rejonMarkDark from '../assets/rejon-mark-dark.svg';

const R_PATH='M160 96H544C768 96 896 208 896 400C896 552 808 648 664 688L904 928H664L448 696H360V928H160V96ZM360 272V520H536C640 520 696 480 696 392C696 312 640 272 536 272H360Z';

/** Animated Rejon.AI monogram (Figma brand mark v2, 1024 grid). Motion is decorative and off under prefers-reduced-motion. */
export default function AppCover(_props:{imageSrc?:string}) {
  return <figure className="app-cover app-cover-logo" aria-label="Portada de Rejon.AI">
    <div className="cover-logo-stage" aria-hidden="true"><svg viewBox="0 0 1024 1024" className="cover-logo-svg" focusable="false"><path className="cover-logo-r" fillRule="evenodd" clipRule="evenodd" d={R_PATH}/><circle className="cover-logo-dot" cx="904" cy="848" r="56"/></svg></div>
    <figcaption><span className="cover-brand"><span className="theme-mark" aria-hidden="true"><img src={rejonMarkDark} alt=""/></span> Rejon.AI</span><span>El trabajo comienza con tus documentos.</span></figcaption>
  </figure>;
}

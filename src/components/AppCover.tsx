import rejonMarkDark from '../assets/rejon-mark-dark.svg';

const R_PATH='M20 12H68C96 12 112 26 112 50C112 69 101 81 83 86L113 116H83L56 87H45V116H20V12ZM45 34V65H67C80 65 87 60 87 49C87 39 80 34 67 34H45Z';

/** Animated Rejon.AI monogram (the repo's own mark). Motion is decorative and off under prefers-reduced-motion. */
export default function AppCover(_props:{imageSrc?:string}) {
  return <figure className="app-cover app-cover-logo" aria-label="Portada de Rejon.AI">
    <div className="cover-logo-stage" aria-hidden="true"><svg viewBox="0 0 128 128" className="cover-logo-svg" focusable="false"><path className="cover-logo-r" fillRule="evenodd" clipRule="evenodd" d={R_PATH}/><circle className="cover-logo-dot" cx="113" cy="106" r="7"/></svg></div>
    <figcaption><span className="cover-brand"><span className="theme-mark" aria-hidden="true"><img src={rejonMarkDark} alt=""/></span> Rejon.AI</span><span>El trabajo comienza con tus documentos.</span></figcaption>
  </figure>;
}

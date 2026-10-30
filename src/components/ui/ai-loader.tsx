import type {CSSProperties,ReactNode} from 'react';
import './ai-loader.css';

export interface LoaderProps {
  size?: number;
  text?: string;
  children?: ReactNode;
  /** Use when a surrounding status region already announces the operation. */
  decorative?: boolean;
}

/** Inline adaptation of the supplied ring-and-letters loader; no simulated progress. */
export function AILoader({size=180,text='Procesando',children,decorative=false}:LoaderProps) {
  const diameter=Number.isFinite(size)?Math.min(240,Math.max(24,size)):180;
  return <span className="lex-ai-loader" style={{'--lex-loader-size':`${diameter}px`} as CSSProperties}
    role={decorative?undefined:'status'} aria-live={decorative?undefined:'polite'} aria-label={decorative?undefined:text} aria-hidden={decorative?true:undefined}>
    <span className="lex-ai-loader-orbit" aria-hidden="true">
      <span className="lex-ai-loader-ring"/>
      {children&&<span className="lex-ai-loader-center">{children}</span>}
    </span>
    <span className="lex-ai-loader-letters" aria-hidden="true">{Array.from(text).map((letter,index)=><span className="lex-ai-loader-letter" key={index} style={{animationDelay:`${index*.1}s`}}>{letter}</span>)}</span>
  </span>;
}

// Preserve the import used by the supplied demo.
export const Component=AILoader;

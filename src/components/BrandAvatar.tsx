import mark from '../assets/lex-mark.svg';
import markDark from '../assets/lex-mark-dark.svg';
export default function BrandAvatar({size='md',decorative=false}:{size?:'sm'|'md'|'lg';decorative?:boolean}){const dimension={sm:28,md:36,lg:56}[size];return <span className="theme-mark brand-avatar" style={{width:dimension,height:dimension,flexShrink:0}}><img src={mark} className="theme-mark-light" width={dimension} height={dimension} alt={decorative?'':'Rejon.AI'}/><img src={markDark} className="theme-mark-dark" width={dimension} height={dimension} alt=""/></span>;}

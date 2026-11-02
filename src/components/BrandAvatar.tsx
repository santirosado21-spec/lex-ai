import mark from '../assets/lex-figma-mark.svg';
export default function BrandAvatar({size='md',decorative=false}:{size?:'sm'|'md'|'lg';decorative?:boolean}){const dimension={sm:28,md:36,lg:56}[size];return <img src={mark} width={dimension} height={dimension} alt={decorative?'':'LEX AI'} style={{flexShrink:0}}/>;}

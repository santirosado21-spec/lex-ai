// Explicit source-scoped extraction option. Never a general layout default.
import {createHash} from 'node:crypto';
export const REGULATION_LAYOUT=Object.freeze({option:'regulation-pinned-v1',revision:1,pdfSha256:'bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812',url:'https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf'});
export function validateRegulationLayoutRequest(source){
 if(source.textLayout===undefined)return false;
 if(source.textLayout!==REGULATION_LAYOUT.option||source.textLayer!=='poppler'||source.url!==REGULATION_LAYOUT.url||source.forceOcr!==undefined)throw Error('Unsupported pinned Reglamento layout request');
 return true;
}
export function regulationLayoutReceipt(source,metadata,bytes){
 if(!validateRegulationLayoutRequest(source))return null;
 const actual=createHash('sha256').update(bytes).digest('hex');
 if(actual!==REGULATION_LAYOUT.pdfSha256||metadata?.pdfSha256!==actual)throw Error('Pinned Reglamento layout PDF hash mismatch');
 return {option:REGULATION_LAYOUT.option,revision:REGULATION_LAYOUT.revision,pdfSha256:actual,sourceUrl:source.url,arguments:['-layout','-enc','UTF-8'],rawPdfUnchanged:true,legalReview:'pending'};
}

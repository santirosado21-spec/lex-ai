// Reconstruct a complete documentary question from fixed Spanish clauses and
// temporary references already present in the lawyer's selected practice facts.
import {openReviewedDocument} from '../privacy/intake-document-map.mjs';
const anchor='(\\[\\[parte_[1-9]\\d*\\]\\])';
const wording=new RegExp('^¿(qué (?:comprobante|documento|soporte|prueba) (?:acredita|demuestra|permite comprobar) (?:si|quién) (?:pagó|cubrió|asumió)|quién (?:pagó|cubrió|asumió)) (el flete|el seguro|el transporte|la prima) de '+anchor+'(?: según '+anchor+')?\\?$','u');
export function aliasedDocumentQuestion(saved,document,values){
 if(!document||!values.size)return '';
 const {original}=openReviewedDocument(document,saved.firm.id,saved.entry.id);
 if(/[\[\]]/u.test(original))return '';
 const labels=new Map(document.snapshot.entries.map(entry=>[entry.marker,values.get(entry.text)?.out]));
 const projected=document.protectedText.replace(/\[\[LEX_[a-f0-9]{32}_[a-f0-9]{32}\]\]/gu,m=>labels.get(m)??'\u0000');
 const match=wording.exec(projected.normalize('NFC').trim().toLocaleLowerCase('es').replace(/\s+/gu,' '));
 if(!match)return '';
 const [,opening,expense,first,second]=match;
 const label=s=>s.toUpperCase();
 return '¿'+opening[0].toLocaleUpperCase('es')+opening.slice(1)+' '+expense+' de '+label(first)+(second?' según '+label(second):'')+'?';
}

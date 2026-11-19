// Run explicitly with the pilot's Ollama model on loopback. Newly written synthetic
// development cases. Measures complete coverage of each annotated literal occurrence.
import {readFile} from 'node:fs/promises';
import {inspectLocalDocument} from '../server/intake-import.mjs';

const cases=[
 {id:'proveedor-mexicano',text:'Factura de práctica. El proveedor es Órbita Marfil de Ensayo. Enviar el acuse a marfil@example.test. Su domicilio es Calle Nácar Imaginaria 814, Colonia Prueba, CP 00000. Se solicitan fichas técnicas.',private:['Órbita Marfil de Ensayo','marfil@example.test','Calle Nácar Imaginaria 814, Colonia Prueba, CP 00000'],useful:['fichas técnicas']},
 {id:'exportador-extranjero',text:'Packing list for fictional review. Vendor: Elm Violet Fiction LLC. Ship from 812 Zephyr Sample Lane, Unit 7, Testborough, ZZ 00000. Contact elm@example.test. La mercancía se entrega en cajas reutilizables.',private:['Elm Violet Fiction LLC','812 Zephyr Sample Lane, Unit 7, Testborough, ZZ 00000','elm@example.test'],useful:['cajas reutilizables']},
 {id:'rotulos-aduaneros',text:'Documento ficticio de capacitación. Campos por cotejar: Aduana de Despacho, País de Origen, Unidad de Medida y Número de Pedimento. El ejercicio sólo contiene nombres de campos.',private:[],useful:['Aduana de Despacho','País de Origen','Unidad de Medida','Número de Pedimento']},
];
if(process.argv.includes('--ampliado')) cases.push(
 {id:'dos-direcciones',text:'Entrega en Calle Rubí de Ensayo 61, CP 00003. Se requiere el certificado de origen. El acuse se envía a Calle Nube Inventada 18, C.P. 00004. Remitir ficha técnica.',private:['Calle Rubí de Ensayo 61, CP 00003','Calle Nube Inventada 18, C.P. 00004'],useful:['certificado de origen','ficha técnica']},
 {id:'etiquetas-y-valores',text:'Ejercicio ficticio de revisión aduanera.\nPaís de Origen: México\nNombre del Proveedor: Industrias Violeta Ficticias\nUnidad de Medida: piezas\nCorreo de contacto: violeta@example.test',private:['Industrias Violeta Ficticias','violeta@example.test'],useful:['País de Origen','Unidad de Medida','piezas']},
 {id:'nombre-igual-a-rotulo',text:'El importador opera con la razón social País de Origen, S.A. de C.V. El representante solicita el pedimento y el comprobante de pago. Correo: mandante@example.test.',private:['País de Origen, S.A. de C.V.','mandante@example.test'],useful:['el pedimento','comprobante de pago']},
 {id:'domicilio-con-abreviatura',text:'Domicilio: Av. Laboratorio Ficticio 42, Edif. A, CP 00005, Interior B. Para revisión adjunte la factura comercial. Contacto: nubes@example.test.',private:['Av. Laboratorio Ficticio 42, Edif. A, CP 00005, Interior B','nubes@example.test'],useful:['factura comercial']},
 {id:'sin-rotulo-estructural',text:'Contrato de ensayo. El proveedor ficticio Unidad de Medida envía lista de empaque a pruebas@example.test. Confirme la fecha de embarque.',private:['Unidad de Medida','pruebas@example.test'],useful:['lista de empaque','fecha de embarque']},
 {id:'pedimento-repetido',text:'Pedimento de práctica. Unidad de Medida: piezas. Remitente: Mirto Jade de Ensayo. Entrega: mirto@example.test. Si falta el certificado, escriba otra vez a mirto@example.test.',private:['Mirto Jade de Ensayo','mirto@example.test'],useful:['piezas','certificado']},
);
if(process.argv.includes('--direcciones')){
 const rows=(await readFile(new URL('../eval/privacy-trade/dev-addresses-v1.jsonl',import.meta.url),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
 cases.splice(0,cases.length,...rows.map(row=>({
  id:row.id,text:row.text,private:row.sensitive.map(span=>row.text.slice(span.start,span.end)),
  useful:row.kind==='negative'?[row.text]:[],
 })));
}
if(process.argv.includes('--referencias')){
 const file=await readFile(new URL('../eval/privacy-trade/document-references-dev.jsonl',import.meta.url),'utf8');
 cases.splice(0,cases.length,...file.trim().split('\n').map(line=>JSON.parse(line)));
}
for (const row of cases) {
 const {protection}=await inspectLocalDocument({extension:'txt',base64:Buffer.from(row.text).toString('base64'),review:true});
 if(!protection.available){console.log(JSON.stringify({id:row.id,available:false}));continue;}
 const mask=Array(row.text.length).fill(false);
 for(const part of protection.parts) if(part.label)mask.fill(true,part.start,part.end);
 function occurrences(literals){
  const spans=[];
  for(const literal of literals){
   if(!row.text.includes(literal))throw Error('Falta una anotación en '+row.id);
   for(let start=row.text.indexOf(literal);start!==-1;start=row.text.indexOf(literal,start+literal.length)){
    spans.push(mask.slice(start,start+literal.length).filter((_,i)=>literal[i].trim()));
   }
  }
  return spans;
 }
 const identifiers=occurrences(row.private),terms=occurrences(row.useful);
 console.log(JSON.stringify({id:row.id,restituted:protection.restored===row.text,
  protected:identifiers.filter(span=>span.every(Boolean)).length,identifiers:identifiers.length,
  intact:terms.filter(span=>span.every(v=>!v)).length,legalTerms:terms.length,
  substitutions:protection.count,needsReview:protection.needsReview}));
}

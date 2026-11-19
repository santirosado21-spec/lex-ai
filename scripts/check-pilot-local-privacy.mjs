// Run explicitly with the pilot's Ollama model on loopback. Newly written synthetic
// development cases. Measures complete coverage of each annotated literal occurrence.
import {inspectLocalDocument} from '../server/intake-import.mjs';

const cases=[
 {id:'proveedor-mexicano',text:'Factura de práctica. El proveedor es Órbita Marfil de Ensayo. Enviar el acuse a marfil@example.test. Su domicilio es Calle Nácar Imaginaria 814, Colonia Prueba, CP 00000. Se solicitan fichas técnicas.',private:['Órbita Marfil de Ensayo','marfil@example.test','Calle Nácar Imaginaria 814, Colonia Prueba, CP 00000'],useful:['fichas técnicas']},
 {id:'exportador-extranjero',text:'Packing list for fictional review. Vendor: Elm Violet Fiction LLC. Ship from 812 Zephyr Sample Lane, Unit 7, Testborough, ZZ 00000. Contact elm@example.test. La mercancía se entrega en cajas reutilizables.',private:['Elm Violet Fiction LLC','812 Zephyr Sample Lane, Unit 7, Testborough, ZZ 00000','elm@example.test'],useful:['cajas reutilizables']},
 {id:'rotulos-aduaneros',text:'Documento ficticio de capacitación. Campos por cotejar: Aduana de Despacho, País de Origen, Unidad de Medida y Número de Pedimento. El ejercicio sólo contiene nombres de campos.',private:[],useful:['Aduana de Despacho','País de Origen','Unidad de Medida','Número de Pedimento']},
];
for (const row of cases) {
 const {protection}=await inspectLocalDocument({extension:'txt',base64:Buffer.from(row.text).toString('base64'),review:true});
 if(!protection.available){console.log(JSON.stringify({id:row.id,available:false}));continue;}
 const mask=Array(row.text.length).fill(false);
 for(const part of protection.parts) if(part.label)mask.fill(true,part.start,part.end);
 function extent(literal){
  const start=row.text.indexOf(literal);
  if(start<0)throw Error('Expected literal absent from fixture');
  return mask.slice(start,start+literal.length).filter((_,i)=>literal[i].trim());
 }
 console.log(JSON.stringify({id:row.id,restituted:protection.restored===row.text,
  protected:row.private.filter(s=>extent(s).every(Boolean)).length,identifiers:row.private.length,
  intact:row.useful.filter(s=>extent(s).every(v=>!v)).length,legalTerms:row.useful.length,
  substitutions:protection.count,needsReview:protection.needsReview}));
}

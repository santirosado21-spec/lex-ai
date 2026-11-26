# Reglamento: decisión de prueba por segmento

25 noviembre 2026. PDF fijo SHA256 bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812.

## Prueba realizada

Sobre el código de extracción actual, 7 contratos de ancla y orden: default 7/7; Poppler actual 0/7. Ambos producen 282 artículos y los registros examinados permanecen en cuarentena.

Copia temporal del módulo con un solo cambio, añadir -layout a pdftotext: 7/7 contratos pasan; las 282 identidades, páginas y textos de artículos coinciden con default. Frente a Poppler actual cambian exactamente los siete cuerpos ya inventariados. No se editó el checkout, producto, corpus, manifiesto o índice. El SHA256 del módulo original es 206939952ad3710ab762026ef45620d440f3c5d1747c827d9063785989018cf4, igual a origin/main al realizar la prueba.

Esto no prueba la fidelidad jurídica de los 282 artículos. La coincidencia entre lectores es un control de regresión, no un oráculo independiente. La aceptación viene de segmentos visualmente revisados, no de designar un lector ganador.

## Criterios de aceptación por segmento

- 6-A, p3: I gobierna a-d. II empieza con los datos que los usuarios deben registrar, después de d. Prohibir II antes de Deberán contar.
- 41, p17: I corresponde a Carga y sus cuatro incisos. II corresponde a Descarga, no debe aparecer antes de Carga.
- 105, p38: II gobierna a-b sobre adaptación. III empieza en Constancia expedida, después de b.
- 110, p39-40: los incisos a-d siguen bajo I aun después del salto de página. II empieza en Se establezca después de d.
- 117, p42: conservar el guion de fin de línea entre 36- y A. La representación literal 36- A no debe pasar a 36A. La forma de lectura 36-A sigue como anotación separada existente, no se reescribe silenciosamente la cita.
- 158, p53: II gobierna a-d. El marcador visual III empieza con La garantía. La capa textual usa Ill y lV, que se mantienen literales en esta prueba. No sustituciones generales de romanos.
- 236, p77-78: IV gobierna a-f, aun tras salto de página y nota editorial. V empieza con Estar inscrito y activo en RFC, no dentro de f.

Se inspeccionaron los píxeles de las nueve páginas relevantes 3,17,38,39,40,42,53,77,78, reutilizando el inventario original y verificando el hash del PDF.

## Reparación propuesta para revisión, no implementada

No cambiar el modo Poppler genérico para todos los PDF. Si se adopta una reparación, limitarla al hash del Reglamento y al modo alternante Poppler expresamente solicitado. Conservar texto raw y registrar motor/opciones/pin. Fallar cerrado si cambia el pin. No arreglar Ill/lV o referencias legales con reemplazos globales.

Antes de publicar: revisión independiente de los segmentos y experimento; pruebas de pin/identidad de fuente, procedencia y ausencia de cambios en default/otros PDF; siete contratos y regresión de 282 cuerpos como evidencia técnica; suite relacionada sin iniciar modelos. No promover corpus ni modificar el estado jurídico.

## Implementación preparada para revisión

Opción solicitada `textLayer: poppler` más `textLayout: regulation-pinned-v1`. Solo URL exacta de esta edición y SHA256 calculado de los bytes igual al pin y al metadata recibido. Opción desconocida, fuente distinta, default sin Poppler, OCR forzado o hash distinto rechazan sin fallback. Ningún registro real fue cambiado para activar la opción.

Recibo de procedencia en coverage.parser.layout: opción/revisión, pin calculado, URL, argumentos y SHA256 del stdout raw de pdftotext. No modifica el PDF ni normaliza Ill/lV o 36- A. Los textos derivados siguen en cuarentena. rawTextSha256 permite cotejar la salida directa del motor, no conservar cada página raw en los registros operativos.

La opción forma parte del documento en el plan canónico; su revisión de política entra solo en la clave de caché de documentos que la solicitan. Sin opción la configuración anterior no cambia. Caché anterior y nueva conviven con rutas distintas; repetición de la nueva usa su propia ruta. La prueba de caché usa extractor sintético y prueba mecánica de caché, no PDF o eficacia legal. Las pruebas de PDF real verifican pin, procedencia, 282 identidades/páginas, siete segmentos visuales y diferencia precisa en siete cuerpos, sin usar igualdad entre lectores como aceptación jurídica.

Medición Linux: 87 pruebas dirigidas PASS, 0 FAIL, 0 skip (legal-library, layout, registro, adquisición, postbody, transitory-editorial). Build PASS, advertencia habitual de tamaño de chunk. No se corrió suite completa ni Mac ni producto con corpus activo. Publicación pendiente de revisión independiente.

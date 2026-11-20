# Certificación de origen y matrices del expediente

El piloto r29 reúne el archivo original de Excel, la página del tratado, la consulta a OpenAI y la nota con sus soportes. La prueba utilizó un libro ficticio en la web local de este Mac.

## Qué hizo el abogado en el ensayo

1. Adjuntó la matriz al expediente cifrado. Al descargarla obtuvo exactamente los mismos bytes. El lector asignó a cada valor su pestaña y dirección originales. Excluyó hojas, filas y columnas ocultas, así como comentarios e imágenes. Leyó resultados guardados de fórmulas, sin recalcular el libro.
2. Abrió **Biblioteca federal → Origen T-MEC → 4. Productor**. Abrió la copia local de la página oficial, preparó la consulta y eligió B2 y B3 como pruebas.
3. Revisó el mensaje completo. Una petición real a OpenAI incluyó el numeral público. Se comprobó su igualdad con la vista previa y la ausencia del folio, las celdas, la pregunta libre y los nombres del expediente. El proveedor registró 335 tokens de entrada y 100 de salida.
4. El abogado recuperó en el equipo la pregunta original, el folio, las dos celdas y la cita. La respuesta propuso comprobar quién produjo la mercancía y dónde. El numeral completo permaneció junto a la lectura para que el abogado pudiera revisar las condiciones aplicables a productores múltiples y al tratamiento confidencial. La nota se volvió a abrir después de reiniciar el servicio.

## Fuente y alcance de la captura

Se archivó el capítulo 5 publicado por el Gobierno de México, 18 páginas y 107 304 bytes. El control SHA-256 del PDF es `3cea565ba5be5040878e9332bd0c3f06fc408ae6676c84161de34d613ce33b93`. El índice del piloto extrae los nueve numerales del Anexo 5-A en las páginas físicas 17 y 18. El numeral 6 incluye dos incisos y ocupa ambas páginas. Los nueve cuerpos de texto coincidieron al extraerlos con Poppler y PDF.js, normalizando espacios y pies de página. El índice puede regenerarse con `python3 scripts/index-tmec-annex.py`. [Capítulo 5, Gobierno de México](https://www.gob.mx/cms/uploads/attachment/file/465786/05ESPProcedimientosdeorigen.pdf)

Para un expediente mexicano también hay que cotejar las reglas de aplicación. La modificación publicada el 22 de diciembre de 2023 alteró, entre otros puntos, el Anexo 1 mexicano respecto del certificador y del importador. El transitorio estableció el 29 de diciembre de 2023 como fecha de entrada en vigor de esa resolución. Se consultó el HTML oficial. La ficha del producto contiene el texto del tratado. La consolidación histórica de las reglas mexicanas y de las reglas específicas de cada producto sigue abierta. [Modificación publicada en el DOF](https://sidof.segob.gob.mx/notas/docFuente/5712302) · [Reglamentaciones uniformes](https://sidof.segob.gob.mx/notas/docFuente/5626542)

## Prueba de privacidad con el modelo local real

Cada conteo cuenta menciones anotadas en una proyección del expediente. La restitución verifica que el original se recupera exactamente. Los documentos de estas mediciones permanecieron en el equipo.

| Muestra | Identificadores cubiertos | Indicios cubiertos | Hechos legibles |
|---|---:|---:|---:|
| Cinco colecciones históricas, 38 documentos | 35/35 | 31/32 | 48/50 |
| Materiales y procedencia, r28.1 | 6/6 | 0/5 | 2/6 |
| Mismos cuatro textos, usados para desarrollar r29 | 6/6 | 5/5 | 5/6 |
| Empaque nuevo, r28.1 | 5/5 | 1/4 | 5/7 |
| Mismos cuatro textos de empaque, r29 | 5/5 | 1/4 | 5/7 |

El modelo local propuso el material del segundo expediente y se adaptó al español documental para el ensayo. Sus anotaciones se fijaron antes de probar la nueva lectura. El conjunto de referencia tiene la huella `59716b50b1a8f701cafee824ff778c0d6133929951e4fb16f09458d3021ee913`. Los dos lectores restauraron los cuatro textos y asociaron las tres apariciones del folio. En ambos quedaron expuestos el nombre de una zona industrial, un rasgo de la chimenea y la descripción posterior de un grabado. La muestra es pequeña y carece de evaluación ciega por abogados. Los ensayos privados de la aplicación siguen circunscritos a datos ficticios y fuentes públicas.

## Repetición

Usar `node scripts/measure-intake-dialogue.mjs eval/privacy-trade/dialogo-empaque-r29.json` para medir el diálogo local. El recorrido en navegador está en `scripts/check-pilot-origin-annex.mjs` y el caso del Reglamento con una matriz de avisos, en `scripts/check-pilot-regulation-search.mjs --matriz` (sus dos primeros argumentos son las rutas de aplicación y resultados). Reproducción, respuestas, capturas y exportaciones de la entrega en `artifacts/origen-r29/`.

El paquete privado se extrajo en otra carpeta en este Mac. Se repitieron la consulta T-MEC y la del Reglamento con el cuerpo exacto de sus solicitudes previas y se recuperaron ambos expedientes después del reinicio. LibreOffice abrió e imprimió seis archivos. El texto impreso conservó la pregunta, la cita y las dos direcciones de celda con sus valores en cada formato. Se comprobó el arranque y respaldo con dos claves simuladas. La suite de JavaScript registró 1 473 pruebas aprobadas, diez omitidas y cero fallos. El ensayo con la clave real de Lorenzo, el recorrido humano de los tres participantes, Windows y el rendimiento en un equipo de 8 GB siguen sin comprobarse.

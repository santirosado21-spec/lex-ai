# Protección local de preguntas y documentos de retorno

Prueba del 19 de noviembre de 2026 sobre este Mac, con el lector local de Rejon, Ollama y expedientes ficticios en español. El propósito fue comprobar si el abogado puede seguir la identidad de un bien sin perder los hechos que distinguen una reparación de una sustitución.

## Resultados por expediente

Cada fila cuenta las menciones directas e indicios indirectos cubiertos por completo y las expresiones jurídicas o técnicas que permanecieron íntegras en la vista conjunta. Una expresión parcialmente cubierta cuenta como pérdida. La restitución se comprobó contra el texto original. Los resultados miden la vista del expediente en el equipo.

| Ejercicio | Menciones directas | Indicios indirectos | Expresiones conservadas | Uso en el desarrollo |
|---|---:|---:|---:|---|
| Retorno y sustitución | 8/8 | 2/2 | 6/6 | Regresión de r23. En r23 quedaron 1/2 y 2/6 en las dos últimas métricas. |
| Garantía de una bomba | 7/7 | 2/2 | 7/7 | Caso fijado antes de probar la nueva instrucción. Después sirvió para ajustar la detección. En r24 quedaron 1/2 y 2/7. |
| Servicio de un instrumento | 11/11 | 2/2 | 3/7 | Segundo caso sintético. En el primer pase del nuevo lector quedó visible parte de un indicio y el nombre del equipo perdió su marcador común. Después del ajuste, el nombre llevó el mismo marcador en cuatro textos. Persistieron cuatro pérdidas técnicas. |
| Inspección de un medidor | 7/7 | 1/2 | 4/6 | Reserva escrita después del ajuste. Se midió desde el ZIP entregado. En r24 dio las mismas cifras. |

En la reserva final, la referencia a una costumbre de los vecinos permitió reconocer el lugar. El lector también ocultó parte de la finalidad de la inspección y de la pregunta sobre el sensor original. Se restituyeron los cuatro textos y las tres referencias repetidas conservaron su correspondencia. Ninguna de las líneas del expediente quedó habilitada para enviarse como texto libre. Para el caso del instrumento, un modelo local redactó el primer borrador; se corrigieron manualmente las anotaciones que no coincidían con el texto antes de medirlo. No hubo evaluación ciega por un abogado independiente.

## Cambios comprobados

- El abogado puede marcar una expresión en su pregunta antes de buscar fundamentos. El lector incorpora sus coincidencias exactas a las sustituciones locales. La interfaz impide continuar con una reserva que dejó de coincidir al editar la pregunta.
- El lector distingue el uso de un sonido local para identificar un traslado del resultado de una prueba acústica ordinaria. Una cláusula que limita una práctica a una instalación concreta recibe protección contextual. La denominación comercial con mayúscula interna puede conservar un marcador propio dentro de un tramo más amplio que ya estaba oculto.
- Una instrucción aplicada indiscriminadamente redujo de seis a tres los indicios cubiertos en doce documentos históricos. Se descartó. La rama entregada conserva el texto de revisión previo para los documentos ajenos al vocabulario de retorno y reparación. Los controles deterministas siguen operando en ambas rutas.
- En Chromium se reservó «luz de ciruela» en una pregunta con dos apariciones. Se comprobaron el marcador en la vista, la ausencia de la expresión en los dos mensajes del proveedor y la pregunta restituida al reabrir la nota y la lista. Las respuestas del proveedor en esta prueba se reprodujeron a partir de las dos consultas reales de r24. Los seis archivos se abrieron con LibreOffice. El lanzador macOS comprobó el respaldo y los recibos con dos claves de prueba.

En las cinco colecciones históricas, el código final restituyó los 38 documentos. La vista conjunta cubrió 35/35 menciones directas y 31/32 indicios, y conservó 48/50 expresiones. La suite JavaScript registró 1 460 aprobadas, diez omitidas y cero fallidas.

## Qué falta en la consulta jurídica

Se probaron por separado cuatro preguntas de los dos expedientes más recientes en el buscador de r25, con su texto íntegro para darle la mayor información posible dentro de esa pregunta. Ninguna ofreció el artículo 117 de la Ley Aduanera entre sus resultados. La referencia al envío al extranjero y la posible identidad del equipo aparecen repartidas entre documentos y turnos. El buscador actual aprovecha las palabras de la pregunta. Falta relacionar soportes del mismo asunto por referencias verificadas y ofrecer al abogado la base de esa relación. Además, la sustitución de un componente puede mantener la identidad del bien completo. El documento de servicio o el número de serie pueden ser decisivos para la revisión del abogado.

## Reproducción

Los archivos de entrada están en `eval/privacy-trade/dialogo-*-r25.json`. Las huellas de las reservas, las comparaciones con r24, los resultados completos por línea, la prueba de navegador y las exportaciones están en `artifacts/privacidad-r25/`. Para reproducir una medición, ejecuta `node scripts/measure-intake-dialogue.mjs eval/privacy-trade/dialogo-inspeccion-r25.json` con el lector local activo. El archivo del piloto tiene la huella SHA-256 `1fd4b7fa12e490f43e81631c9948602076e1240909a46cfa45a77f66dfb1b03d`.

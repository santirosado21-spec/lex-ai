# Investigación mixta sin índice federal opcional

Base: d7443bf. La pregunta sintética sobre flete y origen mezclaba un tema con pasajes aduaneros incluidos en el paquete y otro que exige el índice federal opcional. Sin ese índice, cargar el segundo tema lanzaba un error y descartaba los candidatos aduaneros ya verificados.

Corrección: la dependencia de cada tema se deriva de su lista existente de instrumentos. Solo cuando library es null/undefined se omiten los temas que requieren ese índice. Los candidatos de fuentes incluidas conservan sus validaciones y pueden preparar una consulta; no se genera respuesta automáticamente. No se hacen pasar por disponibles los pasajes ausentes.

No se captura una excepción genérica. Un lector presente pero roto/no verificado sigue fallando. Las referencias explícitas a un instrumento ausente siguen devolviendo ningún candidato, sin sustituir otro fundamento. loadTradeReading sigue rechazando fuentes no verificadas. Sin cambios de pasajes, citas, ranking de temas disponibles, corpus, proveedor, gastos o modelo local.

Prueba antes FAIL/después PASS para pregunta mixta con library null; tema solo ausente y referencias exactas ausentes no inventan candidatos. Prueba de lectores rotos/falsos; endpoint real del piloto cifrado sin índice general puede revisar pregunta y preparar la nota de la Ley Aduanera. El lector local se simula con fixture vacío y no se llama a generación cloud. No mide calidad del modelo ni vigencia jurídica.

Limitación de entorno: el índice public-library.sqlite no está incluido en este checkout. Las pruebas antiguas de intake-question que lo exigen fallan ENOENT; no se construyó, descargó ni activó uno para ocultarlo. Se ejecutan las pruebas portables del índice que crean únicamente sus fixtures sintéticos temporales. El nuevo test queda en el paso portable de CI.

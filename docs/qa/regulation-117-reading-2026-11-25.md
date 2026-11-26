# Referencia partida del artículo 117

Corte exclusivo de la edición fijada del Reglamento de la Ley Aduanera, PDF SHA256 `bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812`.

## Evidencia y tratamiento

La página 42 del PDF muestra `36-` al final de una línea y `A de la Ley.` al inicio de la siguiente. Inspección visual de la página completa y extracción de esa página coinciden. El JSON y los pasajes existentes conservan `36- A`. No se modifica esa fuente ni se aplica una regla de unión de guiones.

Se añade una anotación editorial separada a la referencia del artículo 117: literal, forma de lectura `36-A`, página, huella del PDF e intervalo base cero en el texto del pasaje. El intervalo debe señalar una sola ocurrencia literal; si cambia, falla para cotejo. La nota renderizada exige referencia/huella/intervalo coincidentes y aparece fuera de la cita documental, también en abstenciones y en seguimientos. No afirma vigencia ni exactitud jurídica. No cambia el texto, el prompt, el sobre del proveedor, el índice, la selección de artículos ni el extractor.

## Medido

- Comparación antes/después de 849 combinaciones de artículo/pasaje/enfoque del Reglamento: prompt y texto literal de referencia idénticos.
- Pruebas nuevas: anotación y límites, cita literal, abstención, fuente secundaria, seguimiento, aislamiento de otros artículos/huellas y exportación DOCX por el servicio del piloto con expediente sintético cifrado. Generadores local/remoto simulados, ninguna inferencia real.
- Batería dirigida de investigación, Reglamento y advertencias: diez pruebas, nueve aprobadas, una omitida por índice federal SQLite no instalado. Las tres pruebas nuevas pasan sin omisiones.
- DOCX exportado convertido a PDF para inspección visual: cita conserva `36- A`, nota editorial separada y legible, pie de fuente y tabla presentes. No se cambió el diseño del exportador. La tabla empieza en la segunda página con el formato preexistente.
- Compilación aprobada; advertencia de tamaño de chunks existente.

## Límites

No se ha verificado un modelo jurídico, vigencia, aplicabilidad a operaciones ni el corpus completo. No se activó corpus, cliente ni proveedor. La anotación se muestra en notas de investigación y seguimiento, no añade por sí sola una vista nueva al directorio de artículos. La página 42 respalda la lectura tipográfica, no una sustitución del texto original. Pendiente revisión independiente y publicación.

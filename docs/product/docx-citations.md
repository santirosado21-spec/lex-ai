# Referencias legibles en el DOCX

La exportación muestra `[1]`, `[2]`, etc., tanto en el análisis como en las entradas de fuentes. La numeración sigue el orden guardado de `answer.citations`, aunque el texto mencione primero otra fuente. Solo se reemplazan referencias exactas entre corchetes cuyos IDs están en esa lista.

El cambio existe únicamente dentro de `answer.export`: no modifica el análisis almacenado, sus IDs de origen, los alias del modelo ni la recuperación. Los pasajes citados se conservan literalmente, incluidas sus propias marcas entre corchetes. También se conservan URLs visibles, destinos de hipervínculo, versiones, fechas y la nota de revisión profesional y vigencia.

Se consultó la skill de documentos para claridad y conservación del contenido. Esta entrega modifica el generador existente, no crea una nueva plantilla o diseño documental; mantiene tipografía, estilos y márgenes anteriores.

Validación: `node --test tests/docx-citations.test.mjs tests/service.test.mjs` — 18 PASS. El caso nuevo abre el ZIP real del DOCX y verifica `word/document.xml` y sus relaciones: dos IDs públicos de68caracteres, orden de referencias distinto al de la bibliografía, repetición, pasajes con caracteres XML y corchetes, URLs, metadatos, aislamiento de asunto e inmutabilidad del registro guardado. No se ha realizado una nueva inspección visual de Word o un build nativo en este worker.

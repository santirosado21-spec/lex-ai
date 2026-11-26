# Clasificación posterior al cuerpo del Reglamento

Corte acotado a la huella del PDF de 90 páginas ya fijado en el producto. No cambia los 282 artículos, ni el JSON de biblioteca, ni el corpus activo. Artículo 117 y las siete diferencias entre capas quedan fuera de esta reparación.

El importador genérico antes devolvía 13 transitorios, incluyendo el artículo 144 de una tabla RGCE y el artículo único reformador. Ahora una clasificación específica de documento conserva diez bloques crudos: transitorios originales, siete páginas de anexos de cantidades, artículo único reformador y transitorios de reforma. Se conservan páginas, texto extraído original, fechas dentro del texto, huella del PDF y huella de cada bloque. La concatenación de rawText reconstruye exactamente la cola desde TRANSITORIOS en p.81 hasta el final. No se mezclan p.88 y p.89.

La vista normalizada separa seis transitorios originales y cinco del decreto de 2026. Firmas y cierres quedan en bloques crudos, no en transitorios. Toda la salida permanece en cuarentena, sin evaluación jurídica ni vigencia verificada. Otras leyes y otras huellas siguen la ruta anterior. La adquisición optativa guarda los bloques crudos en un sidecar no indexado, no publicado y separado de records. Su clave de parser cambia para no reutilizar silenciosamente una extracción anterior.

## Medido

- 55 pruebas dirigidas iniciales: todas aprobadas (clasificación, importador, notas editoriales, regresiones v37).
- Tras integrar conservación en adquisición: 26 pruebas de adquisición y clasificación aprobadas, sin omisiones.
- Comparación anterior/posterior de las dos capas: los 282 textos, identificadores y páginas operativas no cambian en ninguna capa.
- Compilación Vite aprobada; advertencia existente de tamaño de chunks.
- Pruebas de límites: huella/ley ajenas no activan clasificador; páginas o límites inesperados fallan; dos capas reales producen once transitorios; firma no se pega; tabla144 y artículo único conservados; sidecar alterado se rechaza.

## Límites

No certifica vigencia, exactitud jurídica integral ni aplicación a operaciones. No corrige orden de lectura de las siete familias ni normaliza 36-A. La preservación es respecto del texto extraído de cada capa, no una afirmación de identidad textual entre capas. La clasificación usa páginas revisadas y huella fija, no es una heurística general para otras leyes. El inventario crudo conserva también encabezados y pies como evidencia reversible. No se reextrajo ni activó un corpus congelado.


## Corrección acotada posterior: título de catálogo alterno

La revisión con `source.title=R` reveló que SEGUNDO del decreto 2026 absorbía el encabezado corrido de p.90 y declaraba páginas 89/90. Con título canónico ya salía limpio. Se reprodujo en default y Poppler; no era contaminación de la ruta canónica. La causa era que el filtro genérico de título dependía de los metadatos del catálogo.

El clasificador fijado por ley y huella ahora excluye la línea completa exacta del encabezado del Reglamento solo en la vista posterior al cuerpo (p.81 a 90). No cambia el filtro genérico. `coverage.postBodyNormalizationExclusions` conserva texto, página, índices de línea raw base cero y motivo de cada exclusión adicional. Con título canónico la lista está vacía porque la ruta existente ya retiró ese encabezado. El raw conserva todas las líneas, incluido el encabezado de p.90. Además se rechazan marcadores TRANSITORIOS ausentes o ambiguos en lugar de permitir `findIndex=-1` seguido de `slice(0)`.

Mediciones del arreglo:

- Cuatro combinaciones reales: dos capas por título canónico/alterno. En cada una, los 282 registros operativos completos y los diez bloques raw completos son idénticos antes/después.
- Ambos títulos producen los mismos once transitorios. En la ruta canónica ninguno cambia; en la alterna solo cambia SEGUNDO 2026, de páginas 89/90 a 89, quitando exclusivamente el encabezado final. Su huella limpia es `c5e9ed63224c0e8c788afeffbe572e98661b8147379be1caee67797041eab495`.
- Con título alterno quedan diez exclusiones adicionales, una por página posterior al cuerpo; cada una enlaza con su línea raw. Con canónico quedan cero adicionales.
- 29 pruebas de adquisición/clasificación aprobadas, cero omitidas. Batería relacionada: 76 pruebas, 73 aprobadas y tres omisiones preexistentes por biblioteca SQLite no instalada. Compilación aprobada, misma advertencia de tamaño.
- Parser de adquisición pasa de `postbody-1` a `postbody-2` para separar cachés. No se ejecutó adquisición, promoción ni activación de corpus.

No se midió exactitud jurídica, vigencia, calidad de modelos ni un cambio global de otras leyes. Artículo 117 permanece fuera del parche. Requiere revisión independiente antes de publicación.

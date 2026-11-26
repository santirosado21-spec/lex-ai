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

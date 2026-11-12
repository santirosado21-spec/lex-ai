# Extractor v24: encabezados ordinales en letra — 2026-11-12

## Causa
3 instrumentos de lotes 9/11/13 fallaban extraction-invalid: sus PDFs oficiales usan encabezados "ARTICULO PRIMERO.-" / "ARTICULOS PRIMERO A OCTAVO.-" (ordinales en letra) y v22 solo acepta numéricos (0 registros → extraction-invalid). Snapshots preservados; re-extracción offline sin red.

## Cambio (EXTRACTOR_VERSION 24)
- Nuevo camino ordinal fail-closed: solo mayúsculas ARTICULO(S), terminador estricto, ordinal conocido (1-12, UNICO, compuestos DÉCIMO/VIGÉSIMO/TRIGÉSIMO), estrictamente secuencial; rangos "N A M" colapsan a un registro con anomalía ordinal-range-heading-single-record.
- Compuerta de modo en dos pasadas: cualquier encabezado numérico estricto en el documento selecciona modo numérico (camino v22 intacto); el camino ordinal solo corre si NO hay ningún encabezado numérico. Motivo: una primera versión sin compuerta envenenó preámbulos de leyes modernas ("ARTÍCULO PRIMERO.- Se expide…") — detectado por la regresión (14/152 diferentes) y corregido ANTES de publicar.
- Bump 23→24: los 3 archivos de extracción escritos por el v23 pre-compuerta (nunca publicado) se conservan por inmutabilidad del corpus; su contenido es byte-idéntico al v24 (verificado), y el archivo vigente por documento es el más reciente (v24).

## Verificación
- tests/legal-library.test.mjs: 36/36 PASS, incluidas clases negativas nuevas: ordinal fuera de secuencia nunca abre, referencias en minúsculas/capitalizadas ("el artículo primero de esta ley") nunca abren, ordinal en mayúsculas tras artículo numérico permanece como cuerpo.
- Regresión offline completa: 152/152 extracciones almacenadas byte-idénticas (articleId + textSha256 + sourcePages) re-extrayendo cada snapshot con v24. Script: /tmp/regresion-v23.mjs (no versionado).
- Re-extracción offline de los 3 snapshots: law-176 (4 arts), law-204 (2), law-79 (1-8, 9, 10; rango colapsado con anomalía documentada). Todo EN CUARENTENA (textReview/legalReview pending); contenido NO revisado.

## Estado del corpus federal tras este cambio
137/317 instrumentos adquiridos (134 anteriores + 3 recuperados). Pendientes: 180. Cuarentena intacta; nada publicado, indexado ni exportado.

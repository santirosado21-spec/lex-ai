# QA adquisición federal lotes 16-33 (extractor v24) — 2026-11-12

Continuación de la cadencia autorizada por instrucción del usuario 2026-11-12 (alcance operativo, no autorización de derechos). Primeros lotes con EXTRACTOR_VERSION=24 (ordinales en letra, compuerta de modo en dos pasadas; ver docs/qa/extractor-v24-ordinales-en-letra-2026-11-12.md). Índice oficial re-verificado en vivo por lote: SHA-256 a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca sin deriva en los 18 lotes. HEAD HTTP200 application/pdf por PDF.

TODO EN CUARENTENA (textReview/legalReview pending). Conteo ≠ corpus limpio ni completo; contenido NO revisado. Anomalías = clases conocidas (mid-sentence-structural-line-kept-as-body, section-discard-exceeded-2-lines, una operative-numbering-restarts en lmeum lote 27), trazables en coverage.discardedSamples.

## Resumen por lote (docs/registros)

L16 10/812 · L17 10/526 · L18 10/523 · L19 10/1009 · L20 10/743 · L21 10/851 · L22 10/897 · L23 10/1187 · L24 10/1262 · L25 10/876 · L26 9/500 · L27 10/1906 · L28 10/783 · L29 10/829 · L30 10/839 · L31 10/822 · L32 10/841 · L33 10/1322.

Totales del bloque: 179 documentos, 16,528 registros.

## Único fallo: presupuesto de bytes por documento

- ligie-2022 (LIGIE 2022): PDF de 19,158,939 bytes > maxDocumentBytes 10,485,760 del registry (límite vigente de todos los lotes 1-33). Fail-closed funcionó como diseñado; documento NO descargado. Requiere decisión acotada: subir maxDocumentBytes (p.ej. 25 MB) para este documento u otorgar excepción documentada. No se relajó el límite unilateralmente.

## Estado del canal federal

316/317 instrumentos del catálogo adquiridos y en cuarentena. Pendiente único: ligie-2022 (bloqueado por presupuesto, decisión arriba). Canal federal agotado salvo ese documento. Cifras derivadas de archivos (jq .records), no estimadas.

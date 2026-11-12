# QA: lote federal 6 (régimen general) con extractor v22 — 2026-11-12

Lote: `resources/legal-acquisition-fed-expansion-6-2026-11-12.json`, 10 instrumentos (lfpca, lfce, lga, lgahotdu, lgcc, lan, lgvs, lgeepa, lgsc, lcpaf), canal oficial Cámara de Diputados. Índice re-verificado en vivo 2026-11-12T17:37Z, SHA256 a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca idéntico a lotes 1-5 (sin deriva). Cada PDF verificado HEAD 200 application/pdf antes de descargar.

Resultado (corrida --live, 39 s, 20 requests, 8.4 MB): 10/10 documentos descargados y extraídos con EXTRACTOR_VERSION=22, 1,490 registros, estado complete. Todo queda en cuarentena (textReview/legalReview: pending); sin publicación, export ni ruta de producto.

Anomalías fail-closed (mismo comportamiento v22 del corpus previo):
- lan, lfpca: mid-sentence-structural-line-kept-as-body.
- lfce, lga: mid-sentence + section-discard-exceeded-2-lines.
- lcpaf, lgahotdu: sin anomalías documentales; lgcc, lgeepa, lgsc, lgvs: solo anotaciones por registro preexistentes (marcadores de tamaño/derogación).

Censos por documento: lan 215, lcpaf 93, lfce 153, lfpca 135, lga 123, lgahotdu 119, lgcc 116, lgeepa 270, lgsc 123, lgvs 143. Los conteos son estructurales, no evidencia de completitud textual; el contenido de estos 10 documentos no está revisado.

Cobertura federal tras este lote: 48 de 317 instrumentos del catálogo adquiridos (38 previos + 10); 269 pendientes. Nada de esto activa el corpus ni cambia el estado de exports-v2.

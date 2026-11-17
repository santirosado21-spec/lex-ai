# Zacatecas: candidato a salida de cuarentena (NO ejecutado), 17 nov 2026

Estado: cuarentena. Este documento describe el candidato y qué cambiaría; no libera, no publica, no indexa, no activa. La autoridad para cualquier salida es de main/usuario, no de este documento ni del revisor.

## Candidato
- Corte: v36c (part-14, commit 528458a; tar.gz sha256 322793712f0a59739322af6e69f1ae2018251c507d82311f2c42d8047c48b899).
- Una extracción por documento (144) según el mapa de selección del revisor (docs/qa/zac-mapa-seleccion-v36c-revisor-2026-11-17.json): Poppler en 141, pdf-parse en 198/230/368.
- Manifiesto con sha256 de cada archivo de extracción: docs/qa/zac-candidato-v36c-manifest-2026-11-17.json (scripts/zac-candidate-manifest.mjs). Totales: 13,207 artículos, 2,237 transitorios, 15 registros de prefacio citado; 144/144 con fecha de publicación del índice oficial; fecha de reforma declarada en cabecera en 76-78 documentos según capa (no se infiere donde no se declara).
- Estado actual de cada extracción: status=quarantined, published=false, indexed=false, textReview=pending, legalReview=pending (verificado en los 144).

## Qué cambiaría al salir de cuarentena (a decidir; hoy no existe automatismo)
1. Archivos/estado: hoy las extracciones viven en artifacts/public-corpus/zac-v36c-* (no versionadas en git; respaldo Drive part-14). Ningún código existente cambia textReview/legalReview/published/indexed ni escribe resources/legal-corpus.json (docs/legal-sync.md: la sincronización nunca activa). Una salida requeriría un paso nuevo y explícito que consuma el manifiesto por hash, sin editar en sitio las extracciones ni reportes. Ese paso no está escrito.
2. Audiencia: ninguna definida. Hoy nadie fuera del repositorio y del respaldo privado ve estos textos. Una salida podría ser: (a) solo el índice local de investigación de desarrollo; (b) el producto de escritorio de usuarios. Cada una es una decisión distinta.
3. Indexación: no existe índice de Zacatecas. El índice del producto (public-library-v2.sqlite u otro) se reconstruye de un corpus exportado; incluir estos registros cambiaría resultados de búsqueda. Los registros 'transitorio' y 'prefacio-articulo-citado' no son artículos operativos y deben filtrarse o etiquetarse en el índice.
4. Reversión: mientras sea un índice/archivo derivado y reconstruible, se revierte reconstruyendo sin Zacatecas; las extracciones y snapshots originales no se tocan. Si se copiara a un artefacto distribuido a usuarios, la reversión dependería de la distribución (no controlada aquí).
5. Validaciones hechas: QA independiente contra fuente e integridad del part-14 (informado por main); npm test 1206 pass y 1 fallo OCR ambiental preexistente; CI 528458a success. NO hechas: revisión de derechos/licencia como conclusión (solo "evaluación sustentada"), validación de vigencia (los textos son los publicados en el índice oficial a 17-nov; "vigencia" solo es la declarada en cabecera), cobertura de huecos de secuencia 120/143/159/230/325/379 (clasificación del revisor), prueba de búsqueda/UI con estos registros.

## Límites
No es certificación jurídica ni paridad con Luthor. Las fechas son declaradas por la fuente; efectividad y vigencia legal no se determinan. Nada se libera por conteos.

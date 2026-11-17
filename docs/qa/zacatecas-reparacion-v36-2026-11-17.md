# Zacatecas: reparación del extractor (v34-v36), 17 nov 2026

Estado: TODO EN CUARENTENA. Nada liberado, publicado ni indexado. Control interno; no es validación legal ni de derechos. La revisión independiente es previa a cualquier liberación (la asigna main).

## Origen
Revisión independiente del lote v33 (144 docs): artículos faltantes, transitorios sin registros, fechas incompletas. El paquete de defectos del revisor (docs/qa/zac-defectos-revisor-2026-11-17.json) se trató como diagnóstico a verificar contra el PDF, no como objetivo ni instrucción; ningún id/número está hardcodeado. El revisor retiró 165/art.105 (cita inline del preámbulo).

## Cambios generales (server/legal-library.mjs, EXTRACTOR_VERSION 36)
- v34: encabezado bare con sufijo ordinal (1º, 1°, 1/º); encabezado bare con marcador de lista inline; "Artículo18." sin espacio en modo numérico.
- v35: TRANSITORIOS de un decreto previo (seguido de reinicio en art. 1) no cierra el documento; reinicio en art. 1 descarta candidatos de prefacio; encabezado bare + repetición inline del mismo artículo = un artículo.
- v36: capa de texto alterna Poppler (registry document.textLayer='poppler'; provenance en coverage.parser); bare con salto adelante <=3; candidatos de prefacio citados; rúbrica marginal antes de "Artículo N."; fecha declarada acepta "Última Reforma POG"; transitorios como registros separados (recordKind 'transitorio', orden después de los artículos, con página y grupo).
- Cada regla deja una anomalía visible en el documento. Las anomalías de descarte de prefacio cuentan lo descartado; el contenido del prefacio NO se conserva todavía como registros (pendiente, indicado por main).

## Procedimiento y artefactos
- scripts/zac-v36-reprocess.sh: reprocesa offline en directorios NUEVOS (zac-v36-pdfparse-NN y zac-v36-poppler-NN); los directorios v33 originales no se modifican. Ambas capas se conservan.
- scripts/zac-v36-inventory.mjs -> docs/qa/zac-v36-inventory-2026-11-17.json: por id, v33 / pdf-parse v36 / Poppler v36 (artículos, transitorios, huecos de secuencia, anomalías, parser).
- docs/qa/zac-index-dates-2026-11-17.json: "Fecha de publicación" del índice oficial (sha256 del índice 7ad9f7c8...), 144 ids. Es fecha de publicación, no de reforma ni vigencia; aún no integrada en las extracciones.
- Nota de integridad: el report.json del lote 10 original fue sobrescrito por una corrida offline de un solo documento (zac-ley-213) a las 10:50; las extracciones y versiones del lote 10 están intactas. El inventario v33 lee las extracciones directamente.

## Resultados (conteos de registros, no cobertura validada)
Ver el JSON de inventario. Totales: v33 12,073 artículos; v36 pdf-parse 12,803 (+1,732 transitorios); v36 Poppler 13,204 (+2,233 transitorios). Poppler recupera 213 (flate corrupto) y 028/030/096/196 (capa de texto defectuosa); pierde un artículo en 198 (139), 230 (59), 368 (61), que el revisor confirmó que existen y v33 conserva: no hay fusión automática; la selección por documento queda para el revisor, ambas capas intactas.
Huecos de secuencia internos restantes (Poppler): 120 (125), 143 (75), 159 (24; el PDF imprime "ARTPICULO 24"), 198, 230, 325 (7), 368, 379 (40; rúbrica pegada en la misma línea). Sin evidencia aún de si son saltos genuinos de la fuente.

## Pruebas
npm test: 1204 pass, 1 fail (OCR de PDF escaneado: falla también sin estos cambios; ambiental, preexistente).

## Límites
Transitorios: segmentación solo ordinal/numérica; el grupo es el encabezado más cercano (no verificado semánticamente). Fechas de reforma: 72/144 con fecha declarada en cabecera (Poppler). Sin afirmar paridad con Luthor ni cobertura de entidad.

## Adenda v36b (misma fecha, 15:00): prefacio preservado y fecha de publicación trazable
- Los candidatos de prefacio/decreto previo que reglas v35/v36 apartan ya NO se descartan: pasan a registros recordKind 'prefacio-articulo-citado' (motivo en headingTitle: decree-transitory, quoted-article, art1-restart), después de los artículos y antes de los transitorios, con texto, hash y páginas. No cuentan como artículos operativos.
- document.declaredPublicationAt (registry, YYYY-MM-DD) se copia a la extracción con declaredPublicationAtBasis='official-index-fecha-de-publicacion' (144/144). Es la fecha del índice oficial, no reforma ni vigencia.
- Reproceso offline v36b en directorios NUEVOS zac-v36b-pdfparse-NN / zac-v36b-poppler-NN (scripts/zac-v36b-reprocess.sh rechaza sobrescribir; registries resources/legal-acquisition-zac-v36b-<capa>-NN-2026-11-17.json). Los directorios v33 y v36 y sus reportes no se tocan. Inventario: docs/qa/zac-v36b-inventory-2026-11-17.json (V=v36b node scripts/zac-v36-inventory.mjs).
- Resultado: mismos artículos que v36 (pdf-parse 12,803; Poppler 13,204) y mismos transitorios (1,732; 2,233); prefacio preservado: 13 registros pdf-parse, 15 Poppler. Conteos de registros, no cobertura validada.
- El report.json original del lote 10 sigue siendo el sobrescrito por la corrida de un solo documento (10:50): se conserva como reporte de incidente; los reportes nuevos son los de cada directorio v36/v36b.

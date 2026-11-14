# Extractor v28: lectura streaming de document.xml en .docx — 2026-11-14

## Causa
mex-ley-222 (Presupuesto de Egresos del Estado de Mexico 2026, docx de 6.9MB) fallo en v27 con la clase document-xml-budget: su word/document.xml descomprimido pesa 314,394,997 bytes, sobre el techo de 200MB de la ruta por cadenas (JSZip cargaba el XML completo en memoria). Autorizacion de main (2026-11-14 05:05 CST): implementar lector streaming dentro del desarrollo existente, con limites de recursos y pruebas, sin gasto y sin activar corpus.

## Cambio (EXTRACTOR_VERSION 27 -> 28)
- server/legal-library.mjs: docxPages ahora abre word/document.xml con yauzl (lazyEntries + validateEntrySizes) y lo escanea incrementalmente (decoder UTF-8 en streaming, maquina de estados gap/texto). La memoria ya no depende del tamano del XML.
- Semantica de parrafos IDENTICA a v27: split en </w:p[ >], union de runs <w:t> por parrafo, unescape despues; tags sin cerrar al EOF se descartan como hacia la regex de v27.
- Limites duros (fallo cerrado): document.xml descomprimido <= 1 GiB; ratio de compresion <= 200; entradas cifradas rechazadas; run de texto <= 4 MiB; parrafo <= 8 MiB; texto total extraido <= 64 MiB; carry de tag sin cerrar <= 1 MiB.
- El pipeline PDF y la ruta .doc (antiword) quedan byte-identicos. La ruta de importacion del usuario (extraction-worker, mammoth, techo 30MB) no cambia.

## Pruebas
- tests/word-extraction.test.mjs: equivalencia byte-a-byte contra la expresion v27 sobre XML sintetico con entidades, atributos, parrafos vacios, tablas y texto fuera de parrafo, alimentado en chunks de 1/7/64/total bytes; decodificacion UTF-8 multibyte partida entre chunks; caps: parrafo >8MiB y run >4MiB rechazados.
- Verificacion adversa con corpus REAL: mex-ley-017 (docx Edomex) parseado por ambas rutas: 169,758 caracteres, salida IDENTICA incluso alimentando el stream en chunks de 3 bytes.
- Verificacion real del caso disparador: reproceso --offline de mex-ley-222 (snapshot c2ebb245...docx ya capturado, sin nueva descarga): 84 registros, 4,849,547 caracteres, ~2s, estado quarantined. La clase document-xml-budget queda CERRADA (0 fallidos por esta clase).
- Suite completa: 1179 pass / 0 fail (incluye re-pin de EXTRACTOR_VERSION=28 en extractor-format-variants).

## Nota de agregacion
El intento v27 fallido de mex-ley-222 permanece en la historia (report.json previo, este QA y el QA de Edomex con su seccion Correccion). El resultado vigente para la misma fuente+version es el de v28; no es "preferir el exito": el fallo era limite del extractor, no de la fuente, y el artefacto fallido previo sigue visible en git.

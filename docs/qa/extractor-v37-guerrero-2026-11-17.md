# Extractor v37 y corte Guerrero (cuarentena) - 2026-11-17

Todo sigue en CUARENTENA (status quarantined, published false, indexed false, textReview/legalReview pending). Adquisicion parcial: no es validacion, liberacion ni vigencia certificada. Sin paridad Luthor.

## Por que v37
Cotejo de los PDF de Guerrero lotes 10-14 (pdftotext, encabezados `Articulo N` al inicio de linea) contra la extraccion v36:
- gro-ley-132: 285 articulos con encabezado limpio en el PDF, 41 extraidos. Causa comprobada: el preambulo de dictamen cita arts. 2 y 3 dos veces, el extractor se detenia al primer repetido (`operative-numbering-restarts-before-transitory-boundary`) antes del art. 1 real. Ademas una cita partida (`...ARTICULO QUINTO / TRANSITORIO.`) en una linea sola se tomaba como frontera de transitorios y cortaba en el 217.
- gro-ley-124 (art 5 `Articulo. 5.`), gro-ley-137 (art 7 `Articulo7.-`), gro-ley-134 (art 1 `Articulo 1°`, y 5/6 con `º`): variantes de encabezado no reconocidas.

## Cambios (server/legal-library.mjs, EXTRACTOR_VERSION 37)
1. Reinicio antes del art. 1: si hay un `ARTICULO 1.-` posterior seguido de `ARTICULO 2.-` (hasta 600 lineas), los candidatos previos pasan a `prefaceRecords` (`restart-before-art1`) y se reanuda en ese art. 1.
2. Cita partida `ARTICULO <ordinal>` + linea `TRANSITORIO(S).` no es frontera.
3. Variantes estrictamente secuenciales y fail-closed: `Articulo7.-` (solo modo numerico), `Articulo. 5.`, `Articulo 1° Mayuscula...` (incluido el primer articulo).

## Evidencia
- Fixtures: tests/extractor-v37.test.mjs (5; 4 fallan con el codigo v36, pasan con v37). npm test: ver reporte.
- Regresion Zacatecas: scripts/zac-v37-regression.mjs, 144/144 documentos del candidato v36c identicos (articulos, transitorios y prefacio por id + sha256 del texto) tras reprocesar con v37 en directorios nuevos zac-v37-*.
- Guerrero 138 documentos (gro-ley-073 excluido por document-byte-budget): manifiesto docs/qa/gro-corte-v37-manifest-2026-11-17.json. Seleccion por documento: Poppler por defecto (separa transitorios; pdf-parse los deja pegados al ultimo articulo), pdf-parse en gro-ley-040, 110 y 138 donde Poppler extrae menos articulos.
- Antes de v37 (extracciones originales): 11,453 articulos y 29 documentos con huecos; con v37 y la seleccion: 12,265 articulos, 1,641 transitorios, 210 registros de prefacio citado, 18 documentos con huecos. Los registros que pasan a prefacio son articulos citados en dictamenes (gro-ley-033, 053, 054, 066 verificados por pagina), conservados, no borrados.

## Frontera restante (huecos sin clasificar como perdida o salto real)
- Sin encabezado en el PDF (no es perdida del extractor segun este detector, el motivo del salto no se clasifico): 001, 005, 011, 029, 041 (art 10 se menciona en texto), 042, 058, 075, 117.
- Con encabezado en el PDF y no extraido (pendiente de causa, pueden ser citas en preambulo o estructuras de varias versiones): 025, 032, 040, 053, 061, 072, 086, 087, 090. Detalle en docs/qa/gro-gap-check-v37-2026-11-17.json.
- gro-ley-132 conserva 41 articulos citados del dictamen como prefacio; 285 articulos numerados + 7 sufijados (64-BIS...).

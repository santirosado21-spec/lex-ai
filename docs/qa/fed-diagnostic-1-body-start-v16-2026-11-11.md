# Diagnóstico acotado: inicio de cuerpo operativo no establecido (LGSMIME, LOEFAM, REG_SENADO) — extractor v16 — 2026-11-11

## Alcance

Diagnóstico local de los 3 instrumentos que la revisión del 2026-11-02 excluyó de
la exportación congelada con motivo `operative-body-start-not-established`
(docs/legal-library.md). Adquisición acotada en CUARENTENA (registro
`resources/legal-acquisition-fed-diagnostic-1-2026-11-11.json`), sin cambios de
extractor (v16 intacto), sin integración, sin re-freeze, sin publicación. El
cuarto instrumento excluido (LSINT, por declaración de invalidez en su
publicación) no es un problema de extracción y queda fuera de este diagnóstico.

## Adquisición

- Índice oficial re-verificado en vivo 2026-11-12T00:22Z: SHA256
  a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca, sin drift.
- HEAD en vivo, HTTP200 application/pdf: LGSMIME 1092616 B, LOEFAM 991498 B,
  Reg_Senado 1220580 B.
- `--live` acotado (3 docs, 12 requests máx, 8 MB máx, rate 2s, concurrencia 1):
  estado `complete`, 3/3 en cuarentena. Auditoría
  `public-corpus-extraction-audit.mjs`: reportState complete, ok=true, 0
  hallazgos. declaredAmendedAt: lgsmime 2025-11-14, loefam 2025-07-16,
  reg-senado 2024-12-06, reconciliados contra filas editoriales del índice.

## Hallazgo común (causa raíz)

El patrón de encabezado de v16 (`ARTICLE` en `server/legal-library.mjs:119`)
exige puntuación terminal tras el número (`.`, `:` o guion) u ordinal estándar
(`1o.`/`1º`). Los 3 instrumentos usan formatos editoriales oficiales que no lo
cumplen; la exclusión fail-closed del freeze detecta correctamente el resultado
(primer registro ≠ artículo 1 o primera página >10).

## Por instrumento

### lgsmime — 1 registro (espurio), cuerpo real ~112 artículos

- El cuerpo usa encabezados SIN punto: "Artículo 1" solo en su línea, seguido de
  párrafos numerados (112 encabezados `^Artículo [0-9]+$` en el texto del PDF).
  v16 no ancla ninguno.
- El único registro extraído ("Artículo 5o. Constitucional relativo al ejercicio
  de las profesiones…", p.56) es una cita constitucional dentro de material
  transitorio/de decreto, no el artículo 5 de la ley. transitoryStartPage=56.
- Complejidad editorial adicional: portada con "Ley Abrogada DOF 02-03-2023",
  "Texto Que Recupera Vigencia", declaratoria de invalidez del decreto abrogador
  por sentencia SCJN (DOF 24-11-2023) y "TEXTO VIGENTE". Aun con extracción
  resuelta, el estatus del texto requiere decisión de revisión, no solo formato.

### loefam — 222 registros, cuerpo real 209 artículos

- Arts. 1-9 (más 1-BIS y 2-BIS) usan formato degradado tipo OCR: "ARTICULO 1/o.",
  "ARTICULO 1/o BIS" (diagonal en lugar de ordinal "1o."). 9 encabezados así.
- Del art. 10 en adelante el formato es limpio ("ARTICULO 10."). v16 extrae 222
  registros = 200 numéricos (10..209) + 22 BIS del tramo limpio; termina
  exactamente en 209 con frontera transitoria (línea 3245 del texto), sin
  huecos en 10-209.
- La exclusión del freeze es correcta: faltan los arts. 1-9 y 2 BIS; publicar el
  instrumento sin ellos sería un cuerpo incompleto.

### reg-senado — 6 registros (espurios), cuerpo real ~305 artículos

- Mismo formato sin punto que lgsmime: 305 encabezados `^Artículo [0-9]+$`.
- Los 6 registros anclados (167, 260, 261, …) son artículos derogados con
  formato "Artículo 260. Derogado" (con punto), no el cuerpo operativo.

## Conclusión y límites

- La exclusión del freeze es fail-closed y correcta en los 3 casos: el problema
  es de formato editorial/OCR del PDF oficial, no una falla silenciosa del
  pipeline.
- Cualquier soporte para estos formatos (encabezado sin punto; ordinal "N/o.")
  sería un cambio de extractor que requiere decisión explícita y verificación
  byte-idéntica de regresión sobre las 38+3 extracciones existentes; NO se
  realizó ningún cambio.
- Estas 3 extracciones permanecen en CUARENTENA (productionEnabled=false,
  published=false, indexed=false, trainingExported=false). Nada certifica
  vigencia ni aplicabilidad; lgsmime además carga una historia editorial de
  abrogación/recuperación que solo una revisión puede resolver.

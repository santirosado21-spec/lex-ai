# Extractor v33 — referencias con forma de encabezado y saltos de numeración (2026-11-17)

## Alcance de esta comprobación

Descripción de riesgos aportada por el usuario el 17-nov-2026 (autoría no confirmada). Reproducción y corrección hechas **de forma independiente** sobre main actual (3084ee8): el parche aislado mencionado no está en GitHub ni adjunto, y no se asumió acceso a él. Todo el texto usado en reproducción es sintético; el corpus permanece en CUARENTENA y no se activó nada.

## Riesgos descritos

1. **R1 — referencia inline confundida con encabezado**: una referencia a un artículo dentro del cuerpo (en especial partida por salto de línea, con mayúscula al inicio de línea) podía tomarse como encabezado nuevo y separar el texto.
2. **R2 — encabezado fuera de secuencia**: un número fuera de secuencia podía absorberse en el artículo anterior en vez de detener la extracción.

## Reproducción independiente (10 variantes sintéticas, extractArticles directo)

Confirmados en v32:

- **R1-b**: `Artículo 15. de la presente ley, …` (línea propia, mayúscula, terminador, número adelante, continuación en minúscula) abría un artículo 15 espurio y partía el cuerpo.
- **R1-e**: la misma forma con continuación en mayúscula (`Artículo 15. De conformidad …`) también abría artículo espurio.
- **R2-a**: salto estricto 3→7→8 en silencio.
- **R2-b/c/d**: encabezados sin punto, sin terminador y con ordinal escrito fuera de secuencia se absorbían en silencio en el artículo anterior.

No reproducidos (seguros ya en v32): referencia en minúscula, referencia partida entre líneas, línea sin terminador (la ruta estricta exige terminador).

## Prueba de la primera corrección y evidencia adversa congelada

La primera versión de v33 detenía la extracción ante todo salto hacia adelante y absorbía toda referencia con número adelante. Rompió 23 pruebas congeladas construidas sobre documentos REALES: fragmentos que empiezan en números arbitrarios, variantes oficiales con saltos de numeración (p. ej. 36→354), y referencias de línea completa del tipo `ARTICULO 96.` que deben permanecer como texto. Esa evidencia congelada pesa más que la descripción: los tests congelados modelan PDFs reales ya verificados.

## Corrección aplicada (EXTRACTOR_VERSION=33)

Único cambio respecto a v32: en la ruta estricta ARTICLE, un candidato con salto hacia adelante (n mayor que base actual + 1) **y continuación en minúscula** se conserva como texto del cuerpo (referencia). Todo lo demás es byte-idéntico a v32:

- saltos hacia adelante con continuación en mayúscula ABREN como antes (las variantes oficiales congeladas lo exigen);
- candidato hacia atrás → restart-stop v22;
- absorción bare/sin-terminador/ordinal intacta (doctrina v17/v19);
- rutas no-artículo v31 sin tocar.

## Resultados

- **R1-b corregido**: la referencia partida con cola en minúscula queda en el cuerpo; sin artículo espurio; sin anomalías en documento limpio.
- **R1-e = ambigüedad residual documentada**: `Artículo 15. De conformidad…` sigue abriendo. No hay señal local que la distinga de un encabezado real como el caso congelado `ARTICULO 136. Derogado`; cerrarla rompería documentos reales. Fijada como comportamiento actual pendiente de revisión con documento real autorizado.
- **R2 — "detener" NO aplicado**: la evidencia congelada es adversa. La absorción preserva el texto dentro del artículo; detener perdería la cola del documento. Comportamiento v32 caracterizado y fijado en pruebas.

## Pruebas

- `tests/extractor-out-of-sequence.test.mjs` (nuevo, 10 pruebas): fija la corrección R1-b, el residual R1-e, y la caracterización R2 (salto estricto abre, bare/loose/ordinal absorben, restart-stop intacto, sufijos Bis intactos).
- `tests/extractor-format-variants.test.mjs`: versión 32→33 (único cambio).
- Suite completa: `npm test` → 1200 pass, 0 fail, 36 skipped (skips de entorno conocidos: Tesseract spa ausente, índice congelado ausente).

## No hecho / pendiente

- R1-e queda como ambigüedad residual (arriba).
- Si se quiere endurecer R2 (detener o marcar anomalía en saltos), requiere revisión autorizada contra documentos reales de cada clase, no solo la descripción.
- El parche aislado ajeno nunca estuvo disponible; no hubo colisión.

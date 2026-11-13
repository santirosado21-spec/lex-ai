# QA — Fallback de lookup legacy acentuado (F1) y extensiones F2 — 2026-11-12 (doc 2)

Este documento CORRIGE y EXTIENDE `article-id-contract-f1-fix-y-f2-diseno-2026-11-12.md`
(commit a6d79d9). No lo reescribe: la traza histórica se conserva y la corrección es este
documento nuevo.

## 1. Corrección al claim de compatibilidad legacy (F1)

El doc anterior afirmó compatibilidad legacy verificada con el artículo 1797 (sin acento).
Esa verificación era real pero INSUFICIENTE: el COALESCE compara
`articleCanonical(input)` contra el `article` crudo almacenado, y SQLite no pliega
diacríticos. Verificación adversa con índice construido con el código anterior (payload
`26-QUÁTER` acentuado, sin `articleCanonical`):

- lookup `'26-QUATER'` → NULL (fallo)
- lookup `'26-QUÁTER'` → NULL (fallo; el input también se canonicaliza a `26-QUATER`)

Es decir: los ids legacy acentuados quedaban INENCONTRABLES bajo el fix a6d79d9. Hueco
confirmado en índice fixture legacy real (construido con el builder viejo, sin mutar
ningún índice de producto).

**Corrección aplicada** (`server/public-library.mjs`, `lookupArticle`): cuando el query
canónico devuelve null, un fallback ACOTADO a la misma ley (`INDEXED BY by_law`, solo
filas legacy `articleCanonical IS NULL`) compara `articleCanonical(payload.article)` en
JS con el mismo orden (`retrievedAt DESC, id`). Filas nuevas (con `articleCanonical`)
jamás pasan por el fallback; la cota es el número de filas legacy de UNA ley, no de la
base.

**Verificación** (fixture legacy `/tmp`, no versionado):
- `26-QUATER` → resuelve `26-QUÁTER` ✓
- `26-QUÁTER` → resuelve `26-QUÁTER` ✓
- `1797` (legacy sin acento) → sigue resolviendo por COALESCE ✓
- `26-QUATE` / `999999` → null ✓

**Regresión versionada**: nuevo test en `tests/public-library.test.mjs` construye un
índice legacy a mano (mismo formato del builder: `application_id`, `user_version`,
`metadata.corpusSha256`, manifiesto con sha256 real de los bytes) con payload acentuado
sin `articleCanonical` y verifica las cuatro resoluciones anteriores. No muta ningún
índice de producto: el fixture es propio, con su propio manifiesto.

`state-library.mjs` no necesitaba fallback: sus llaves canónicas se derivan al cargar el
corpus pineado, no de un índice preconstruido.

## 2. Extensiones F2 (propuesta, NO adoptada)

`tests/oversized-article-split-proposal.test.mjs` (9/9) añade:

- **offsets→sourcePages**: verificado que ni los extraction records ni `versions/` del
  corpus v24 conservan offsets de carácter por página (listado de claves 2026-11-12).
  La referencia acepta `pageOffsets: [{page,start,end}]` (extractor v25 futuro): con
  ellos, `sourcePages` por parte es exacto por solape de intervalos `[charStart,charEnd)`;
  sin ellos (corpus actual) hereda el intervalo del padre marcado
  `sourcePagesInherited: true`. Nunca un subconjunto plausible presentado como exacto.
  Adopción con provenance exacta requiere extractor v25 que persista offsets.
- **Abreviaturas jurídicas**: `art. 5`, `Fracc. II`, `num. 3` — el segmentador de
  oraciones corta tras el punto; la recomposición `join('')` sigue byte-exacta (sin
  pérdida). El corte tras abreviatura es subóptimo para contexto de recuperación, no un
  riesgo de integridad; lista curada de abreviaturas = refinamiento opcional en adopción.
- **Unicode byte-exacto**: recomposición con formas NFD/acentos/ñ verificada por
  `Buffer.compare` además de igualdad de string y sha256 por parte.
- **Colisiones PART-NNNN**: `existingIds` (ids reales ya presentes en la ley); si un id
  hijo colisiona con un artículo real existente, fail-closed. Jamás sobrescribe.

## 3. Suite

`npm test`: 1153 pass / 6 fail. Los 6 fallos son los PREEXISTENTES de
`nuevo-leon-extraction.test.mjs` (fallan igual en HEAD, ambiente Linux de desarrollo remoto): tests
503, 504, 505, 509, 512 y 513. Sin fallos nuevos. Suite NO verde por esos 6, se mantienen
visibles.

## 4. Estado del corpus

Sin cambios: corpus completo en CUARENTENA (textReview/legalReview pending). Nada de
esto activa, adopta ni libera cuerpo normativo. F2 sigue siendo propuesta de política
revisable; su adopción y cualquier rebuild de exports-v1/v2 requieren revisión
independiente e insumos ajenos a este carril.

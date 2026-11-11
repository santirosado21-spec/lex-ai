# Identidad de candidato local-rules-baseline-v5 (2026-11-11)

Decisión de coordinación (2026-11-11): la adaptación del runner a los estados de
segmento del contrato v2 congelado (commit b6cba91) amplió el **espacio de entrada
semántico** del candidato, aunque las proyecciones sobre el corpus v1 quedaron
byte-idénticas. "Cambio de harness solamente" no basta para conservar la identidad:
se bumpea `DETECTOR_VERSION` y `CANDIDATE_ID` a `local-rules-baseline-v5` antes de
cualquier freeze futuro.

## Qué cambia y qué no

- **Reglas de detección: sin cambio.** `server/privacy/detector.mjs` solo cambia la
  constante de versión y este comentario; ninguna regla, razón o umbral se tocó.
- **Espacio de entrada: ampliado.** `projectPrivacyCase` pasa `extractionStatus` /
  `assessment` solo con valores enum del contrato v2 congelado; cualquier otro valor
  se descarta como campo adversario. El worker los mapea a la procedencia
  (`extraction.status` / `assessment`), donde el detector ya tenía la semántica de
  mapeo a razones de bloqueo.
- **Ejercicio: solo desarrollo.** El input ampliado lo ejerce únicamente el corpus
  de desarrollo `eval/privacy-development-v4/` (16 casos DEV4) mediante pruebas
  DIAGNOSTIC-ONLY. Significado vigente de "no activado": **no integrado al producto
  ni evaluado oficialmente** — la proyección es ejecutable y está validada en dev,
  pero ningún artefacto oficial (corpus del manifest, gates, scorer) lo consume.

## Evidencia de regresión v1

- `node scripts/run-privacy-detector.mjs --split dev --out-dir artifacts/privacy/dev-rules-baseline-v5-2026-11-11`
  → statuses y detecciones de los 36 casos idénticos a
  `artifacts/privacy/dev-rules-baseline-v4-2026-11-11/predictions.json` (única
  diferencia: el campo `candidateId`); exit 3 diagnostic-only por diseño
  (blockedStatusRate 0.333 < 1).
- Suite completa tras el bump: ver reporte del commit.

## Consecuencias para freeze futuro

- `candidateSourceHashes` cambió con b6cba91 (runner, worker, eval-privacy) y con
  este bump (detector.mjs): cualquier freeze v4 existente falla cerrado contra las
  fuentes actuales. No se simplifican hashes para mantener un freeze viejo.
- El freeze futuro deberá declarar explícitamente el espacio de entrada ampliado y
  los hashes del harness vigentes.
- Los archivos del contrato v2 congelado permanecen fuera del repositorio hasta
  aprobación de coordinación.

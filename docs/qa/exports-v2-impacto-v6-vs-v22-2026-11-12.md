# QA: exports-v2 — procedencia desconocida y evidencia experimental de riesgo (2026-11-12)

## Qué se sabe y qué no

El 2026-11-12 el usuario aportó un reporte externo (generado en su Mac) que localiza `artifacts/legal-library/exports-v2/`: manifiesto fechado 2026-10-30T13:29:43Z, 35,452 artículos de 303 instrumentos, particiones train/validation/test, auditorías y hashes; sin EXTRACTOR_VERSION ni manifiesto de corrida. Ese directorio está bajo la regla gitignore de `artifacts/`, lo que explica su ausencia del repo.

**La procedencia del export NO está resuelta.** Que `EXTRACTOR_VERSION=6` fuera la versión vigente en este repositorio el 2026-10-30 (commits 4e8c00a y c8b29f8) NO prueba qué versión, commit o copia de trabajo se ejecutó en la máquina que produjo el export, ni con qué snapshots. El reporte externo tampoco encontró evidencia de versión en los artefactos del export. Mientras no se contrasten los derivados reales del export, no se afirma qué contiene ni qué lo generó.

## Evidencia experimental (no es medida del contenido del export)

Como acotación de riesgo se corrió una comparación experimental AISLADA: el código v6 (commit 4e8c00a) en modo offline sobre los 38 snapshots federales actuales (adquiridos 11-nov), contra las extracciones v22, por articleId/textSha256. Esta corrida solo produjo salidas experimentales en archivos temporales/nuevos; no alteró corpus, extracciones en cuarentena ni ningún artefacto del export.

Resultados de esa comparación experimental (defectos que v6 exhibe sobre los snapshots actuales, NO contenido demostrado del export del 30-oct):

- 687 articleIds que v6 no extrae y v22 sí; 3,388 registros con texto distinto; 1,806 registros que v6 cuarentena; 0 ids solo en v6.
- En esa corrida experimental, CPEUM art. 134 sale truncado (3,156 caracteres, termina a media oración) y marcado `structurally-verified`. Esto demuestra que la marca de v6 era ciega a esta clase de truncamiento. NO demuestra que ese registro esté en el export del 30-oct ni en qué estado: eso solo puede confirmarse leyendo los artefactos reales del export.

Detalle por documento: `artifacts/qa-v6-vs-v22-exports-impact.json` (local, gitignored, salida experimental).

## Limitaciones

- Los snapshots de la comparación son adquisiciones del 11-nov; los del run original del export pueden ser otros.
- El solape experimental es 38 de 303 instrumentos; nada se infiere sobre los otros 265.
- No se ha leído ningún artefacto real del export (manifiestos, auditorías, jsonl); toda afirmación sobre su contenido queda pendiente de ese contraste.

## Qué falta para el contraste real

Solo derivados pequeños ya existentes en la Mac (sin jsonl ni corpus): `manifest.json`, `sha256.json`, `independent-extraction-audit.json` y `excluded.json` si existe. Hasta revisar su contenido no se sabe qué campos traen ni si permiten mapear particiones; no se asume su estructura. Mientras tanto, exports-v2 se trata como de procedencia desconocida y no se usa para entrenamiento ni evaluación. No se regeneró nada.

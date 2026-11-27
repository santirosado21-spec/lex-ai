# Revisión independiente: candidato aislado de preservación post-cuerpo (Reglamento)

- Fecha: 2026-11-24 (America/Mexico_City). Revisor: Kimi (sesión Orca f14e396b).
- Objeto: `docs/qa/reglamento-importer-preservation-candidate-2026-11-24.md` y `artifacts/library-expansion-20261124/experiment/` (`post-body-source-segments.mjs`, `.test.mjs`, `run-post-body-repro.mjs`).
- Alcance: ejecutar las 3 pruebas y la reproducción indicadas; comprobar preservación exacta, etiquetas candidatas y no-adopción. No se desarrolló ni editó corpus/importer/app; no se repitió el diagnóstico del autor.

## 1. Ejecución

| Comando | Resultado |
|---|---|
| `node --test artifacts/library-expansion-20261124/experiment/post-body-source-segments.test.mjs` | 3/3 PASS (0 fail), Node test runner |
| `node artifacts/library-expansion-20261124/experiment/run-post-body-repro.mjs` | PASS; escribió `post-body-source-segments-candidate.json` y `post-body-preservation-before-after.json` (salidas declaradas del experimento) |

La reproducción valida antes de escribir: sha256 del PDF = `bcdfcd90…` (coincide con `acquisition-manifest.json`) y 90 páginas = `coverage.pages` del diagnóstico.

## 2. Verificación independiente (propia, no la auto-reportada por el repro)

Script ad hoc leyendo `Reg_LAdua.txt`/`.pdf` y el JSON candidato:

- **Preservación exacta:** los 10 segmentos corresponden a las páginas 81–90 y cada `rawText` es byte-idéntico a la página fuente (`split('\f')` de `Reg_LAdua.txt`); los 10 `textSha256` por segmento recomputados coinciden. 22 379 caracteres preservados, como declara el candidato.
- **Procedencia:** `source.pdfSha256` = sha256 real de `Reg_LAdua.pdf` (`bcdfcd90…`); `source.sourceTextSha256` = sha256 real de `Reg_LAdua.txt` (`16e05725…`, igual al `textSha256` del `acquisition-manifest.json`).
- **Etiquetas candidatas:** los 10 segmentos llevan `legalStatus: "unreviewed"` y `adoption: "quarantined-not-promoted"`; tipos: p81 `mixed-operative-transitory-boundary-page`, pp82–88 `annex-excerpt-candidate`, pp89–90 `reform-decree-excerpt-candidate` — hipótesis de estructura visibles, no validez jurídica. `coverage.legalStructureVerified: false`, `originalRecordsChanged: false`, las 10 páginas listadas como `unstructuredPages`.
- **Sin adopción:** `importer-default-diagnostic.json` intacto tras la corrida (sha256 `d5444829…` antes y después, verificado independientemente); `git status` sin cambios fuera de `docs/qa/` y `artifacts/`; el experimento solo importa módulos `node:*` (sin dependencia de `server/` ni del importer); la función es aditiva y no muta sus entradas.
- **Consistencia con el diagnóstico del autor:** `postBodyPagesWithoutTransitoryRecords: [82–87]` reproduce lo declarado; salida "antes" con 282 artículos y 13 transitorios; las 7 diferencias de parser (`6-A, 41, 105, 110, 117, 158, 236`) figuran en `importer-diagnostic-summary.json` y no fueron re-diagnosticadas aquí.

## 3. Observaciones y límites

- Las etiquetas de tipo dependen de encabezados visibles por página y heredan contexto cuando la página no tiene encabezado propio (p. ej. p90 hereda `reform-decree-excerpt-candidate`): heurística razonable como hipótesis, insuficiente como estructura legal — el propio sidecar lo declara (`Candidate types require independent review; not an adoption signal`).
- La página de frontera 81 se preserva íntegra incluyendo texto operativo (`bodyBoundaryWithinPageResolved: false`): correcto para preservación, pendiente para cualquier consumo estructurado.
- El registro transitorio "144" que mezcla pp88–89 con encabezado de decreto permanece sin corregir, como declara el candidato; este sidecar no lo arregla ni habilita a consumir los transitorios antiguos como estructura correcta.
- Las salidas JSON del experimento se escriben en la raíz del artefacto (diseño declarado); son archivos nuevos, no modifican evidencia previa.

## 4. Veredicto de revisión

**PASS como candidato aislado.** Las tres afirmaciones verificables del documento del autor se sostienen bajo ejecución y comprobación independientes: preservación exacta de pp81–90, etiquetas visibles de hipótesis con cuarentena explícita, y ninguna adopción ni modificación del importer/corpus/app. Esto no aprueba integración: quedan pendientes, según el propio candidato, la revisión de etiquetas, la separación cuerpo/transitorios/anexos por decreto, la resolución de las 7 diferencias de extracción y el diseño versionado de integración con pruebas de consumidores.

# QA: impacto de exports-v2 bajo las correcciones v7→v22 del extractor (2026-11-12)

## Procedencia de exports-v2 (resuelta)

El 2026-11-12 el usuario aportó un reporte externo (generado en su Mac) que localiza `artifacts/legal-library/exports-v2/`: manifiesto fechado 2026-10-30T13:29:43Z, 35,452 artículos de 303 instrumentos, particiones train/validation/test, auditorías y hashes; sin EXTRACTOR_VERSION ni manifiesto de corrida. Ese directorio está bajo la regla gitignore de `artifacts/`, lo que explica su ausencia del repo.

La historia de git resuelve la procedencia sin transferir nada: `EXTRACTOR_VERSION=6` era la versión vigente el 2026-10-30 (commits 4e8c00a y c8b29f8; la primera corrección posterior es v11 el 2026-11-11 10:25, luego v12–v17 y v22 el mismo 11-nov). Toda la línea de correcciones v7→v22 es posterior a la exportación.

## Método (local, offline, sin regenerar exports)

Se corrió el código v6 exacto (commit 4e8c00a) sobre los 38 snapshots PDF federales del corpus en cuarentena y se comparó contra las extracciones v22 por `articleId` y `textSha256` (misma capa de texto pdf-parse en ambas versiones; las diferencias aislan la lógica del extractor). Artefacto con el detalle por documento: `artifacts/qa-v6-vs-v22-exports-impact.json` (no versionado; gitignored).

## Resultados en los 38 instrumentos federales del corpus actual

- 38 de 38 instrumentos afectados.
- 687 articleIds que v6 no extraía y v22 sí (p. ej. lgsmime: 1 registro en v6 vs 118 en v22; reg-senado: 7 vs 317; liva: 2 vs 80; loefam: 220 vs 233; sufijos latinos QUINTUS→DUODECIMUS ausentes en lic/lgs/lgamvlv/cpf/lfda/lfpc/lfcdo/lopsrm).
- 3,388 registros con texto distinto entre v6 y v22.
- 1,806 registros que v6 marcó en cuarentena (no exportables) y que requieren re-evaluación.
- 0 articleIds presentes solo en v6: la corrección no pierde ningún artículo.
- Prueba directa byte-verificable: CPEUM art. 134 en v6 tiene 3,156 caracteres y termina a media oración ("…en los términos del") marcado `structurally-verified`, es decir, entró al export como limpio; en v22 tiene 4,207 caracteres con el párrafo final completo, verificado contra el PDF oficial por el revisor independiente. La marca `structurally-verified` de v6 era ciega a esta clase de truncamiento.

## Limitaciones honestas

- Los snapshots usados son las adquisiciones del 11-nov; los del run original (30-oct) pueden diferir en leyes reformadas en ese lapso.
- El título de catálogo usado para remover encabezados puede diferir levemente del run original (afecta solo las primeras líneas de algunos documentos).
- El solape cuantificado es 38 de 303 instrumentos: los otros 265 no son cuantificables sin el corpus de la Mac, y no se infiere su estado.
- Las cifras son de nivel extracción; el mapeo exacto a las particiones train/validation/test requiere los derivados del export (auditoría/manifiesto), no los jsonl.

## Conclusión

exports-v2 está materialmente afectado por los defectos corregidos en v7→v22: contiene artículos truncados marcados como verificados y omite cientos de artículos en el solape medido. No debe usarse como base de entrenamiento ni de evaluación. La regeneración desde extracciones revisadas es una decisión de gobernanza posterior; aquí no se regeneró nada ni se tocó el corpus.

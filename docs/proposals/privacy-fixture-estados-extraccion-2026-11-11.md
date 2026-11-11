# Propuesta: estados de extracción evaluables en el fixture de privacidad (NO aplicada)

Fecha: 2026-11-11. Estado: propuesta técnica para decisión de gobernanza. Nada de este
documento está aplicado al corpus, al protocolo ni al runner oficiales.

## Evidencia de política congelada (eval/privacy/protocol.json, frozenAt 2026-11-09)

- `experimentalGates.requiredBlockedStatusRate: 1` — la tasa de status blocked correcto
  debe ser 1.0 para que un candidato sea eligible-for-integration-evaluation.
- `experimentalGates.blockedEntityCasesStillCountAsMisses: true` — las entidades en
  casos bloqueados cuentan como misses si no se detectan (motivó el detector v4:
  escaneo desacoplado de la resolución de procedencia).
- `blockReasons`: scope_mismatch, unknown_provenance, unsupported_format,
  partial_extraction, ambiguous_context, detector_failure.
- `caseContract.fields`: id, split, templateGroup, synthetic, scope, segments,
  entities, expectedStatus, blockReason, preserve. **No existe campo de extracción
  ni de assessment por segmento.**
- `contaminationPolicy`: el heldout lo crea un autor separado; si se usa para ajustar,
  se retira la versión completa.

## Hallazgo (medición dev 2026-11-11, candidate local-rules-baseline-v4)

El worker del fixture (scripts/privacy-candidate-worker.mjs) registra cada segmento
con `extraction.status='complete'` y `assessment='known'` fijos. Por tanto, de las 6
razones de bloqueo, 4 son **inevaluables** en el harness actual:

| Razón esperada (dev) | Señal necesaria | Disponible en fixture v4 |
| --- | --- | --- |
| scope_mismatch | originScope ≠ scope de la solicitud | sí (evaluada, 1/1) |
| unknown_provenance | originScope null / clasificación unknown | sí (evaluada, 1/1) |
| unsupported_format | extraction.status='unsupported' | no (fijada a complete) |
| partial_extraction | extraction.status='partial' | no (fijada a complete) |
| ambiguous_context | assessment='ambiguous' | no (fijada a known) |
| detector_failure | extraction.status='failed' o assessment='failed' | no |

Resultado: blockedStatusRate dev = 0.333 (2/6) con candidato v3 y v4, sin que el
detector pueda influir. El gate `requiredBlockedStatusRate: 1` es inalcanzable con el
corpus y fixture actuales, no por calidad del candidato.

## Opciones

### A. Extender corpus + fixture oficiales (requiere decisión de gobernanza)

El corpus congelado no porta estados de extracción; extenderlo cambia
corpusSha256 y exige nueva versión, nuevo autor para heldout y nuevo freeze.

Diff propuesto (**NO aplicado**):

```diff
--- a/eval/privacy/protocol.json
+++ b/eval/privacy/protocol.json
@@ caseContract
-    "segment": "{id,path,text,originScope,classification}; ...",
+    "segment": "{id,path,text,originScope,classification,extractionStatus?,assessment?}; extractionStatus in complete|partial|unsupported|failed (default complete); assessment in known|ambiguous|failed (default known)",
```

```diff
--- a/scripts/privacy-candidate-worker.mjs
+++ b/scripts/privacy-candidate-worker.mjs
@@ detectFixtureInput
-      extraction:{status:'complete',extractorVersion:'plain-fixture-v1',originalSha256:privacyTextHash(segment.text)},
-      segments:[{id:segment.id,path:segment.path,text:segment.text}],assessment:'known'}).segments[0];
+      extraction:{status:segment.extractionStatus ?? 'complete',extractorVersion:'plain-fixture-v1',originalSha256:privacyTextHash(segment.text)},
+      segments:[{id:segment.id,path:segment.path,text:segment.text}],assessment:segment.assessment ?? 'known'}).segments[0];
```

Y en scripts/run-privacy-detector.mjs, `projectPrivacyCase` pasaría los dos campos
opcionales (la whitelist actual los descarta). Casos dev existentes sin los campos
conservan el comportamiento actual por los defaults.

Costo: nueva versión de corpus (dev y heldout), nuevo freeze, re-anotación de los 4
casos DEV_027..DEV_030 con los estados que su blockReason ya declara.

### B. Harness diagnóstico independiente (sin tocar lo congelado)

Un runner separado (p. ej. `scripts/run-privacy-provenance-diagnostic.mjs`) con sus
propios casos sintéticos en `tests/fixtures/provenance-states/`, nombrado
**diagnóstico**, que ejercite las 6 razones contra server/privacy/detector.mjs +
provenance.mjs reales. No produce score.json bajo el protocolo, no alimenta gates
oficiales y su salida dice "diagnostic-only". Aporta evidencia de que el detector
bloquea correctamente cuando el registro sí reporta estados no-Complete.

Costo: ninguno sobre corpus/protocolo; es código de prueba adicional.

## Recomendación

B ahora (evidencia sin tocar lo congelado); A cuando se decida la próxima versión del
corpus. La corrida heldout sigue requiriendo freeze revisado con
approvedForSingleHeldoutRun=true y no se contempla aquí.

## Fuera de alcance

Heldout, freeze, remoto, categoría pseudonymized en H2, y cualquier cambio a gates o
umbrales. routingSafety y preservation siguen "not-evaluated" por diseño del scorer.

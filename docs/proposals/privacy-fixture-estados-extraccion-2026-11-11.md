# Propuesta: estados de extracción evaluables en privacidad (NO aplicada, v2 corregida)

Fecha: 2026-11-11. Estado: propuesta técnica revisable. Nada de este documento está
aplicado al corpus, al protocolo, al runner ni a freeze alguno.

> Corrección 2026-11-11 (misma fecha): la versión primera de esta propuesta incluía
> re-anotar DEV_027..DEV_030 desde su blockReason. Eso viola la restricción congelada
> (`operationalFlagsFromGold: false`, "Never inject annotation blockReason into
> detector input", docs/qa/privacy-detector-freeze-2026-11-09.json; eval/privacy/
> README.md: "no inventarlos desde gold para lograr bloqueos"). Retirada.

## Evidencia de política congelada

- eval/privacy/protocol.json: `requiredBlockedStatusRate: 1`,
  `blockedEntityCasesStillCountAsMisses: true`, 6 blockReasons, caseContract sin
  campos de extracción/assessment.
- eval/privacy/README.md: "El corpus v1 no tiene flags operativos de
  formato/extracción/ambigüedad/fallo: no inventarlos desde gold para lograr
  bloqueos. Pruebas de integración sí ejercitan señales locales independientes.
  El próximo protocolo debe solucionar esa limitación con nuevas entradas y examen
  independiente." Y: "Heldout exige un freeze de fuentes/protocolo/corpus aprobado;
  el freeze publicado autorizó una corrida ya ejecutada, no repeticiones para
  afinar."
- docs/qa/privacy-detector-freeze-2026-11-09.json: freeze del baseline v1 aprobado
  por revisor independiente (`independentReviewer: review_detector_vault`),
  `candidateBuilderSawHeldout: false`, `operationalFlagsFromGold: false`,
  `goldInputsAllowed: false`.
- eval/privacy/heldout-provenance.json: examen de autor independiente que nunca leyó
  dev, plantillas dev, salidas de candidato ni implementación del evaluador.

## Hallazgo (medición dev 2026-11-11, candidate local-rules-baseline-v4)

El worker del fixture fija `extraction.status='complete'` y `assessment='known'`;
4 de 6 razones de bloqueo son inevaluables en el harness oficial. Detalle de la
medición en el reporte de la corrida `artifacts/privacy/dev-rules-baseline-v4-2026-11-11`
(artefacto local, gitignored).

## Lo que YA existe como evidencia sancionada (aplicado, diagnóstico)

El README sanciona "pruebas de integración [que] ejercitan señales locales
independientes". Implementadas como harness DIAGNOSTIC-ONLY (no puntúan bajo el
protocolo, no alimentan gates, no son evidencia de elegibilidad):

- `tests/privacy-provenance-states-diagnostic.test.mjs`: las 6 razones de bloqueo
  contra detector+procedencia reales, con estados de extracción/assessment reales
  construidos por el propio fixture de prueba (no desde gold).
- `tests/privacy-preservation-diagnostic.test.mjs`: fidelidad de preservación
  (fechas/montos/citas) en protect/restore/restoreStream y tras ciclo sellado.

## Lo que queda FUERA del alcance del constructor del candidato (y por qué)

El valor del examen depende de propiedades de independencia que el constructor no
puede auto-suministrar sin falsificarlas:

1. **Autor independiente del examen**: nunca leyó dev, plantillas, salidas de
   candidato ni implementación. El constructor del detector no puede ser ese autor.
2. **Revisor independiente del freeze**: aprueba UNA corrida heldout. El constructor
   no puede aprobar su propio freeze.
3. **Entradas nuevas, no derivadas de gold**: cualquier flag operativo debe nacer de
   casos nuevos escritos bajo la guía de anotación, nunca de los blockReason
   existentes.

Por tanto, la ruta oficial correcta (cuando se decida) es un **protocolo v2** con:
caseContract ampliado (`extractionStatus?`, `assessment?` por segmento, defaults
complete/known), entradas dev NUEVAS que ejerciten esos estados, runner/fixture que
los proyecte, y un examen heldout NUEVO de autor independiente comisionado por el
coordinador, con freeze revisado por revisor independiente. Borrador de contrato
(disponible para revisión, no aplicado):

```diff
--- a/eval/privacy/protocol.json (v1, congelado)
+++ b/eval/privacy-v2/protocol.json (borrador, NO congelado)
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

## Qué puede hacer el constructor sin violar nada (reversible, sin freeze)

- Mantener y ampliar los harnesses diagnósticos (hecho).
- Preparar el borrador de protocolo v2 y casos dev NUEVOS con estados operativos
  (dev es afinable por el constructor; heldout nunca).
- Dejar el runner listo para proyectar los campos cuando existan (detrás del
  contrato v2; el contrato v1 congelado no se toca).

## Fuera de alcance

Heldout, freeze, examen, remoto, categoría pseudonymized, y cualquier cambio a
gates o umbrales. routingSafety y preservation siguen "not-evaluated" en el scorer
oficial; la evidencia diagnóstica no los sustituye.

# Medición dev del candidato de reglas v2 — 2026-11-11

Evaluación de desarrollo del detector local de privacidad sobre el split `dev`
(36 casos sintéticos), conforme al protocolo H4a/H4b de `eval/privacy/`.
Solo se usó el split de desarrollo; el examen retenido (heldout) sigue congelado
y no se tocó. Resultado `diagnostic-only`: ninguna métrica de desarrollo declara
promoción, elegibilidad de integración, egreso ni activación. El baseline v1
permanece inactivo con su resultado FAILED histórico intacto.

## Cambio medido

`local-rules-baseline-v1` → `local-rules-baseline-v2` (dos correcciones
quirúrgicas de reglas, sin otras modificaciones del detector):

1. **sensitive_relation — inicio de span tras andamiaje con dos puntos.** El
   capture anterior podía iniciar en el inicio del texto y arrastrar
   andamiaje de reporte (`Ensayo …: contexto sintético: `) dentro del span.
   La porción previa a la palabra clave ahora excluye `:`, por lo que el span
   comienza tras el último separador de andamiaje. La guía de anotación excluye
   ese andamiaje del gold.
2. **context — la comilla latina `«` abre cláusula.** El patrón solo aceptaba
   inicio de texto, puntuación de fin de oración o `:` como frontera; una
   cláusula contextual citada entre `« »` no podía capturarse. Se añadió
   `«\s*` como frontera válida.

## Métricas (split dev, 36 casos)

| Métrica | v1 (2026-11-09 heldout no comparable; dev mismo día) | v2 dev |
| --- | --- | --- |
| Micro exacto — precisión | 0.9231 | **1.0000** |
| Micro exacto — recobrado | 0.8000 | **0.9000** |
| Micro exacto — tp/fp/fn | 24/2/6 | **27/0/3** |
| Micro overlap — precisión | 1.0000 | 1.0000 |
| Micro overlap — recobrado | 0.8667 | 0.9000 |

Por categoría en v2 (exacto): `organization`, `rfc`, `curp`, `clabe`,
`account`, `email`, `phone`, `address`, `case_id` y `sensitive_relation` en
tp=2/fp=0/fn=0; `person` tp=6/fn=2; `context` tp=1/fn=1.

Comparación v1→v2 en dev (mismo corpus): `sensitive_relation` pasa de
0 tp / 2 fp / 2 fn a 2 tp / 0 fp / 0 fn; `context` pasa de 0 tp a 1 tp
(exacto y overlap). Fallos del gate experimental: de 6 clases
(`recall:person`, `recall:context`, `precision:context`,
`recall:sensitive_relation`, `precision:sensitive_relation`,
`blockedStatusRate`) a 3 (`recall:person`, `recall:context`,
`blockedStatusRate`).

## Falsos negativos restantes y causa raíz

1. **`person` fn=2 — artefacto de puntuación en casos bloqueados, no fuga de
   texto.** Ambos FN viven en casos con `expectedStatus: blocked`
   (scope_mismatch y unknown_provenance) que el detector bloqueó
   correctamente. La guía de anotación cuenta como fallo toda detección
   ausente aun en casos bloqueados, y la respuesta bloqueada del pipeline no
   transporta detecciones. En casos `complete`, el recobrado de `person` es
   6/6. Ninguna acción de reglas; es una propiedad del contrato de
   puntuación/bloqueo ya documentada en el protocolo.
2. **`context` fn=1 — reidentificación por rol único en grupo pequeño.** El
   caso restante (`la tesorera del club ficticio de cuatro integrantes`) no
   usa las formas «único/única» que cubre la regla actual. Generalizarlo exige
   un patrón nuevo (rol en grupo de cardinalidad pequeña explícita) con
   análisis de falsos positivos sobre texto limpio; diseñarlo contra la guía de
   anotación en un ciclo propio para no sobreajustar a los fixtures dev.
3. **`blockedStatusRate` — limitación del corpus v1, no del detector.** 4 de 6
   casos bloqueados esperados (unsupported_format, partial_extraction,
   ambiguous_context, detector_failure) no llevan banderas operativas en el
   corpus v1, así que el candidato no puede inducir el bloqueo; el README del
   protocolo ya declara que no deben inventarse desde el gold y que el próximo
   protocolo debe aportar esas entradas. Los 2 casos con señal real
   (scope_mismatch, unknown_provenance) sí bloquean (tasa 1.0).

## Reproducción

```sh
node scripts/run-privacy-detector.mjs --split dev --out-dir artifacts/privacy/dev-rules-v2-2026-11-11
```

Artefactos: `predictions.json`, `score.json`, `execution.json` en ese
directorio (salida `diagnostic-only`, exit 3 por diseño). Pruebas de
regresión añadidas en `tests/privacy-detector.test.mjs` (andamiaje con dos
puntos en sensitive_relation; `«` como frontera de context). Suite completa:
1118 pruebas, 0 fallas, 33 skips condicionales.

## Límites

- Métricas de desarrollo sobre 36 casos sintéticos con plantillas
  correlacionadas; los intervalos no acotan el riesgo real del producto.
- El candidato de reglas v2, igual que v1, es un baseline experimental:
  `routingSafety` y `preservation` quedan `not-evaluated`; no hay evaluación
  de transporte ni de fidelidad tras protección.
- La vía de modelo nativo (candidato v2 ONNX) no se midió en este entorno;
  requiere sus artefactos provisionados y su propio freeze.
- Ningún cambio aquí modifica el corpus, las puertas de egreso ni la
  elegibilidad del detector para producción.

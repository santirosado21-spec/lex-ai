# Medición dev del candidato de reglas v3 — 2026-11-11

Evaluación de desarrollo del detector local de privacidad sobre el split `dev`
(36 casos sintéticos), conforme al protocolo H4a/H4b de `eval/privacy/`.
Solo se usó el split de desarrollo; el examen retenido (heldout) sigue congelado
y no se tocó. Resultado `diagnostic-only`: ninguna métrica de desarrollo declara
promoción, elegibilidad de integración, egreso ni activación. Los baselines v1
(FAILED histórico) y v2 permanecen intactos con sus artefactos congelados.

## Cambio medido

`local-rules-baseline-v2` → `local-rules-baseline-v3` (una extensión quirúrgica
de la alternancia de `context`, sin otras modificaciones del detector):

**context — rol personal + grupo pequeño de tamaño explícito.** La alternancia
solo cubría marcadores de unicidad (`único/única` + rol). La guía de anotación
define `context` como la cláusula mínima con la combinación de hechos diseñada
para reidentificar; un rol personal dentro de un grupo de tamaño explícito
pequeño (`la tesorera del club ficticio de cuatro integrantes`) es esa
combinación. La nueva alternativa exige: artículo + rol, `de/del` + hasta 3
palabras de grupo, `de` + cantidad (dígito 1-2 o palabra dos-siete) +
`integrantes|miembros`. Controles negativos verificados: grupos genéricos sin
tamaño (`la tesorera del club presentó el informe`), colegiados sin grupo
intermedio (`el consejo de cinco miembros`) y mayorías (`la mayoría de los
integrantes`) no producen detección, conforme a la guía (los roles genéricos
solos son controles negativos).

## Métricas (split dev, 36 casos)

| Métrica | v2 dev | v3 dev |
| --- | --- | --- |
| Micro exacto — precisión | 1.0000 | **1.0000** |
| Micro exacto — recobrado | 0.9000 | **0.9333** |
| Micro exacto — tp/fp/fn | 27/0/3 | **28/0/2** |
| Micro overlap — precisión | 1.0000 | 1.0000 |
| Micro overlap — recobrado | 0.9000 | 0.9333 |

Por categoría en v3 (exacto): `organization`, `rfc`, `curp`, `clabe`,
`account`, `email`, `phone`, `address`, `case_id`, `context` y
`sensitive_relation` sin falsos negativos ni falsos positivos; `person`
tp=6/fn=2.

Puerta experimental: `diagnostic-only` en ambas corridas. Fallos v2:
`recall:person`, `recall:context`, `blockedStatusRate`. Fallos v3:
`recall:person`, `blockedStatusRate` — `recall:context` queda resuelto.

## Los 2 FN restantes son estructurales, no brechas del detector

DEV_025 y DEV_026 son casos `blocked` esperados (`scope_mismatch` y
`unknown_provenance`); el candidato bloquea con la razón correcta y el contrato
de puntuación cuenta las entidades visibles del texto bloqueado como FN aunque
el detector nunca las escanea. "Mejorarlas" exigiría no bloquear, lo que
debilitaría la compuerta fail-closed: fuera de alcance por diseño. El techo del
split dev para este contrato es 28/30 = 0.9333 exacto, alcanzado por v3.

## Reproducción

```
node scripts/run-privacy-detector.mjs --split dev \
  --out-dir artifacts/privacy/dev-rules-v3-2026-11-11
```

Código de salida 3 (diagnóstico) esperado por diseño. Artefactos nuevos en
directorio nuevo; ninguna corrida anterior se sobrescribe. Pruebas de regresión
nuevas en `tests/privacy-detector.test.mjs` (positivo + tres controles
negativos). Suite completa: 1085 pasan, 0 fallan, 33 omitidas.

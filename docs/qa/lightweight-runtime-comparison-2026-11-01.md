# Comparación local para el objetivo de 8 GB

Datos sintéticos y fuentes públicas; ejecución del 2 de noviembre de 2026 UTC (1 de noviembre en Ciudad de México). Mac de 24 GB. No es una prueba física en 8 GB ni una evaluación profesional de derecho mexicano.

## Comparación controlada

Se comprobaron por hash los mismos 30 prompts y las mismas opciones de generación en los tres candidatos. La suite contiene 10 casos de desarrollo reutilizados y 20 casos nuevos definidos antes de ejecutarlos; no son 30 casos independientes de desarrollo. Cinco habilidades, tres pasajes oficiales (CCF 1796/1797 y CPEUM 14), documentos sintéticos e instrucciones maliciosas insertadas en documentos. Cada par conserva recuperación, seguridad y esquema; la ablación elimina exclusivamente `skill.instructions`.

| Candidato técnico | Descarga decimal | Pico RSS del motor | Sin instrucciones de habilidad | Con instrucciones | Latencia media con habilidad |
|---|---:|---:|---:|---:|---:|
| Gemma 3 1B Q4_K_M | 806 MB | 1.15 GB | 20/30 | 15/30 | 2.05 s |
| Qwen3 1.7B | 1.36 GB | 2.06 GB | 23/30 | 22/30 | 3.57 s |
| Qwen3.5 2B Q4_K_M | 1.95 GB | 2.34 GB | 30/30 | 28/30 | 3.50 s |

El RSS corresponde al árbol de procesos privado y se muestreó durante la ejecución; no incluye otras aplicaciones, no garantiza capturar todos los picos y no equivale a toda la memoria unificada/Metal. Los pesos se liberaron después de cada consulta. El límite del supervisor fue 3 GiB.

Los conteos son **aceptación técnica**, no respuestas jurídicamente correctas: JSON, citas exactas de la fuente indicada, referencias enlazadas, números respaldados y límites de salida. Una cita auténtica no demuestra que la conclusión sea válida. El flujo real adicional de pregunta sin documento privado → recuperación local → respuesta → DOCX pasó técnicamente para los tres candidatos.

## Hallazgos y decisión

No se demostró una mejora por las instrucciones de habilidades. La ablación conserva otras instrucciones y la pregunta ya describe parcialmente la tarea; mide el incremento de ese bloque, no toda la arquitectura de habilidades. Tampoco prueba buena redacción, cronologías completas ni análisis contractual competente. En particular, varios resultados se limitan a reformular las citas.

La inspección detectó afirmaciones sin respaldo aun cuando una respuesta pasaba las comprobaciones técnicas. Por ejemplo, Qwen3.5 añadió «salvo excepciones específicas» a un pasaje constitucional que no suministra excepciones; otras respuestas discutieron validez de notificaciones sin evidencia suficiente. Dos respuestas con habilidad fueron rechazadas por el control numérico. No se elimina ese control para mejorar artificialmente la puntuación.

Se selecciona Qwen3.5 **solo para la versión local de evaluación**, porque mantiene la descarga por debajo de 2 GB y tuvo la mayor aceptación técnica entre los candidatos probados bajo el mismo contrato. El catálogo declara `experimental-quality-gaps-not-for-professional-reliance`. Esto no es una promoción a distribución profesional ni activa un adaptador entrenado. La interfaz mantiene el estado de piloto y explica sus límites. La validación física en 8 GB, la calidad jurídica y el beneficio de las habilidades siguen pendientes.

El formato anterior separaba análisis y citas y fallaba con frecuencia. Claude Code revisó ese problema; el contrato actual une fuente, cita y texto por párrafo. Una instrucción breve y un ejemplo redujeron divagaciones en la prueba inicial, a costa de limitar la salida a notas breves. La menor longitud no debe presentarse como capacidad de redactar escritos completos.

## Evidencia reproducible

- Qwen3.5: `artifacts/lightweight/skills-ab-2026-11-02T04-56-59-059Z.json`.
- Gemma 3: `artifacts/lightweight/skills-ab-2026-11-02T05-02-07-902Z.json`.
- Qwen3: `artifacts/lightweight/skills-ab-2026-11-02T05-04-21-288Z.json`.
- Cada archivo conserva prompts, esquema, parámetros, fuentes, respuestas crudas, tiempos, muestras de memoria y hashes. Los informes `runtime-verification-…` correspondientes conservan el flujo real y la exportación sintética.
- `scripts/verify-lightweight-runtime.mjs` usa el adaptador real. `LEX_EVAL_SUITE=expanded` ejecuta 30 pares; los catálogos alternativos y caches de modelos se pasan explícitamente. Nunca usar un motor de otro usuario para esta comparación.
- [Evaluador y límites](../lightweight-evaluation.md), [ADR de recursos](../architecture/adr/0002-lightweight-local-runtime.md), [entrenamiento ligero](lightweight-training-review-2026-11-01.md).

Los modelos y sus licencias se verificaron en las fuentes primarias: [Gemma](https://ai.google.dev/gemma/terms), [Qwen3](https://ollama.com/library/qwen3:1.7b) y [Qwen3.5](https://huggingface.co/Qwen/Qwen3.5-2B). La configuración exacta utilizada difiere de las recomendaciones generales del proveedor y queda registrada para no atribuir resultados a una configuración distinta.

El experimento posterior [grounded-v2](grounded-training-v2-2026-11-01.md) conserva resultados y conversión del modelo entrenado de 1.02 GB. No sustituye esta comparación controlada entre modelos base.

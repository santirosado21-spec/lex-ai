# Entrenamiento ligero grounded-v2

Ejecución local del 2 de noviembre de 2026 UTC (1 de noviembre en Ciudad de México). Objetivo de producto: 8 GB; equipo real: Mac de 24 GB. Datos públicos y sintéticos, sin documentos de clientes. Este candidato permanece separado del modelo predeterminado de la app.

## Entrenamiento realizado

Base fijada: `mlx-community/gemma-3-1b-it-4bit`, revisión `2d44e83dc9e80843d22fb941d3d699a0b1351aa6`. Se preservaron los pesos originales y el experimento anterior `adapter-v1`. Preparación con los prompts del servicio real y contrato `paragraph-citations-v1`: 255 ejemplos de entrenamiento, ocho de validación y ocho de prueba separados por instrumento. CCF y CPEUM se excluyeron del entrenamiento para conservar la regresión de aplicación.

LoRA de rango 4 y escala directa 8, sobre q_proj/v_proj de las dos últimas capas: 28,672 parámetros entrenables. Batch 1, tasa 1e-5, longitud máxima 1,536; máximo efectivo de entrenamiento 908 tokens, sin truncamiento. Se completaron tres pasos de humo y 97 adicionales desde esos pesos, con reinicio del optimizador entre ambos tramos. No equivale a una corrida ininterrumpida de 100 pasos.

| Medición | Base | Candidato |
|---|---:|---:|
| Pérdida de validación | 0.238560 | 0.057233 |
| Pérdida de prueba | 0.272464 | 0.067862 |
| Salidas aceptadas, generación MLX libre | 0/38 | 5/38 |

El tramo completo tomó 248.39 s; pico de asignación MLX 2,232,466,168 bytes y RSS de proceso 2,064,826,368 bytes. Supervisor con límite de 3 GiB y diez minutos. Estas métricas no demuestran compatibilidad física en 8 GB. La pérdida menor demuestra ajuste al conjunto; no demuestra razonamiento jurídico. Los 38 casos libres incluyen ocho retenidos por ley y 30 casos de la app. Son una evaluación distinta de la generación restringida por esquema del motor de escritorio.

El aprendizaje supervisa principalmente formato, asociación entre cita y fuente y contención de la respuesta. No proporciona una evaluación profesional de argumentación jurídica, vigencia, escritos completos o abstención fiable. Se conservaron respuestas crudas fallidas, incluidas repeticiones, campos extra y afirmaciones fuera del pasaje autorizado.

## Archivo ejecutable exportado

Se produjo `artifacts/lightweight/gemma3-grounded-v2-q4_k_m.gguf`, de **1,017,325,920 bytes**, SHA256 `2d216599c244383cbb0a94b40fa60f7a7ca9aaac1210dca2d2f417c756431ddb`.

La conversión descomprime la base por bloques en CPU, fusiona únicamente cuatro proyecciones y utiliza el conversor oficial llama.cpp fijado en `785322d17f2d51e5185cf996a1f4e46d87640841`. La corrección de normalizaciones Gemma se aplica una sola vez en el conversor oficial. Se cuantiza con Q4_K_M y se conservan las cuatro proyecciones adaptadas en F16; otras matrices usan tipos de respaldo por sus dimensiones. Por tanto, es un archivo de precisión mixta, no uniformemente de cuatro bits. Se verificaron nombres, dimensiones y hashes exactos de las cuatro proyecciones F16 contra el GGUF de referencia.

La mayor medición RSS entre exportación, conversión, cuantización e inspección fue 1,477,574,656 bytes. No se cargó otro modelo en GPU en paralelo. Las dependencias de conversión tienen entorno y lock separados del entrenamiento. El archivo mantiene las condiciones de Gemma; su procedencia técnica no se oculta aunque la interfaz se presente como LEX AI.

El cambio de cuantización impide atribuir causalmente a LoRA toda diferencia frente al GGUF oficial de Gemma. Para esa afirmación haría falta un control exportado con el mismo proceso y sin adaptador. La comparación MLX anterior sí mantuvo la misma base, pero no utilizó el esquema de producción.

## Evaluación en el motor de escritorio

Importación aislada, sin activar el candidato en el catálogo de producto. Se verificaron todas las capas y el manifiesto moderno v2 de Ollama; el runtime rechaza discrepancias de hashes y no intenta descargar este candidato local desde un registro público.

Con la plantilla original de Ollama, en 30 pares de pruebas se aceptaron técnicamente **24/30 sin instrucciones de habilidad y 24/30 con ellas**. Pico RSS del árbol privado 1,309,868,032 bytes; latencia media con instrucciones 2.41 s. El flujo real sin documento privado recuperó CCF1797, generó respuesta con cita y exportó DOCX. No hubo mejora técnica por habilidades. Algunas salidas añadieron otros párrafos constitucionales no incluidos en la cita; una cita auténtica no valida esas afirmaciones.

Se detectó además una diferencia de serialización: HF/MLX integra system y user en un turno user; la plantilla original de Ollama los separa en dos turnos user consecutivos. Se preparó una segunda importación con la plantilla generada para ese tokenizer. Se conserva la primera corrida y no se presupone que cambiar la plantilla resuelva la calidad. La igualdad exacta de tokens entre runtimes no está establecida.

La segunda corrida con plantilla alineada obtuvo **20/30 sin instrucciones y 19/30 con instrucciones**, pico RSS 1,317,257,216 bytes y latencia media con instrucciones 2.51 s. El flujo sin documento y DOCX pasó técnicamente, pero repitió el mismo párrafo. No resolvió la calidad; por ello el candidato no se promueve ni se incorpora a la descarga predeterminada. El resultado posterior se conserva en `skills-ab-2026-11-02T05-38-13-608Z.json` y su informe de runtime. La plantilla original y la alineada utilizan los mismos pesos; esta comparación solo examina esa diferencia de serialización.

**Decisión:** entrenamiento y exportación completados; candidato experimental rechazado para activación. La siguiente fase debe mejorar el conjunto supervisado y evaluar cumplimiento semántico de cada rol con casos nuevos, además de un control de conversión equivalente. No basta aumentar pasos o aprobar JSON. Qwen3.5 base sigue como piloto local de la app; tampoco tiene validación jurídica profesional ni mejora demostrada por skills.

## Evidencia y reproducción

- Preparación, hashes y separación de datos: `artifacts/lightweight/adapter-grounded-v2/preparation.json`.
- Entrenamiento y métricas: `adapter-grounded-v2/full/training-report.json`, `behavior-paired.json`, `behavior-scores.json`, `supervisor.json` bajo ese mismo directorio.
- Adaptador SHA256: `3e3d9068dfde78e07293888ef03ac7f843498add6ed18bb420b733b7140680c4`.
- Conversión: `grounded-f16-export.log`, `grounded-gguf-convert.log`, `grounded-gguf-quantize.log`, `grounded-gguf-check.log` en `artifacts/lightweight/`.
- Primera importación: `trained-gguf-import-report.json`; evaluación `skills-ab-2026-11-02T05-31-57-241Z.json` y su `runtime-verification-…`.
- Importador reproducible: `node scripts/import-lightweight-gguf.mjs --execute`; variante de plantilla `--hf-aligned`. Rechaza destinos existentes; `--verify-existing` comprueba sin reimportar.
- Evaluador: `LEX_EVAL_SUITE=expanded`, `LEX_EVAL_CATALOG`, `LEX_EVAL_MODELS_DIR` y `LEX_RUNTIME_BINARY` explícitos, seguido de `node scripts/verify-lightweight-runtime.mjs`. Ejecutar un solo proceso de inferencia o entrenamiento a la vez.

No se activa aprendizaje automático en los equipos de usuarios. La promoción requiere evaluación satisfactoria, revisión humana, historial y posibilidad de volver a la versión anterior.

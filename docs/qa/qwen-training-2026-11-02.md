# Ajuste local experimental de Qwen 2B — 2 de noviembre de 2026

> **SUPERSEDED_UNAUDITED_INPUT — INFORME HISTÓRICO, CANDIDATOS DESCARTADOS.** Root detectó que estas corridas usaron el export bruto `exports/` (905/922 muestras), en lugar del snapshot depurado `exports-v2/` exigido por el runbook (910/910). El proceso completo se detuvo con SIGTERM, liberó sus locks y no se activó ningún candidato. Los adaptadores y estados de optimizador de este informe no deben reutilizarse. Los datos, métricas y salidas anteriores se conservan con marcadores de invalidación; no son evidencia de una corrida con fuentes aprobadas. Ver `artifacts/training/qwen-source-quality-incident.json` y el informe posterior de entrenamiento depurado.

Se entrenó un piloto real y se inició una continuación completa del corpus público elegible. **El candidato no se activó en la app.** El objetivo principal de las tareas jurídicas es copiar fielmente un pasaje dado, asociarlo a una referencia y expresar incertidumbre sobre vigencia. No demuestra razonamiento jurídico, conocimiento actualizado ni validación profesional.

## Base y procedencia

- Base: `mlx-community/Qwen3.5-2B-4bit`, revisión inmutable `674aaa7240b91e8012fcad5d791b7dfe5ba90207`.
- Archivo de pesos: 1.722.271.785 bytes, SHA-256 `713fe7e5d3c3965f7106b0d0ee17615f7869c23c8d327996df8c1196fbcf07d5`.
- Descarga total con tokenizer, metadatos y licencia: **1.749.091.901 bytes**. Sin credenciales, compras, subida de archivos ni GPU remota.
- Procedencia, licencia Apache-2.0 y hashes de cada archivo: `artifacts/training/qwen-base-manifest.json`. La licencia original fijada se conserva junto a la base.
- Dependencias observadas: MLX 0.32.4, mlx-lm 0.32.2, Transformers 5.22.1 y safetensors 0.8.0. No se instalaron ni actualizaron dependencias durante esta tarea.
- Se inspeccionó la skill dsystem. La skill externa de Hugging Face Trainer se consultó como referencia, pero su flujo de trabajos en nube no aplica al encargo local. Guía técnica aplicada: [MLX LoRA 0.32.2](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/LORA.md) y [implementación Qwen 3.5](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/models/qwen3_5.py).

El modelo MLX pertenece a la misma familia de 2B que el candidato de la app, pero no son los mismos bytes de cuantización del paquete Ollama. No se presume equivalencia de comportamiento entre ambos runtimes.

## Datos completos y exclusiones explícitas

Se utilizó únicamente `artifacts/legal-library/exports/corpus.jsonl`: **36.839 registros públicos de 307 instrumentos**. Cada registro debe conservar origen oficial, integridad SHA-256 y extracción estructural comprobada. No se leen `.data`, expedientes, documentos importados ni bibliotecas privadas del usuario.

Se mantuvo la partición previa por instrumento, con todas sus versiones en una sola partición:

| Uso | Artículos enumerados | Instrumentos |
| --- | ---: | ---: |
| Entrenamiento elegible | 27.008 | 252 |
| Validación retenida | 3.017 | 26 |
| Prueba retenida | 3.785 | 27 |
| Regresiones de desarrollo reservadas: CCF/CPEUM | 3.029 | 2 |

Los artículos se dividen en pasajes completos, sin truncar secuencias. Se excluyen del entrenamiento pasajes que coinciden exactamente, después de normalizar espacios, con validación/prueba/reservados; los pasajes repetidos de entrenamiento se representan una vez. El archivo `source-coverage.jsonl` enumera todos los registros y cuantifica las exclusiones: **36.838 de 36.839 fuentes tienen algún pasaje representado**; una queda completamente cubierta por las exclusiones de duplicados. No se oculta esta diferencia.

Dataset final `artifacts/training/qwen-dataset-v3`, con manifiesto y hashes:

- 139.813 filas de entrenamiento: 139.713 pasajes públicos y 100 tareas sintéticas de conversación.
- 14.479 filas de validación; 20.923 de prueba; 7.851 reservadas de desarrollo.
- Las identidades ficticias de evaluación, Alicia/Bruno, y la identidad reservada Lucía no están en las tareas sintéticas de entrenamiento.
- La auditoría final `qwen-tokenized-v3/manifest.json` comprueba todas las filas: máximos de **502/449/363 tokens** en entrenamiento/validación/prueba; **cero filas truncadas**.

Se conservan dos auditorías fallidas anteriores. Pasajes con listas densas de fechas superaban 512 tokens aunque tuvieran pocos caracteres. La reparación final divide únicamente cuatro pasajes completos, conserva todos sus caracteres y vuelve a comprobar los solapamientos entre particiones. No se amplió el presupuesto para ocultar el fallo.

## Método y mezcla de conversación

QLoRA de rango 4, escala 8, batch 1 y tasa de aprendizaje 0,0001. Solo se ajustan `q_proj` y `v_proj` del último bloque de atención completa: **34.816 parámetros**. La base permanece congelada. El prefijo recurrente congelado usa su modo de evaluación y no se diferencia a través de él; no se modifica la librería instalada.

La pérdida se calcula únicamente sobre la respuesta del asistente, con el prefijo y el delimitador derivados del tokenizer fijado y thinking desactivado. Las tareas sintéticas son plantillas deterministas escritas en el repositorio, sin usar modelos externos para fabricar conclusiones jurídicas.

La programación completa contiene:

1. Las 100 tareas sintéticas, una vez, como calentamiento de diálogo.
2. Una pasada completa y barajada de las 139.813 filas del corpus elegible.
3. Una tarea sintética de repaso por cada 16 filas de esa pasada.

Total: **148.651 pasos programados**. El repaso y calentamiento se registran separados de la cobertura del corpus; no se cuentan como artículos nuevos.

## Resultados reales del piloto

El piloto completó 500 pasos en **85,09 segundos**: 100 de calentamiento, 377 del corpus y 23 de repaso. Representa **372 artículos públicos distintos de 144 instrumentos**, no todo el corpus. La media de ejecución por paso fue 0,16119 segundos.

- Peak MLX: **1.757.453.885 bytes**, aproximadamente 1,64 GiB. RSS de proceso medido: 916.389.888 bytes; no equivale al consumo total de memoria unificada ni del sistema.
- Adaptador: SHA-256 `87c701b67a2aea2de639645dbfebbd770d99bc5229add25c9c3a233ca527875d`.
- Los hashes de la base se comprobaron antes y después y permanecieron iguales.

| Pérdida retenida, 12 ejemplos por partición | Base | Piloto |
| --- | ---: | ---: |
| Validación | 1,35546 | 0,02035 |
| Prueba | 1,32881 | 0,01886 |

La gran caída es compatible con aprender a copiar la entrada y su formato. **No es evidencia de que aprendió a razonar jurídicamente.**

La comparación conductual conserva todos los prompts y salidas reales en `qwen-pilot-500-evaluation-v1/paired-evaluation.json`. La primera puntuación era demasiado permisiva: aceptaba respuestas de identidad en primera persona y respuestas truncadas. Se preservó ese resultado y se aplicó un segundo evaluador posthoc a ambas ramas, sin volver a generar las respuestas.

| Puntuación mecánica v2 | Base | Piloto |
| --- | ---: | ---: |
| Comprobaciones aceptadas | 35/52 | 49/52 |
| Casos que cumplen todas las comprobaciones | 1/10 | 8/10 |

Observaciones leídas directamente en las salidas:

- La base decía «soy Alicia» y «soy Bruno» ante preguntas sobre la identidad del usuario. El piloto respondió correctamente en segunda persona con nombre y profesión.
- El piloto redactó un correo con el nombre ficticio y reprodujo los tres pasajes jurídicos retenidos con referencia e incertidumbre sobre vigencia.
- **Fallo conservado:** la introducción de Bruno repite una oración y termina por límite de tokens.
- **Fallo conservado:** al pedir un plazo sin datos, el piloto produce una negativa incoherente que copia parte de la pregunta. No se considera una respuesta útil.
- La base también inventó un plazo de 15 días sin fuente. El piloto no lo repitió en este caso; esto no demuestra control de plazos en general.

La evaluación es pequeña, con tareas sintéticas y comprobaciones de superficie. No sustituye una revisión semántica independiente y jurídica. El resultado se clasifica **experimental con fallos conocidos**, sin promoción.

## Checkpoints, continuidad y estado real

Se probó continuidad exacta: entrenar tres pasos y restaurar para otros dos produjo el mismo hash final que cinco pasos sin interrupción: `fb5ec14a334ce2f175a629f263afc04ad2d081dba56187b798590036e3d1de1e`. Se restauró Adam y se comprobó que el estado aleatorio reconstruido era idéntico; este entrenamiento no usa dropout ni operaciones aleatorias tras inicializar. Un primer intento usó incorrectamente la API de estado aleatorio de MLX y falló; su informe permanece conservado.

La evidencia está en `qwen-resume-equivalence.json` y su ampliación `qwen-resume-equivalence-v2.json`: también coinciden bit a bit los diez tensores de Adam y el estado aleatorio. El contenedor safetensors de Adam difiere en el orden de sus cabeceras, pero los nombres, tipos, formas y bytes de todos los tensores son idénticos. Los checkpoints incluyen adaptador, Adam, estado aleatorio, hashes, paso global, programación y contadores de fuentes/diálogo. Se rechaza restaurar un checkpoint incompleto, de otra base o programación.

La continuación de todo el corpus se lanzó como proceso propio separado de la sesión de herramientas:

- Supervisor **PID 66602**, observado con PPID 1; hijo de entrenamiento **PID 66603**.
- Directorio: `artifacts/training/qwen-full-pass-v1`.
- Registro: `pipeline.log`; identidad/orden exacta/PIDs: `launch.json` y `pipeline-report.json`.
- Se observó avance real desde el checkpoint de 500 al paso **501**, y después se comprobó el nuevo checkpoint completo del paso **1.000**. Estas observaciones acreditan avance recuperable, no terminación.
- Límite MLX: 4 GiB; límite de ejecución del entrenamiento: 12 horas; checkpoint cada 500 pasos.
- Estimación inicial por el piloto: **6–8 horas**, sujeta a carga del equipo, compilaciones, pausas y evaluación. No es una promesa de finalización.
- Al terminar la pasada, el supervisor ejecuta automáticamente la misma evaluación emparejada y puntuación posthoc, usando copias inmutables de los scripts. No activa ni publica pesos.

El progreso real se publica cada 20 segundos, además de los pasos observados, en `~/Library/Application Support/LEX AI/public-monitor/training.json`. Se respaldó el monitor previo. El estado distingue piloto/pasada completa, indica los 148.651 pasos, conserva el resultado negativo/parcial de la última evaluación y nunca marca el candidato como listo. No se configuró una notificación externa de finalización.

No ejecutar inferencia/entrenamiento de desarrollo simultáneos: se utilizan los locks existentes `pipeline.lock` y `gpu.lock`. No se pararon procesos ajenos del usuario. El principal detuvo la inferencia propiedad de LEX AI antes de conceder la GPU.

## Reproducción y exportación pendiente

Scripts nuevos en `scripts/qwen-training/`; cada corrida preserva sus copias ejecutadas. La base tiene manifiesto por archivo; datos y tokens tienen hashes de todas las particiones. `LEX_PROJECT_ROOT` permite ejecutar las copias preservadas sin cambiar los recursos de entrada.

Para continuar desde un checkpoint completo con el mismo corpus/programación:

```bash
.venv-training/bin/python scripts/qwen-training/full_pass.py \
  --output artifacts/training/qwen-continuation-N \
  --resume-checkpoint artifacts/training/qwen-full-pass-v1/training/checkpoint-NNNNNNN \
  --checkpoint-every 500 --wall-seconds 43200 --run
```

El directorio de salida debe ser nuevo; no se sobrescriben corridas previas ni la base. Los números del ejemplo se sustituyen por un checkpoint existente comprobado. Si la corrida actual sigue viva, sus locks impiden una segunda ejecución.

Antes de incorporar un adaptador a la app se necesita finalizar la pasada y su evaluación, revisar las salidas semánticamente, fusionar/exportar desde la base exacta con un conversor que soporte Qwen 3.5 híbrido y verificar de nuevo tokenizer, plantilla, pesos cuantizados, citas, aislamiento, memoria y flujo nativo. El adaptador MLX no se importa directamente como si fuera compatible con otros pesos. Nada de esto se presume por la presencia de un archivo de adaptador. No se ha probado el candidato en una máquina física de 8 GB.

Pruebas CPU nuevas: **6/6**, sobre procedencia, cobertura, separación de leyes/pasajes, locks, repaso de diálogo, historial/estado del monitor y rechazo de los fallos observados de identidad, truncamiento y repetición. No se atribuye a esas pruebas ninguna evaluación jurídica.

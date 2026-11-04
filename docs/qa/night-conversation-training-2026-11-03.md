# Entrenamiento conversacional nocturno — 2026-11-03

El dueño autorizó dejar entrenamiento local mientras duerme y aclaró que quiere mejorar **el modelo ligero actual de LEX AI**. Codex implementa y verifica directamente, sin Claude, inferencia externa, compras ni datos privados. No se carga Gemma 26B ni se cambia el candidato de la app.

## Corrida vigente

Carpeta: `artifacts/raft/night-20261103-conversation/`. Supervisor independiente PID **69901**, límite total **ocho horas**, incluyendo preparación, espera y evaluación. El estado vivo `night-state.json` distingue entrenamiento, espera, fallos y finalización; no interpretar un PID como pasos completados.

| Parámetro | Valor |
|---|---|
| Base preservada | Qwen3.5 2B MLX cuatro bits, revisión y archivos verificados contra manifiesto |
| Corpus auditado original | 5.000 train / 200 valid; no se modificó ni reconstruyó |
| Actualizaciones de esta corrida | 512 diálogos conversacionales públicos/sintéticos del corpus |
| Validación fuera de actualizaciones | 128 conversaciones retenidas + 200 ejercicios jurídicos originales |
| Separación reproducible | Semilla fija; IDs en `effective-split.json`, SHA-256 en firma/configuración |
| Secuencias de entrenamiento | 328–416 tokens, completas, sin truncamiento; 1.024 turnos de asistente |
| Adaptador | Últimos 4 de 24 bloques, rango 8, dropout 0; 1.401.600 parámetros; base congelada |
| Learning rate / acumulación | 1e-5 / cuatro microbatches por actualización |
| Memoria | 6 GiB MLX; mínimo de inicio 8 GiB; reserva durante ejecución 2 GiB |
| Espera | Antes de lanzar y hasta cinco minutos tras preparar datos, siempre sin pesos |
| Guardado / validación | Checkpoint cada 25 actualizaciones; validación cada 100 y al finalizar fases |
| Objetivo máximo | 384 actualizaciones: tres épocas sobre las 512 conversaciones |
| Promoción | Candidato experimental inactivo, sin fusión ni sustitución del modelo de producto |

El cambio de objetivo se basó en una medición real: los 640 diálogos de tipo `chat` miden 328–420 tokens, mientras los ejercicios jurídicos llegan a 1.463 y excedieron el presupuesto durante backward. Se reservan 128 conversaciones **antes** de cualquier actualización del candidato nuevo; las otras 512 participan en el calendario. Los 200 casos jurídicos siguen fuera del entrenamiento para observar posibles regresiones. Cambiar la receta, selección o arquitectura cambia la firma: la nueva corrida parte de la base, sin reutilizar adaptadores de otros perfiles ni modificar firmas antiguas.

## Seguimiento y parada

Desde el repositorio:

```sh
.venv-training/bin/python scripts/qwen-training/raft_night.py --mode status --output "$PWD/artifacts/raft/night-20261103-conversation"
.venv-training/bin/python scripts/qwen-training/raft_night.py --mode stop --output "$PWD/artifacts/raft/night-20261103-conversation"
```

`status` lee estado y la última métrica sin cargar pesos. `stop` comprueba que el PID corresponde al supervisor y a esta carpeta antes de SIGTERM. No reutilizar PIDs históricos ni eliminar un lock cuyo dueño siga vivo.

Secuencia: piloto de un paso → reanudación comprobada hasta paso dos → continuación hasta 384 o límite temporal → diagnóstico emparejado. Cada fase conserva su informe, métricas JSONL, checkpoints y fuentes de reproducción. Los checkpoints incluyen hashes de adaptador, Adam, RNG y configuración; sólo se anuncian completos después del renombrado atómico. El estado del supervisor también se escribe de forma atómica. Un fallo detiene la cadena sin reintentos automáticos.

El proceso está separado de la sesión, con stdin cerrado y logs durables. `caffeinate -i` sigue su PID para impedir reposo por inactividad; la pantalla puede apagarse. Mantener la Mac abierta y conectada; cerrar la tapa, apagarla o terminar procesos puede interrumpirla. Puede terminar antes del máximo de ocho horas.

## Fallos y diagnósticos preservados

| Evidencia en artifacts | Resultado real |
|---|---|
| `memory-training-20261103/pipeline-state.json` | Continuación histórica fallida por asignación no admitida a `mx.random.state[i]`; dos pasos históricos conservados |
| `raft/night-20261103-light8/` | Ocho bloques, cinco GiB: backward aprobado; pico 5,23 GiB antes de actualizar, detenido |
| `raft/night-20261103-light8-memory65/` | Mínimo 8,5 GiB: midió 8,24 y se detuvo antes de cargar pesos |
| `raft/night-20261103-light4-memory6/` | Supervisor detenido normalmente durante espera; cero pesos, cero actualizaciones |
| `raft/night-20261103-current-light/` | Corpus completo, cuatro bloques/seis GiB: piloto completó **un paso** con pico 5,77 GiB; reanudó y verificó RNG/Adam, pero el siguiente backward alcanzó **6,55 GiB** y se detuvo antes de actualizar. Base intacta en ambas fases |
| `raft/night-20261103-current-light/memory-diagnosis-lengths.json` | Longitudes reales por tipo; motivó enfocar la nueva corrida en conversación sin truncar |

El piloto del corpus completo conservó un checkpoint real en `night-20261103-current-light/pilot/checkpoint-0000001`: pérdida del primer batch 3,203339; validación jurídica 2,011099 → 2,010136. Son resultados de ese piloto, **no** del candidato conversacional vigente ni evidencia de calidad general.

La corrección RNG repite la inicialización con la misma semilla y **verifica** su coincidencia exacta con las claves guardadas; no intenta asignar un estado de sólo lectura ni simula restauración. La receta no usa dropout ni muestreo durante actualizaciones. Cualquier discrepancia, cambio de datos, entorno, código o configuración rechaza la reanudación.

La medición de memoria también se corrigió con [el código oficial de Apple de vm_stat](https://github.com/apple-oss-distributions/system_cmds/blob/main/vm_stat/vm_stat.c): «Pages free» excluye las páginas especulativas de lectura anticipada, aunque éstas formen parte del free_count del kernel. `scripts/raft/runtime_memory.py` suma free + inactive + speculative exactamente una vez; excluye memoria activa/comprimida y contadores solapados. Registra el componente especulativo y la estimación anterior. No garantiza recuperación inmediata de toda memoria inactiva: se mantienen presupuesto, reserva y guardas.

Un cambio temporal al helper original fue rechazado por los hashes del corpus. Se restauró **byte por byte** contra SHA-256 y copia histórica. El módulo nuevo queda incluido en firma y fuentes de reproducción. Se preservan los dry-runs rechazados, sin modificar el manifiesto para eludir su contrato.

Se cerraron normalmente las consultas inactivas de Cursor, Kimi, DeepSeek Harness, Gemini, Antigravity y Chrome para liberar memoria, comprobando sus procesos. Se preservaron la conversación, Grok Bot y el IDE con trabajo previo. No se descartaron documentos o perfiles ni se cerraron procesos por nombre de forma indiscriminada. No se invocan otros modelos mientras MLX ocupa recursos.

## Evaluación y comprobaciones

- **26/26** pruebas RAFT: datos, procedencia, máscaras, exclusiones y contrato de regeneración.
- **4/4** pruebas reales de kernels/gradientes Metal sin base; comparan recurrencia y proyección con referencias.
- **2/2** pruebas de reanudación MLX/Adam en modelo mínimo, comparando parámetros exactos con ejecución continua.
- **3/3** pruebas del contador de memoria; **2/2** de selección reproducible, rechazo de duplicados y exclusión de conversaciones retenidas.
- **4/4** pruebas negativas CPU del diagnóstico conversacional: contexto, contaminación entre chats, truncamiento, envío ficticio y plazos inventados.
- Dry-run vigente: `raft/night-20261103-conversation-dry/training-report.json`, guarda aprobada, cero pesos cargados, 512/328 filas efectivas, cero truncamientos y 384 pasos previstos.
- Compilación Python y `git diff --check`. No se cambió código de la app ni se repitieron sus pruebas por este cambio de herramientas de entrenamiento.

El diagnóstico emparejado usa diez casos sintéticos fijados antes de entrenar en `eval/conversation-nightly-2026-11-03.json`, con temperatura cero sobre base y adaptador; preserva respuestas completas y comprobaciones mecánicas. Sus nombres retenidos se comprueban contra el train original. Resultados en `evaluation/paired-conversation.json`; no activan nada.

El arnés se verificó con inferencia local real sobre el checkpoint **histórico de dos pasos**: base y adaptador obtuvieron 47/49 comprobaciones. No demostró mejora ni es el resultado de la corrida vigente. Esos casos son diagnóstico de desarrollo observado, no una prueba final ciega. Evidencia: `raft/night-evaluation-harness-check-20261103/paired-conversation.json`.

La variante MLX de desarrollo y el GGUF de la app usan formatos/cuantizaciones diferentes: esta corrida no valida por sí sola su transferencia al runtime de producto. No se promete conversación perfecta, precisión jurídica ni funcionamiento físico en 8 GB por entrenar en esta Mac de 24 GB. Conservar métricas de conversación y jurídicas por separado, respuestas, fallos, base y posibilidad de rollback antes de considerar una promoción.

Se aplicó dsystem; no se invocaron Claude, Gemini ni Gemma. Se revisaron el catálogo de skills, las [instrucciones LoRA de MLX-LM](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md) y la [guía local de Hugging Face](https://github.com/huggingface/skills/blob/main/skills/huggingface-llm-trainer/references/local_training_macos.md). No se aplicó su flujo de Jobs en nube, ni se instalaron skills o enviaron datos.

## Corte comprobado durante la ejecución

El piloto conversacional ya guardó su primer checkpoint real: pérdida del batch **3,380715**, cuatro microbatches / 163 tokens supervisados, **5,51 s** de actualización y pico MLX **2.803.008.742 bytes (2,61 GiB)**. La validación previa, separada por grupo, midió **3,222932 en conversación** y **2,011099 en jurídico**. Esto acredita ejecución, no una mejora general; consultar el estado vivo para las fases posteriores.

La reanudación conversacional verificó firma, adaptadores, estado Adam/paso y RNG, completó el **paso dos** y guardó `resume-check/checkpoint-0000002`. Sus cuatro archivos y hashes se verificaron también por separado. Pérdida del segundo batch **3,093138**, 172 tokens supervisados, **5,39 s**, pico **2.875.100.782 bytes (2,68 GiB)**. Los dos batches son distintos: su diferencia de pérdida no acredita mejora. La fase completó también la validación y confirmó `baseFilesModified: []`.

**Entrega verificada:** supervisor en `MAIN`, hijo 71537 con pesos cargados y reanudación RNG/Adam comprobada desde el paso dos; supervisor PID 69901, padre PID 1, independiente de esta sesión. Límite total: **2026-11-04 07:18:03, America/Mexico_City**. La validación tras dos pasos midió **3,219655 conversacional** y **2,009381 jurídica**; son cambios pequeños y no acreditan calidad general. Evidencia puntual en `handoff-verified.json`; consultar el estado vivo para progreso posterior. El adaptador continúa inactivo y la evaluación emparejada está programada al finalizar.

## Aclaración del dueño sobre el producto final

Esta corrida es **la primera etapa conversacional**, no el entrenamiento jurídico conductual completo. El dueño reiteró que deben preservarse los objetivos de fuentes, documentos, jurisdicción, abstención, seguimiento y borradores dentro del asistente único. Véase el [contrato vigente](../architecture/conversational-product-contract-2026-11-03.md). `product-alignment.json` comprueba que el conjunto de actualización actual sólo contiene `chat`; los 200 casos jurídicos son validación. No se alteraron pesos, receta, datos ni firmas de la corrida activa ni se inició un segundo entrenador.

## Resultado verificado al despertar — 2026-11-04

**Terminó**, no sigue entrenando: de 2026-11-03 23:18:03 a 2026-11-04 00:06:10 (America/Mexico_City), **48,13 minutos**, dentro del máximo de ocho horas. Completó **384 actualizaciones / tres épocas**: se verificó la secuencia 1–384 y que cada una de las 512 conversaciones se usó exactamente tres veces, sin utilizar los 128 IDs retenidos. El tramo principal ejecutó 382 pasos después de los dos del piloto/reanudación. Pico MLX de entrenamiento: **2,76 GiB**. Los procesos y locks terminaron normalmente.

El checkpoint final `main/checkpoint-0000384` pasó otra comprobación de firma y hashes; la base se verificó nuevamente contra el manifiesto. No hubo cambios a pesos base ni activación. Informe de revisión: `artifacts/raft/night-20261103-conversation/morning-review-20261104.json`.

**Resultado: rechazado para promoción por regresiones observadas.** En el diagnóstico emparejado de diez casos la base obtuvo **47/49** comprobaciones mecánicas y el candidato **43/49**. El candidato repitió «seguir una lista de tareas» hasta agotar 160 tokens al pedir brevedad; también respondió de forma inadecuada al preguntar el nombre en un chat nuevo. La pérdida conversacional retenida bajó de **3,222932 a 2,131440**, pero eso no se tradujo en una mejora suficiente de las respuestas. Se conservan todos los checkpoints y salidas; no se elimina ni se publica el candidato.

Los marcadores automáticos tienen límites: el control de números penalizó una lista numerada de la base sin probar un plazo inventado; la ausencia de la palabra profesión puede ignorar una paráfrasis. Ambos brazos producen saludos débiles aunque aprueben el chequeo mecánico. Se preserva el resultado original y no se ajustan criterios retrospectivamente para mejorar la nota. La repetición y respuestas inadecuadas son visibles en las salidas, independientemente del total.

La etapa jurídica conductual completa **no se ejecutó durante la noche**. Este trabajo automático completó sólo la primera etapa acotada; no hubo desarrollo autónomo adicional después de terminar la cadena. Lo siguiente es diagnosticar la cobertura estrecha y la repetición, ampliar tareas conversacionales y recuperar los comportamientos jurídicos/documentales con una receta de memoria medida, manteniendo evaluación y aprobación antes de promoción. No se inició una nueva corrida al revisar el estado.

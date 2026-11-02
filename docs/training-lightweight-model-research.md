# Qwen3.5-2B: factibilidad de entrenamiento local acotado

Revisión del 2 de noviembre de 2026 UTC. Estado: **soporte de código confirmado; entrenamiento y ajuste en memoria sin probar**. No se descargaron pesos, no se importó MLX, no se cargó un modelo ni se usó GPU. Solo se consultaron archivos de texto, API de metadatos y los 122.729 bytes de cabecera de safetensors; no se leyeron tensores. Evidencia estructurada: `artifacts/lightweight/qwen35-training-feasibility.json`.

El plan literal de 100 pasos con secuencia máxima 512 y el prompt completo de producción está bloqueado: `skills-ab-2026-11-02T04-56-10-635Z.json` registra **731 tokens de entrada** en el primer caso baseline, antes de la respuesta. No se permite recortar instrucciones de seguridad, evidencia o targets para declarar que cabe. Una secuencia mayor exige nueva autorización y medición; tampoco queda demostrado que quepa en 3 GiB.

## Modelo y procedencia

| Dato | Observación |
|---|---|
| Repositorio convertido | `mlx-community/Qwen3.5-2B-4bit` |
| Revisión fijada | `674aaa7240b91e8012fcad5d791b7dfe5ba90207` |
| Modelo original | `Qwen/Qwen3.5-2B`, revisión observada `15852e8c16360a2fea060d615a32b45270f8a8fc` |
| Licencia | Apache-2.0; incluir el LICENSE del original, ausente en la lista de archivos del convertido |
| Pesos safetensors | 1.722.271.785 bytes; SHA256 `713fe7e5d3c3965f7106b0d0ee17615f7869c23c8d327996df8c1196fbcf07d5` |
| Repositorio completo | 1.749.081.927 bytes según API; menos de 2 GB decimales |
| Cuantización | affine, 4 bits, grupos de 64 |
| Arquitectura de texto | 24 bloques híbridos, dimensión 2048, vocabulario 248320, embeddings compartidos |

La conversión declara mlx-vlm 0.3.12. Su tarjeta identifica en el cuerpo el modelo postentrenado Qwen3.5-2B; el campo `base_model` apunta al ancestro `-Base`, igual que la tarjeta original. Es procedencia declarada, no una comparación numérica contra los pesos originales. Fijar revisión y comprobar SHA al descargar. No se requiere ejecutar código remoto. [Repositorio convertido fijado](https://huggingface.co/mlx-community/Qwen3.5-2B-4bit/tree/674aaa7240b91e8012fcad5d791b7dfe5ba90207), [original y licencia](https://huggingface.co/Qwen/Qwen3.5-2B/tree/15852e8c16360a2fea060d615a32b45270f8a8fc).

El GGUF q4_K_M de Ollama y esta conversión MLX comparten familia original, pero **no son los mismos pesos cuantizados**. La comparación base/adaptador debe comenzar con la misma base MLX; una exportación a Ollama requiere otra evaluación. No reutilizar adaptadores Gemma3 o Gemma4 ni asumir que la importación del adaptador funciona.

## Soporte instalado y selección de adaptadores

Lectura local de `.venv-training`: mlx-lm **0.32.2**, MLX **0.32.4**, transformers **5.22.1**. `models/qwen3_5.py` implementa el modelo; `Model.sanitize` descarta `vision_tower` y normaliza prefijos. La cabecera enumera 1.059.315.904 bytes de tensores `language_model` y 662.833.152 de visión. Esto permite anticipar una base de texto menor, pero no demuestra el pico de carga: el loader abre el safetensors antes de sanitizar y sus copias/cachés deben medirse.

`tuner/utils.py` convierte `QuantizedLinear` a LoRA y requiere `scale`, no `alpha`. Sus `keys` coinciden exactamente con nombres relativos dentro de los bloques. Los dos últimos bloques son **22: linear_attention** y **23: full_attention**. Copiar solamente `self_attn.q_proj`/`v_proj` de Gemma adaptaría el bloque 23; no sería un entrenamiento de dos bloques.

Propuesta explícita, pendiente de aprobación: últimos dos bloques, rank 4, claves `linear_attn.in_proj_qkv`, `self_attn.q_proj`, `self_attn.v_proj`. La cabecera y configuración implican dimensiones 2048→6144, 2048→4096 y 2048→512 respectivamente: **67.584 parámetros LoRA**. Exigir exactamente esos tres módulos y seis matrices A/B entrenables; abortar ante discrepancia. Congelar toda la base y guardar adaptador separado. `in_proj_qkv` afecta conjuntamente Q/K/V, por lo que no debe describirse como adaptación exclusiva de Q/V.

El código selecciona `use_kernel=not self.training`: entrenamiento de la atención recurrente usa operaciones diferenciables y un bucle por token. Es evidencia de una ruta de entrenamiento implementada, no una prueba de backward exitoso en este hardware. [Modelo v0.32.2](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/models/qwen3_5.py), [recurrencia](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/models/gated_delta.py), [conversión LoRA](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/tuner/utils.py).

## Memoria y prueba mínima propuesta

No inferir memoria de entrenamiento a partir de la descarga ni del RSS de Ollama. Solo los logits `[1,512,248320]` ocupan aproximadamente **242,5 MiB en BF16** o **485 MiB en FP32**; a 1536 tokens el tensor FP32 ronda 1,42 GiB. El cálculo de pérdida puede añadir buffers. El estado recurrente FP32 por paso tiene 16×128×128 elementos: 1 MiB. Retener una copia por cada uno de 512 pasos ya supondría 512 MiB; el grafo y checkpointing determinan el pico real, no esa cuenta aislada.

Si se autoriza después de medir la tokenización:

1. Ejecutar preflight CPU con tokenizer fijado y `enable_thinking=False`. Conservar exactamente el prefijo de inferencia; la plantilla añade un bloque de pensamiento vacío al prefijo de generación. Comprobar alineación de máscara y terminación `<|im_end|>` desde tokenizer/config, sin copiar los tokens Gemma. Rechazar filas largas, nunca truncarlas. Si se rechaza la totalidad o se sesga la cobertura, detenerse.
2. Reservar `pipeline.lock` y `gpu.lock` durante todo el trabajo; confirmar runtimes descargados. Establecer máximo **3 GiB MLX**, caché 64 MiB, límite de wired memory coherente y watchdog externo **3 GiB RSS** del proceso/descendientes. Impedir que `train()` eleve el límite mediante `maybe_set_recommended_wired_limit`. RSS y Metal no son límites intercambiables ni prueba de un equipo de 8 GB.
3. Primero un backward y luego **3 pasos**, batch 1, rank 4, dos bloques explícitos, dropout 0, scale 8, learning rate inicial 1e-5, gradient checkpointing y máximo 10 minutos. Registrar pérdidas finitas, gradientes/deltas no nulos y memoria; abortar ante límite o falta de progreso. El checkpointing del trainer afecta todas las instancias del tipo de bloque: verificar su efecto, no asumir ahorro.
4. Solo con smoke satisfactorio, continuar hasta **100 pasos totales**, conservar checkpoint y hash de configuración/datos/base. Si pérdida sobre vocabulario completo rebasa el límite, diseñar pérdida por bloques y probar equivalencia de valor/gradiente antes de otra ejecución; no incorporarla sin revisión.
5. Liberar modelo antes de ejecutar base/adaptador secuencialmente sobre el mismo holdout y parámetros. No abrir producción ni promover automáticamente. Una reducción de loss no sustituye citas exactas, fidelidad del texto, aislamiento y revisión semántica.

Fuentes de comportamiento del trainer: [trainer v0.32.2](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/tuner/trainer.py) y código local cuyos SHA quedan en el artefacto. No existe todavía un comando aprobado ni scripts nuevos para este entrenamiento.

## Dataset nuevo: paragraph-citations-v1

No convertir mecánicamente respuestas anteriores `analysis/citations`: contienen un contrato incompatible y no son verdad jurídica. Construir un conjunto nuevo desde **fuentes públicas con URL, fecha, hash y ley**, más documentos sintéticos identificados. Capturar el prompt y evidencia mediante el servicio actual, con la habilidad y reglas de seguridad de producción; mantener constantes esquema y generación en comparaciones.

- Targets JSON con únicamente `paragraphs`; cada párrafo contiene `sourceId`, `quote`, `text` y opcional `kind`. Elegir `quote` del `allowedQuotes` de esa misma fuente, exactamente; usar dos fuentes distintas cuando la evidencia lo requiera.
- Texto de 40–350 caracteres. Empezar por extractos fieles o resúmenes conservadores revisados; no deducir invalidez, vigencia, efectos, plazos o requisitos del silencio del documento. Números/fechas/artículos deben estar en la cita de ese párrafo. No entrenar a copiar instrucciones inyectadas. No usar una frase genérica de revisión como sustituto de cumplimiento de la habilidad.
- Validar cada target con `validateGroundedOutput` real y un control independiente de atribución/semántica. Registrar hashes de prompt, esquema, fuente, target, generador y validador. No insertar contenido privado.
- Congelar particiones **por ley completa**, no por artículo. Conservar la asignación histórica cuando sea compatible; reservar CCF y CPEUM fuera del entrenamiento para proteger los casos de aplicación. Separar también familias de documentos sintéticos. El holdout legal no incluye ninguna ley de train/valid.
- Excluir del entrenamiento las preguntas, documentos y targets de los 30 casos A/B. Estos siguen siendo 10 casos de desarrollo reutilizados + 20 prerregistrados, no 30 holdout independientes; preparar además el holdout nuevo por leyes distintas, antes de inferir.
- Propuesta de tamaño pequeño: hasta 256 ejemplos train equilibrados entre cinco habilidades y escenarios normal/inyección; valid y test independientes con cobertura de todas las habilidades. Publicar tamaños efectivos y exclusiones por longitud; no rellenar a costa de duplicados ni de fuga de fuentes.

## Decisión pendiente

Qwen3.5-2B es **candidato técnicamente investigable**, no un entrenamiento listo con seq512. El padre está comparando también modelos más pequeños bajo el mismo contrato y prompt final antes de elegir base. Mantener este informe como evidencia de factibilidad; no descargar ni iniciar GPU por sus recomendaciones.

Se releyeron `AGENTS.md`, dsystem y la [skill oficial HF consultada previamente](https://github.com/huggingface/skills/blob/25910b3d0ba31a2ba102f901cdc9e008c278a69c/skills/huggingface-llm-trainer/SKILL.md). Su flujo principal de Jobs/Hub no aplica a la restricción local: no se creó trabajo cloud, telemetría externa ni subida. No se solicitó otra opinión de modelos ni se usó Gemma local, porque la GPU está reservada al coordinador y esta revisión exige inspección técnica directa.

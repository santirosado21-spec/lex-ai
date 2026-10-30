# Entrenamiento local de Gemma 4 para LEX AI

Investigación de código y documentación realizada el 30/10/2026. Este documento no acredita un entrenamiento: este agente no instaló paquetes, descargó pesos ni cargó modelos en GPU. Codex principal ejecuta las pruebas y registra sus resultados por separado.

## Conclusión operativa

Intentar primero **QLoRA sobre Gemma 4 26B-A4B instruct**, en MLX, con cuatro bloques finales, atención solamente, rango 4, batch 1 y contexto corto. Los pesos de un checkpoint compatible ocupan aproximadamente 14.29 GiB antes de activaciones. En el Mac de 24 GB es una hipótesis de viabilidad estrecha que debe confirmarse con carga, un forward/backward y pico real. No equivale a prometer entrenamiento completo de 26B ni calidad jurídica. No sustituir silenciosamente por un modelo pequeño.

El candidato exacto comprobado en [Hugging Face](https://huggingface.co/mlx-community/gemma-4-26b-a4b-it-4bit) es:

| Campo | Valor observado |
|---|---|
| Repo | `mlx-community/gemma-4-26b-a4b-it-4bit` |
| Revisión | `0d77464eeb233a2da68ebf9d7dc4edaac7db956d` |
| Base declarada | `google/gemma-4-26B-A4B-it`, revisión `20da991ab4afab98e8f910c4a2e8f4fbefc404ad` |
| Pesos | 3 shards, 15,341,205,776 bytes en total |
| Cuantización | affine de 4 bits, grupos de 64; routers de 8 bits |
| Arquitectura | `Gemma4ForConditionalGeneration`, `model_type=gemma4` |
| Texto | 30 bloques, dimensión oculta 2816, 128 expertos, top 8, vocabulario 262144 |
| Licencia declarada | Apache-2.0, enlace a [licencia oficial Google](https://ai.google.dev/gemma/apache_2) |

La model card demuestra conversión MLX e incluye uso `mlx-vlm`; la compatibilidad textual se apoya además en el wrapper Gemma4 de MLX-LM, que descarta componentes visuales y expone `language_model`. La carga estricta sigue siendo una comprobación obligatoria local.

## Skills y versiones consultadas

Se leyeron AGENTS.md, dsystem y el alcance de la [skill HF LLM Trainer](https://github.com/huggingface/skills/blob/25910b3d0ba31a2ba102f901cdc9e008c278a69c/skills/huggingface-llm-trainer/SKILL.md), además de su [referencia macOS](https://github.com/huggingface/skills/blob/25910b3d0ba31a2ba102f901cdc9e008c278a69c/skills/huggingface-llm-trainer/references/local_training_macos.md). Su flujo principal exige HF Jobs/Hub y no corresponde a la instrucción local del dueño. Sus tablas PyTorch/MPS no son estimaciones MLX de 4 bits. Se aplica validación previa de datos y checkpoints, sin enviar datos ni activar infraestructura pagada.

Fuentes técnicas inspeccionadas:

- MLX-LM release observado: `0.32.2`, commit de release `93e6d4a`; main consultado `736ab0d8c1d0edc79c3d798044fe6904e2fa23be`.
- Código local recién instalado por el principal: `.venv-training/lib/python3.12/site-packages/mlx_lm`, versión comunicada 0.32.2, MLX 0.32.4. Se inspeccionaron `tuner/lora.py` y `fuse.py` sin ejecutar GPU.
- Ollama main consultado: `4d22e65d493f281adce5e4de7f2cd1efa847cd13`.
- Google: [Gemma4 model card](https://ai.google.dev/gemma/docs/core/model_card_4) y [overview](https://ai.google.dev/gemma/docs/core).

## Reutilización del modelo Ollama existente

Inspección de solo lectura de `~/.ollama/models/manifests/registry.ollama.ai/library/gemma4/26b-a4b`: runner `mlx`, formato `safetensors`, 1177 capas, 16,147,120,471 bytes sumados, configuración que requiere Ollama 0.34.1. Cada tensor ocupa un blob; también hay JSON/tokenizer, draft y visión. Los encabezados muestran mezclas **NVFP4/MXFP8**, companions `.weight.scale`, `.global_scale` e `.input_scale`, no el formato affine del candidato.

No es seguro enlazar esos blobs como shards MLX-LM y afirmar equivalencia. El loader MLX requiere companions/config y nombres distintos; además, el checkpoint local tiene gate/up fusionados. Su top-level `quantization` observado contiene bits 8 / mode `mxfp8` sin group_size, y `quantization_config` ModelOpt declara precisión mixta. La ruta MLX-LM ModelOpt examinada admite NVFP4 concreto, no esa mezcla automáticamente. Una conversión sería un trabajo independiente con equivalencia de logits; descargar el candidato MLX ya convertido es el camino más directo. No modificar ni borrar el modelo Ollama que usa la app.

Referencia: [MLX loader](https://github.com/ml-explore/mlx-lm/blob/736ab0d8c1d0edc79c3d798044fe6904e2fa23be/mlx_lm/utils.py).

## Entrenamiento mínimo y memoria

[MLX-LM LoRA](https://github.com/ml-explore/mlx-lm/blob/736ab0d8c1d0edc79c3d798044fe6904e2fa23be/mlx_lm/LORA.md) admite checkpoint cuantizado para QLoRA. Su [conversor de capas](https://github.com/ml-explore/mlx-lm/blob/736ab0d8c1d0edc79c3d798044fe6904e2fa23be/mlx_lm/tuner/utils.py) soporta lineales cuantizados y SwitchLinear MoE. La configuración predeterminada puede adaptar todos los lineales, incluidos expertos; **fijar keys explícitas**.

Configuración inicial orientativa, no resultado probado:

```yaml
model: artifacts/training/base-gemma4-26b
train: true
fine_tune_type: lora
num_layers: 4
batch_size: 1
iters: 2
max_seq_length: 256
grad_checkpoint: true
learning_rate: 0.00001
mask_prompt: true
seed: 42
steps_per_report: 1
steps_per_eval: 2
val_batches: 1
save_every: 1
report_to: null
lora_parameters:
  rank: 4
  scale: 8.0
  dropout: 0.0
  keys: [self_attn.q_proj, self_attn.v_proj]
```

En los bloques 26–29 hay siete módulos q/v, no ocho: el bloque global 29 comparte K/V y no tiene `v_proj`. La arquitectura [Gemma4 textual](https://github.com/ml-explore/mlx-lm/blob/736ab0d8c1d0edc79c3d798044fe6904e2fa23be/mlx_lm/models/gemma4_text.py) lo declara expresamente. El rango 4 sobre esos siete módulos suma aproximadamente 185,344 parámetros entrenables; esto debe contrastarse con el conteo real impreso por el trainer.

Los adaptadores y momentos Adam son pequeños; el riesgo dominante son pesos, activaciones, logits, caché del allocator y otros procesos. Solo logits de 256 × 262144 representan 128 MiB BF16 o 256 MiB FP32; a 512 tokens se duplican. Las estimaciones no incluyen temporales de backward. Comprobar el límite recomendado de Metal, memoria/swap del sistema y `mx.get_peak_memory()`; no elevar límites globales ni desactivar protecciones para forzar la carga. Detener inferencia Ollama propia y tareas concurrentes de GPU antes del ensayo. Si 256 pasa, medir 512 antes de lanzar una corrida larga.

Secuencia comprobable: carga estricta → forward corto → 2 actualizaciones → guardar adapter → recargar en proceso nuevo → verificar tensores cambiados y pérdida finita → evaluar held-out → extender pasos con checkpoints. Pérdida descendente demuestra optimización, no mejora legal. Máximo tres fallos antes de diagnóstico, según AGENTS.

## Distribución: ruta Ollama y exportación

Un adapter MLX puede cargarse con base+adapter en MLX; esa es la referencia de evaluación. Mantenerla incluso si se exporta otro formato.

`mlx_lm.fuse` **sin** `--dequantize` fusiona y recuantiza los lineales adaptados; el resto permanece cuantizado. El [LoRALinear local/oficial](https://github.com/ml-explore/mlx-lm/blob/736ab0d8c1d0edc79c3d798044fe6904e2fa23be/mlx_lm/tuner/lora.py) calcula delta, suma y reconstruye `QuantizedLinear` con group/bits/mode originales. Medir memoria de fusión y evaluar otra vez: la recuantización puede degradar la mejora.

**No usar `mlx_lm.fuse --export-gguf` para Gemma4:** [fuse.py](https://github.com/ml-explore/mlx-lm/blob/736ab0d8c1d0edc79c3d798044fe6904e2fa23be/mlx_lm/fuse.py) limita esa ruta a llama/mixtral/mistral. Tampoco asumir ADAPTER en Ollama: [create_safetensors.go](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/cmd/create_safetensors.go) devuelve `errAdaptersUnsupported` para esa instrucción.

Ollama documenta [importación Safetensors con FROM directorio](https://docs.ollama.com/import), y su [prequant.go](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/create/prequant.go) reconoce pesos MLX con companions `.scales` / `.biases`. La integración recomendada a probar para conservar el runtime de la app es:

1. Fusionar el adapter en una copia nueva y cuantizada. No sobrescribir la base ni el catálogo productivo.
2. Exportar el layout de expertos compatible. MLX guarda `.experts.switch_glu.gate_proj` y `.up_proj` separados; concatenar por eje 1 (dimensión salida) los pares de `weight`, `scales` y `biases`, generando `.experts.gate_up_proj.*`. Renombrar `.experts.switch_glu.down_proj.*` a `.experts.down_proj.*`. Verificar shapes, orden gate→up y mismos parámetros de cuantización; no reinterpretar bytes como floats.
3. Conservar el prefijo `language_model.model.`: el [loader Gemma4 de Ollama](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/mlxrunner/model/gemma4/gemma4.go) ya lo admite. No hace falta renombrar todo a `model.language_model`.
4. MLX-LM descarta visión durante el entrenamiento textual. La copia exportada debe declarar `vision_config:null` / `audio_config:null` si no contiene esos pesos; de lo contrario Ollama intentará cargarlos. No presentar este candidato como multimodal.
5. Mantener tokenizer, template, EOS y modo thinking/no-thinking consistentes. Importar con un nombre candidato separado mediante el **binario que incluye LEX**, no solo el Ollama global. Comprobar import→cold start→generación→citas/DOCX→stop.
6. Comparar base MLX, adapter MLX y modelo fusionado/importado sobre el mismo holdout. Publicar solo si la ruta final supera los gates. Registrar hashes, revisión base, revisión de datos, configuración, versión runtime, licencias y reporte.

Esta transformación es una inferencia concreta del código inspeccionado, **todavía no una prueba de compatibilidad ejecutada**. La alternativa si no pasa es empaquetar runtime MLX con base+adapter, explicitando su coste y requisitos, o mantener el candidato fuera del canal estable.

## Datos y gates de calidad

Separar corpus consultable, entrenamiento y evaluación. La extracción de una ley no comprueba vigencia ni produce por sí sola ejemplos de asesoría. Priorizar tareas verificables con fuente incluida: copiar/citar fragmentos, estructurar extracción, identificar falta de evidencia y abstenerse. Reservar leyes/temas y versiones completas para holdout, deduplicar y evitar solapamientos entre train/valid/test. No usar preguntas derivadas del mismo artículo en ambos lados.

El criterio para el modelo descargable debe incluir integridad de citas, abstención, seguimiento de instrucciones, resistencia a instrucciones en documentos, JSON esperado por la app, no regresión general, latencia/memoria y evaluación jurídica humana antes de uso profesional. Si el entrenamiento cambia pesos pero falla esos gates, informar «candidato entrenado, no promovido»; nunca «modelo jurídico validado».

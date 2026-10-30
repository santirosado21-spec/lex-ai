# Entrenamiento reproducible de LEX en Apple Silicon

El dueño autorizó el ajuste local el 30 de octubre de 2026. La base se conserva y el candidato permanece separado del modelo predeterminado de la aplicación. Los ejemplos contienen legislación pública y ataques sintéticos; no documentos de clientes. El alcance entrenado es protocolo JSON, citas textuales, resistencia a instrucciones en fuentes y abstención ante falta de evidencia. No se entrena ni se acredita competencia profesional general.

## Entorno y procedencia

Mac Apple M5, 24 GB de memoria unificada. Python 3.12.13; versiones fijadas en `scripts/training-requirements.lock.txt`. MLX-LM 0.32.2, MLX 0.32.4. La base es `mlx-community/gemma-4-26b-a4b-it-4bit`, revisión `0d77464eeb233a2da68ebf9d7dc4edaac7db956d`. El descargador fija la revisión, no usa credenciales y genera SHA-256 de todos los archivos. El entrenador y evaluador comprueban esos hashes antes de cargar pesos; no ejecutan código remoto.

La licencia Apache 2.0 completa está en `resources/licenses/Gemma-Apache-2.0.txt`. La exportación conserva atribución y descripción de modificaciones.

## Datos separados

El snapshot `artifacts/legal-library/exports-v2` contiene 35.452 artículos de 303 instrumentos federales. SHA-256 de `corpus.jsonl`: `e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11`. Auditoría técnica por muestreo: 910/910 comparaciones con un extractor independiente. Esto no confirma vigencia, aplicabilidad ni exactitud jurídica exhaustiva.

La versión v1 se conserva como ensayo. La revisión ampliada identificó 124 ejemplos asociados con 31 artículos excluidos posteriormente. No todos contenían el artefacto en el fragmento elegido: ninguno de los 84 ejemplos de entrenamiento afectados lo incluía literalmente; seis ejemplos de test sí. El candidato v2 usa el snapshot depurado completo.

`build-training-data.py` conserva citas literales, limita artículos por ley, elimina citas duplicadas y separa leyes enteras entre entrenamiento, validación y test. V2 produce 31.956/3.116/3.688 ejemplos de 250/26/27 leyes. El entrenador descarta ejemplos que no caben completos, sin truncar respuestas: sus conteos efectivos y motivos quedan en `dataset-audit.json`. Los archivos efectivos también se conservan.

## Ejecución

```bash
uv venv --python 3.12 .venv-training
uv pip install --python .venv-training/bin/python -r scripts/training-requirements.lock.txt
.venv-training/bin/python scripts/download-training-model.py
.venv-training/bin/python scripts/build-training-data.py \
  --input artifacts/legal-library/exports-v2/corpus.jsonl \
  --output artifacts/training/dataset-v2
.venv-training/bin/python scripts/train-legal-adapter.py \
  --data artifacts/training/dataset-v2 \
  --output artifacts/training/lex-gemma4-lora-v2 \
  --iters 400 --eval-batches 16
```

Un adaptador existente nunca se sobrescribe: elegir otro directorio para repetir. La base permanece congelada; se ajustan 185.344 parámetros de siete módulos q/v en los cuatro últimos bloques, rango 4, batch 1, contexto máximo 512, Adam y learning rate 2e-5. Hay checkpoint cada diez pasos y copia del mejor checkpoint según validación; el candidato evaluado por defecto es el final y su hash queda registrado.

La máscara supervisa solamente `fin_del_prompt <= posición_del_target < longitud_sin_padding`. Se corrige explícitamente el límite superior de la pérdida upstream. La comparación de pérdida usa casos fijos balanceados y documentados, idénticos antes y después. MLX y NumPy usan semillas fijas. No hay trackers externos ni uploads.

## Evaluación y exportación

```bash
.venv-training/bin/python scripts/evaluate-legal-adapter.py \
  --adapter artifacts/training/lex-gemma4-lora-v2 --mode base --per-task 8
.venv-training/bin/python scripts/evaluate-legal-adapter.py \
  --adapter artifacts/training/lex-gemma4-lora-v2 --mode candidate --per-task 8
.venv-training/bin/python scripts/export-trained-model.py \
  --base artifacts/training/base-gemma4-26b \
  --adapter artifacts/training/lex-gemma4-lora-v2 \
  --output artifacts/training/lex-gemma4-candidate-v2 \
  --license-file resources/licenses/Gemma-Apache-2.0.txt
node scripts/verify-trained-runtime.mjs
```

Los tres modos comparan los mismos casos de leyes reservadas. El contrato incluye hash del test efectivo, base, IDs ordenados, configuración de generación y evaluador. Cambiar el evaluador exige repetir la base. La evaluación es técnica y léxica: JSON, cita exacta, fuente permitida, abstención y ausencia del canario de inyección. La pérdida por sí sola nunca aprueba el candidato.

La exportación fusiona una copia y adapta el layout para Ollama, con comprobaciones de tensores y shards. El verificador importa en un almacenamiento independiente usando el binario incluido en LEX, evalúa respuestas reales y prueba contrato sintético → recuperación federal → citas → DOCX. No modifica el catálogo del modelo predeterminado. Ver `model-distribution.md` para transformaciones y límites.

## Supervisión y resultados

El bloqueo `artifacts/training/gpu.lock` impide dos entrenamientos/evaluaciones simultáneos. Si queda después de un cierre forzoso, verificar primero que su PID terminó; nunca borrarlo ciegamente. No ejecutar inferencia adicional durante entrenamiento. El monitor de fuentes existente conserva el corpus semilla y no relanza Gemma salvo cambio de ese corpus.

`training.json` publica progreso real cada 15 segundos; la UI lo marca obsoleto si deja de actualizarse. Cada corrida conserva métricas, configuración, casos, hashes y duración. `training-report.json` acredita ajuste de pesos, `behavior-*.json` resultados del protocolo y `runtime-v2/verification.json` compatibilidad real. Un fallo debe mantenerse visible; un archivo exportado no implica aprobación ni publicación.

Pruebas CPU: `.venv-training/bin/python -m unittest discover -s tests -p '*_test.py'`. Las pruebas de interfaz usan inferencia explícitamente simulada; no cuentan como evidencia de calidad del modelo.

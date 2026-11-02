# Evaluación y entrenamiento acotados para el objetivo de 8 GB

Preparación del 1 de noviembre de 2026. El equipo de trabajo tiene 24 GB; ejecutar aquí con límites **no valida físicamente un Mac de 8 GB**. El modelo grande y su adaptador se preservan. El candidato pequeño no hereda los pesos LoRA del de 26B.

Se revisaron AGENTS.md, dsystem, la skill HF Trainer guardada en `artifacts/training/references/HF-TRAINER-SKILL.md`, el código local MLX-LM 0.32.2 y su [guía LoRA](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/LORA.md). El flujo HF Jobs no se aplica: el dueño exige trabajo local, sin gasto cloud ni subir datos. No se ejecutó otro modelo para redactar estos scripts.

## A/B de instrucciones de habilidades

`scripts/evaluate-lightweight-skills.mjs` captura diez casos del **servicio real**, con las cinco habilidades y una variante de inyección por habilidad. Cada par usa el mismo modelo, fuentes, pregunta, notas, instrucciones de seguridad, esquema de citas y parámetros. Baseline elimina exclusivamente `skill.instructions`; enabled las conserva. El orden de los brazos alterna entre casos. No compara modelos diferentes y no presupone que las habilidades mejoren las métricas.

Las fuentes combinan un acuerdo ficticio y el pasaje oficial de CCF1797 del corpus verificado. Dos controles deterministas por caso comprueban que un documento de otro asunto no puede recuperarse con el ID del asunto actual ni entrar en el prompt. Esos controles de acceso se reportan por separado de la inferencia. No son una auditoría exhaustiva de aislamiento entre despachos.

El reporte conserva prompts, hashes de servicio/skills/corpus/evaluador, contexto idéntico por par, digest del modelo, versión runtime, respuestas crudas y tiempos. Evalúa JSON estricto, aceptación del validador de la app, citas exactas de `allowedQuotes`, canarios de instrucciones/otro asunto, truncamiento y números nuevos. El chequeo numérico es una señal limitada: **no equivale a detectar toda invención, implicación semántica ni error jurídico**. El esquema ya restringe las citas; un pase no acredita que el modelo aprendiera esa restricción por sí solo. Empates se declaran sin mejora observada. Cada caso incluye una rúbrica de revisión específica del rol, con estado pendiente, y diagnósticos descriptivos (párrafos, longitud e IDs citados). No se puntúa el cumplimiento del rol mediante palabras clave; un delta técnico positivo no se presenta como beneficio profesional de la habilidad.

### Contrato v2 de párrafos y citas asociadas

El preparador actual declara explícitamente `outputContract: paragraph-citations-v1` en el adaptador simulado, igual que el runtime de producción. Esto hace que el **servicio real** construya el prompt y esquema `paragraphs[{sourceId,quote,text,kind?}]`; no se transforma una respuesta legacy para hacerla pasar por v2. Cada caso conserva su contrato y el hash de `server/grounded-output.mjs`. El mock solo captura contexto: emite pasajes exactos de 40–350 caracteres, sin modelo, para completar el recorrido determinista del servicio.

`assess` selecciona el validador por metadata confiable. V2 usa `validateGroundedOutput`, que comprueba citas exactas, fuentes distintas requeridas, límites de texto y respaldo numérico por **la cita del mismo párrafo**. Solo tras validar convierte a la representación interna para diagnósticos de texto. No repara JSON ni intenta legacy cuando v2 falla. Reportes históricos sin `outputContract` conservan la ruta legacy, explícitamente diferenciada; contrato desconocido se rechaza. No se comparan como equivalentes las tasas de contratos distintos.

El A/B mantiene los mismos diez casos de regresión y cambia exclusivamente las instrucciones de la habilidad dentro de cada par. `artifacts/lightweight/skills-ab-v2-prepared.json` es preparación CPU, no inferencia. Diez pruebas del A/B pasan, incluyendo rechazo de números de otra fuente, duplicación de fuentes, citas inventadas, campos extra, controles y fallback entre contratos. Las solicitudes envían `truncate:false`, `shift:false` y `think:false`: el runtime no tiene autorización para recortar evidencia silenciosamente. La revisión real de Claude que motivó el contrato está en `artifacts/lightweight/claude-contract-review.json`; su recomendación sobre mayor cobertura y revisión semántica sigue pendiente. Vincular la cita estructuralmente no convierte una conclusión inventada en correcta.

Preparar casos, solo CPU:

```bash
node scripts/evaluate-lightweight-skills.mjs \
  --output artifacts/lightweight/skills-ab-prepared-current.json
node --test tests/lightweight-skills.test.mjs
```

Solo cuando el coordinador libere recursos, contra un runtime aislado ya iniciado por él:

```bash
node scripts/evaluate-lightweight-skills.mjs --run \
  --endpoint http://127.0.0.1:PUERTO --model gemma3:1b \
  --runtime-pid PID \
  --output artifacts/lightweight/skills-ab-real.json
```

`--case-limit 1` ejecuta únicamente el primer par como smoke; se reporta ese tamaño real, nunca como diez casos. No hay descarga ni inicio automático de runtime en el evaluador. El endpoint exige loopback, puerto explícito, sin credenciales ni redirecciones. Cada solicitud usa el esquema real capturado, contexto 4096, salida 512, temperatura 0, semilla fija, batch 64, dos hilos y `keep_alive:0`. Esas dos últimas cotas de procesamiento son propias de la evaluación; el transporte de producción puede dejar sus valores al runtime. Se rechaza cualquier modelo de más de 2 GiB y otro modelo cargado en el mismo servidor.

Adquiere `pipeline.lock` y `gpu.lock`, respeta dueños previos y solo libera sus propios bloqueos. Las solicitudes son secuenciales, con timeout de 90 segundos y máximo 1 MiB de respuesta. Muestrea RSS del PID y sus descendientes cada 300 ms, interrumpe solicitudes al superar 3 GiB e intenta descargar el modelo al terminar. **RSS muestreado no es toda la memoria unificada, puede duplicar páginas compartidas y no incluye otras apps.** El límite no sustituye revisar presión de memoria/swap del sistema; un controlador no garantiza cancelación inmediata dentro de un kernel GPU.

## Adaptador nuevo para la base pequeña

Base propuesta: [mlx-community/gemma-3-1b-it-4bit](https://huggingface.co/mlx-community/gemma-3-1b-it-4bit), revisión `2d44e83dc9e80843d22fb941d3d699a0b1351aa6`. El archivo de pesos tiene 732.577.304 bytes según metadata pública; todos los archivos seleccionados quedan por debajo de 1 GiB. Arquitectura `gemma3_text`, 26 bloques, dimensión 1152, cuantización 4 bits. Su licencia es **Gemma**, no Apache-2.0: revisar [términos oficiales](https://ai.google.dev/gemma/terms) antes de distribuir un derivado. Este preparador no publica ni exporta a Ollama.

`download-lightweight-training-model.py` descarga solo esa revisión, sin credenciales, y crea hashes. No importa MLX ni carga pesos. `train-lightweight-adapter.py` verifica todos los archivos y rechaza bases grandes, otra revisión, pesos extra y cualquier archivo alterado.

Preparación offline después de descargar, todavía sin GPU:

```bash
.venv-training/bin/python scripts/train-lightweight-adapter.py \
  --output artifacts/lightweight/training-preparation --seq-length 512
.venv-training/bin/python -m unittest discover -s tests -p lightweight_training_test.py
```

Entrenamiento real **solo tras coordinación de GPU**, con salida nueva:

```bash
.venv-training/bin/python scripts/train-lightweight-adapter.py --run \
  --output artifacts/lightweight/adapter-smoke --iters 3 --seq-length 512
```

Usa el dataset v2 con hashes y leyes separadas, selecciona de forma balanceada 256 train y 8 valid/test por defecto, conserva IDs/procedencia y registra el holdout efectivo. Rechaza ejemplos largos completos, sin truncar targets. El prefijo y el cierre se derivan del template de Gemma3; no reutiliza el cierre especial de Gemma4. Se comprueba que el texto completo comience por el prefijo de generación y luego se codifican prefijo y completion por separado, sin añadir BOS: evita que BPE fusione el salto de línea del prefijo con la llave inicial de JSON y cambie el límite de entrenamiento respecto de la inferencia.

LoRA nuevo: rango 4, dos últimos bloques q/v, batch 1, learning rate `1e-5`, gradient checkpointing, caché 64 MiB y límite de asignación/wired MLX 3 GiB. Se desactiva dentro de este proceso el reajuste del límite wired que el trainer upstream haría para el Mac anfitrión de 24 GB. El proceso tiene alarma de diez minutos. Baseline y candidato miden pérdida sobre los mismos casos fijos; se registran parámetros entrenables, pesos B no nulos, pérdidas y pico MLX. Una pérdida menor solo termina en `TRAINED_EXPERIMENTAL_NOT_PROMOTED`: falta evaluación conductual del adaptador e importación/distribución compatible. No sustituye automáticamente el modelo de la app.

## Evidencia de preparación, sin GPU

- Descarga completa: 771.862.020 bytes; manifiesto en `artifacts/lightweight/base-model-manifest.json`. Pesos y tokenizer comprobados por hash; no modelo cargado por el descargador.
- Preparación real con tokenizer local: `artifacts/lightweight/training-preparation/preparation.json`, 256 train / 8 valid / 8 test, máximos 369 / 339 / 337 tokens. Ningún ejemplo seleccionado fue truncado ni rechazado por longitud.
- Siete pruebas deterministas del A/B y siete del entrenamiento pasaron. Cubren identidad de contexto, roles, aislamiento entre asuntos, citas/canarios, locks, fronteras del tokenizer, integridad y partición de leyes.
- Después de esa preparación, el coordinador autorizó el A/B y 100 pasos de entrenamiento. Ambos se ejecutaron, pero el candidato **fue rechazado**: 0/8 holdout y 0/10 aplicación en la comparación MLX corregida. Véase el [reporte de ejecución y límites](qa/lightweight-training-review-2026-11-01.md). No se promueve un modelo por caber en memoria.

La evaluación integrada actual añade el token especial de cierre de turno Gemma3 (106) al EOS verificado (1). El primer experimento reveló que el checkpoint omitía ese cierre de su configuración de parada. Se preservaron las salidas iniciales y se repitió inferencia, sin reentrenar, mediante `evaluate-lightweight-adapter.py`. `score-lightweight-training.py` puntúa después exclusivamente en CPU y rechaza pares incompletos. El flujo actual guarda una copia del trainer ejecutado junto a su hash para distinguir cambios posteriores del código usado por cada experimento.

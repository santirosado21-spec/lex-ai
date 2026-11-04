# Corrida vigente: Qwen 2B con el corpus depurado — 2 de noviembre de 2026

**Estado observado: piloto nuevo de 500 pasos terminado y continuación completa en ejecución. Ningún candidato se activó en la app.** La corrida anterior se invalidó por selección incorrecta de la versión de datos; no se reutilizaron sus adaptadores ni Adam.

## Corrección de procedencia

Root detectó que el constructor inicial usaba `artifacts/legal-library/exports/`, cuya auditoría independiente había pasado solamente 905/922 muestras. El runbook ya exigía el snapshot depurado `exports-v2/`, con 910/910. Fue un error de selección del agente: comprobar `structurally-verified` por registro no bastaba para autorizar aquel export bruto.

Se verificó el comando del proceso propio y se envió SIGTERM únicamente al entrenamiento PID 66603. El supervisor 66602 terminó, ambos locks se liberaron y los logs/checkpoints se conservaron. Quince directorios anteriores llevan un sidecar **`SUPERSEDED_UNAUDITED_INPUT.json`**. El informe histórico también muestra la invalidación. El análisis de procedencia encontró 31 IDs de fuentes del antiguo piloto asociados con exclusiones posteriores; esto no significa que todos sus fragmentos entrenados contuvieran literalmente el artefacto.

La evidencia y alcance están en `artifacts/training/qwen-source-quality-incident.json`. Los metadatos sintéticos anteriores que decían `human-authored` también se corrigieron mediante ese sidecar: fueron plantillas escritas por Codex, no revisadas por una persona o profesional jurídico. Los nuevos datos usan `codex-authored-deterministic-synthetic-template` y lo declaran expresamente.

## Entrada pública congelada y auditada

| Archivo | SHA-256 fijado |
| --- | --- |
| `exports-v2/corpus.jsonl` | `e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11` |
| `exports-v2/manifest.json` | `861b5f1601a0c495300e3ccf8ab291ea9576645ecc59b80b86138d5a809e77a3` |
| `exports-v2/independent-extraction-audit.json` | `7058281c1760f915167b48c8c1b547d9e23fb24b24dc1c1512bd1501a28cf2db` |
| `exports-v2/review-exclusions.json` | `eb6ae6278ca2dfb9abf9fa4dca38dd27b3be9dfebd987f8889c2a3dba1457568` |

`scripts/qwen-training/curation.py` comprueba esos cuatro hashes, los 910/910 resultados individuales, la identidad del corpus auditado y las cantidades del manifiesto antes de preparar o cargar un modelo. Constructor, entrenador, evaluador, restauración y launcher rechazan datos/candidatos/evaluaciones anteriores sin esa procedencia. La revisión excluyó 1.387 registros adicionales, incluidos LGSMIME, LOEFAM, REG_SENADO y LSINT, por los motivos conservados en el manifiesto. No se volvió a incorporar ninguno.

Esta auditoría es una comprobación técnica por muestreo con extractor independiente. No acredita vigencia, exhaustividad ni corrección jurídica profesional.

## Cobertura y particiones

El snapshot aprobado contiene **35.452 artículos de 303 instrumentos**, con particiones por instrumento preservadas. Reservar CCF/CPEUM evita entrenar sobre los casos previos de desarrollo.

| Uso | Artículos enumerados | Instrumentos |
| --- | ---: | ---: |
| Entrenamiento elegible | 25.855 | 248 |
| Validación retenida | 2.899 | 26 |
| Prueba retenida | 3.670 | 27 |
| CCF/CPEUM reservados para regresiones | 3.028 | 2 |

Datos finales: `qwen-curated-dataset-v2`; tokens: `qwen-curated-tokenized-v1`.

- Entrenamiento: **129.010 filas**, de las cuales 128.910 son pasajes públicos y 100 tareas sintéticas.
- Validación: **13.114**; prueba: **19.723**; reservadas: **7.819**.
- Todas las filas caben completas: máximos **502/449/363 tokens** en entrenamiento/validación/prueba; **cero truncamientos**.
- Se enumeran todas las fuentes; **35.451 de 35.452** tienen al menos un pasaje representado. Una queda completamente cubierta por exclusiones de solapamiento. Las exclusiones por fuente y caracteres constan en `source-coverage.jsonl`.
- Se excluyen coincidencias exactas normalizadas entre entrenamiento y fuentes retenidas/reservadas; no se declara ausencia de duplicados aproximados.
- No se leen documentos de clientes, `.data`, archivos importados ni almacenes privados del usuario.

Para evitar repetir una auditoría de tokens innecesariamente, se reutilizaron 161.821 tokenizaciones solo cuando **todos los mensajes visibles al modelo eran idénticos**, y se hicieron 30 tokenizaciones nuevas. Cada pasaje público se volvió a comprobar contra el ID, hash de texto, partición y contenido del snapshot aprobado. Se dividieron los pasajes numéricos largos sin perder caracteres y se revisaron de nuevo los solapamientos. **No se leyó ningún adaptador ni optimizador anterior para este proceso.**

## Base y entrenamiento nuevo

Se partió de la base congelada `mlx-community/Qwen3.5-2B-4bit`, revisión `674aaa7240b91e8012fcad5d791b7dfe5ba90207`, pesos SHA-256 `713fe7e5d3c3965f7106b0d0ee17615f7869c23c8d327996df8c1196fbcf07d5`. Es la descarga local de aproximadamente 1,75 GB ya verificada; no se descargó otro modelo ni se modificó la base.

QLoRA de rango 4, escala 8, batch 1, tasa 0,0001 y máximo 512 tokens. Se ajustan **34.816 parámetros** q/v del último bloque de atención completa. El prefijo recurrente congelado usa modo de evaluación; dropout es cero. Versiones: MLX 0.32.4, mlx-lm 0.32.2, Transformers 5.22.1, safetensors 0.8.0. La licencia y procedencia originales se conservan.

La programación vigente contiene 100 tareas de calentamiento conversacional, una pasada completa de las 129.010 filas y una tarea sintética de repaso cada 16 filas: **137.173 pasos programados**. Los pasos de repaso no cuentan como artículos nuevos. Las identidades ficticias Alicia/Bruno de prueba y Lucía reservada no se usan en las tareas de entrenamiento.

El objetivo jurídico enseña principalmente copia contextual fiel, formato de referencia e incertidumbre sobre vigencia. **No demuestra aprendizaje de conocimiento jurídico autónomo ni razonamiento profesional.**

## Piloto depurado real y evaluación emparejada

Corrida: `qwen-curated-pilot-500-v1`. Se inició sin `--resume`, desde la base congelada y con un adaptador nuevo. Completó 500 pasos en **70,18 segundos**: 100 de calentamiento, 377 de la pasada del corpus y 23 de repaso. Dentro de esos pasos hubo 376 pasajes públicos; las otras filas fueron tareas sintéticas. Se utilizaron **370 artículos distintos de 139 instrumentos**, no todo el corpus.

- Peak MLX: **1.755.340.710 bytes**, aproximadamente 1,63 GiB. No es una medición de toda la memoria del sistema ni validación física de 8 GB.
- Adaptador: `40c4c072f5fa29e4745cba5a5276df997a2afa3f8ae87a7e51b92eb16659feb0`.
- Los hashes de la base antes/después son iguales.

Evaluación nueva de ambas ramas, con el mismo protocolo sobre fuentes retenidas aprobadas e identidades ficticias: `qwen-curated-pilot-500-evaluation-v1`.

| Medida | Base congelada | Piloto nuevo |
| --- | ---: | ---: |
| Pérdida de validación, 12 ejemplos | 1,35546 | 0,02062 |
| Pérdida de prueba, 12 ejemplos | 1,32881 | 0,01885 |
| Comprobaciones mecánicas estrictas v2 | 35/52 | 48/52 |
| Casos que cumplen todas las comprobaciones | 1/10 | 8/10 |

La pérdida baja es esperable en una tarea que copia el pasaje de entrada. No sirve para aprobar calidad jurídica. La puntuación v2 también rechaza confundir la identidad del usuario con la del asistente, truncamiento, repetición y negativas sin petición clara de datos.

Observaciones de las salidas reales nuevas:

- Las presentaciones de Alicia y Bruno terminaron de forma coherente; el piloto recordó sus nombres y profesiones en segunda persona y redactó un correo firmado con el nombre correcto.
- Los tres pasajes jurídicos de prueba se reprodujeron literalmente, con `[S1]` e incertidumbre sobre vigencia.
- **Fallos conservados:** ante un plazo sin fechas/jurisdicción, respondió «La instantánea no confirma la vigencia legal de la instantánea». Ante una petición de confirmar vigencia sin fuente, respondió «No confirmé la vigencia de la disposición». Son respuestas insuficientes y no se aprobaron.
- La base confundió las identidades e inventó un plazo sin fuente. Estos resultados no prueban que el piloto controle otros plazos o todos los casos de falta de evidencia.

Clasificación: **experimental con fallos conocidos**. No se activó, publicó ni presentó como versión profesional.

## Continuación vigente y durabilidad

La continuación nueva utiliza exclusivamente el checkpoint depurado de 500 pasos, que incluye Adam, adaptador, estado aleatorio, hashes, programación y contadores. El hash de `checkpoint.json` es `dde733c88ccbc1c9fd13a9393449681dd413f547b550e049b8a86259d1a5e891`. La comprobación previa de continuidad bit a bit valida el método sin dropout; no valida la calidad de las fuentes anteriores ni permite reutilizar sus pesos.

Se observó avance real desde el paso 500 al **501 y 510**, y se comprobó el nuevo checkpoint completo **1.000**, SHA-256 de `checkpoint.json` `b908ac921c6284039d6ed5e74ea6080901aa7302ead95ce1ac1aecd2f6e71ba8`. Estos datos acreditan arranque y progreso recuperable, no terminación.

- Supervisor nuevo: **PID 81275**, observado con PPID 1.
- Entrenamiento: **PID 81277**, propietario del lock de GPU.
- `caffeinate`: **PID 81276**, con `-i -w 81275`; evita únicamente suspensión por inactividad y termina al salir el supervisor propio. No se cambió `pmset`, bloqueo de pantalla ni procesos ajenos.
- Directorio: `artifacts/training/qwen-curated-full-pass-v1`.
- Logs y orden exacta: `pipeline.log`, `launch.json`, `pipeline-report.json`.
- Límite MLX **4 GiB**, límite de entrenamiento **12 horas**, checkpoint cada **500 pasos**.
- Estimación por el nuevo piloto: **5,18 horas**, comunicada como **5–7 horas más posibles pausas/evaluación**. No es una promesa de terminación.
- Al terminar se ejecutan la misma comparación base/candidato y puntuación estricta sobre los datos depurados, a partir de scripts preservados. No se promociona el candidato automáticamente.

El monitor local conserva el resultado parcial negativo del **piloto depurado**, muestra `pilot:false`, la fase completa, 137.173 pasos, fuentes/filas realmente vistas y latidos cada 20 segundos. El monitor anterior está respaldado. Ningún resultado del piloto bruto se usa como evaluación vigente.

El cierre de tapa, suspensión manual, reinicio, pérdida de energía o terminación del proceso pueden interrumpir la tarea; el checkpoint completo conserva la continuidad. No se configuró una notificación automática de finalización.

Para restaurar desde un checkpoint depurado posterior, usar un directorio nuevo y la evaluación depurada como contexto:

```bash
.venv-training/bin/python scripts/qwen-training/launch_full.py \
  --output artifacts/training/qwen-curated-continuation-N \
  --resume-checkpoint artifacts/training/qwen-curated-full-pass-v1/training/checkpoint-NNNNNNN \
  --previous-evaluation artifacts/training/qwen-curated-pilot-500-evaluation-v1/paired-evaluation-score-v2.json
```

Sustituir el número por un checkpoint real comprobado y no lanzar otra tarea mientras el proceso actual conserve sus locks. El launcher rechaza checkpoints/evaluaciones sin la curación fijada. No reutilizar los directorios con `SUPERSEDED_UNAUDITED_INPUT`.

Pruebas CPU nuevas: **7/7**. Cubren procedencia, rechazo del export bruto, separación de leyes/pasajes, locks, repaso, monitor y los fallos conductuales observados. La evaluación semántica y jurídica y el flujo nativo con un candidato convertido todavía requieren trabajo independiente; un adaptador MLX no acredita compatibilidad con los pesos cuantizados de la app.

# Monitor persistente: fuentes y verificación local

`scripts/night-watch.mjs` ejecuta ciclos acotados con bloqueo de instancia, estado persistente, heartbeat, cancelación y backoff. Esta ampliación no reinicia el job existente: el supervisor debe volver a iniciarlo explícitamente para cargar el código nuevo.

## Biblioteca pública

La etapa `library-ingest` invoca:

```sh
node scripts/corpus-ingest.mjs --limit 317 --max-gib 2
```

El timeout es el menor entre 45 minutos y el tiempo restante del job. No se inicia otra etapa si ya venció el deadline. La descarga y extracción conservan los límites del importador (HTTPS/robots/rate limit, un worker CPU, tamaños acotados, snapshots históricos y cuarentenas).

No se ejecuta esta etapa cuando el estado final `complete`, `partial` o `failed` tiene `finishedAt` de hace menos de seis horas. El monitor también persiste `libraryLastAttemptAt`; esto impide nuevos intentos dentro de seis horas incluso si el subproceso falló antes de escribir su propio estado final o si se reinicia el supervisor. La fecha más reciente entre fin de ingesta e intento es la referencia. Una ingesta marcada `running` iniciada hace menos de 45 minutos se omite para evitar duplicación. Los bloqueos huérfanos no se eliminan automáticamente.

Esta etapa solo actualiza el área de trabajo `artifacts/legal-library`: adquisiciones, manifest, extracción, estado y exportación candidata. No escribe `resources`, snapshots congelados `exports-v1`/`exports-v2`, índices publicados, adaptadores ni modelos. Auditar, congelar e integrar una nueva versión son pasos separados. La presencia de una nueva extracción nunca implica aprobación jurídica ni activación automática.

Los skips se registran con motivo y `nextCheckAfter` cuando corresponde. Un estado previo parcial/fallido conserva una advertencia visible de revisión pendiente. El backoff general del supervisor sigue actuando ante fallos efectivos de sus etapas.

## Exclusión mutua de GPU

Antes de `gemma-real`, el monitor comprueba `artifacts/training/pipeline.lock`. El harness de validación mantiene ese bloqueo durante toda su ejecución, incluido el intervalo entre el evaluador hijo y el E2E del padre. Mientras existe, la etapa se omite sin intentar reservar GPU. El monitor comprueba existencia, no depende de que el propietario haya terminado de escribir el JSON y nunca modifica ese bloqueo.

Si no hay pipeline, intenta crear `artifacts/training/gpu.lock` con `open(...,'wx',0600)`. Este es el mismo archivo que usan entrenamiento y evaluación. Si ya existe, la etapa se registra como `ok:true, skipped:true`, con motivo GPU ocupada; no incrementa el contador de fallos ni marca el hash del corpus como inferencia verificada. Un ciclo posterior vuelve a intentarlo cuando corresponda.

Después de adquirir y registrar su reserva de GPU, vuelve a comprobar `pipeline.lock`. Si el pipeline apareció entre ambas comprobaciones, omite la inferencia y pasa por `finally`, que libera únicamente la reserva GPU cuyo UUID sigue siendo del monitor. Este orden complementa el del harness: el harness crea primero su bloqueo de pipeline y luego comprueba si la GPU ya está reservada. Así el monitor no entra en el hueco entre fases de una validación activa. Ambas clases de omisión son exitosas y dejan pendiente la inferencia para otro ciclo.

Si obtiene el lock, escribe un UUID de propietario, PID, fecha, modo y ID del monitor. Lo libera en `finally` solo si el UUID guardado sigue siendo suyo. No borra locks de otros procesos ni recupera locks antiguos por su cuenta. El hash de inferencia se registra únicamente tras un comando exitoso. Un timeout o cancelación conserva la terminación del grupo de procesos existente y después libera el lock propio.

## Pruebas e integración

`runNightWatch` admite `gpuLockPath`, `pipelineLockPath` y `libraryStatusPath` para rutas de pruebas aisladas. Si no se proporciona `pipelineLockPath`, usa un archivo `pipeline.lock` en el mismo directorio que `gpuLockPath`, también al inyectar rutas de pruebas. `now` y `sleep` permiten comprobar ciclos y períodos sin esperar minutos reales; `run` sigue siendo inyectable. Producción conserva rutas y reloj reales por defecto.

```sh
node --test tests/night-watch.test.mjs
```

Resultado al entregar: 13/13 pruebas aprobadas. Incluyen cooldown de seis horas, persistencia entre reinicios, límite temporal del job, GPU/pipeline ocupados sin fallo ni hash consumido, ejecución posterior del mismo corpus, llegada de pipeline entre precheck y reserva GPU, conservación de lock ajeno, liberación por excepción y regresiones de timeout/cancelación de descendientes. La cancelación espera la confirmación de disponibilidad del PID hijo antes de abortarlo; no usa una espera fija de 500 ms. Las pruebas de GPU usan comandos inyectados; no arrancan Gemma ni entrenamiento.

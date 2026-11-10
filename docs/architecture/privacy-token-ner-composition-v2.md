# H4b.2b.4b — composición experimental de spans v2

Esta versión nueva no modifica Rampart v1, su trace invariante, GLiNER, reglas, corpus, protocolo de evaluación o rutas de producto. Usa los mismos pesos/tokenizer preparados y fijados, CPU único, umbral 0.4, BIO estricto, límite de 512 tokens, timeout 15 s y límite combinado 1 GiB. No se ejecutó inferencia v2 durante la implementación. No hay descargas, entrenamiento, proveedor ni permiso de egreso.

## Contrato y autoridad

La entrada conserva exclusivamente `scope`, `segments` y `operational`. El padre proyecta esos campos y excluye caso/gold/expected/entities/preserve. Un constructor local crea handles por objeto/versión/hash/texto original/ruta/ámbito exacto; el compositor revalida su registro inmutable después del await. El backend sólo recibe textos e IDs locales T/P; no recibe reglas ni autoridad de procedencia. Sigue siendo una fixture sintética, no el registro integrado de importación de producción.

Las reglas se ejecutan internamente sobre el original. Son hipótesis sintácticas: **no validan RFC/CURP/checksums ni identidad jurídica**. Contener un span sólo demuestra que sus caracteres estarán dentro del rango propuesto para protección; no demuestra el significado de su tipo ni anonimización.

El decoder nuevo produce todos los spans BIO nativos, incluidos tipos sin equivalencia, y confirma el recorrido de cada texto y ruta. No intenta reparar BIO, bajar confianza, descartar UNK, truncar, normalizar offsets o unir nombres. Un error duro puede detener el recorrido, pero entonces no se permite composición completa. Una clasificación sin mapa ya no corta el recorrido: se conserva hasta comprobar todos los spans/segmentos y después se decide su cobertura.

## Composición conservadora

1. Los fallos operativos, de ámbito, extracción, evaluación contextual y reglas ambiguas mantienen bloqueo. No se obtiene diagnóstico de reglas de un ámbito rechazado. Las reglas válidas ya calculadas se conservan bajo error posterior sólo como diagnóstico.
2. Cualquier span aprendido en una ruta bloquea. No se usa una coincidencia del cuerpo para resolver una clave/ruta sensible.
3. Entre categorías conocidas, cualquier solapamiento de categorías distintas bloquea: regla/regla, regla/modelo o modelo/modelo. No se elige una categoría por prioridad para mejorar métricas.
4. Cada span nativo no mapeado del texto requiere **una sola regla interna que lo contenga por completo** en el mismo segmento ligado al registro. No se unen reglas adyacentes, espacios, segmentos, versiones o fuentes. La prueba registra rango original UTF-16, límites UTF-8 derivados, ámbito, referencia y hash. Los pares sustitutos no pueden dividirse; no se equiparan textos normalizados.
5. La resolución se denomina cobertura literal; no convierte TAX_ID en RFC o CITY en address. La regla completa permanece. Cualquier span sin cobertura deja el caso bloqueado, aunque otro span anterior esté cubierto.
6. Un span aprendido de la misma categoría completamente contenido en una regla se deduplica conservando la regla entera. El plan une sólo rangos superpuestos, nunca adyacentes. El padre vuelve a comprobar alcance, referencias/hashes y equivalencia entre detecciones y plan.

## Resultado y aislamiento de diagnóstico

Salida del candidato: `{result,diagnostic,protectionPlan,diagnosticOnly:true,egressEligible:false}`. `result` contiene status/reason/detections. Bajo bloqueo, `result.detections=[]` y `protectionPlan=null`; `diagnostic.ruleDetections` conserva únicamente reglas calculadas con procedencia válida. Los diagnósticos incluyen spans nativos, pruebas y causas finitas, sin texto original ni instrucciones/herramientas. Mantener reglas diagnósticas no eleva TP del resultado puntuable bloqueado.

Incluso `complete` significa únicamente que terminó este algoritmo acotado. No hay formato de solicitud a proveedor, importaciones de routing ni constructor de payload remoto. H2 y H4/H5/H6/H7 permanecen fuera de este experimento. Continúan las brechas aprendidas de organización, identificadores de expediente, contexto y relaciones; no se interpreta ausencia de etiquetas como ausencia de riesgo. La cobertura semántica insuficiente sigue siendo una limitación global, no algo resuelto por contención.

El proceso hereda el sandbox que niega red, escrituras y corpus/evaluadores; añade rechazo de runner nuevo, docs de diagnóstico y recibos failure/started. No se presenta como aislamiento general del filesystem. Un error, timeout, cancelación, salida inválida o falta de confirmación del recorrido bloquea. Un proceso no se reinicia automáticamente. El compositor también verifica deadline absoluto monotónico antes/después del backend y antes de completar: un callback tardío del event loop no permite un resultado completo fuera de plazo.

## Runner y recibos

`node scripts/run-privacy-token-ner-composition-v2.mjs` sólo imprime un plan: no carga modelo, crea artefactos ni hace red. El modo `--dev --freeze FILE --out-dir NEW_DIRECTORY` requiere revisión independiente y binding de fuentes transitivas, runtime, manifiesto/modelo, protocolo/guía, DEV3 exacto de 60 casos y predicciones baseline fijadas. No existe modo heldout o dataset alternativo en el CLI.

El baseline se lee sólo en el padre para comparación de resultados, nunca como entrada del candidato. V2 cambia conducta deliberadamente; compara IDs/casos cambiados sin exigir invariancia ni modificar resultados históricos. No calcula un score nuevo ni selecciona una mejora. El éxito técnico no implica elegibilidad.

Se reserva un directorio exclusivo y se escribe `started.json` exclusivo antes del worker. `predictions.json` y `execution.json` se añaden sólo tras validar cada respuesta y revalidar identidad/bytes al terminar. Ante fallo, `failure.json` exclusivo contiene binding, código finito y sólo prefijo validado; no mensajes de excepción, salida cruda, score o promoción. No overwrite ni retry. Latencias/RSS se registrarán aparte del baseline; no hay afirmación de velocidad o calidad antes de una ejecución revisada.

## Pruebas sin inferencia

Pruebas adversariales cubren contención exacta/subrango, borde descubierto, segundo span/segmento, rutas, unión prohibida de reglas, dedupe íntegro, conflictos de categoría, surrogate/acentos, handles/hash/ámbito/versiones, autoridad falsificada, mutación asíncrona del input, errores posteriores al primer no mapeado, recorrido incompleto, timeout y ausencia de reintentos. El decoder se prueba con logits sintéticos sin importar ONNX. El runner se prueba con 60 filas generadas de test y backend simulado, incluyendo recibo de prefijo fallido y no sobrescritura. No se consumió el examen retenido ni se ajustó el modelo con gold.

Independent review correction: the parent IPC request now owns its absolute deadline and rejects late messages even before the timer callback runs. The parent output validator asynchronously reconstructs deterministic composition from its original input and declared native spans, recomputing operational gates and rules locally. Complete output must match exactly, including every mapped detection and unmapped proof; blocked output retains no protection plan or scored detections. Transient failures may retain only internally verified rule diagnostics and a valid proof prefix. Mocked child-process tests exercise the actual parent readiness, request, abort and late-message handlers without ONNX inference. This fixes review defects; it is not evidence from a development model run.

Readiness cancellation correction: a request registers cancellation before awaiting readiness and uses one absolute timeout budget from request entry through response, including model readiness. Already-aborted and loading-time aborts kill the worker once, settle the request and remove its listener/timer; ready/abort races and late messages cannot dispatch IPC or revive a settled request. The independent startup cap remains 15 seconds when no request exists. Tests exercise these parent protocol paths with a mocked child only.

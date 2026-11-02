# ADR 0002 — Objetivo de 8 GB y evidencia antes de promoción

Estado: implementación y evaluación experimental, 2026-11-01. Sustituye los presupuestos de memoria/descarga de ADR 0001; no afirma compatibilidad física ya demostrada.

El dueño fijó 8 GB de RAM como objetivo mínimo. La aplicación no inicia descargas ni carga pesos al abrirse. La inicialización explícita admite un único modelo público fijado por manifiesto SHA256, con descarga total de hasta 2.000.000.000 bytes. Los modelos grandes existentes se preservan y no se reutilizan como alternativa silenciosa.

El motor privado tiene una sola solicitud y un solo modelo simultáneos, contexto de 4096 tokens, salida de hasta 512 tokens y descarga del modelo de memoria al finalizar. La comprobación previa exige 8 GB totales, una estimación conservadora de 3 GiB disponibles para el candidato actual y 3 GiB de disco libre. La generación se interrumpe si el RSS muestreado del árbol del motor supera 3 GiB o no puede medirse. Este muestreo puede omitir picos y no mide toda la memoria unificada/Metal ni la presión del sistema. No es una garantía de que nunca haya intercambio a disco.

Las opciones de muestreo se fijan en `server/generation-options.mjs`; producción y evaluación comparten esa configuración. No se heredan penalizaciones de repetición/presencia creativas del registro para respuestas con citas. Los presupuestos de contexto y salida también se comprueban después de generar. No se acepta truncamiento silencioso ni una respuesta cortada por el límite de tokens.

La recuperación es local. El investigador jurídico puede consultar fuentes públicas sin importar documentos privados. El contexto contiene hasta tres pasajes compactos con sus hashes originales y de pasaje. Los documentos y notas siguen separados por asunto. Los pasajes limitados no equivalen a una revisión de todo un contrato ni de todo el corpus.

El contrato `paragraph-citations-v1` une cada texto con una fuente y cita exacta antes de renderizar referencias. Valida identidad, cita, presupuesto, diversidad de fuentes y números por cita. **No prueba implicación semántica ni corrección jurídica.** La evidencia real mostró respuestas con citas exactas pero conclusiones sin respaldo. Una tasa técnica alta no autoriza promocionar un candidato como validado.

El entrenamiento de desarrollo usa datos públicos/sintéticos, conserva el modelo base y produce adaptadores separados. El ajuste ligero de Gemma 3 1B terminó realmente, pero falló la evaluación de comportamiento y no se activa. No hay aprendizaje automático con documentos del usuario ni promoción automática por disminuir la pérdida de entrenamiento.

Ver `docs/lightweight-evaluation.md`, `docs/qa/lightweight-training-review-2026-11-01.md` y los informes fechados en `artifacts/lightweight/`. La validación física en una Mac de 8 GB y una evaluación jurídica profesional siguen pendientes.

# Ajuste local pequeño: entrenado y rechazado

Ejecución de la noche del 1 de noviembre de 2026, Ciudad de México (artefactos fechados 2 de noviembre UTC). El objetivo es reducir recursos para equipos de 8 GB. El Mac de prueba tiene 24 GB; esta corrida no demuestra funcionamiento físico en un Mac de 8 GB.

**Resultado: no promover el modelo base evaluado ni este adaptador.** La memoria medida es pequeña, pero los casos de aplicación y el holdout no pasaron. La pérdida disminuyó sin convertir las respuestas en salidas fiables. El adaptador se conserva como experimento, separado del modelo de la aplicación.

## Trabajo ejecutado

Se descargó la base MLX de 1B fijada por revisión y hashes: 771.862.020 bytes en total, licencia Gemma. Se entrenó un LoRA nuevo de rango 4 en las proyecciones q/v de los últimos dos bloques: **28.672 parámetros**, batch 1, 100 pasos, learning rate `1e-5`, contexto máximo 512, gradient checkpointing y caché de 64 MiB. No se reutilizó el adaptador del modelo de 26B ni se cambiaron los pesos base.

Los ejemplos proceden del dataset v2 público/sintético con procedencia y leyes separadas: 256 train, ocho valid y ocho test balanceados por tarea. El tokenizer local comprobó máximos de 369/339/337 tokens, sin truncamientos. Baseline y candidato midieron pérdida sobre los mismos casos fijos; los ocho casos de test pertenecen a leyes reservadas. Los diez casos de aplicación son regresiones sintéticas del A/B, **no un nuevo holdout jurídico**.

| Medida | Base | Adaptador de 100 pasos |
|---|---:|---:|
| Pérdida en ocho casos fijos de validación | 1,82762 | 1,26668 |
| Pérdida en ocho casos fijos de test | 1,89094 | 1,30185 |
| Gates técnicos en ocho casos de leyes reservadas, MLX libre | 0/8 | 0/8 |
| Gates técnicos en diez casos de aplicación, MLX libre | 0/10 | 0/10 |

La corrida de entrenamiento más la comparación inicial duró **146,36 segundos**. Pico de asignación MLX: **1.371.422.912 bytes (1,28 GiB)**. Máximo RSS del proceso informado por el sistema: **2.147.876.864 bytes (2,00 GiB)**. Son medidas distintas; ninguna mide toda la memoria del sistema. Se impusieron límites MLX/wired de 3 GiB y alarma de diez minutos. El proceso terminó y liberó sus locks antes de que el coordinador iniciara otra inferencia.

Adaptador SHA256: `c9017f49cbd6a39c07f34c176b692f0f40d27c4f8a657a423541cb8a08f23fe8`. Hay 10.240 valores B no nulos. El [reporte](../../artifacts/lightweight/adapter-v1/training-report.json) y la [copia exacta del trainer ejecutado](../../artifacts/lightweight/adapter-v1/trainer-executed.py) conservan la evidencia; el hash de esa copia coincide con el registrado.

## Corrección del evaluador, sin reentrenar

La configuración del checkpoint declaraba únicamente `<eos>` (ID 1), pero su template cierra respuestas con `<end_of_turn>` (ID 106). La primera evaluación MLX continuaba después del turno hasta el límite de 512 tokens. Se conservaron las [36 salidas originales](../../artifacts/lightweight/adapter-v1/behavior-paired.json); **no se usan como resultado definitivo**.

Se repitió únicamente la comparación de inferencia, en un proceso: primero base, después carga del adaptador verificado, idénticos 18 prompts, temperatura 0 y hasta 512 tokens. Se comprobó el token especial en el tokenizer fijado y se usaron paradas `{1,106}`. No se eliminaron palabras de las respuestas ni se reconstruyó JSON. La [comparación corregida](../../artifacts/lightweight/adapter-v1/behavior-paired-turn-stop.json) duró 48,90 segundos, con pico MLX 917.975.260 bytes y RSS 1.690.583.040 bytes. La [copia del evaluador ejecutado](../../artifacts/lightweight/adapter-v1/evaluator-turn-stop-executed.py) coincide con su hash registrado. Los scripts actuales incorporan la corrección para próximas corridas.

La generación MLX fue libre. No debe confundirse con el transporte de producción Ollama, que utiliza esquema JSON. La comparación A/B real previa del coordinador sí usó ese esquema, el mismo modelo pequeño y los mismos contextos en ambos brazos: **0/10 sin instrucciones de habilidad y 0/10 con ellas**. No se demostró una mejora por activar las habilidades. Ese resultado y sus límites están en [el reporte A/B](../../artifacts/lightweight/skills-ab-2026-11-02T04-25-02-640Z.json).

## Fallos observados

El [scoring CPU](../../artifacts/lightweight/adapter-v1/behavior-scores-turn-stop.json) reutiliza el evaluador de holdout y el validador real de la app. Rechaza JSON inválido, citas/IDs ajenos al pasaje, referencias ausentes y truncamiento; no convierte la integridad textual en una medida de exactitud jurídica.

La [revisión de evidencia de Codex](../../artifacts/lightweight/adapter-v1/semantic-evidence-review.json) encontró problemas que tampoco se resuelven envolviendo la salida en JSON:

- El caso de abstención `9a99c922…` convierte `currentValidity:unverified` en una afirmación de que la disposición ya no está vigente ni se aplica. La metadata aportada no permite esa conclusión.
- `legal-researcher:injection` atribuye el pasaje público CCF1797 a `D1`, que identifica el documento interno sintético, y confunde la naturaleza de la fuente.
- `legal-drafter:normal` afirma que el artículo no fue proporcionado, aunque figura en el contexto.
- `contract-reviewer:normal` no separa adecuadamente hechos, inferencia y recomendación; habla de asegurar la validez del artículo y no vincula las citas en el análisis.

Esta es una revisión técnica de contradicciones respecto de evidencia suministrada, **no una revisión de un abogado ni un dictamen sobre la ley**. Las rúbricas por habilidad siguen requiriendo evaluación más amplia. No basta mejorar formato, agregar etiquetas o relajar el validador para aprobar estos resultados.

## Estado y siguiente decisión

El entrenamiento real solicitado se completó y produjo pesos distintos. El candidato queda `REJECTED_TECHNICAL_FAILURE`, sin exportación, publicación ni activación. El coordinador está evaluando una alternativa pequeña con los mismos casos y límites; sus resultados se documentan por separado. No se concluye que todo modelo de 1B sea incapaz ni que más pasos garanticen una solución. Antes de otra optimización, corresponde elegir una base que responda adecuadamente al flujo observado y conservar estos casos como regresión.

Pasaron once pruebas CPU de preparación/scoring y siete de A/B. No se modificaron `server/inference.mjs`, `server/service.mjs` ni UI en esta tarea. No se utilizó GPU cloud ni se transfirieron documentos privados.

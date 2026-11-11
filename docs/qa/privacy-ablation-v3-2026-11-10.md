# H4b.2b.3: tres etiquetas no resuelven el detector

Se ejecutó una vez el diagnóstico revisado y congelado: dos configuraciones, mismos pesos uint8/runtime/umbral0.3, sesenta casos españoles nuevos de autor independiente. La única diferencia de inferencia son cinco etiquetas frente a tres documentadas. Son120 dispatches de caso secuenciales; no se confunde ese contador con forwards ONNX, porque cada caso puede tener varias superficies. [Freeze previo](privacy-ablation-v3-freeze-2026-11-10.json), [métricas y binding](privacy-ablation-v3-2026-11-10.json), [autoría/anotación](privacy-development-v3-freeze-2026-11-10.json).

| Configuración | TP/FP/FN exactos | Precisión | Recobrado | Limpios completos | Pico parcial observado |
| --- | --- | --- | --- | --- | --- |
| Cinco etiquetas v2 | 33/228/15 | 12,64% | 68,75% | 0/8 | 300.990.464B |
| Tres etiquetas v3 | 32/113/16 | 22,07% | 66,67% | 0/8 | 300.498.944B |

Ambas bloquearon60/60 casos. Los cuatro bloqueos operativos requeridos conservaron su motivo; los dos motivos ausentes no se cuentan como pases. Reducir etiquetas disminuyó falsos positivos, perdió un verdadero positivo y no recuperó utilidad: **ninguna configuración es elegible**. Las detecciones de paths mantienen el bloqueo; no se bajó la protección para mejorar el resultado. La composición y las reglas no cambiaron, ni se ajustó con el examen retenido.

Latencias descriptivas p50/p95/máximo: v2 27,94/49,76/60,49ms, v3 23,28/42,73/52,10ms; incluyen reglas y preparación por caso, no producto completo. Se observaron controles de denegación de red/lectura del corpus y evaluador en el backend; el perfil no aísla todo el sistema de archivos. Una CPU, límites de tiempo/RSS, salida nueva exclusiva, sin retry, entrenamiento o descarga adicional. Los valores de memoria son picos parciales sumados sobre este Mac, no certificación8GB o futura plataforma.

Builder Astra18/18; revisión Sol18/18 previa, cierre de nota histórica de pesos aprobado antes de freeze. Root ejecutó el primer directorio y exit0 significa ejecución técnica completa, no eficacia. Revisor Sol recalculó todos los scores desde las120 predicciones guardadas y confirmó identidad exacta de fuentes/runtime/modelos/protocolo/guía/dev, sin nueva inferencia o red. APPROVE de evidencia, no de calidad. Las anotaciones dev ya son expuestas; no se reciclan como aceptación ciega.

Continúa con adaptador token-classification pequeño de otra familia y evaluación separada, con mapas de etiquetas explícitos y licencia fijada. No crear freeze de heldout, activar envíos de clientes o presentar seudonimización como anonimización garantizada a partir de este ensayo.

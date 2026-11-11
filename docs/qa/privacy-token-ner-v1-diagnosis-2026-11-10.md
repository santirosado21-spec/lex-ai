# Rampart v1: diagnóstico del fallo preservado

Fecha: 2026-11-10. Baseline preservado en `ff0619b`. Diagnóstico del desarrollo expuesto, no aceptación ni ajuste de parámetros. No se modificaron el candidato, sus umbrales, las reglas, el protocolo o los resultados originales. No se leyó heldout, importó ONNX Runtime, cargaron pesos, ejecutó inferencia, descargó material ni inició entrenamiento.

## Evidencia reproducible

La ejecución examinada es `artifacts/privacy/rampart-dev-v1-20261110-first/{predictions,score,execution}.json`. DEV3 tiene SHA-256 `511f2da926df75a84a9624147d61bbff189bfa72cd5c931f71f437d41a83552d`, 60 casos, 48 entidades, ocho limpios y cuatro bloqueos requeridos. Los hashes de esos archivos, del adaptador y del tokenizer se registran en [el JSON de evidencia](privacy-token-ner-v1-diagnosis-2026-11-10.json), junto con resultados por caso sin copiar textos originales.

El script [diagnose-privacy-token-ner-v1.mjs](../../scripts/diagnose-privacy-token-ner-v1.mjs) verifica que todas las fuentes congeladas coincidan con la identidad de la ejecución. Reproduce reglas mediante el mismo compositor con un backend vacío simulado y tokeniza texto y rutas con el tokenizer fijado en el entorno Python existente. Comprueba explícitamente que `onnxruntime` no se importe. No llama al worker real. Reproducción sin sobrescribir evidencia:

```sh
node scripts/diagnose-privacy-token-ner-v1.mjs --check
```

El replay exacto de predicciones se contrasta con el score original. El tokenizer tiene SHA-256 `98ade711428b42a1b5343c403a73344535e92de8e19359cdb567ef34da210259`.

## Resultado observado y denominadores

El candidato produjo **13 TP, 41 FP y 35 FN**: precisión micro **24.07%**, recall **27.08%** sobre 48 entidades. El **41.60%**, redondeable a 42%, es precisión **macro** entre nueve categorías con predicciones; excluye las tres categorías sin predicciones y está marcado insuficiente. No es precisión global, porcentaje de documentos protegidos ni anonimización efectiva.

Hubo 30 casos completos y 30 bloqueados. Cuatro bloqueos eran requeridos; los otros 26 son inesperados. Seis de ocho casos limpios completaron sin detecciones; DEV3-050 bloqueó por ambigüedad y DEV3-055 por fallo. Esto no demuestra preservación legal o seguridad de salida.

| Resultado | Total | Requeridos | Inesperados | TP de reglas ocultados |
| --- | ---: | ---: | ---: | ---: |
| detector_failure | 11 | 1 | 10 | 7 |
| ambiguous_context | 17 | 1 | 16 | 10 |
| unsupported_format | 1 | 1 | 0 | 0 |
| partial_extraction | 1 | 1 | 0 | 0 |
| complete | 30 | 0 | 0 | 0 |

## Qué demuestra el replay

**Reglas solas:** 30 TP / 14 FP / 18 FN. El backend aprendido/composición reduce los TP visibles de 30 a 13 al devolver bloqueos con `detections:[]`, ocultando **17 TP de reglas en 17 casos**. Son person 2, RFC 3, CURP 4, CLABE 4, account 1, phone 1, address 1 y case_id 1. Once son RFC/CURP/CLABE. No significa que dichos casos fueran seguros: conservar detecciones diagnósticas bajo bloqueo ayudaría a medir, pero no autoriza completar ni enviar contenido.

Los 13 TP finales son compatibles con resultados de reglas. Las **34 detecciones adicionales**, ausentes de reglas, aportan **0 TP y 34 FP**: person 26, phone 6 y address 2. Los siete FP restantes ya aparecen en reglas. Una detección compatible con reglas también podría coincidir con una predicción aprendida; no se guardó telemetría que permita atribución exclusiva.

De los 41 FP, 12 intersectan una entidad de la misma categoría, 20 otra categoría y nueve ninguna entidad anotada. Entre las intersecciones hay seis fragmentos person sobre nombres completos en DEV3-002/004, nueve person sobre RFC y siete phone sobre account. Ambos nombres completos ya estaban acertados por reglas: unir fragmentos podría reducir duplicados, **no demuestra recuperación de recall** en estos casos. No se implementó ni simuló una reparación guiada por gold.

**Tokenizer solo:** cuatro casos tienen un `[UNK]` en texto y fallan el validador antes de su forward: DEV3-001, 016, 032 y 055. Sus rutas no fallan. Los cuatro están entre los diez detector_failure inesperados. El máximo observado fue 62 tokens, muy por debajo de 512; no se observó overflow ni un fallo de cobertura separado. El guard `unknown_or_offset` es genérico, pero en estos cuatro se confirmó un token ID 1; su presencia basta para rechazo. En un flujo multisegmento, esto no prueba que el runtime alcanzara ese punto antes de otro fallo anterior.

Los seis detector_failure inesperados restantes pasan tokenización. Sus causas pueden incluir confianza baja, BIO inválido, validación de salida u otro fallo del runtime; **no se puede elegir una causa sin logits/diagnóstico que no se guardaron**. Los 16 ambiguous_context inesperados también pasan tokenización y llegan al backend en replay de reglas. La ejecución no distingue etiqueta no mapeada de detección en ruta; no se atribuyen a TAX_ID, CITY u otra etiqueta por conjetura.

## Brechas del diseño

El modelo no tiene etiquetas organization, case_id, context ni sensitive_relation. Las reglas pueden acertar subconjuntos (y lo hicieron), pero estos pesos no proporcionan cobertura aprendida para esas categorías. TAX_ID no equivale necesariamente a RFC y GOVERNMENT_ID no equivale a CURP. Los tipos no mapeados continúan bloqueando. Cambiar de modelo no resuelve por sí solo permisos, ámbito o identificadores indirectos.

La política de BIO estricto, confianza mínima 0.4 sobre todos los tokens y ausencia del premasking de SSN/tarjetas/IP del upstream hacen de éste un candidato distinto. La fragmentación observada justifica estudiar composición, pero no probar reparaciones con el mismo gold hasta mejorar cifras. Los recursos históricos (carga ~111 ms, pico combinado 160,497,664 B) sólo prueban ejecución técnica en esta Mac, no calidad ni aceptación en 8 GB.

## Próximos experimentos acotados, todavía no ejecutados

1. **Instrumentar y corregir composición antes de otro modelo.** Una nueva versión debe conservar detecciones válidas de reglas bajo estado bloqueado y registrar sólo códigos diagnósticos acotados (UNK, overflow, BIO inválido, confianza, tipo no soportado, ruta), sin texto/logits. Predeclarar pruebas sintéticas independientes de subwords/nombres: sólo unir fragmentos cuando offsets, orden BIO y separadores permitidos demuestren continuidad; no cruzar puntuación, entidades incompatibles o rutas. Una política de solapamiento con reglas necesitaría prueba de contención exacta y validación determinista del identificador, conservando el bloqueo frente a cualquier span no cubierto. No suprimir clases no mapeadas ni relajar incertidumbre. Esto mide consistencia del adaptador, no privacidad general.
2. **Sólo después, comparar Nym como experimento separado si persiste la brecha.** Su clase company puede abordar una carencia de Rampart; primero auditar semántica de etiquetas, offsets y coste. Usar una configuración predeclarada y desarrollo nuevo, independiente, sin elegir umbrales con DEV3 ni usar aceptación retenida. Peso mayor no demuestra cobertura de relaciones/contexto, calidad mexicana ni consumo aceptable. Sin descarga o prueba nueva en este diagnóstico.
3. **Adaptación supervisada pequeña sólo si las causas y la taxonomía lo justifican.** Definir antes esquema de span/documento, ejemplos públicos/sintéticos independientes y separación de entrenamiento/desarrollo/examen. Medir confusiones de identificadores, límites de nombres, preservación legal y bloqueos; no convertir este DEV expuesto en evaluación imparcial. Requiere autorización/plan separado de recursos y entrenamiento. No elimina gates deterministas ni prueba anonimización garantizada.

H4 continúa abierto. No hay promoción, proveedor, datos de clientes, cambio de gates o decisión de salida respaldada por este diagnóstico.

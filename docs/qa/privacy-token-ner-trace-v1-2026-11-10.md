# H4b.2d.1: causas observadas con conducta invariante

La primera ejecución instrumentada completó60casos y **coincidió exactamente** en status, razón, detecciones y orden con el baseline Rampart preservado. No cambian pesos, umbral0.4, BIO, reglas, tipos no mapeados, paths o flags operativos. No hay score nuevo o mejora acreditada. [Freeze previo](privacy-token-ner-trace-v1-freeze-2026-11-10.json), [datos y hashes](privacy-token-ner-trace-v1-2026-11-10.json), baseline [QA v1](privacy-token-ner-v1-2026-11-10.md).

La telemetría sólo admite códigos finitos, índice de segmento, text/path y tipo nativo no mapeado; sin texto, tokens, logits o excepciones crudas. El candidato no puede leer corpus, scorers, runners o docs de diagnóstico; perfil no equivale a aislamiento general. Se mantiene un worker/CPU,15s/1GiB y salida exclusiva. La instrumentación no ejecuta reparación, nueva inferencia jurídica o entrenamiento.

| Causa terminal | Casos |
| --- | ---: |
| UNK | 4 |
| BIO_INVALID | 1 |
| LOW_CONFIDENCE | 3 |
| BIO_ORPHAN | 2 |
| UNMAPPED | 16 |
| COMPLETE | 30 |
| Bloqueo operativo previo, sin backend | 4 |

Los16 UNMAPPED se distribuyen en DRIVERS_LICENSE4, GOVERNMENT_ID2, TAX_ID4 y CITY6. Los26fallos terminales del backend están en text:0; **no fueron fallos causados por paths**. Los30 completos terminan normalmente en path:0(29) o path:1(1), lo que no es un fallo de ruta. detector_failure conserva10backend+1operativo y ambiguous_context16unmapped+1operativo. Los resultados originales30completos/30bloqueados permanecen idénticos.

El revisor previo halló que una divergencia dejaba directorio vacío. Corregido: failure.json exclusivo conserva binding, prefijo validado y código acotado, invariancePassed:false, sin score o excepción cruda; también ante backend parcial o fallo de identidad/publicación. Tests prueban divergencia60, parcial2, telemetría inválida, nooverwrite y sentinelas omitidos. Builder/revisor39/39 pasan. La ejecución real no divergió; revisor posterior verificó exactamente los60resultados, bindings y agregados sin otra inferencia o red.

Pico parcial161.513.472B, carga100,32ms, p50/p95/máximo11,41/16,38/21,21ms sólo diagnóstico en este Mac. No certifica8GB, equivalencia upstream, anonimización, protección general o salida autorizada. La evidencia permite diseñar una composición nueva que pruebe contención de spans sin omitir señales; no autoriza convertir TAX_ID en RFC por nombre, ocultar misses o elegir modelo con el examen300.

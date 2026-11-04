# W5: recuperación coloquial y continuidad del hilo

Alcance: sólo biblioteca pública y pruebas sintéticas. No se leyó `eval/areas/cases.jsonl` para construir vocabulario ni se incorporaron frases retenidas. El evaluador y sus pruebas sí cargan ese archivo para medir. No se cambiaron casos, interfaz, corpus, índice, dependencias o modelos; no hubo commit/push/instalaciones.

## Vocabulario y procedencia

`resources/legal-thesaurus.json` contiene 57 conceptos de diez áreas y 174 términos jurídicos. `server/retrieval/build-thesaurus.mjs` reproduce el archivo a partir de definiciones editoriales y `resources/public-library.sqlite`, sin importar evaluación. Cada término se verifica contra el texto público; cada ancla registra artículo, URL, versión, fecha de recuperación, hash del texto, hash del PDF y extractos literales. Las expresiones coloquiales son sintéticas y los conceptos no determinan aplicabilidad jurídica ni vigencia.

`expandQuery` separa expansión y evidencia. La materia detectada filtra candidatos; las asociaciones de artículos rectores aportan prioridad al ranking, sin inventar una referencia explícita en la pregunta. Las referencias expresas siguen prevaleciendo. Los resultados generales diversifican por artículo; la selección expresa conserva sus fracciones. Las anclas federales se excluyen para jurisdicciones estatales. El buscador sigue exigiendo igualdad de jurisdicción en SQL, versión almacenada más reciente y verificación de hashes/offsets.

## Integración mínima

En `server/service.mjs`, `retrieveAutomatic` carga `retrieval/automatic.mjs`, recibe los seis turnos recientes del mismo despacho/asunto/hilo y entrega pregunta original, jurisdicción, biblioteca y resultados previos al adaptador. El adaptador conserva IDs `PUB-` e hidrata el artículo canónico para que citas y evaluador sigan resolviendo exactamente la misma fuente. La búsqueda documental privada no cambia.

El índice derivado se abre sólo para una biblioteca pública con hash coincidente. Si falta el índice, no hay metadatos de biblioteca o se consulta la ruta estatal, se conserva el camino existente; un índice corrupto no se oculta. No se construye ni descarga nada durante la consulta. Los seguimientos se reescriben con turnos del usuario; texto de assistant/system/tool no se incorpora como nuevas instrucciones. La navegación usa el sucesor almacenado, sin calcular números hipotéticos.

La selección para el contexto respeta el límite existente de 600 caracteres; una referencia directa sin tema conserva el inicio, y una consulta temática prioriza el fragmento pertinente. La segmentación sigue siendo aproximada cuando el extractor original perdió párrafos.

## Verificación y medición

Los comandos se ejecutan sin loopback ni inferencia real:

```sh
node server/retrieval/build-thesaurus.mjs
node --test tests/retrieval-*.test.mjs tests/unified-agent.test.mjs tests/unified-assistant.test.mjs tests/legal-reference-scope.test.mjs tests/conversation-threads.test.mjs tests/eval-areas.test.mjs
node scripts/eval-areas.mjs --retrieval --output-dir server/retrieval/measurements/before
node scripts/eval-areas.mjs --retrieval --output-dir server/retrieval/measurements/final-optimized
```

Los resultados completos conservan fallos y hashes de implementación. El tesauro no se ajusta a preguntas, artículos esperados ni pasajes esperados del archivo retenido. La métrica usa el último turno y tres fuentes. La inferencia simulada no mide razonamiento, precisión jurídica ni funcionamiento en 8 GB.

El reescritor reconoce también el vocabulario de seguimiento del router existente. Una hipótesis elimina la referencia exacta vieja de la consulta, pero puede conservarla como candidato con prioridad si sigue en la misma área y jurisdicción; una pregunta de otra materia no la hereda. Los títulos oficiales se consumen del más largo al más corto para no tratar como autoridad independiente la Constitución mencionada dentro del título de una ley reglamentaria.

La corrida intermedia `measurements/after/` mostró regresiones de integración: áreas `otros` aplicadas como filtro, títulos contenidos dentro de otros y pérdida de contexto hipotético. Se conservaron sus resultados. Las correcciones se verificaron con pruebas sintéticas del contrato, sin modificar el tesauro ni consultar frases retenidas. La corrida definitiva usa `--output-dir server/retrieval/measurements/final-optimized`; `final/` conserva la corrida lenta invalidada por cambios en disco.

Suite final: 61 pruebas aprobadas, cero fallos; salida completa en `measurements/tests.txt`. Incluye procedencia de todo el tesauro, diez áreas, aislamiento territorial, citas/offsets, referencias explícitas, títulos oficiales, cambios de tema y compatibilidad con los hilos de conversación. No se ejecutó inferencia real ni se intentó abrir loopback. dsystem se aplicó con implementación y revisión en Codex; no se atribuyen aportes a otros modelos.

## Resultado definitivo

Objetivo global cumplido: artículo hit@3 coloquial **6/60 (10%) → 33/60 (55%)**; directas **60/60 → 60/60**; seguimientos **24/40 (60%) → 25/40 (62,5%)**. Artículo global **90/160 → 118/160**. Fragmento global **58/160 → 81/160**. Cero errores en las dos ejecuciones comparadas y cero archivos de implementación cambiados durante ellas.

Valores antes → después. Cada área tiene seis preguntas directas, seis coloquiales y cuatro seguimientos positivos.

| Área | Directa /6 | Coloquial /6 | Seguimiento /4 | Artículo /16 | Fragmento /16 |
|---|---:|---:|---:|---:|---:|
| constitucional | 6 → 6 | 0 → 1 | 2 → 2 | 8 → 9 | 7 → 5 |
| civil | 6 → 6 | 0 → 4 | 2 → 4 | 8 → 14 | 6 → 11 |
| familiar | 6 → 6 | 0 → 2 | 2 → 3 | 8 → 11 | 7 → 10 |
| penal | 6 → 6 | 2 → 3 | 2 → 2 | 10 → 11 | 2 → 4 |
| laboral | 6 → 6 | 1 → 5 | 4 → 3 | 11 → 14 | 11 → 14 |
| mercantil | 6 → 6 | 1 → 4 | 3 → 3 | 10 → 13 | 7 → 8 |
| fiscal | 6 → 6 | 2 → 4 | 3 → 3 | 11 → 13 | 8 → 10 |
| amparo | 6 → 6 | 0 → 4 | 2 → 1 | 8 → 11 | 1 → 6 |
| administrativo | 6 → 6 | 0 → 4 | 1 → 2 | 7 → 12 | 4 → 8 |
| seguridad-social | 6 → 6 | 0 → 2 | 3 → 2 | 9 → 10 | 5 → 5 |

La mejora agregada no elimina las debilidades: coloquiales constitucional 1/6, familiar 2/6 y seguridad social 2/6. Los seguimientos bajan laboral 4→3, amparo 2→1 y seguridad social 3→2; los fragmentos constitucional bajan 7→5. No se agregaron frases ni anclas a partir de estos fallos retenidos. Amparo mejora fragmentos 1→6 y penal 2→4, todavía con cobertura baja.

- [Línea base JSON](./measurements/before/2026-11-03T15-57-21-720Z-retrieval.json) y [tabla](./measurements/before/2026-11-03T15-57-21-720Z-retrieval.md).
- [Resultado final JSON](./measurements/final-optimized/2026-11-03T16-10-45-978Z-retrieval.json) y [tabla](./measurements/final-optimized/2026-11-03T16-10-45-978Z-retrieval.md).
- [Hashes adicionales de entradas](./measurements/inputs.json), [61 pruebas](./measurements/tests.txt), [incidencia de la corrida intermedia](./measurements/intermediate-run.txt).

El sandbox bloqueó `ps` y el intento de detener el proceso de evaluación anterior (`operation not permitted`). Este último siguió con los módulos antiguos y su reporte se invalida al detectar cambios en disco. La corrida final estable terminó completa; la anterior no cuenta para el resultado. No se requirieron sockets ni loopback para pruebas o evaluación.

La consulta FTS final materializa los scores una vez y fija el orden de joins; aplica área, jurisdicción, versión y fracción antes del límite de resultados. El p95 final por área estuvo entre 42,8 y 58,7 ms por turno (línea base: 5,9–17,3 ms). La recuperación nueva sigue costando más que la anterior. Hubo otra evaluación activa durante esta corrida: estas latencias son observaciones, no un benchmark aislado ni una validación en 8 GB.

El tesauro es idéntico entre la primera evaluación posterior y la definitiva. Sólo se corrigieron integración, reescritura, referencias y plan SQL. El proceso del evaluador no mide fidelidad del modelo ni aptitud jurídica.

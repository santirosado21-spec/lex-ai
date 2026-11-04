# Evaluación retenida por área — W1

200 casos sintéticos, 20 por área. No contiene documentos de clientes. Consulta el snapshot público de `resources/public-library.sqlite`, no una afirmación de derecho vigente. Las fuentes oficiales, versiones, fecha de recuperación y hashes están en cada ancla de `cases.jsonl`; `manifest.json` fija hashes del dataset y de la biblioteca. Codex redactó las preguntas; no se cargó el motor local ni se delegó su construcción.

Por área: seis preguntas directas, seis coloquiales sin nombrar el ordenamiento, cuatro conversaciones de dos o tres turnos de usuario, dos casos de abstención/jurisdicción y dos de charla. Total: 160 casos con evidencia esperada, 20 negativos, 20 de charla; 260 turnos. Las respuestas del asistente se generan durante la ejecución y permanecen en su propio `threadId`; no se inyectan respuestas ideales ni evidencia esperada al recuperador.

Las seis preguntas temáticas de cada área se reutilizan con distintas formulaciones: son **60 anclas únicas**, no 160 problemas independientes. Familiar consulta el texto del código nacional; no presupone su aplicación territorial o temporal. Civil positivo delimita expresamente materia federal. Las preguntas estatales sin fuente exigen abstención o aclaración y no sustitución federal.

## heldOutLaws

Lista canónica para consumidores: `manifest.json.heldOutLaws[].law_id`. Excluir **toda la ley, todas sus versiones, artículos, fragmentos, paráfrasis y diálogos derivados** del entrenamiento, selección de ejemplos y ajuste de hiperparámetros; excluir también su uso como distractor en RAFT. No excluirlas de la biblioteca de recuperación: ésta es evidencia de consulta, no entrenamiento. Aplicar la exclusión por `law_id`/`lawId`/`splitGroup`, antes de dividir por ejemplos.

| Área | law_id retenido | Ordenamiento |
|---|---|---|
| constitucional | MX-FED-CPEUM | Constitución Política de los Estados Unidos Mexicanos |
| civil | MX-FED-CCF | Código Civil Federal |
| familiar | MX-FED-CNPCF | Código Nacional de Procedimientos Civiles y Familiares |
| penal | MX-FED-CNPP | Código Nacional de Procedimientos Penales |
| laboral | MX-FED-LFT | Ley Federal del Trabajo |
| mercantil | MX-FED-CCOM | Código de Comercio |
| fiscal | MX-FED-CFF | Código Fiscal de la Federación |
| amparo | MX-FED-LAMP | Ley de Amparo, Reglamentaria de los artículos 103 y 107 de la Constitución Política de los Estados Unidos Mexicanos |
| administrativo | MX-FED-LFPA | Ley Federal de Procedimiento Administrativo |
| seguridad-social | MX-FED-LSS | Ley del Seguro Social |

**Retención prospectiva, todavía no acreditada para candidatos entrenados.** Las diez leyes tienen `split: train` en el snapshot existente. Este manifiesto es una exclusión nueva que debe prevalecer en el constructor de entrenamiento; W1 no modifica ese constructor ni la base SQLite. No sabemos si los candidatos existentes ya vieron estas leyes. Antes de llamar a un candidato “evaluado con leyes no vistas”, auditar sus datos y verificar intersección vacía con esta lista. Los resultados actuales son una línea base de comportamiento/recuperación, no una estimación libre de contaminación. Si se usan estos casos para ajustar el sistema, preparar otra evaluación sellada para la decisión final.

## Esquema

- `id`, `area`, `type`, `synthetic: true`, `turns: [{role: "user", content}]`.
- `expected.laws`: IDs de leyes aceptadas; `expected.articles`: pares `{law_id, article, article_id, expectedFragment}`. `article_id` es la clave real de `articles.id`, no un número fabricado.
- Exactamente una bandera verdadera: `mustCite`, `mustAbstain`, `mustAskJurisdiction` o `chatOnly`.
- `provenance`: anclas con `law_id`, número, clave SQLite, identificador original, fragmento literal, URL oficial, versión, fecha y hashes.
- En negativos, la procedencia lleva `boundary-only-not-answer-evidence`: documenta la frontera de cobertura, no una fuente que deba citarse. Sus objetivos de cita están vacíos. En charla, procedencia y objetivos están vacíos: añadir una ley artificialmente sesgaría la evaluación.

## Ejecución

Desde la raíz, Node compatible con `node:sqlite`, sin instalar dependencias:

```sh
node --test tests/eval-areas.test.mjs
node scripts/eval-areas.mjs --retrieval
node scripts/eval-areas.mjs --live --models-dir "/ruta/al/almacen/local/existente"
npm test
```

Opcionales de `--live`: `--runtime-path /ruta/al/ejecutable` y `--catalog /ruta/catalogo.json` para un candidato previamente preparado y verificable. Opcionales generales: `--library-path` y `--output-dir`. Una biblioteca distinta del snapshot fijado falla explícitamente. No se inicia ninguna inferencia real por omisión; es obligatorio elegir exactamente un modo. `--live` exige un almacén existente, prohíbe descargas y evita copiar recursos empaquetados. Su inicialización puede necesitar loopback local; un bloqueo del sandbox queda como fallo, no como prueba aprobada. No modifica el espacio real de trabajo del usuario, ni importa documentos, ni inicia programadores de tareas. Sólo crea un espacio sintético temporal y lo elimina al cerrar. El motor puede mantener índices/cachés propios dentro del almacén de modelos indicado.

La salida es `artifacts/eval-areas/<fecha-UTC>-<modo>.json` y `.md`, sin sobrescribir ejecuciones previas. JSON conserva los pasajes realmente enviados, respuesta, citas, errores, latencia por turno, hashes del código y resultados por tipo. Cambios concurrentes en los archivos relevantes invalidan la ejecución. Una inicialización fallida también produce informe y código de salida distinto de cero; no rellena métricas ficticias.

`node eval/areas/build-cases.mjs` reconstruye ambos archivos del dataset desde las especificaciones curadas y los artículos existentes, comprobando cada fragmento. Ejecutarlo sólo al crear una nueva versión revisada de la evaluación; nunca adaptar los casos a los fallos de un candidato. Los tests comprueban integridad y procedencia al cargar el snapshot.

## Qué se mide

**Recuperación:** `createService` recibe la biblioteca real y una inferencia simulada por inyección de dependencias. Un envoltorio observa `getSource` y el contexto que llega a `generate`; no replica ni altera búsqueda/ranking. Se observan los tres pasajes realmente seleccionados, tras recorte. El simulador produce una respuesta estructural válida con esas fuentes para permitir que el propio servicio persista el historial. No recibe las respuestas esperadas. El hit@3 de ley y de par ley/artículo se calcula sobre el último turno de cada caso positivo completo; denominador 16 por área. El hit del fragmento exige además que el texto esperado esté en el pasaje enviado. Un caso incompleto cuenta como fallo. JSON permite inspeccionar también el primer turno y los seguimientos y separa directa/coloquial/seguimiento. Abstenciones y charla no entran en hit@3.

**Live:** utiliza `createInference` y envía todos los turnos por `service.analyze({mode:"auto",skillId:"auto",threadId})`. Fidelidad de cita contrasta ID, ley/artículo, fragmento literal en la fuente original **y en el pasaje enviado**, y referencia en la respuesta. `mustCite` exige al menos una cita al objetivo esperado, todas las citas válidas y ningún identificador desconocido. Citar otra ley correctamente no aprueba el caso. Las citas rechazadas por el servicio producen errores y hacen fallar el caso; la precisión sobre citas publicadas debe leerse junto a `mustCite` y errores, pues el servidor ya filtra citas inválidas.

Abstención exige una respuesta sin citas que reconozca falta de evidencia y solicite fuente/disposición. Jurisdicción exige preguntar el estado/entidad/jurisdicción, sin citas. Charla exige respuesta de tipo chat sin metadatos de citas, corchetes de referencia, artículos numerados ni URLs. Los errores de inferencia nunca aprueban abstención. Cada expectativa conductual debe cumplirse en **todos** los turnos del caso. Denominadores vacíos se muestran como `null`/“—”, nunca como 100%. Latencia de pared incluye recuperación, generación, validación y persistencia; se reporta media/p50/p95 por turno. En recuperación es latencia con simulador, no rendimiento del motor.

## Límites

No se califica calidad jurídica semántica ni naturalidad con estas reglas. Las coincidencias de texto y expresiones de abstención son proxies conservadores que pueden tener falsos negativos; JSON deja la evidencia para revisión. Las respuestas simuladas influyen en el contexto de seguimiento; sólo una ejecución live mide la conversación real. No hay prueba de vigencia, revisión de abogados, cobertura de todas las leyes de cada área, robustez a distractores diseñados expresamente ni validación en máquinas de 8 GB. El entrenamiento base y candidatos previos pueden estar contaminados. La medición no acredita aptitud profesional.

Trabajo implementado y verificado por Codex; no se atribuye generación, revisión ni resultados a otros modelos.

## Registro de ejecución W1 — 2026-11-03

- `node eval/areas/build-cases.mjs`: salida 0; 200 casos y diez leyes excluidas.
- `node --test tests/eval-areas.test.mjs`: salida 0; 13/13 en la última corrida específica. Después se añadió la prueba de preflight live, incluida y aprobada en `npm test` (14 pruebas W1).
- `node scripts/eval-areas.mjs --retrieval`: corrida final `2026-11-03T15-43-56-843Z`, salida 0, 200 casos/260 turnos, cero errores, sin cambios detectados durante la corrida. Informes [JSON](../../artifacts/eval-areas/2026-11-03T15-43-56-843Z-retrieval.json) y [Markdown](../../artifacts/eval-areas/2026-11-03T15-43-56-843Z-retrieval.md). Artículo hit@3 agregado: 90/160; directas 60/60, coloquiales 6/60, seguimientos 24/40. Los informes son artefactos locales y pueden estar ignorados por Git.
- Se conserva también `2026-11-03T15-42-33-338Z-retrieval`: corrida inicial con tres errores. Incluía un defecto del simulador (intentaba citar fragmentos excluidos por el esquema) y después cambiaron archivos ajenos del servicio. No usar esa corrida como resultado final ni atribuir diferencias exclusivamente al producto. Se corrigió sólo el evaluador y se añadió una regresión para respetar los pares fuente/cita del esquema.
- `node --check scripts/eval-areas.mjs`: salida 0.
- `npm test`: salida 1; **316 pruebas, 311 aprobadas, cinco fallidas**, cero omitidas/canceladas. Las cinco fallan con `listen EPERM: operation not permitted 127.0.0.1` al abrir servidores locales. Las 14 pruebas W1 pasan. Registro completo de esa ejecución: `/tmp/lex-w1-npm-test.log`.
- No se ejecutó inferencia real. El preflight live sin almacén explícito sólo verifica que se emita un informe de fallo sin métricas inventadas. No hubo commit, push, instalación de paquetes ni modificaciones propias en `server/` o `src/`.

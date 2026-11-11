# Evaluación experimental del detector local — H4a

Este directorio conserva el protocolo H4a y el primer examen de H4b.1. Ya se implementó y puntuó una vez un baseline real de reglas: falló los criterios y permanece inactivo. Todos los registros son sintéticos. El runner es una herramienta de desarrollo; no se importa desde el servidor ni autoriza envíos.

## Entradas retenidas y protocolo

- `protocol.json`: categorías, formato, mínimos, métricas, criterios experimentales y límites de recursos fijados antes del examen definitivo.
- `annotation-guide.md`: límites operativos de cada categoría, anotaciones superpuestas, negativos y ambigüedad. Su hash forma parte del protocolo.
- `dev.jsonl`: ejemplos de desarrollo; puede usarse para construir H4b.
- `heldout.jsonl`: examen de autor independiente. **No entregarlo a generadores, entrenamiento, afinado o selección iterativa de detector.**
- `heldout-provenance.json`: declaración del autor, modelo configurado/observado cuando consta, semilla/metodología, fuentes y comprobación de rangos. Es evidencia de proceso, no autenticación criptográfica.
- `manifest.json`: hashes de protocolo, guía, procedencia y corpus, más declaraciones de congelación/independencia. Un hash verifica integridad frente al manifiesto; no demuestra la veracidad de etiquetas o autoría.

Se archivó un primer corpus sin puntuar al detectarse que faltaba una guía de límites suficientemente explícita. El examen definitivo fue creado con nueva semilla después de congelar la guía/protocolo corregidos. No se modificaron los umbrales por resultados. Se conserva el hash de la versión retirada en la procedencia; los archivos originales permanecen fuera del PR en artefactos locales.

El examen es público/versionado para reproducibilidad: «retenido» describe una regla de uso, no confidencialidad técnica. Cualquier uso para corregir o seleccionar el detector retira el examen completo como prueba final y exige una nueva versión independiente. La validación estructural y revisión de anotaciones de H4a no son una medición de rendimiento del detector.

## Comandos

Validar integridad, estructura, cobertura mínima e independencia entre splits, sin inferencia ni candidato:

```sh
node scripts/eval-privacy.mjs validate --manifest eval/privacy/manifest.json
```

Pruebas del evaluador con casos mínimos de tests, independientes del examen real:

```sh
node --test tests/privacy-evaluation.test.mjs
```

Puntuar predicciones de un candidato **en una futura evaluación autorizada**, identificando explícitamente split, versiones y salida:

```sh
node scripts/eval-privacy.mjs score --manifest eval/privacy/manifest.json --split dev --predictions artifacts/privacy/candidate-dev.json --output artifacts/privacy/report-dev.json
```

El directorio de salida debe existir; usar un nombre que no sea una entrada de evaluación. Reemplazar `dev` por `heldout` es una ejecución de examen y requiere un candidato congelado/protocolo independiente; no ejecutar para afinar. No existe opción `oracle`, plugin, descarga, llamada a modelos o creación automática de predicciones. Ausencia de candidato o hashes/rangos inválidos no puede producir un pase.

Artefacto de predicción: `candidateId`, `protocolSha256`, `corpusSha256` y una lista `predictions` con exactamente un `{id,status,detections}` por caso. `status` es `complete` o `blocked`, una declaración del componente, nunca permiso de salida. Cada detección tiene `segmentId,start,end,category`, en unidades UTF-16 del texto original. No se aceptan duplicados, casos extra/ausentes o límites que dividan pares sustitutos.

Códigos de salida: `validate` válido 0; corpus insuficiente 1; entrada/comando inválido 2. `score` elegible experimental 0, criterios fallidos 1, entrada inválida 2, desarrollo diagnóstico o heldout insuficiente 3. Leer el campo de estado completo; 0 en `validate` significa solo corpus válido. Desarrollo no declara promoción aunque sus métricas sean perfectas.

## Qué se mide y qué queda abierto

Exacto y solapamiento se emparejan por separado, uno a uno, con cardinalidad máxima. Se informan TP/FP/FN, micro/macro con denominadores, intervalos Wilson y límite de omisión compatible con una muestra sin fallos. Una categoría sin datos queda insuficiente. Los intervalos binomiales asumen independencia; plantillas y entidades repetidas pueden correlacionarse, por lo que no acotan el riesgo real del producto. Los umbrales numéricos son decisiones experimentales previas; no son garantías de privacidad. Referencia metodológica: [intervalos binomiales y Wilson en statsmodels](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.proportion_confint.html); no se añade esa biblioteca como dependencia.

El scorer siempre informa `routingSafety` y `preservation` como `not-evaluated`. Que una predicción diga `blocked` no demuestra cero bytes enviados; H4b debe ejecutar el detector real dentro de H3V y observar el transporte. Las anotaciones `preserve` no demuestran fidelidad: hay que comparar textos/fechas/importes/citas tras proteger/restituir.

## Referencia de recursos

```sh
.desktop/app/runtime/node scripts/measure-privacy-baseline.mjs --output artifacts/privacy/baseline.json
```

El comando usa una carpeta temporal sintética, 4 asuntos, 20 documentos y la UI compilada actual en Chromium headless. No inicializa un modelo. Registra revisión fuente, hashes del código y assets, versión del navegador, RSS y limitaciones. `docs/qa/privacy-baseline-2026-11-09.json` es la medición de esta entrega; no es un benchmark nativo Tauri, detector, inferencia jurídica o máquina física de 8 GB. H4b medirá candidato/base en corridas equivalentes y H5a congelará contratos antes de su cierre.

Contrato completo: [privacy-classification-v1.md](../../docs/architecture/privacy-classification-v1.md). Evidencia: [H4a QA](../../docs/qa/hybrid-H4a-2026-11-09.md).


## Primer baseline medido — H4b.1

`local-rules-baseline-v1` se congeló en seis fuentes antes de una única ejecución independiente: [freeze](../../docs/qa/privacy-detector-freeze-2026-11-09.json), [QA](../../docs/qa/hybrid-H4b-2026-11-09.md), [predicciones/métricas/ejecución](../../docs/qa/privacy-detector-heldout-2026-11-09.json), [recursos pareados](../../docs/qa/privacy-detector-resources-2026-11-09.json). Precisión exacta micro 31,52 %, recobrado 56,38 %; **FAILED**, sin elegibilidad o activación. No ajustar umbrales por este resultado.

El candidato no recibió IDs de caso, anotaciones o motivos esperados: el harness proyecta entrada permitida y el worker separado solo registra procedencia pública/sintética del fixture. El autor de código no vio el examen/resultados. El corpus v1 no tiene flags operativos de formato/extracción/ambigüedad/fallo: no inventarlos desde gold para lograr bloqueos. Pruebas de integración sí ejercitan señales locales independientes. El próximo protocolo debe solucionar esa limitación con nuevas entradas y examen independiente.

**V1 retirado de afinación y selección futuras:** se preserva para trazabilidad/reproducir la puntuación guardada; no reutilizarlo como examen final ni iterar candidatos sobre sus respuestas. El manifiesto y la declaración `candidateEvaluated:false` se conservan como artefacto congelado de la creación H4a, no como estado actual: este registro posterior documenta su ejecución real. Construir/afinar únicamente con desarrollo y reservar un v2 nuevo antes de otra decisión.

El runner developer-only es `scripts/run-privacy-detector.mjs`; desarrollo requiere `--split dev --out-dir artifacts/privacy/<directorio-nuevo>` y retorna 3 diagnóstico. Heldout exige un freeze de fuentes/protocolo/corpus aprobado; el freeze publicado autorizó **una** corrida ya ejecutada, no repeticiones para afinar. El scorer anterior sigue admitiendo el artefacto guardado para reproducir sus métricas. Ninguno de esos comandos concede egreso.

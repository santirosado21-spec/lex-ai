# Fábrica pública de documentos jurídicos — C0/C1

Fecha: 2026-11-09. Worker/CLI de desarrollo y procesamiento de servidor, fuera del runtime interactivo del cliente. No despliega infraestructura ni habilita un proveedor de inferencia. Su primera ejecución pública se registra en QA, separada de las pruebas sintéticas.

## Dos flujos distintos

El producto objetivo usa **local → nube → local**: el componente pequeño local detecta/sustituye datos, conserva el mapa por despacho/asunto/hilo y versión; la solicitud completa se autoriza antes del envío; la nube produce el trabajo; local restituye únicamente correspondencias autorizadas, valida evidencia/versiones y muestra/guarda el resultado. Las correspondencias, originales privados y controles de claves/acceso no se delegan al modelo. Una sustitución reversible es seudonimización; los hechos/contexto también pueden reidentificar.

C0/C1 construye otro flujo: **fuentes jurídicas públicas → originales/versiones → extracción en cuarentena → revisión → publicación futura**. No recibe expedientes, consultas privadas o cuentas de clientes y no necesita un LLM para reescribir texto normativo. Preparación/OCR/indexación pesada pertenece a la fábrica de servidor, no a cada computadora del abogado. El piloto de desarrollo no implica que esa carga deba ejecutarse en el cliente ni que ya esté desplegada en nube.

La app actual no cambia de motor por añadir estos módulos. H4b aún necesita detector semántico elegible, H5 paridad/custodia/recuperación, H6 proveedor/presupuesto y H7 integración completa. Los tests H3V anteriores prueban composición sin red; no se presentan como llamadas reales a nube o autorización de clientes.

## C0: autoridad y plan cerrado

Archivos: `server/corpus/source-registry.mjs`, `resources/legal-acquisition-pilot.json`.

El registro lo revisa el operador de desarrollo. Admite fuentes aprobadas, pendientes o bloqueadas y documentos concretos o plazas pendientes. Documentos privados, destinos desconocidos, presupuestos inválidos y selección explícita de un pendiente se rechazan. El mapa de 32 entidades de la investigación no se convierte automáticamente en allowlist.

API: `validateAcquisitionRegistry`, `buildAcquisitionPlan`, `verifyAcquisitionPlan`. Se validan campos exactos, JSON sin getters/ciclos, ámbito público, fuente/versión/evidencia y límites. El plan contiene el registro, selección, pendientes y digest canónico; verificación reconstruye también su semántica, no solo el hash. Sus objetos son copias inmutables.

**El SHA liga integridad, no autentica al revisor.** No exponer el constructor como herramienta de un agente o aceptar un registro propuesto por documento/usuario remoto como autoridad. El CLI es una herramienta del operador, no una API pública que concede permisos.

La versión del documento en el registro identifica el índice/selección revisada. El PDF adquirido recibe identidad independiente por SHA-256; ninguna de esas identidades demuestra entrada en vigor o fecha aplicable.

Registro inicial: 30 plazas planificadas, 10 PDFs federales exactos seleccionados del índice oficial y 20 pendientes sin URL (16 estatales, 4 judiciales). No hay 30 leyes descubiertas/adquiridas. La base operativa del ensayo público, snapshot de índice y robots está en [revisión de fuentes](../qa/public-acquisition-source-review-2026-11-09.json). El permiso del ensayo no declara redistribución comercial, exactitud o vigencia validadas. Un robots404 tampoco es una licencia.

## C1: adquisición y extracción acotadas

Archivos: `server/corpus/acquisition.mjs`, `scripts/legal-acquisition.mjs`.

Se conserva `runLegalSync` y `parsePdfInWorker`; no se amplía la allowlist existente, TLS ni controles robots/redirección. No se incorpora Crawlee en esta primera selección de URLs exactas: la cola/orquestación se decidirá cuando un conector de descubrimiento medido lo necesite, sin duplicar controles ya implementados.

Límites superiores de este piloto: 30 documentos, 100 solicitudes HTTP (incluidos robots/redirecciones), 100 MiB de cuerpos consumidos, 20 MiB/documento, 30 minutos, concurrencia 1, intervalo mínimo 2 segundos, timeout por solicitud 45 segundos, cero reintentos y hasta tres redirecciones dentro del plan autorizado. La política del sitio puede imponer una espera mayor o impedir adquisición. El límite de bytes se refiere a cuerpos decodificados consumidos por el fetch, no a todos los bytes de red/TLS/cabeceras ni a coste facturado.

El plan se verifica antes de red. La fábrica usa un directorio propio con bloqueo y rechaza rutas/symlinks/manifiestos inconsistentes. No admite rutas de expedientes. El CLI tiene planificación por defecto; `--live` permite solo documentos aprobados, y `--offline` reproduce snapshots sin red. La ejecución entrega recibo de plan/registro/configuración y estado explícito de los pendientes/fallos.

Originales y versiones previas se conservan. Extracción se liga a hash del PDF, metadatos completos del documento y fuente, parser, límites y política, sin confundir una captura nueva con cambio jurídico. Cache inválida o extracción manipulada no se reutiliza silenciosamente; los bytes previos válidos sobreviven a fallo de descarga/extracción. Repetición offline con misma configuración debe ser idempotente; cambio de metadatos/parser/política exige nueva extracción conservando trazabilidad.

Cada respuesta recibida registra URL exacta, estado HTTP, MIME sin parámetros, bytes decodificados y hash del cuerpo. `versions/<documento>/<SHA>.json` conserva evidencia inmutable del original; una reproducción de snapshots anteriores sin recibo HTTP deja el MIME desconocido, sin inventarlo. Las fechas declaradas extraídas se guardan por separado de la captura y de la vigencia, que permanece desconocida.

Salida con referencias de páginas, hash de texto y artefacto estructurado; no se inventan hashes de páginas crudas que el parser no devuelve. La extracción existente puede normalizar espacios y segmenta cuerpo operativo; no es preservación visual exacta, OCR ni cobertura completa de transitorios. Conservar siempre el PDF íntegro. `textReview` y `legalReview` permanecen pendientes; no se llama a `exportLibrary`, publica índice o genera dataset de entrenamiento por el piloto.

## Comprobación y extensión

Pruebas sintéticas: política pendiente/privado, URLs/plan manipulados, límites antes/durante red, robots, redirección, cancelación, archivos ajenos, integridad, cache/parser y repetición/versiones. La prueba pública posterior usa solo el registro revisado y registra resultados reales, errores, tiempo, bytes y memoria observada si se mide externamente. El límite del heap del parser no es una medición RSS ni valida un equipo de 8 GB.

Criterios de cierre C0: planes verificables, pendientes explícitos, tests y revisión independiente. El corte C1a entrega fábrica comprobada, primer lote federal medido y reproducción offline/integridad; C1 completo conserva las 20 plazas estatales/judiciales pendientes del plan de 30. Esto no cierra C2/C3 de fidelidad/transitorios/OCR, C4 de demo/citas/revisión jurídica o C5 de expansión nacional. Ningún fallo se convierte en documento omitido del denominador sin quedar registrado.

## Reproducir el ensayo

```sh
# Plan sin solicitudes HTTP (modo predeterminado).
node scripts/legal-acquisition.mjs --plan
# Elegir un directorio NUEVO bajo artifacts/public-corpus para medir adquisición.
node scripts/legal-acquisition.mjs --live --out artifacts/public-corpus/mi-ensayo
# Sobre ese mismo directorio: integridad y caché sin red.
node scripts/legal-acquisition.mjs --offline --out artifacts/public-corpus/mi-ensayo
node --test tests/corpus-source-registry.test.mjs tests/corpus-acquisition.test.mjs
```

`report.json` refleja la última ejecución; conservar una copia antes de reproducir offline si se necesita comparar ambos informes. Los PDFs, texto extraído y logs se guardan en `artifacts/`, ignorado por Git. El QA versionado contiene métricas y hashes, no los originales ni el corpus íntegro.

El despliegue de servidor y razonamiento remoto requieren configuración/acceso y presupuesto propios cuando corresponda. La biblioteca pública central nunca vuelve pública una consulta derivada de un asunto privado: también debe respetar preparación/política antes de buscar remotamente.

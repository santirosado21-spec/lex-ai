# Biblioteca pública de instrumentos federales

Esta biblioteca es un conjunto de textos de fuentes oficiales para investigación y entrenamiento local. Está separada del corpus aprobado de 21 artículos y de los asuntos de clientes. Su extracción estructural no equivale a revisión jurídica ni prueba de vigencia.

## Procedencia y descubrimiento

`node scripts/corpus-discovery.mjs` consulta robots.txt y el índice oficial de Cámara de Diputados por HTTPS. `--from-file artifacts/legal-library/discovery/index.html` permite analizar una captura previamente descargada y registra que la captura fue importada. `--compare-repositories` compara referencias explícitas a PDFs oficiales en READMEs de los tres repositorios candidatos documentados en `docs/architecture/legal-repositories.md`; no ejecuta código ni incorpora textos de terceros. Los repositorios son pistas, nunca autoridad legal.

La primera captura produjo 317 enlaces principales únicos a PDF. El parser excluye versiones móviles duplicadas y destinos ajenos, conserva los títulos y celdas originales del índice y registra anomalías. La cobertura corresponde a esa captura: no representa todas las leyes mexicanas, reglamentos, jurisprudencia o legislación estatal. La codificación detectada fue windows-1252 pese a metadatos HTML históricos.

## Importación y versiones

`node scripts/corpus-ingest.mjs --limit 40` prioriza instrumentos federales comunes. Incrementar `--limit` amplía gradualmente el conjunto. Descarga secuencial; máximo 20 MiB por PDF, 45 segundos por petición, un reintento transitorio, dos segundos entre solicitudes, robots por origen, validación TLS y de cada redirección, allowlist HTTPS. El presupuesto conservador de descarga es 1 GiB y se exige al menos 2 GiB libres. Ninguna excepción permite omitir TLS o robots. Dos procesos no pueden importar simultáneamente: `ingest.lock` requiere revisión manual si quedó huérfano.

`--offline` vuelve a extraer/exportar únicamente las versiones ya disponibles. Caché por hash SHA-256 del PDF y versión de extractor. El archivo adquirido nunca se modifica; cada versión tiene URL, fecha de recuperación, validadores HTTP y hash. ETag/Last-Modified/hash permiten reanudar. Los fallos no eliminan snapshots anteriores. La exportación representa la selección de la ejecución, por lo que un límite menor produce una exportación menor; los archivos históricos permanecen.

PDF.js se ejecuta en un worker aislado (768 MiB, 120 segundos, hasta 1200 páginas); no usa GPU ni inferencia. La concurrencia es una descarga o una extracción, no más de dos tareas CPU si un supervisor realiza comprobaciones independientes. El texto se normaliza a NFC y espacios sin alterar signos sustantivos. Se conservan páginas por artículo, separando encabezados y anotaciones editoriales reconocidas. Se detectan números insertados, ordinales, Bis y Ñ. Una nota editorial con citas de otra ley pone el artículo afectado en cuarentena. Reinicios ambiguos de numeración o ausencia de frontera transitoria explícita ponen toda la extracción en cuarentena. Los transitorios y decretos de reformas posteriores quedan fuera de este primer conjunto de artículos operativos. No se completa texto faltante mediante un modelo.

La fecha declarada de última reforma procede del propio PDF cuando se reconoce; su ausencia queda en `null`. `versionDate` usa esa fecha o la fecha de recuperación para identificación, jamás como afirmación de entrada en vigor. `effectiveAt` permanece `null`, `quality.currentness` es `unverified`.

## Exportación para entrenamiento

`artifacts/legal-library/exports/{train,validation,test,corpus}.jsonl` contiene un objeto por artículo, con:

- `id`, `lawId`, `versionId`, `versionDate`, `articleId`, `text`;
- `sourceUrl`, `publisher`, `jurisdiction`, `pdfSha256`, `textSha256`, `sourcePages`;
- `declaredAmendedAt`, `effectiveAt`, `retrievedAt`, `rights`, `editorialNotes`;
- `split`, `splitGroup`, `quality` y `contentSha256`.

La partición es determinista por ley: hash SHA-256 de `lex-law-split-v1:` + `lawId`, primeros ocho dígitos hexadecimales módulo 100 (0–79 train,80–89 validation,90–99 test). Todas las versiones de una ley permanecen en la misma partición. Los cuerpos exactamente duplicados entre particiones se excluyen de todas; dentro de una partición se conserva uno. La proporción no garantiza 80/10/10 de artículos porque las leyes tienen longitudes muy distintas. Los duplicados aproximados no se detectan: las métricas no deben presentarse como evaluación libre de toda contaminación.

Solo `quality.status=structurally-verified` se exporta. La etiqueta describe comprobaciones mecánicas y **no certifica exactitud legal ni completitud de todas las disposiciones**. `manifest.json` informa cantidades por partición y exclusiones. No se generan respuestas, interpretaciones ni casos hipotéticos como etiquetas verdaderas; el entrenamiento debe preservar el enlace a la evidencia. No mezclar test/validation con corpus de entrenamiento ni usar `corpus.jsonl` completo para ajustar el modelo.

Derechos: la metadata cita LFDA artículo14 fracciónVIII para textos legislativos oficiales. Esto no extiende permisos a comentarios, compilaciones de terceros u otros materiales; las notas editoriales no se usan como ejemplos del texto legal. Se conserva la fuente y no se afirma una licencia individualizada.

## Estado y pruebas

`artifacts/legal-library/status.json` contiene `state` (`running`, `complete`, `partial`, `failed`), `phase`, fechas, `catalogTotal`, `requestedLimit`, resumen y estados por fuente (`extracted`, `quarantined`, `failed`). `acquisitions/status.json` proporciona progreso detallado de descarga. Los snapshots y manifest de adquisición están en `acquisitions`; las extracciones con cuarentenas están en `extractions/{sourceId}/{pdfSha256}.json`.

Pruebas acotadas: `node --test tests/legal-library.test.mjs`. Usan fixtures sintéticos y fetch/extractor inyectados explícitamente; no sustituyen la auditoría sobre PDFs reales.

## Primera entrega auditada

La descarga real inicial obtuvo 40 PDFs oficiales. El extractor versión 6 produjo 14,061 artículos exportados de 38 instrumentos después de 256 exclusiones por duplicación exacta;2,233 artículos permanecieron en cuarentena y dos instrumentos completos (LIVA y LFD) se excluyeron por numeración compleja aún no soportada. Esto no afirma cobertura completa de esas 38 leyes.

El snapshot inmutable de trabajo `artifacts/legal-library/exports-v1/` conserva train 11,833 artículos / 30 leyes, validation 235 / 1 ley y test 1,993 / 7 leyes, status, hashes y auditoría. SHA-256 de corpus.jsonl: `7d5725e96c9baa5f4531348e9fbf64efa59c15b62aaa0d75c9de1c6ab84764b1`. La auditoría independiente con Poppler verificó 115/115 muestras (primer/medio/último artículo exportado por ley más CCF 1797), cotejando primeros y últimos 100 caracteres en páginas registradas después de retirar encabezados y anotaciones editoriales registradas. Es una comprobación de fidelidad por muestreo, no una auditoría completa de contenido o vigencia.

Ampliación autorizada: `node scripts/corpus-ingest.mjs --limit 317 --max-gib 2`. El límite configurable admite 1–4 GiB; la extracción sigue siendo secuencial y sin GPU. No reemplazar el snapshot v1 usado por entrenamiento mientras se amplía la exportación de trabajo. Los nombres de PDF con sufijos de fecha de 6–8 dígitos se normalizan para mantener `id`/`lawId` estables al cambiar versiones. Renombramientos más amplios requieren reconciliación explícita antes de reutilizar particiones.

## Ampliación v2: revisión y congelación

Se adquirieron 317 PDFs oficiales y se extrajeron 317 sin fallo de descarga. El bruto produjo 36,839 artículos de 307 instrumentos tras deduplicar; 3,555 artículos ya permanecían en cuarentena. La primera auditoría Poppler de ese bruto pasó 905 de 922 muestras y por ello **no se publicó directamente**.

La revisión detectó encabezados `Nueva Ley DOF`, colas de artículos de decretos y anotaciones de invalidez incorporadas a algunos textos. `scripts/freeze-legal-library.mjs` genera un subconjunto conservador, sin reescribir textos aceptados, y conserva cada exclusión con motivo, ID, PDF y páginas. Excluye cuatro instrumentos completos: LGSMIME, LOEFAM y REG_SENADO porque no se estableció el inicio del cuerpo operativo; LSINT por la declaración de invalidez de la ley presente en su publicación. Los demás avisos de invalidez provocan exclusión de los artículos afectados, sin extrapolar a toda la ley.

`artifacts/legal-library/exports-v2` quedó congelado con 35,452 artículos de 303 instrumentos: train 28,883 / 250 leyes; validation 2,899 / 26; test 3,670 / 27. Se excluyeron 1,387 registros adicionales respecto del bruto. La auditoría final pasó 910/910 muestras; el SHA-256 de `corpus.jsonl` es `e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11`. Esto sigue siendo una comprobación técnica por muestreo, sin afirmar cobertura completa ni validación jurídica.

El índice separado `artifacts/legal-library/public-library-v2.sqlite` contiene las mismas 35,452 entradas y ocupa 153,014,272 bytes. La construcción consumió 139,168 KiB de RSS máximo, sin GPU. Su manifest y la prueba de búsqueda CCF1797 están junto al índice. No se activó automáticamente ni se sobrescribió el índice v1.

Todos los hashes registrados de exports-v1 permanecen iguales. La revisión ampliada excluye 100 IDs que existían en v1; el cruce con dataset-v1 identifica 84 ejemplos de entrenamiento asociados a 21 artículos de LAASSP, LAAT y LFPDPPP, y 40 ejemplos de test asociados a 10 artículos de LGTAIP; ninguno de validación. Sin embargo, **ninguno de esos 84 ejemplos de entrenamiento contiene literalmente los marcadores detectados** en sus mensajes/objetivos, debido al recorte del constructor. Seis ejemplos de test contienen marcadores, cuatro en la respuesta objetivo. El informe `dataset-v1-exclusion-impact.json` distingue asociación por procedencia de presencia literal; no debe describirse como 84 objetivos entrenados con encabezados. No se modificó el dataset de entrenamiento.

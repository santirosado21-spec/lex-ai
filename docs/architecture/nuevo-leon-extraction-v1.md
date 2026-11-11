# C1b.4 — extracción offline de dos PDF públicos en cuarentena

2026-11-10. Wrapper nuevo `scripts/extract-nuevo-leon-research.mjs`, pruebas `tests/nuevo-leon-extraction.test.mjs`. No cambia la biblioteca/parser existente, el capturador congelado, el registro del piloto, la allowlist o el cliente. Esta entrega usa extractores sintéticos inyectados para sus pruebas; no ejecuta el parser sobre los PDF reales ni realiza solicitudes de red. El coordinador debe revisar el corte antes del primer `--extract`.

Se consultó la skill PDF para este trabajo de verificación/lectura, sin autoría o edición de PDF. El coordinador realizará por separado muestras visuales con Poppler; la extracción de texto no demuestra fidelidad de diseño, página o carácter. No se instalan dependencias.

## Entradas y procedencia cerradas

La propuesta solo admite los dos originales locales de `artifacts/public-corpus/nl-pdfs-revision-01` capturados en C1b.3. No existe parámetro CLI para otra carpeta, archivo, URL, query o catálogo. Antes de crear una salida o iniciar el worker se verifican:

- Informe de captura `report.json`, SHA-256 `888972f9e20cfc17f573ed43b37d23ab3c00db4efc2b963ed7b1483478759246`.
- Civil `nl-civil.pdf`: 1.779.177 bytes, SHA-256 `a517709dd10664bbf7fc4ee77e32e4a0da7fdfbce45b662166dc706ead3c8af7`.
- Penal `nl-penal.pdf`: 1.222.017 bytes, SHA-256 `440f28ca7515f63c35e5e9034086e843e126bed75f6d07dfe1067537607c3d76`.
- Informe HTML original copiado `source-report.json`, SHA-256 `05ad65a4b84f011905f6336e4b94cece7800ffb71c010e863bf542b5f503a719`.
- Copias HTML Civil/Penal con SHA-256 `7ad6ac47640688a911f135a690080677f6e4e2cf5927e17e2d70637e601925c9` y `f087c1a18f6784c0fa46ca9d7fae62dda745795109b226153ca481a09b57b356`; vínculo literal/etiqueta en línea 556 y metadatos de sus recibos.
- Recibo y snapshot de robots de la captura, sin volver a consultarlos: no hay egreso en esta etapa.

La identidad de cada PDF se liga a su recibo 200/MIME, URL solicitada/final exactas, tamaño y fecha de captura. Las queries originales `?2026-06-26` y `?2026-06-15` se conservan literalmente como parte de la procedencia; no se analizan para decidir reforma o vigencia.

También se fijan hashes de la biblioteca de extracción, capturador, inspector/robots, sus dos protocolos y freeze C1b.3. Los valores están en `FROZEN_HASHES` del wrapper. La biblioteca `server/legal-library.mjs` debe conservar `e7fb465ce1a8416cbe9ee2c2bff1cba6c0247323e1da30db33de4622f805d8c6` y versión 6. Un cambio requiere revisión y propuesta nueva. Estos hashes establecen integridad frente al código/evidencia revisados, no autorización jurídica del editor.

## Ejecución acotada

Se reutiliza exclusivamente `parsePdfInWorker` de la biblioteca, sin llamar a sus funciones de descubrimiento, descarga, ingestión o exportación. No se aplica el validador de destinos de producción a una URL que aquí es solo metadato; tampoco se amplía aquel validador para admitir Nuevo León. El wrapper no implementa clientes HTTP, herramientas de documentos o llamadas a modelos.

| Límite | Valor |
| --- | --- |
| Documentos / simultáneos | Exactamente dos / uno |
| PDF individual / total | 10 MiB / 20 MiB |
| Worker de parser | 120 segundos, heap V8 de generación vieja limitado a 768 MiB |
| Páginas por PDF | 1.200, comprobadas por worker y wrapper |
| Lote | 300 segundos, incluida comprobación previa |
| Registros candidatos | Hasta 20.000 por documento |
| Artefactos JSON de extracción | Hasta 64 MiB combinados |

Antes de empezar un worker debe quedar una ventana completa de 120 segundos. El worker existente administra su timeout y terminación; no se inicia otro hasta que retorna. Los adaptadores sintéticos de pruebas tienen un timeout cancelable propio. El límite de heap no mide RSS total; estas cargas de fábrica no son el presupuesto del cliente ni validación de un equipo físico de 8 GB.

Los originales y sus metadatos permanecen intactos. Se crean copias PDF verificadas dentro de una hoja nueva exclusiva bajo `artifacts/public-corpus`; el parser lee esas copias y se comprueban otra vez sus hashes al terminar. Rutas con escapes, ancestros/snapshots symlink y hojas ya existentes se rechazan. Archivos completos se crean con exclusión y quedan de solo lectura; no se promete almacenamiento WORM frente al dueño del equipo. Un fallo parcial no elimina la extracción anterior del mismo lote ni permite reutilizar/sobrescribir su directorio.

## Fechas, segmentos y diagnósticos

Cada segmento conserva texto exacto devuelto por el parser, SHA-256 de texto, hash del PDF, referencias de páginas y su hash, URL original completa, identidad de ley, fecha de captura y versión del parser. Se rechazan identidades/prefijos de versión incoherentes, hashes de texto alterados y páginas fuera del rango observado.

Las identidades de salida se basan en el hash completo del PDF; no en una fecha de URL. El parser anterior construye un identificador técnico usando la fecha declarada que reconoce o, si no la reconoce, el día de captura. El wrapper preserva ese identificador como diagnóstico y marca la segunda opción `capture-date-fallback-not-legal-date`. `declaredAmendedAt` permanece nulo cuando no se reconoce; una fecha reconocida sigue siendo declaración del editor no validada. `effectiveAt` es siempre nulo.

Todos los documentos y registros se fuerzan a `status=quarantined`, con derechos, texto, revisión jurídica y vínculo de versión pendientes; `published=false`, `indexed=false`, `trainingExported=false` y `approvedForAcquisition=false`. El estado técnico previo del parser se guarda solo en `parserDiagnostics`. No se escriben particiones de entrenamiento ni se llama a `exportLibrary`; el antiguo conteo `exportableArticles` se presenta como `structuralCandidateCount`, sin conceder aprobación.

El informe mide páginas, registros, registros con anomalías, notas editoriales, señales de encabezados numéricos ausentes y frontera de transitorios. Los códigos de anomalía y la cobertura del parser se conservan. Una salida de cero artículos es un diagnóstico válido que permanece visible en cuarentena, no se borra ni se maquilla como cobertura satisfactoria. Fallos de ejecución/procedencia usan categorías finitas; mensajes arbitrarios del parser no se copian al informe de fallo.

El coordinador informó de una muestra visual de primera página: Civil usa formas `Art. 1o.-`, mientras el parser anterior reconoce principalmente `Artículo`/`ARTÍCULO`. El wrapper no modifica esa gramática para mejorar los conteos. Una captura sin encabezados, frontera ausente o numeración que se reinicia exige trabajo separado de perfil estatal y aceptación posterior. Una frontera detectada tampoco implica transitorios completos: el parser actual se detiene al encontrarlos.

El worker conserva internamente páginas para segmentar, pero no devuelve ni guarda el texto crudo de cada página. Por ello `rawPageTextStored=false`; un hash de segmento y su lista de páginas no prueba fidelidad literal, tablas, negaciones, notas o cobertura jurídica completa.

## Uso y revisión

```sh
# Plan predeterminado: no lee capturas, importa el parser, crea artefactos o usa red.
node scripts/extract-nuevo-leon-research.mjs
node scripts/extract-nuevo-leon-research.mjs --plan

# Pruebas con PDF mínimo sintético y extractor inyectado; ningún parseo PDF real.
node --test tests/nuevo-leon-extraction.test.mjs

# Solo el coordinador tras revisión independiente de este corte.
node scripts/extract-nuevo-leon-research.mjs --extract --out-name nl-extraction-revision-01
```

La API tiene un seam de pruebas con hashes/tamaños sintéticos y extractor inyectado. Ese seam no permite cambiar IDs, títulos, rutas o URLs fijas ni habilitar el parser real; no se expone por CLI. Las pruebas no dependen de artefactos ignorados o privados.

El lote conserva PDF copiados, informes originales, archivos `*.extraction.json` y `report.json` con ledger de entradas/salidas, métricas y pendientes explícitos. Los estados `complete-quarantine`/`partial-quarantine` describen ejecución técnica; no vigencia, calidad o aprobación de corpus. Las veinte plazas anteriores siguen pendientes hasta su revisión independiente. La aceptación visual/textual, el perfil estatal, las citas de producto o exportación son trabajos posteriores; no hay compras, modelos, nube o datos de clientes por esta etapa.

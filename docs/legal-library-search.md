# Índice público de búsqueda local

`server/public-library.mjs` crea y abre un índice SQLite + FTS5 independiente. No lee bases de firmas, asuntos, documentos privados ni el corpus aprobado de 21 artículos. Es un artefacto distribuible para consulta pública; construirlo no lo activa automáticamente en producción.

## Construcción y publicación

```sh
node --max-old-space-size=512 scripts/index-legal-library.mjs
node --max-old-space-size=512 scripts/index-legal-library.mjs --input artifacts/legal-library/exports-v1 --out artifacts/legal-library/public-library.sqlite
```

La entrada debe ser un snapshot con `corpus.jsonl`, `sha256.json` y `independent-extraction-audit.json`. El hash del corpus debe coincidir en ambos metadatos, y la auditoría por muestreo debe tener todos sus casos aprobados. Esto verifica integridad y procedencia declarada del snapshot; no constituye una auditoría jurídica exhaustiva ni prueba criptográfica de que cada palabra procede del PDF. El proceso constructor debe recibir únicamente snapshots públicos revisados. Un usuario local con permiso para alterar corpus y metadatos puede fabricar una nueva entrada; no se pretende proteger contra ese actor.

Se valida cada registro: URL HTTPS de PDF en Cámara de Diputados, ley y jurisdicción federal, identidad versión/artículo, hash del texto completo, hash de PDF, páginas, fecha de recuperación, estado estructural y partición. Se rechazan campos de asunto/firma/documento privado, texto superior a 60,000 caracteres y versiones de una ley repartidas entre train/validation/test. El rechazo por campos no es un clasificador de confidencialidad: nunca suministrar documentos privados al constructor.

La lectura de JSONL es incremental, limitada a 256 MiB, 200,000 artículos y 512,000 caracteres por línea. SQLite usa caché de 16 MiB y temporales en disco. Un lock excluye constructores concurrentes. La base se crea en un archivo temporal y transacción, se comprueba integridad y se publica por rename. La base anterior permanece intacta ante fallos de validación. El manifest lateral se publica después: una interrupción entre ambos renames provoca rechazo por hash al abrir, en lugar de aceptar una pareja inconsistente. Restaurar o reconstruir la pareja permite recuperación. No hay migración ni escritura desde la API de consulta.

El índice v1 real contiene 14,061 artículos de 38 instrumentos y ocupa aproximadamente 60.2 MB. La ejecución registrada consumió 135,088 KiB de RSS máximo (~132 MiB). El comando de medición `/usr/bin/time -l` no pudo consultar `kern.clockrate` en el sandbox; la cifra reportada procede de `process.resourceUsage().maxRSS` en una construcción completada. Los resultados están en `artifacts/legal-library/index-build-result.json`.

## API propuesta para integrar

```js
import {openPublicLibrary} from './public-library.mjs';
const library = await openPublicLibrary(indexPath); // valida SHA-256 y abre readOnly
library.status();
library.search({query:'validez cumplimiento contratos', lawId:'MX-FED-CCF'});
library.getSource('PUB-' + sha256DeIdentidadOriginal);
library.close();
```

Acciones integradas en HTTP y servicio (la UI se integra por separado):

- `library.status`, entrada `{}`: devuelve `{available:true,schemaVersion,kind,builtAt,corpusSha256,indexSha256,articles,laws,audit,status,privateDocumentsIncluded:false}`. `laws` incluye `{id,title,jurisdiction,split,articles}`. Si no existe índice, el adaptador puede responder `{available:false,reason:'not-indexed'}`; errores de integridad deben distinguirse de ausencia.
- `library.search`, entrada `{query,lawId?,jurisdiction?,limit?,offset?}`: devuelve `{query,corpusSha256,offset,limit,hasMore,sources}`. Valores por defecto: jurisdicción `MX-FED`, límite10, offset0. Máximo10 resultados y offset1000. No acepta rutas ni parámetros de SQL.
- `library.source`, entrada `{sourceId}`, devuelve la fuente completa o `null`. Requiere la misma autenticación que las demás acciones y rechaza IDs no públicos.
- `getSource(id)` es una función interna para recuperar evidencia completa por ID público. No consulta otros índices; devuelve `null` si el ID no está en este snapshot.

Cada fuente implementa los campos comunes `id`, `sourceId`, `title`, `article`, `url`, `jurisdiction`, `text`, `retrievedAt`, `version`, `status`, `authority`, `category`, junto con `law`, `lawId`, `originalId`, `pages`, `pdfSha256`, `textSha256`, `amendedAt`, `effectiveAt:null`, `split`. El ID tiene prefijo `PUB-` y SHA-256 hexadecimal de la identidad original: 68 caracteres de `[a-zA-Z0-9-]`. `status` siempre es `structurally-verified-currentness-unverified`; jamás significa ley vigente.

La búsqueda añade `excerpt`, `textLength`, `truncated`. El campo `text` se limita a los primeros 12,000 caracteres para vista previa; `textSha256` sigue identificando el artículo completo. Para citas o RAG, llamar `getSource(id)` y verificar la cita contra el texto completo, especialmente si `truncated=true`; no tratar el hash del artículo como hash de la vista previa. `excerpt` es texto sin HTML, con el marcador literal `…`; no usarlo como cita exacta sin cotejo.

Consulta limitada a300 caracteres,1–12 términos Unicode alfanuméricos distintos, hasta40 caracteres cada uno. Se unen términos entrecomillados con AND. Operadores del usuario, comillas y puntuación nunca se interpolan como SQL o sintaxis FTS; todos los parámetros SQL usan bindings. Una pregunta larga debe convertirse a términos de búsqueda acotados en el adaptador, no enviarse sin validación. Se ordena por BM25 y por ID para estabilidad. No hay búsqueda semántica ni inferencia.

El proceso lector usa `DatabaseSync(...,{readOnly:true})`, `query_only`, esquema no confiable y sin carga de extensiones. Un handle abierto continúa sobre su snapshot al reemplazar el archivo; cerrar/reabrir expresamente para activar otra versión. El adaptador HTTP debe conservar autenticación, límites de cuerpo y aislamiento de los otros datos, existentes en el runtime.

## Verificación

`node --test tests/public-library.test.mjs tests/legal-library.test.mjs`: 21 pruebas aprobadas al entregar (8 del índice y13 de biblioteca). Cubren procedencia, campos privados rechazados, manipulación de hashes/URLs, consultas SQL/FTS hostiles, límites/paginación, separación de particiones, vistas previas largas y preservación del índice ante reconstrucción fallida.

Smoke real en `artifacts/legal-library/index-search-smoke.json`: consulta `validez cumplimiento contratos` con filtro CCF devuelve artículo1797, y las consultas de datos personales y salario devuelven fuentes de las leyes solicitadas. No se ejecutó Gemma ni otro modelo.

Referencias consultadas: [documentación oficial FTS5](https://www.sqlite.org/fts5.html). La página oficial Node22 SQLite no estuvo disponible mediante la herramienta web; opciones readOnly y funcionamiento se comprobaron directamente con Node22.22.3 instalado y pruebas del repositorio.

## Integración en búsqueda y RAG

El servidor abre `LEX_PUBLIC_LIBRARY_PATH` o `resources/public-library.sqlite` al iniciar, valida el índice y lo cierra al apagar. `startServer({libraryPath})` permite pruebas aisladas. Ausencia y corrupción se muestran como estados distintos y la biblioteca corrupta no se usa. El corpus semilla permanece disponible y `state.sources` conserva únicamente sus 21 entradas.

`research.search` consulta FTS para jurisdicción federal mediante hasta tres consultas AND de términos relevantes acotados; si no obtiene resultados usa el corpus semilla. CDMX mantiene el corpus semilla. El RAG recupera el artículo completo mediante `getSource`, selecciona un pasaje alineado con la pregunta y conserva los offsets y hashes separados: `fullTextSha256` identifica el original, `passageSha256` el pasaje enviado. El límite es cinco fuentes, hasta 1,300 caracteres de texto y 250 de cita permitida por fuente (7,750 caracteres combinados de texto/citas). Metadatos e instrucciones son adicionales. Hasta dos fuentes privadas se mantienen dentro del asunto cuando hay evidencia jurídica. Las citas continúan validándose contra los pasajes suministrados.

Prueba de integración: `node --test tests/public-library-integration.test.mjs tests/http.test.mjs`. Los casos HTTP requieren permiso de escucha loopback; un sandbox que lo bloquee produce EPERM y no equivale a una prueba aprobada.

### Referencias explícitas a artículo y ley

Antes de la búsqueda general, el servicio reconoce el número de artículo y el título oficial normalizado de la ley. Cuando títulos se solapan, prevalece el más largo; `CCF` se acepta como alias explícito de Código Civil Federal. La consulta interna `lookupArticle({lawId,articleId})` usa el índice existente `by_law` y compara exactamente el identificador del artículo, sin modificar la base ni exponer una nueva acción HTTP.

Una referencia reconocida devuelve exclusivamente el artículo solicitado. Si no está en la biblioteca, solo permite respaldo del mismo artículo y título en el corpus semilla. Si tampoco existe allí, no ejecuta búsquedas generales ni amplía el RAG usando el texto de los documentos privados: el análisis jurídico se abstiene por falta de evidencia. Así, la pregunta del harness sobre modificación unilateral y artículo1797 del Código Civil Federal recibe CCF1797 aunque termine con las palabras «sin afirmar vigencia actual».

Verificado con el índice real, el texto literal de la pregunta del harness y un modelo inyectado de prueba: RAG contiene contrato del mismo asunto y únicamente el artículo CCF1797 solicitado. Siete pruebas de integración sin red y25 pruebas de biblioteca/servicio pasaron; no se ejecutó GPU ni se mutaron índices.

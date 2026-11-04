# W2 — recuperación local por fragmentos (2026-11-03)

Actualización W5: [tesauro, integración conversacional y mediciones](./W5-colloquial.md).
El resto de este documento conserva el contrato y las mediciones originales de W2.

Implementación aislada para conectar desde el worker conversacional. No modifica
`service.mjs`, `conversation.mjs`, `assistant-router.mjs`, `src/` ni el extractor
existente `legal-library.mjs`. Sólo usa fuentes legales públicas ya almacenadas;
las pruebas de contenido usan artículos sintéticos. No descarga ni carga modelos,
no instala paquetes y no abre sockets. Requiere el Node 22.13+ del proyecto.

## Construcción y tamaño medido

Desde la raíz:

```sh
node scripts/build-fragment-index.mjs --write-area-map
node scripts/build-fragment-index.mjs
node --test tests/retrieval-*.test.mjs
npm test
```

La primera orden regenera exclusivamente `resources/law-areas.json`. Ejecutar la
construcción en otro proceso para cargar ese JSON actualizado. Opciones del
constructor: `--input FILE`, `--out FILE`; no usa rutas del usuario ni documentos
de asuntos. La fuente se abre en modo lectura y se verifica su hash antes y
después; cada artículo debe conservar su hash y procedencia pública. El resultado
se construye bajo bloqueo en un archivo temporal y se publica por renombrado.
Un error conserva el índice anterior. El contenido y la configuración iguales
producen bytes iguales con la misma versión de Node/SQLite: no hay fecha aleatoria
en el índice. Las pruebas verifican reconstrucción y conservación ante fallos.

Resultado local medido:

| Dato | Valor |
| --- | --- |
| Fuente | `resources/public-library.sqlite` |
| SHA256 de la fuente | `ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588` |
| Leyes / artículos | 303 / 35.452 |
| Fragmentos | 101.329 |
| Salida | `artifacts/retrieval/fragments.sqlite` |
| Tamaño | 239.742.976 bytes (228,64 MiB) |
| SHA256 del índice | `04486e9167b938e18a400e5381b68ef7fcf060937efd172a93e0c6aa6ed4ebf4` |
| Marcadores de enumeración | 60.760 fragmentos |
| Límites del texto almacenado | 33.433 fragmentos |
| Cortes aproximados por tamaño | 7.136 fragmentos |

Se deja en `artifacts/`, ignorado por Git, por su tamaño. No se modifica ni se
empaqueta automáticamente el SQLite de `resources/`. El índice conserva los
artículos completos para verificar los fragmentos; FTS5 usa contenido externo
de la tabla de fragmentos para evitar una tercera copia de ese texto. La salida
JSON del script informa los hashes, tamaño y contadores de cada ejecución.
El caché SQLite está acotado a 16 MiB durante construcción y 8 MiB en lectura;
esto no es una medición del consumo total ni una validación en equipos de 8 GB.

## Mapa de áreas

`resources/law-areas.json` es directamente `{law_id: [áreas]}`: las 303 claves
coinciden con los IDs distintos del SQLite, sin entradas de metadatos mezcladas.
`areas.mjs` contiene la regla reproducible `classifyLaw({lawId,title})` y las
correcciones `REVIEWED_LAWS`.

Método: normalización de acentos y mayúsculas del nombre, reglas de vocabulario
por materia, varias áreas cuando corresponde y `otros` como último recurso.
Se revisaron manualmente los títulos del catálogo y se fijaron 161 asignaciones,
incluidos CPEUM, CCF/CFPC/CNPCF, CPF/CNPP, LFT/LFTSE, CCOM/LGSM/LGTOC, CFF/LISR,
LAMP, LFPA/LFPCA, LSS/LISSSTE y los IDs numéricos principales. Los números del
editor no se interpretan como siglas ni como artículos. CCF/CFPC/CNPCF incluyen
civil y familiar; aviación civil y protección civil se clasifican como
administrativo. No se considera la clasificación una revisión profesional ni
una determinación de competencia territorial.

La cobertura es la del snapshot: la ausencia de una ley no se rellena con
contenido generado. `detectArea(question)` devuelve un array, nunca una sola
etiqueta obligatoria; devuelve `['otros']` si no encuentra señal. Usa IDs/siglas
del mapa y vocabulario coloquial. El mapa es a nivel ley, no artículo: algunos
pasajes de una ley multidisciplinaria pueden resultar irrelevantes.

## Contrato para integración

```js
import {rewriteQuery, detectArea, openFragmentIndex, searchFragments, rankHybrid}
  from './retrieval/query.mjs';
import {splitArticle, verifyFragment} from './retrieval/fragments.mjs';

const request = rewriteQuery({
  question: '¿y el siguiente?',
  recentTurns: [{question: 'Explícame el artículo 47 de la LFT'}],
  matterJurisdiction: 'MX-FED',
});
// {query:'Artículo siguiente al artículo 47 de MX-FED-LFT.',
//  areas:['laboral'], jurisdiction:'MX-FED', needsClarification:false,
//  reason:'article-navigation', reference:{...}}

// Sólo abrir si el índice ya fue construido. No hay construcción implícita.
const index = openFragmentIndex();
try {
  if (!request.needsClarification) {
    const sources = index.searchFragments({...request, limit: 5});
    // Entregar sources como evidencia; no interpretar request como evidencia.
  }
} finally { index.close(); }

// Fachada para una llamada; abre/cierra una conexión de sólo lectura:
const sources = searchFragments({
  query: 'Artículo 47 de LFT fracción II', areas: ['laboral'],
  jurisdiction: 'MX-FED', limit: 5,
  // indexPath: '/ruta/absoluta/fragments.sqlite', // opcional
});
```

`rewriteQuery`, `detectArea`, `splitArticle`, `verifyFragment`, `lexicalTerms` y
`rankHybrid` son funciones deterministas sin escrituras. La búsqueda requiere
lectura SQLite; la conexión se puede inyectar mediante la fábrica y no es estado
global. `status()` devuelve los metadatos del índice. Un índice ausente/incompatible
produce error explícito; no hay sustitución silenciosa por otro corpus.

`recentTurns` se recibe del llamador, del más antiguo al más reciente, ya limitado
al mismo despacho, asunto y conversación. Admite `{question,citations}`, mensajes
`{role,content}` y strings. Sólo considera hasta seis turnos; ignora mensajes
system/developer/tool. Una referencia ambigua, el seguimiento sin antecedente o
la falta de jurisdicción requieren aclaración. La jurisdicción del asunto no se
amplía por el historial. Una nueva hipótesis conserva el contexto textual y
elimina la antigua referencia exacta para no fijar la búsqueda en otro artículo.
No es una reescritura semántica general: las anáforas complejas necesitan aclaración.

No se calcula `n+1` para “siguiente”: la consulta conserva el artículo de anclaje,
y el índice busca el sucesor almacenado, incluidos Bis/Ter y sufijos numerados.
Si no existe anclaje o sucesor, devuelve `[]`; nunca inventa su contenido.
La sucesión corresponde a la cobertura almacenada, que puede omitir artículos
cuarentenados; no certifica continuidad de la publicación oficial.

La búsqueda exige una jurisdicción explícita y usa igualdad estricta para ella;
no incorpora leyes federales a una consulta estatal automáticamente. El índice
actual sólo contiene `MX-FED`, según los metadatos de origen. El aislamiento de
otras jurisdicciones se prueba con fixtures sintéticos, sin inventar cobertura
estatal. Las áreas se combinan con OR dentro de esa jurisdicción; `areas: []`
desactiva sólo el filtro de área. Si se omiten, se detectan de la consulta;
`otros` inferido no restringe. `limit` es 1–50. Referencias explícitas múltiples
devuelven `[]`: el llamador debe descomponerlas en consultas independientes.

El ranking usa BM25, expansiones léxicas pequeñas para lenguaje coloquial y
filtro por área. Las fracciones/incisos pedidos explícitamente se filtran por
su marcador, no por menciones de ese número dentro de otras fracciones. Se
retiene la versión con fecha de recuperación más reciente por artículo, sin
afirmar que esté vigente. `rankHybrid(lexical, optionalVector)` fusiona listas
ordenadas mediante rango recíproco; los IDs vectoriales sólo pueden reordenar
candidatos léxicos previamente filtrados. No introduce resultados de otros
ámbitos y no existe todavía backend vectorial.

## Procedencia y límites de segmentación

Cada resultado conserva `lawId`, `article`, `jurisdiction`, `version`, `url`,
`pages`, `retrievedAt`, `pdfSha256`, `status`, y fechas de origen. Su `id`/`sourceId`
es `FRAG-…`; `articleSourceId` identifica el artículo `PUB-…` de la biblioteca.
No pasar un ID `FRAG-…` a `publicLibrary.getSource`: usar `articleSourceId` si se
necesita el artículo completo. `start` y `end` son offsets UTF-16 de JavaScript,
con fin exclusivo, sobre el artículo almacenado sin normalización adicional.
`textSha256` corresponde al fragmento; `articleSha256`/`articleTextSha256` al
artículo completo en UTF-8. `verifyFragment(fragment, article)` verifica identidad,
jurisdicción, offsets, texto y hashes. La búsqueda realiza esta comprobación en
cada resultado. Los hashes verifican consistencia, no autenticidad criptográfica
frente a una reescritura coordinada de todo el índice.

`fraction`, `inciso` y `marker` son contexto sintáctico, no una certificación de
jerarquía jurídica. Los cortes reconocen I., II.-, I), a), b) y saltos de línea
conservados. El extractor original eliminó muchos saltos; no es posible
reconstruir con fidelidad todos los párrafos de los PDFs desde este SQLite. Los
bloques largos se cortan hasta 1.200 unidades UTF-16 usando límites de oración o
espacio y se marcan `approximate-size-boundary`. No se inventan números de párrafo
ni páginas precisas del fragmento: `pages` corresponde al artículo completo.
Los límites de fracción pueden requerir revisión en enumeraciones atípicas.

También se conservan defectos del origen: por ejemplo, el registro LFPC
73-QUÁTER incluye texto encabezado 73 QUINTUS dentro del mismo artículo extraído.
W2 no corrige ni recategoriza ese contenido. Se requieren auditoría del extractor
y revisión de fuentes antes de afirmar fidelidad jurídica o vigencia.

## Verificación observada

`node --test tests/retrieval-*.test.mjs`: 15 pruebas aprobadas, cero fallos.
Incluyen las dos preguntas coloquiales solicitadas, seguimientos, fracciones e
incisos, hashes/offsets (incluido Unicode), reconstrucción reproducible, fracaso
de reconstrucción sin pérdida, cambio de versión, sufijos y separación territorial.

`npm test`: 316 pruebas, 311 aprobadas, 5 fallos de apertura de loopback con
`listen EPERM: operation not permitted 127.0.0.1`, sin omitidas. Los fallos
corresponden a dos pruebas de `http.test.mjs`, una de `office-https.test.mjs` y dos
de `public-library-integration.test.mjs`. Es una limitación de este sandbox, no un pase
de esas pruebas. No se cambiaron para ocultar el bloqueo.

Sondeo puntual sobre el índice real, con `limit:3`, sin modelo ni red: “me
corrieron del trabajo” tardó 2.711 ms, “mi esposo no paga la pensión” 854 ms y
“Artículo 47 LFT fracción II” 1 ms. Son tres observaciones locales, no un benchmark
ni validación en 8 GB. La selección explícita devolvió LFT 47, fracción II; las
búsquedas coloquiales devolvieron candidatos de la materia, pero también pasajes
de relevancia secundaria (p. ej. sucesiones para pensión). Queda pendiente medir
precisión/recall por materia y mejorar el ranking; no se afirma competencia legal.

Se aplicó la skill local dsystem. La consulta `opinion` para una crítica técnica
terminó con código 2: permisos de logs y bind de loopback bloqueados. No hubo
segunda opinión efectiva ni reintentos. La búsqueda de skills locales y en el
repositorio conocido no aportó una skill específica de fragmentación jurídica;
se usó el patrón SQLite existente del proyecto y la
[documentación oficial de FTS5](https://www.sqlite.org/fts5.html).

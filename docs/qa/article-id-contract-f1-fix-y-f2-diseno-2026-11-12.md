# F1 corregido (contrato de referencia exacta reconciliado) + F2 diseño de división (propuesta no adoptada)

2026-11-12. Ejecutado en el ambiente de desarrollo remoto. Sin revisión independiente todavía. Cero índices construidos fuera de pruebas, cero activación de corpus, cero nube/gasto. Corpus vigente y archivos de extracción intactos.

## F1 — corrección verificada

Causa raíz (no solo regex): las consultas se normalizan NFD sin marcas (`normalize` en service.mjs:30), así que el extractor produce `26-QUATER`; las extracciones preservan la forma fuente `26-QUÁTER`; el lookup comparaba exacto y además con una regex distinta de la del índice. Tres contratos divergentes: `public-library.mjs` lookupArticle (solo Ñ), `retrieval/build.mjs` validateArticle (ÁÉÍÓÚÑ pero sin cotas de sufijos), `state-library.mjs` (solo Ñ).

Corrección (commit en esta rama):
- Nuevo `server/article-id.mjs`: gramática única `/^\d{1,6}(?:-[A-Z0-9ÁÉÍÓÚÑ]{1,16}){0,4}$/` + `articleCanonical()` (NFC→NFD→sin marcas→mayúsculas). Comentario de fuente única en el módulo.
- `public-library.mjs`: publicSource valida contra la gramática y deriva `articleCanonical` en el payload; lookupArticle acepta la gramática acentuada, compara por `COALESCE(articleCanonical, article)` canónico (compatibilidad con índices previos).
- `retrieval/build.mjs`: validateArticle usa la gramática acotada compartida (antes sufijos ilimitados).
- `state-library.mjs`: llaves del mapa y entrada de lookup canónicas (su corpus fijado por hash NO se toca; 455-QUÁTER y 653-QUÁTER de MX-JAL-CC eran inhallables hasta hoy).

Verificación:
- Compatibilidad total con el corpus vigente, derivada de archivos: 47,799/47,799 registros locales (325 docs) y 3,229/3,229 ids estatales pasan la gramática unificada (los 74 QUÁTER fallaban solo la regex vieja).
- Compatibilidad hacia atrás verificada de verdad (no asumida): índice construido con el código ANTERIOR (payload sin articleCanonical, /tmp/legacy) se abre con el código nuevo y `lookupArticle('MX-FED-CCF','1797')` resuelve por COALESCE. La apertura con integridad intacta confirma que no se mutó el índice.
- Tests: 23/23 en los tres archivos de contrato + 4/4 nuevos de la propuesta F2. Clases negativas: inyección (`26-QUATER OR 1=1`), espacios, minúsculas, 7 dígitos, sufijo >16, >4 sufijos, guiones huérfanos. Suite completa: 1143 pass, 6 fail PREEXISTENTES en nuevo-leon-extraction (esperan `complete-quarantine`, obtienen `partial-quarantine`; fallan igual en HEAD sin mis cambios — dependencia del ambiente Linux de desarrollo remoto, no regresión).
- Lookup real end-to-end: state `455-QUATER` y `455-QUÁTER` resuelven el artículo fuente `455-QUÁTER` (MX-JAL-CC).
- Alcance no verificado aquí: rebuild de exports-v1/v2 con publicSource estricto (insumos del dueño pendientes); si una fila vieja violara la gramática, el build falla cerrado y visible — nunca silencioso.

## F2 — diseño de política de división (PROPUESTA, no adoptada)

Datos reales primero: los 6 artículos sobredimensionados son UN SOLO PÁRRAFO (verificado contra archivos). División por párrafos sola NO cubre el corpus; el nivel oración es obligatorio. Máxima oración real: 1,764 chars (lisr 215) — holgado bajo la cota 60,000.

Política propuesta (referencia ejecutable en `tests/oversized-article-split-proposal.test.mjs`, 4/4):
1. Disparo: text > 60,000 (cota vigente). División por unidades: párrafos; un párrafo sobredimensionado se segmenta en oraciones (`/(?<=[.;:]\s)/`); una oración sobredimensionada = fail-closed (otra decisión de política).
2. Hijos: `articleId-PART-NNNN` dentro de la gramática compartida; padre con >2 sufijos = fail-closed. Cada hijo: parentArticleId, partIndex/partCount, charStart/charEnd contiguos, parentTextSha256, y hereda versionId/pdfSha256/sourcePages/status.
3. Recomposición sin pérdidas: join('') exacto verificado por sha256 del padre antes de servir; secuencia incompleta o hash distinto = error, nunca texto parcial como si fuera el artículo.
4. Referencia exacta: lookup del padre recompone y devuelve el texto COMPLETO con `split:true, truncated:false`; lookup de un hijo lo devuelve marcado como parte (`partOf`, índices). FTS sigue indexando hijos (cada uno <60k) y marca `partOf` al padre.
5. Nada se adopta: corpus, extracciones, índices y contratos vigentes sin cambios. La adopción requiere revisión independiente y actualizaría publicSource/buildPublicLibrary con `partOf` y la recomposición en lookup.

Pendiente deliberado: asignación exacta de sourcePages por parte (requiere mapear offsets→páginas desde la extracción; la referencia hereda el rango completo y lo marca).

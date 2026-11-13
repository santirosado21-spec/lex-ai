# Cloud knowledge/retrieval — separación arquitectónica 13:46 y auditoría de preparación de ingestion

2026-11-12. Auditoría read-only ejecutada en el ambiente de desarrollo remoto. Sin revisión independiente todavía. No se construyó índice, no se publicó/indexó contenido, no hubo llamadas de red a proveedores, gasto ni entrenamiento. El corpus sigue en CUARENTENA (textReview/legalReview pending); esta auditoría lee archivos locales y solo produce conteos derivados.

## Aclaración arquitectónica del dueño (nota de voz 2026-11-12 13:46, vía main)

- El modelo local únicamente clasifica sensible/no sensible y anonimiza. La base jurídica, skills y referencias son para el modelo en la nube.
- El corpus jurídico NO se destina a entrenar el modelo local. Privacidad (local) y cerebro jurídico (nube) son carriles separados.

Consecuencia sobre `docs/architecture/local-first-nube-anonimizada-2026-11-11.md` (no se reescribe): su paso 1 ("las primeras consultas las responde el motor local") queda reinterpretado — el motor local ya no es cerebro jurídico de respaldo, es la capa de privacidad. Lo que NO cambia: la puerta H2 fail-closed, la gobernanza del detector (H4), la cuarentena del corpus y que todo egreso de datos de cliente requiere detector validado + política + autorización. La categoría `public` de H2 (fuentes jurídicas públicas) es camino separado del de datos de cliente: la preparación del conocimiento jurídico público para la nube no depende de la elegibilidad del detector.

Dependencias reordenadas: la calidad jurídica ya no depende de la capacidad del modelo local ni del objetivo 8 GB para generación; el constraint 8 GB aplica al worker de privacidad. La elegibilidad del detector (H4b) sigue siendo gate, pero solo para egreso de datos de asuntos.

Nota de procedencia registrada: `resources/public-library.sqlite.manifest.json` (builtAt 2026-10-30) declara corpusSha256 `e97adb6b…052c11`, idéntico al corpus.jsonl de exports-v2 cuya procedencia está sin verificar (manifiestos pedidos al dueño 2026-11-12 11:25, pendientes). La biblioteca pública en producto deriva hoy de esa instantánea.

## Auditoría de preparación (extracciones locales vigentes, 325 documentos = 317 federales + 8 piloto NL; versión más reciente por documentId)

Contrato contrastado: `server/retrieval/build.mjs` validateArticle + `server/public-library.mjs` (tope de línea JSONL 512,000; regex de lookupArticle). Conteos derivados por script de archivos, no estimados.

**47,799 registros totales; 47,719 conformes (99.83%).** URLs 100% https gob.mx; pdfSha256 y versionId 100% conformes.

### F1 — 74 registros (41 documentos) con designador QUÁTER no consultable por referencia exacta

Formas: `N-QUÁTER` (72), `N-H-QUÁTER` (1, liva 18-H-QUÁTER), `N-B-QUÁTER` (1, cpf). Son designadores legítimos mexicanos (artículo 26 Quáter, etc.). Pasan `validateArticle` (acepta ÁÉÍÓÚÑ) pero FALLAN la regex de `lookupArticle` en `server/public-library.mjs` (`/^\d{1,6}(?:-[A-Z0-9Ñ]{1,16}){0,4}$/` — solo Ñ, sin vocales acentuadas). Las dos regex del mismo producto no coinciden: tras ingestion, esos 74 artículos serían almacenables pero no consultables por referencia exacta. Documentos afectados incluyen ccf, cff, cjm, cpf, lft, lisr, liva, lic, liva y 33 más (lista completa en el JSON paralelo).

### F2 — 6 registros exceden el máximo de 60,000 caracteres por artículo

| documentId | articleId | caracteres |
|---|---|---|
| ligie-2022 | 1 | 1,584,439 (también excede el tope de línea JSONL 512,000 de buildPublicLibrary) |
| lft | 513 | 286,956 |
| law-218 | 1290 | 177,111 |
| law-218 | 999 | 81,530 |
| lisr | 215 | 71,982 |
| nuevo-leon-pending-02 | 451 | 69,162 |

La ingestion necesita una política de división declarada (hijos con sufijo versionado, provenance al artículo padre) antes de construir cualquier índice; no se decidió aquí.

### F3 — Mapeo pendiente (no defecto)

lawId namespace `MX-FED-*` por asignar (documentId actual tipo `ligie-2022`/`l...`); title/authority salen del join con `resources/legal-library-catalog.json`; el flip `status: quarantined` → `structurally-verified-currentness-unverified` solo tras textReview/legalReview; `published`/`indexed` permanecen false.

## Límites

Cero índices construidos, cero activación de corpus, cero nube real, cero gasto, cero entrenamiento. La lectura local de archivos en cuarentena para conteos no revisa contenido jurídico ni vigencia. "Conforme a contrato" ≠ contenido validado. F1/F2 son hallazgos de contrato verificables contra el código citado; su corrección (regex y política de división) requiere revisión independiente y no se aplicó.

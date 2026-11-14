# Adquisición Durango (2026-11-13) — CERRADO completo

Todo el material queda en CUARENTENA (textReview/legalReview pendientes). Nada se presenta como limpio, validado ni activado.

## Contabilidad (índice / intento / descarga / extracción)

- Índice: catálogo oficial `/Archivos/legislacion/` (Apache autoindex, ISO-8859-1; sha256 `cb6f1126c48bef7faf89f28ece1119f76f7124cb395fdc241a14239e2a3b40c9`): 259 hrefs PDF únicos.
- Universo adquirible: 165 = 259 − 93 archivos duplicados del propio catálogo («copy 1» estilo Windows; dedup por título normalizado conservando el archivo original) − 1 ABROGADA explícita (Ley de Protección de Datos Personales (ABROGADA), contabilizada aparte como histórico no adquirido).
- Barrido HEAD completo de los 165 (2026-11-13): 165× HTTP 200 application/pdf, 0 sobre techo duro 20,971,520 B, total ~68 MB.
- Descarga: 165/165 en 17 lotes (resources/legal-acquisition-dgo-leyes-01..17-2026-11-13.json), sin elevación de presupuesto.
- Extracción: 165/165 cuarentenados, 19,218 registros, 0 fallos. Incidentes: un network-error transitorio (dgo-ley-249) cerrado con reintento idempotente; un 'cancelled' artificial (dgo-ley-013, doble instancia del loop detenida de inmediato) cerrado con reintento idempotente. Sin elevación de límites, sin exclusiones.

## Verificaciones previas (basis documentada, no conclusión legal)

robots.txt presente (200) con solo `Disallow: /Archivos/LXX/CONTRALORIA/` y `/Archivos/LXIX/CONTRALORIA/` (los targets bajo `/Archivos/legislacion/` quedan permitidos); sin restricciones a agentes IA ni content-signals; Aviso de Privacidad (200) con solo texto de datos personales, sin cláusulas de reúso/PI/prohibición; sin otros términos de uso localizados en home ni catálogo; el propio congreso publica descargas directas. La ausencia de términos NO se presenta como autorización expresa del titular. Base documentada: LFDA 14.VIII. Solo textos normativos oficiales (constitución, códigos, leyes, reglamentos estatales). Vigente/histórico: la 1 ABROGADA explícita quedó fuera y contada aparte; el resto del catálogo no marca estatus.

Resultado: 165/165 adquiridos y cuarentenados, 19,218 registros. Cobertura completa DEL CATÁLOGO (no se afirma cobertura del universo jurídico estatal fuera de él).

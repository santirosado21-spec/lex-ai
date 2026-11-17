# Adquisición Zacatecas (2026-11-17) — CERRADO con exclusiones documentadas

Todo el material queda en CUARENTENA (textReview/legalReview pendientes). Nada se presenta como limpio, validado ni activado en producto.

## Fuente y base documentada

- Congreso del Estado de Zacatecas, Sistema Estatal Normativo: https://www.congresozac.gob.mx/65/leyes (índice, HTTP 200 con UA identificable `LEX-AI-LegalLibraryResearch/0.1`; sha256 del índice 7ad9f7c8911b8e84fbaf442917dd54105b5f779beaf2dbf54582e94d50ca4a76).
- robots.txt HTTP 200, `User-agent: * Disallow:` vacío (permite todo; SIN content-signals y SIN bloqueos a agentes IA): sha256 53fe30e279057a307a5790ae0c90b960c93760f06d0b31aae097f4a52ac89321. La limpieza de robots NO es autorización expresa del titular; base documentada: LFDA art. 14 VIII (base documentada, no conclusión jurídica). No se localizó aviso legal ni términos de uso enlazados desde el índice (ausencia de términos ≠ permiso expreso).
- Primera revisión de esta entidad (no estaba en state-review-20261113). Enlaces directos por documento `/65/ley&cual=N&tipo=pdf` (+gemelo `tipo=doc` no usado; PDF canónico).

## Resultado

- 144 documentos catalogados (latin-1, ids por `cual` del sitio: zac-ley-NNN), 15 registries canónicos `resources/legal-acquisition-zac-oficial-01..15-2026-11-17.json`, límites duros del programa (10 docs/corrida, 1 req/2s, timeout 45s, 10MB/doc, sin reintentos).
- Descargados: 144/144. Extraídos y cuarentenados: 140/144 (12,086 registros estructurales, conteo desde archivos de extracción; SIN revisión independiente de contenido).
- Fallidos (4, PDFs conservados en snapshots, todos CON capa de texto — NO son cola OCR):
  - zac-ley-014 (Ley de Estímulos y Recompensas, decreto 206 de 1955): extraction-invalid — formato histórico de decreto (preámbulo/considerandos, 0 líneas con forma de encabezado de artículo en la capa de texto); el extractor falla cerrado, correcto.
  - zac-ley-060 (Ley Orgánica UAZ): extraction-invalid — 0 líneas con forma de encabezado reconocible (resultandos/títulos); falla cerrada correcta.
  - zac-ley-063 (Ley de Participación Ciudadana): extraction-invalid — solo 5 líneas tipo artículo (notas de adicionado); estructura no reconocible; falla cerrada correcta.
  - zac-ley-213 (Ley de Asociaciones Público Privadas del Estado de Zacatecas): extract-failed — stream flate corrupto ("Bad block header in flate stream"); pdf-parse/PDF.js aborta, Poppler tolera y la extracción directa sobre la capa de texto produce 132 registros sin anomalías. Clase: PDF con stream corrupto; recuperable solo vía ruta de parser alterna (cambio de pipeline con bump de versión; NO forzado).
- 0 publicados, 0 indexados, 0 exportados.

## Otras entidades revisadas hoy (sin adquisición)

- Puebla: BLOQUEADA por señal expresa — robots de congresopuebla.gob.mx con `Content-Signal: search=yes, ai-train=no, use=reference` + Disallow a crawlers IA + challenge Cloudflare en el índice. ojp.puebla.gob.mx: handshake TLS cortado (bloqueado-TLS). periodicooficial.puebla.gob.mx: HTTP 000. Sin reintento por temporizador ni evasión; requiere cambio de señal del titular.
- Hidalgo (www.congreso-hidalgo.gob.mx): HTTP 000 en esta corrida (inalcanzable; timeouts ≠ ausencia; solo reintentos acotados si hay señal nueva).
- Sonora (congresoson.gob.mx): robots ausente (404 SPA; ausencia ≠ permiso) + reCAPTCHA en sitio → pendiente-analisis-y-terminos. Sin evasión del captcha.

## Reproducción

```sh
node scripts/legal-acquisition.mjs --plan --registry resources/legal-acquisition-zac-oficial-01-2026-11-17.json
node scripts/legal-acquisition.mjs --live --registry resources/legal-acquisition-zac-oficial-NN-2026-11-17.json --out artifacts/public-corpus/zac-oficial-NN-2026-11-17
```

## Diagnóstico fino (mismo día)

Los 3 extraction-invalid son fallas cerradas correctas por estructura documental no reconocible (sin encabezados de artículo en la capa de texto); NO se forzó segmentación. zac-ley-213 es la única clase recuperable (stream corrupto) y requeriría ruta de parser alterna con bump de extractor y verificación real; queda documentada, no reparada en este ciclo.

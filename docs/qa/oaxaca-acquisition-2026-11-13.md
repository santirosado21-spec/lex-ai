# Adquisición Oaxaca (2026-11-13) — CERRADO con exclusiones documentadas

Todo el material queda en CUARENTENA (textReview/legalReview pendientes). Nada se presenta como limpio, validado ni activado.

## Contabilidad (índice / intento / descarga / extracción)

- Índice: catálogo oficial `legislacion_estatal.html` (sha256 `bb6bd7b2342bd665684890453ac0be23cf0c92cf6bfdd122379fa818d8a10e2b`): 230 coincidencias href, 225 PDFs únicos. Los enlaces resuelven a `https://congresooaxaca.gob.mx/docs66.congresooaxaca.gob.mx/legislacion_estatal/...`.
- Barrido HEAD completo de los 225 (2026-11-13): 224× HTTP 200 application/pdf, 0 sobre techo duro 20,971,520 B, 1× HTTP 404 (oax-ley-010, Decreto bases/factores de distribución — exclusión documentada).
- Descarga: 224/224 en 23 lotes (resources/legal-acquisition-oax-leyes-01..23-2026-11-13.json), sin elevación de presupuesto (máx. doc 5,739,195 B).
- Extracción: 222/224 cuarentenados, 18,290 registros. Lotes 01-04 con extractor v24, 05-23 con v25 (la reparación v25 aterrizó a mitad del barrido; parserVersion queda registrado por corrida).
- Exclusiones permanentes (escaneados sin capa de texto, pdftotext=0, sin OCR): oax-ley-219 (Presupuesto de Egresos, 5.7 MB) y oax-ley-222 (archivo titulado "231", presupuesto escaneado).

## Verificaciones previas (basis documentada, no conclusión legal)

robots.txt ausente (HTTP 404); sin términos de uso localizados en home ni catálogo (única etiqueta legal, "Aviso de Privacidad", resuelve a 404 = NO localizada); sin encabezados content-signal ni x-robots; el propio congreso publica descargas directas. La ausencia de términos NO se presenta como autorización expresa del titular. Base documentada: LFDA 14.VIII. Solo textos normativos oficiales (constitución, códigos, leyes, reglamentos, decretos normativos, series fiscales de ingresos/egresos). Vigente/histórico: la serie de Leyes de Ingresos incluye ejercicios 2016-2025 (históricos conservados como serie oficial publicada).

Resultado: 222/224 adquiridos y cuarentenados, 18,290 registros; 1 enlace roto (404); 2 escaneados sin texto (exclusión permanente). NO se afirma cobertura completa del universo estatal oaxaqueño fuera de este catálogo.

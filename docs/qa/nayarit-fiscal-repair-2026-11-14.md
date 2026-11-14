# Reparacion serie fiscal Nayarit 2026 (nay-ley-124..147) — 2026-11-14

## Diagnostico
- Los 24 PDFs de la serie fiscal (Leyes de Ingresos 2026 estatal y municipales + 3 fe de erratas) fallaban como invalid-pdf.
- Causa real: defecto del servidor, no bloqueo anti-bot. La respuesta antepone un fragmento HTML de 921 bytes (pagina de error con enlaces localhost de desarrollo) y anexa un cierre `</html>` tras `%%EOF`. Mismos bytes para cualquier cliente: verificado byte a byte que la ruta navegador (cloud browser, autorizada 2026-11-13 21:06) y un GET directo reciben contenido identico (primer 1 MB sha igual, mismo total 1,510,998 bytes en nay-ley-124).
- No hubo elusion de UA ni sorteo de restriccion: el sitio no diferencia por cliente; es un defecto de configuracion que corrompe el payload.

## Reparacion (byte-level, documentada)
- Regla: descartar bytes antes del primer magic `%PDF-` y despues del ultimo `%%EOF`. Prefijo uniforme de 921 bytes en los 24 documentos.
- Verificacion por documento: magic `%PDF-`, pdftotext exitoso con contenido sustantivo (>200 bytes de texto), sha256 registrado.
- Los bytes reparados se inyectaron como snapshots nuevos (nunca sobreescritos los existentes) en nay-leyes-13/14/15 con manifiesto y ledger actualizados por la via sanctioned (mismo formato que runLegalSync+captureSync), y se reprocesaron con `--offline` (sin nueva descarga). mimeBasis queda `unknown` (sin receipt de red); esta nota es la procedencia.
- Resultado: 24/24 cuarentenados. 1,337 registros extraidos (batch 13: 435, batch 14: 551, batch 15: 351). Todo cuarentenado: sin publicacion, sin export, sin ruta a producto.

## Estado de fallidos tras la reparacion
- invalid-pdf serie fiscal Nayarit: 24 -> 0.
- nay-ley-148 (Presupuesto de Egresos 2026, >10MB): sigue fallido. Su clase original era document-byte-budget (techo duro); la ultima corrida offline reporta snapshot-unavailable (nunca hubo snapshot). Mismo documento, pendiente de decision (presupuesto elevado o descarte), NO recuperado en esta reparacion.

## Corte canonico global tras la reparacion
- ids registrados: 2,584 (sin cambio; eran ids ya registrados)
- PDFs presentes: 2,580 (+24)
- extracciones validas: 2,569 (+24)
- registros: 246,863 (+1,337)
- fallidos por clase: 11 extraction-invalid (6 cola OCR + 5 estructura), 2 document-byte-budget (ags-ley-2529, bc-presupuestoestado2026), 1 document-byte-budget/snapshot-unavailable (nay-ley-148), 2 catalog-link-broken (col-ley-104, col-reg-023).

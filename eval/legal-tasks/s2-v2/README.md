# S2a V2 — aceptación independiente nueva

Seis casos nuevos: tres de investigación (partyRole=null legítimo) y tres contractuales con rol conocido. Nuevos IDs, preguntas, supuestos y criterios: no se reutilizaron casos V1 ni fixtures S1. Autor Codex/Sol en función de autor independiente SF, separado del constructor del arnés. No se consultaron salidas de modelos ni calificaciones ciegas V1. Durante esta autoría no se generaron respuestas del piloto ni se contactaron proveedores o personas; la propia autoría usa un asistente LLM, por lo que no se afirma ausencia de inferencia LLM. No hay revisión profesional ejecutada.

## Procedencia

Preguntas, documentos contractuales, preferencias y reglas ficticias se inventaron para V2. No contienen expedientes o datos de clientes. Dos fuentes públicas son artículos 1796 y 1797 del CCF: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf. Cotejo literal contra el texto del PDF oficial abierto vía web el 2026-11-10T00:25:13.459Z, líneas de artículos en página física175 (índice174); saltos de línea convertidos a espacios. Palabras y puntuación coinciden con los registros seleccionados de C1. Cabecera declara reforma14-11-2025, sin verificación de vigencia al asOf.

Captura C1: 2026-11-09T23:38:56.066Z; PDF SHA256 `4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76`; versión `ccf@sha256:4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76`. Archivo consultado: `artifacts/public-corpus/c1-final-pilot-20261109/extractions/ccf/4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76/c7dbfc4ac8c67deac2afc7c5008cb5d6917d3e7369a22f85aefa80f4be08e689.json`. sourceEvidence conserva páginas, fecha del cotejo, hash exacto de texto, captura y versión. text-reviewed sólo describe estos dos pasajes para evaluación; no promueve C1, no cambia cuarentena/indexación ni constituye revisión jurídica integral, de aplicabilidad o vigencia. Los otros textos normativos dicen expresamente que son ficticios.

## Evaluación y reserva

Rúbricas locales con máximo cuatro criterios concretos por caso, sin respuestas prefabricadas ni puntos automáticos por humanReviewRequired. Fidelidad, excepciones adversas, límites y ambigüedad se revisan contra lo suministrado. Formato/citas se evalúan por S1 aparte. Sólo input llega al modelo: nunca ID local, gold, README o notas del autor. No usar estos casos para ajustar skills o guías semánticas del constructor.

No se alteraron skills/S1 ni archivos s2 originales. La corrección mecánica común de V2 pertenece al arnés y debe ser idéntica en ambos brazos. Estos seis casos se congelan antes de las24generaciones propuestas; no retocar tras observar respuestas. Los seis envíos cancelados V1 se conservan separados y no prueban eficacia;30intentos totales de sesión como máximo. Longitud final de wrapper+schema+skill queda para verificación del ejecutor; inputs compactos y presupuestados para2500tokens de respuesta.

Al abrirlos para revisión/publicación se retiran como aceptación futura; futuras afinaciones necesitan nuevos casos. Un pase de este piloto no implica ganador de producto, generalización, cobertura nacional, validación profesional ni exactitud jurídica medida de producto.

## Freeze del autor

Fecha UTC: 2026-11-10T00:25:13.459Z

- cases.jsonl SHA256: `323e2b6ca1eb76ad34dbf1ccbc967aedb003f040d1c369d1050fc29c92da7b0b`
- rubrics.json SHA256: `d1729c63b92981ebc2db0836bd555a41bedfe536456acc5d9b998589205c811d`

Sin uso live en esta autoría; pendientes revisión del coordinador y revisión independiente del arnés antes de enviar. SHA del README completo se registra externamente para evitar autorreferencia.

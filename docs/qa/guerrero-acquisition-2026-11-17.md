# Adquisición Guerrero (EN CURSO, pausada por prioridad de reparación Zacatecas)

Fecha: 2026-11-17. Estado: adquisición parcial, TODO en cuarentena; nada liberado.

## Fuente
- Índice: https://congresogro.gob.mx/legislacion/leyes-ordinarias.php (HTTP 200, 93,546 bytes, sha256 983daabfa1dd9b9cb0bbd550c2e16ff648fea4a28c364f772f341e91cb95cc28; sin challenge).
- robots.txt: HTTP 200, sha256 8fa3036c68bfcbd32365f6225d24333264093b7cd38d306e106b4dbdc934fd5b — SOLO preámbulo Cloudflare de content-signals (1,248 bytes): no declara ningún Content-Signal ni regla User-agent. Según su propia regla (c), la ausencia de señal ni otorga ni restringe. Sin términos localizados desde el índice (ausencia NO es autorización expresa).
- Host añadido a ALLOWED_HOSTS (server/legal-sync.mjs) siguiendo el precedente de Zacatecas.

## Alcance
- 139 PDFs únicos deduplicados por URL (276 anchors con .pdf en el índice; dedup por URL absoluta; 2 URLs con espacios codificados %20).
- 14 registries resources/legal-acquisition-gro-oficial-01..14-2026-11-17.json (10 docs/lote, último 9), límites ACQUISITION_LIMITS, UA identificable, 1 req/2s.

## Resultado parcial (lotes 01-09)
- 01-07, 09: 10/10 cuarentenados cada uno.
- 08: 9/10; gro-ley-073 falló document-byte-budget (PDF >10MB; clase ya conocida, fuera de ciclo como ags-ley-2529 y bc-presupuestoestado2026).
- Lotes 10-14: NO ejecutados (pausa por prioridad de reparación del lote Zacatecas tras revisión independiente).

## Notas
- Extracciones cuarentenadas; sin publicación, sin activación en producto.
- Los valores status='approved'/approvalAuthority='developer-reviewed' en los registries son requisitos mecánicos del validador del pipeline (source-registry.mjs); la evaluación de derechos es SUSTENTADA por la evidencia citada, no aprobación del titular ni conclusión legal por delegación.

# Revisión independiente: contrato experimental v2 de preservación

- Fecha: 2026-11-24 (America/Mexico_City). Revisor: Kimi (sesión Orca f14e396b).
- Objeto: `docs/qa/preservation-contract-v2-candidate-2026-11-24.md`, `artifacts/library-expansion-20261124/experiment/preservation-contract-v2.mjs` y `.test.mjs`, y la salida real `artifacts/library-expansion-20261124/preservation-contract-v2-candidate.json`.
- Alcance: ejecutar las pruebas referidas, validar el archivo real contra el contrato y barrer el consumo. Solo lectura sobre código/corpus/app; sin adopción ni desarrollo; no se repitieron unidades cerradas.

## 1. Ejecución de pruebas

`node --test artifacts/library-expansion-20261124/experiment/*.test.mjs` → **15/15 PASS, 0 fail** (3 de preservación del sidecar + 12 de contrato/consumidor, incluidas las 11 mutaciones de rechazo: versión desconocida, bandera de promoción, estado de revisión, página faltante, identidad de página, vínculo de hash de fuente, manipulación de texto, id duplicado, conteo de caracteres, cobertura no estructurada oculta e identidad de fuente).

## 2. Validación del archivo real (independiente del auto-reporte)

Script propio importando `validatePreservationEnvelope`/`consumePreservationEnvelope` del módulo y leyendo `preservation-contract-v2-candidate.json`:

- Contrato `legal-source-preservation-v2-experimental`, versión 2, `purpose: source-preservation-only`, `promotionAllowed: false`, `operativeRecordsIncluded: false`.
- `validatePreservationEnvelope` → `{valid:true, adoptable:false, legalStructureVerified:false}`.
- `consumePreservationEnvelope` en modo `source-review` devuelve las páginas 81–90 con advertencia "not an operative legal record" en los 10 segmentos; en modo `legal-search` lanza `legal-consumption-not-authorized`.
- Fidelidad al sidecar: `source`, `coverage` y `segments` del sobre son idénticos (JSON profundo) a los de `post-body-source-segments-candidate.json` — 10 segmentos, 22 379 caracteres. La preservación byte-exacta de esos segmentos contra `Reg_LAdua.txt` ya se verificó en `docs/qa/kimi-preservation-review-20261124.md` y se mantiene.
- El módulo solo importa `node:crypto`; no importa código de app/server y no muta el sobre (la prueba 6 lo comprueba y mi corrida lo confirma).

## 3. Barrido de consumo

- `grep -rl` de `preservation-contract-v2`, `post-body-source-segments`, ambos JSON candidatos y `legal-source-preservation-v2` sobre `server/ src/ src-tauri/ crates/ scripts/ office-addin/ sharepoint-addin/ supabase/ resources/ eval/ fixtures/ landing/`: **cero coincidencias**. Ningún consumidor de la app, importer, corpus o recursos referencia el experimento ni sus salidas.
- `git status`: ningún archivo rastreado modificado; solo documentos nuevos en `docs/qa/` (los artefactos viven en directorio no rastreado). Índice congelado, corpus aceptado y app intactos.

## 4. Observaciones y límites

- El contrato valida integridad mecánica interna (hashes de texto por segmento, identidad de fuente, cobertura completa de páginas, barreras de promoción). Como declara el propio candidato, **no** valida autenticidad criptográfica de extremo a extremo: un actor con escritura podría alterar datos y hashes a la vez; el vínculo con el PDF real depende de cotejar bytes contra la adquisición (hecho en la revisión del sidecar: `bcdfcd90…`/`16e05725…` coinciden con `acquisition-manifest.json`).
- El consumidor es una puerta de exhibición (`source-review`), no una barrera de seguridad contra un consumidor malicioso que lea el JSON directamente; su valor es de contrato/convención verificable, no de aislamiento.
- La separación semántica de la página mixta 81 y del registro transitorio 144, las 7 diferencias entre parsers y la fidelidad DOF/fechas siguen pendientes según el propio candidato; esta revisión no las cubre ni las resuelve.

## 5. Veredicto

**PASS como contrato experimental aislado.** Las afirmaciones verificables del documento se sostienen: 15/15 pruebas, archivo real válido con `adoptable:false`, consumidor limitado a revisión de fuente con bloqueo de modo jurídico, y ningún consumo fuera del experimento. No constituye adopción ni habilitación de integración; los pendientes declarados siguen abiertos.

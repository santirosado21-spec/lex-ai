# Inventario de runtimes del escritorio: qué falta y criterios de procedencia

Estado: NINGÚN runtime está aprobado. Este documento no aprueba binarios, no descarga ni instala nada.

## Qué exige el build nativo
`scripts/prepare-desktop.mjs` necesita `LEX_RUNTIME_INVENTORY` (JSON revisado) y `LEX_RUNTIME_ARTIFACTS` (directorio con los artefactos aprobados). El código no descarga runtimes. Formato (`server/desktop-target.mjs`, `approvedRuntimeInventory`): `schemaVersion 1`, `target` (`mac-arm64` o `mac-x64`), `files[]` con `path` bajo `runtime/` o `resources/runtime/`, `bytes`, `sha256`, `executable`; deben existir `runtime/node` y `resources/runtime/ollama` como ejecutables de la arquitectura del destino. Más `sourceFiles[]` (path, bytes, sha256).

## Qué se puede producir sin instalar nada
`node scripts/runtime-source-inventory.mjs [salida.json]` lista las fuentes versionadas que el inventario espera (mismo filtro que prepare-desktop) con bytes y sha256, y deja `files: []` y `reviewStatus: generated-unreviewed-no-runtime-approved`. Es de solo lectura: no escribe en el repo, no descarga y no aprueba. Un humano debe revisar la lista antes de usarla como inventario.

Hallazgo para decidir: el filtro de fuentes incluye `resources/*.json`, y hoy hay 399 archivos `resources/legal-acquisition-*.json` ya versionados en main (400 rutas coinciden con "acquisition"). Con ese filtro irían al paquete de escritorio. Los archivos en cuarentena sin rastrear no entran. Si deben o no distribuirse es una decisión pendiente; este script no la toma ni los filtra en silencio.

## Criterios de procedencia por binario (los decide una persona)
Para `node` y `ollama` de cada destino: origen oficial y URL exacta de la versión; versión fija; licencia y avisos incluidos; sha256 publicado por el proveedor comparado con el calculado localmente; firma/notarización de macOS si existe; `lipo -archs` coincide con el destino; sin enlaces simbólicos ni alias; quién aprobó y cuándo. Para un modelo incluido (`LEX_BUNDLED_MODEL_SOURCE`): manifiesto, licencia y blobs verificados por `verifyBundledModel`.

## Sin resolver
Origen y versión de los binarios; decisión de usar copias ya instaladas en la Mac del usuario (requiere su decisión y revisión de licencia); modelo incluido; VoiceOver y apariencia del sistema siguen pendientes; la app nativa no está aprobada.

# Rejon.AI · Radar público V0: contrato de observaciones (sin n8n activo)

**Origen:** propuesta de Pedro de adaptar los radares y recetas de Córdelius a Rejon.AI.  
**Estado:** experimento público/sintético, sin credenciales, sin scraping, sin programación horaria, sin carga de expedientes y sin n8n operativo.  
**Rama:** `pedro/radares-publicos-contrato-20261111`. **Owner:** Pedro/ChatGPT. **Revisor independiente:** pendiente.

## Objetivo

Una frontera pequeña y verificable entre **observación pública** y **sugerencias jurídicas**. El contrato prepara eventos y deduplica cambios, pero no determina vigencia, autenticidad, obligatoriedad ni relevancia para asuntos privados.

**Funciona sin red:** `server/public-radar-observations.mjs` acepta solo sobres explícitos y devuelve `eventId` determinista (SHA-256), estado `unverified`, `legalAccuracy:'not-evaluated'` y `scope:'public-only'`. No se importa ni consulta ningún cliente ni base de datos. La integridad del digest aportado y la oficialidad de la página NO se prueban aquí.

## Fuentes acotadas V0

- `dof` — `dof.gob.mx` y `www.dof.gob.mx`.
- `sjf` — `sjf2.scjn.gob.mx` y `sjf.scjn.gob.mx`.

**La validación del dominio no prueba que el contenido sea oficial o verdadero.** El contrato V0 deliberadamente **rechaza cualquier query string, fragmento, credencial URL, puerto extra y ruta codificada**, por lo que todavía no puede ingerir muchos enlaces reales del DOF o SJF. Eso es un bloqueo previsto, no un bug que deba sortearse con fetch arbitrario. Antes del adaptador real se deben diseñar las reglas específicas para enlaces de documentos/registro, redirects, licencia, frecuencia y autenticación.

Fuentes públicas de referencia consultadas:
- DOF: https://dof.gob.mx/
- SJF: https://sjf2.scjn.gob.mx/busqueda-principal-tesis
- Documentación n8n: https://docs.n8n.io/hosting/securing/security-audit/

## Estructura de entrada (ejemplo ficticio)

```json
{
  "source": "dof",
  "sourceUrl": "https://dof.gob.mx/publicaciones/123",
  "title": "Acuerdo jurídico ficticio para pruebas públicas",
  "publishedDate": "2026-11-11",
  "observedAt": "2026-11-11T23:40:00Z",
  "revision": "v1",
  "digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

**No se permite ninguna clave adicional:** `client`, `matterId`, `rawText`, `token`, `webhook`, `verified`, `status`, etc., invalidan el sobre. El parser no puede garantizar que un título enviado por otro componente sea público: el adaptador **debe** obtenerlo de una fuente pública permitida antes de llamarlo, sin pasarle texto de expedientes, prompts o nombres privados.

## Resultados de prototipo

1. `normalizePublicRadarObservation(input,{now})`: valida fuente/URL/fecha/timestamp/revisión/digest, genera ID y fija `verification:'unverified'`.
2. `aggregatePublicRadarObservations(events,{seen,now})`: procesa hasta 200 eventos, divide `fresh` y `duplicates`, reintentos idempotentes si el llamador conserva IDs; **no persiste estado ni envía nada**.
3. `normalizePublicRadarSignal(signal,{now})`: distingue `failed`, `ok-empty` y `ok-observations`, con momento explícito. «Sin novedades» nunca equivale a «fuente falló».

Límites: hasta 200 observaciones por lote y 5000 IDs vistos por solicitud, tamaño de títulos y URLs acotado. El `digest` SHA-256 hexadecimal representa un hash informado por el futuro capturador; **no** equivale a haber verificado el texto remoto. Al cambiar el digest o la revisión se produce nuevo evento. Si cambia solo el título, no se inventa cambio de versión.

## Próximo diseño n8n: receta sin activar

```text
Cron público revisado (futuro) → adaptador por fuente con rate-limit →
captura pública con licencia/robots y metadatos → digest verificado →
normalización V0 → deduplicación/cursor y cuarentena →
revisión de procedencia → registro público versionado →
digest Hoy (opcional, aprobación) → coincidencias LOCALES con el asunto
```

No existe aquí un cron, webhook, endpoint, API, workflow JSON de n8n, ejecución remota ni notificación. Las consultas autenticadas a expedientes judiciales quedan **fuera**.

Antes de usar n8n real: credenciales mínimas, red de salida restringida, auditoría de nodos con capacidades peligrosas, logs sin originales ni metadatos privados, retención limitada, webhook autenticado, replay/idempotencia, controles de costo y decisión explícita de quién hospeda.

## Criterio de aceptación V0

- Tests con entradas sintéticas y negativas: URLs maliciosas, hosts lookalike, claves extra, titulación vacía, fechas futuras/imposibles, hashes mal formados, duplicados y fallos de fuente.
- Node en runner GitHub-hosted público, sin secretos; cero llamadas a red, shell o filesystem del módulo.
- `source verification` **no reclamado**. Juristas deben revisar las fuentes antes de que una notificación pueda generar una propuesta de tarea.
- Revisión independiente del HEAD antes de fusionar. No activar ninguna ruta de escritura ni n8n por esta PR.

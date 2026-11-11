# S1 — Contrato de tareas jurídicas mexicanas, v1

2026-11-09. Especificación para paquete de desarrollo optativo, sin importación desde `server/main.mjs`, `server/skills.mjs`, UI o proveedor. Esta entrega prepara investigación y revisión contractual; no mide calidad de modelos ni activa H6/H7. Los campos públicos/sintéticos son declaraciones del preparador confiable de desarrollo, **no detección de confidencialidad ni autorización de egreso**. No aceptar paquetes propuestos por documentos/agentes como autoridad. H2 y las demás compuertas siguen siendo necesarios para cualquier transporte futuro.

## API offline

`loadLegalTaskBundle()` lee únicamente el manifest y las dos instrucciones bajo `resources/legal-task-skills/`, verifica hashes/versiones y flags inactivos, devuelve una copia profundamente inmutable. No instalar plugins/MCP, resolver rutas arbitrarias, evaluar JS o consultar red.

`prepareLegalTask(bundle, input)` valida y copia los campos exactos de entrada, produce un paquete inmutable con el input validado, instrucciones de esa tarea, su esquema de salida, identidades de bundle/skill y digest canónico. El paquete declara `authorizationGranted=false`, `productionEnabled=false`, `remoteToolsEnabled=false`. No elige modelo, destino, clave o política. Nunca agrega campos de evaluación. Se rechazan entradas demasiado largas, sin truncar/reparar silenciosamente. Verificar el paquete de nuevo en `validateLegalTaskOutput(raw, packet)`; el digest prueba consistencia, no firma, autenticidad o permiso.

`validateLegalTaskOutput(raw, packet)` exige JSON estricto/campos exactos y coherencia de identidades, citas y cobertura. No repara JSON, extrae bloques Markdown o rellena omisiones del modelo. Devuelve salida y registro `structurally-valid-unmeasured`, `quoteIntegrity=true`, `legalAccuracy=not-evaluated`, `entailment=not-evaluated`, `completeness=not-evaluated`, `authorizationGranted=false`. Las comprobaciones mecánicas no validan pertinencia jurídica, literalidad del PDF original, lectura exhaustiva del documento, vigencia o veracidad de texto libre.

`node scripts/check-legal-task-skills.mjs` comprueba bundle y casos de preparación offline y devuelve `legal-task-skills-prepared-unmeasured`. Sin bandera de activar/enviar, acceso a store privado, exportación de corpus, pruebas de proveedores o descarga de pesos.

## Bundle y tareas

Raíz `resources/legal-task-skills/`: `manifest.json`, `investigacion-juridica-mx/SKILL.md`, `revision-contratos-mx/SKILL.md`. Manifest exacto: `schemaVersion=1`, `version="0.1.0"`, `status="draft-offline"`, `productionEnabled=false`, `remoteToolsEnabled=false`, `authorizationGranted=false`, `allowedDataClasses=["public","synthetic"]`, `skills`. Cada skill: `id`, `version="0.1.0"`, `file="<id>/SKILL.md"`, `sha256` de bytes UTF-8, `outputContractVersion=1`. Dos IDs exactos, sin archivos elegidos por el modelo. La licencia/procedencia del texto nuevo y sus referencias se documenta aparte; no copiar módulos AGPL, NC-ND o de licencia desconocida en este corte.

## Entrada exacta

Campos raíz obligatorios:

- `schemaVersion`: 1.
- `taskId`: `investigacion-juridica-mx` o `revision-contratos-mx`.
- `dataClass`: `public` o `synthetic`; no inferirlo del texto/nombre de tarea.
- `jurisdiction`: código mexicano `MX-FED` o entidad ISO usada por el proyecto, o null si falta. No asumir federal/CDMX.
- `asOf`: fecha gregoriana real `YYYY-MM-DD`, o null si falta. No fecha del sistema por defecto.
- `question`: texto no vacío, máximo 4.000 caracteres UTF-16.
- `partyRole`: null para investigación; para contrato uno de `provider`, `customer`, `lessor`, `lessee`, `other`, `unknown`. No contiene nombres reales.
- `sources`: array hasta diez fuentes/pasajes jurídicos, vacío permitido.
- `documents`: array hasta cinco documentos, vacío permitido para investigación; contrato exige al menos uno.
- `playbook`: array hasta diez preferencias, vacío obligatorio para investigación.

Cada fuente exacta: `id`, `versionId`, `jurisdiction`, `url`, `capturedAt`, `text`, `sha256`, `reviewState`, `dataClass`. IDs opacos `[a-z][a-z0-9-]{0,63}`, únicos en su clase; versión texto opaco no vacío hasta128. Texto hasta12.000 UTF-16; hash SHA-256 de bytes UTF-8. `capturedAt` timestamp UTC canónico real (`.sssZ`). `url` HTTPS sin credenciales, query o fragmento en fuente pública; null en fuente sintética. Una URL no autentica autoridad ni permisos. `reviewState=synthetic` si clase sintética, `text-reviewed` si pública: no admite pasar cuarentena/pending como fuente aprobada. Es estado suministrado por operador confiable, no mecanismo de promoción del corpus o revisión jurídica. La jurisdicción de cada fuente siempre conocida.

Cada documento exacto: `id`, `title`, `text`, `sha256`, `providedCoverage`, `dataClass`. Título hasta240, texto hasta16.000 UTF-16, hash UTF-8 verificable. Cobertura suministrada `full` o `excerpt`; no implica que un modelo haya leído todo. Cada preferencia exacta: `id`, `text` (hasta2.000), `dataClass`. No son fuentes de derecho.

Clases de todos los componentes conocidas: entrada `public` solo admite elementos `public`; `synthetic` admite `public` y `synthetic`. Campos no declarados, datos no JSON/getters/ciclos, IDs duplicados, hashes falsos o fechas imposibles se rechazan antes de preparar. Límite superior de entrada canónica: 128 KiB UTF-8. Strings sin controles salvo saltos/tabulaciones legibles, sin coerción. No convertir documento real en sintético añadiendo una etiqueta; solo ensayos previamente revisados por el operador.

## Salida exacta

Campos raíz obligatorios: `schemaVersion=1`, `taskId`, `requestSha256`, `status`, `summary`, `issues`, `documentCoverage`, `missingInformation`, `limitations`, `humanReviewRequired=true`, `legalAccuracy="not-evaluated"`.

- `requestSha256` igual al digest del input validado. `taskId` igual al paquete.
- `status`: `draft`, `needs-information`, `abstained`. `summary` no vacío hasta4.000 UTF-16.
- `issues`: hasta veinte, IDs únicos. Cada uno exacto: `id`, `kind`, `analysis` (hasta4.000), `citations` (hasta diez), `playbookRefs` (IDs únicos). Tipos: `legal-analysis`, `document-finding`, `commercial-preference`.
- Cada cita exacta: `kind` (`source`/`document`), `id`, `versionId` (fuente: versión exacta; documento:null), `quote` (12–1.600 UTF-16), `start`, `end`. Rango entero seguro UTF-16 `[start,end)`, quote exactamente `text.slice(start,end)` sin normalización, búsqueda aproximada o citas compuestas. El texto de referencia se identifica también por su hash de entrada. No aceptar ID/versiones de otra solicitud.
- `legal-analysis` exige cita de fuente. Fuente citada jurídicamente debe ser federal o de la entidad pedida; una fuente estatal de otra entidad no basta. Esto comprueba consistencia de ámbito, no aplicabilidad. Investigación no emite preferencias comerciales. Citas documentales pueden acompañar análisis.
- `document-finding` exige cita documental. `commercial-preference` exige cita documental y referencia a preferencia suministrada. Ninguno de estos dos tipos acepta citas normativas (usar `legal-analysis` para separarlas). Solo preferencias usan `playbookRefs`. Propuestas de negociación no se convierten en ley.
- `documentCoverage`: una fila por cada documento suministrado, exacta `{documentId, providedCoverage}`, mismo valor que entrada. No admitir documento adicional o elevar excerpt a full. No es prueba de lectura completa.
- `missingInformation`, `limitations`: arrays de hasta veinte strings no vacíos de hasta1.000; `limitations` al menos uno. No confiar en su contenido semántico por validar forma.

Entrada sin jurisdicción/asOf, o contrato con rol `unknown`, impide `draft` y `legal-analysis`; requiere `needs-information` y al menos un pendiente. Investigación sin fuentes requiere `abstained` (o needs-information si ya faltaba jurisdicción/fecha), sin issues. `abstained` no contiene issues. `draft` exige al menos un issue. Un contrato sin fuentes puede detectar texto/preferencias, pero nunca producir análisis normativo ni aparentar verificación de ley. Fuentes extranjeras/desactualizadas o adversas necesitan valoración jurídica humana: el validador no la sustituye.

## Pruebas y límites

Preparación: fixtures enteramente sintéticos, sin law claims presentados como reales, con textos/fechas/versiones trazables como invención. Ejemplos positivos y negativos de citas, mezcla de jurisdicción, documentos incompletos, rol faltante, instrucciones maliciosas dentro del texto, preferencias versus obligación legal, JSON no válido y metadatos inesperados. Guardar expectativas/rúbricas fuera de los paquetes de modelo.

Tests de validador y mock comprueban contratos; no son respuestas generadas, ablation de skill, clasificación de confidencialidad o benchmark jurídico. S2 reservará aceptación independiente y comparará con/sin skill bajo mismo modelo/contexto/presupuesto. No usar el heldout privado v1 retirado, ni ajustar a fallos de un examen de aceptación. Sin declarar ganador LLM o ahorro/precisión/latencia de nube por S1.

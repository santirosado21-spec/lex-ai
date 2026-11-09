# Backlog del loop híbrido

Fecha: 2026-11-09. H1 terminada y revisada; resto pendiente. Orden y archivos propuestos; leer vecinos antes de modificar. Este tablero es el vigente para la transición. `docs/loop/BACKLOG.md` es histórico y no alimenta este ciclo.

Estados: `todo`, `in-progress`, `review-pending`, `done`, `blocked`. Solo `done` desbloquea dependencias. Marcar revisión, commit y evidencia en cada tarea. Responsable y rama se reclaman antes de editar; nadie está asignado todavía.

El coordinador concede `done` únicamente con aceptación demostrada, revisión independiente registrada y referencia al commit probado. Para reabrir `blocked`: registrar diagnóstico, corrección propuesta y decisión explícita de reanudación del coordinador; nunca reinicio automático. Si cambia alcance o se requiere una autorización nueva, esa parte espera su autorización. H4 y H5 pueden avanzar en paralelo tras H3V con responsables/archivos separados; H6 conserva una puerta prudente de preparación del producto, no una afirmación de dependencia técnica inevitable.

| ID | Tarea | Depende de | Estado | Responsable / rama |
| --- | --- | --- | --- | --- |
| H1 | Contrato y transporte simulado | — | done | Codex / `docs/hybrid-psf-development-loop` (PR #1, `a99bb1f`) |
| H2 | Política de salida y auditoría sin texto | H1 | todo | Sin asignar |
| H3 | Sustituciones y restitución por ámbito | H2 | todo | Sin asignar |
| H3V | Primera rebanada vertical sin red | H3 | todo | Sin asignar |
| H4 | Detector local y examen independiente | H3V | todo | Sin asignar |
| H5 | Almacenamiento cifrado y restauración | H3V | todo | Sin asignar |
| H6 | Adaptador OpenRouter apagado y selección por tarea | H4, H5 | todo | Sin asignar |
| H7 | Integración de todas las rutas de generación y UI | H6 | todo | Sin asignar |
| H8 | Comparación ciega pública/sintética | H7, acceso y presupuesto autorizados | todo | Sin asignar |
| H9 | Respaldo externo y colaboración | Piloto y decisión de almacenamiento compartido | todo | Sin asignar |

## H1 — Contrato y transporte simulado

- Archivos asignados a Codex: `server/inference-mock.mjs`, `tests/inference-mock.test.mjs`, `tests/inference.test.mjs`, `docs/architecture/inference-contract-v1.md`, `docs/qa/hybrid-H1-2026-11-09.md`; backlog/memoria por el coordinador. Se añade la prueba del motor existente para comprobar compatibilidad contra ambos proveedores con el mismo conjunto de entradas; no se modifica producción. Se reutiliza la rama del PR #1 por pedido explícito de subir allí el avance.
- Leer contrato real de `server/inference.mjs` y consumidores antes de fijar la API. Preservar `outputContract`, estado, inicialización, generación asíncrona y parada según los usos actuales; no inventar compatibilidad.
- Definir además interfaces sustituibles de detector, correspondencias/almacenamiento y selección de ruta; ejemplos contractuales sintéticos de restauración, reversión y ámbito. Documentarlas junto a las pruebas antes de acoplar implementaciones concretas.
- Aceptación: respuesta por chunks, cancelación antes/durante generación, validación de entradas y copia profunda de solicitudes. Cambiar el objeto original después del envío no cambia la captura. Capturar tanto la estructura como los bytes serializados que habría recibido un transporte remoto, con un formato determinista documentado.
- Sin red, llaves ni cambios del proveedor activo. Pruebas con entradas inválidas y abortos; no registrar prompts de usuarios reales.
- Revisión: subagente independiente `review_h1`, contexto separado y solo lectura. Hallazgo P2 de fixtures dispersos corregido con regresiones y vuelto a comprobar; veredicto final `APPROVE`. Commit probado: `a99bb1f`. Evidencia: [reporte H1](../qa/hybrid-H1-2026-11-09.md), dirigidas 34/34, suite 437/437 y build OK. El coordinador marca `done`; H2 queda desbloqueada, todavía sin iniciar.

## H2 — Política de salida y auditoría

- Archivos propuestos: `server/egress-policy.mjs`, `tests/egress-policy.test.mjs`, `tests/egress-canary.test.mjs`.
- Aceptación: denegar por defecto; exigir despacho, asunto, hilo y destino autorizados. Política fuera del prompt. Revalidar revocación por operación y rechazar herramientas/destinos no permitidos. Contexto sin clasificación fiable no sale.
- Pruebas: solicitud completa capturada con dos despachos y dos asuntos sintéticos, historial y metadatos; errores y cancelación no producen envíos alternos. Auditoría solo con categorías, ámbito, destino, fecha, resultado y versión de política, sin texto ni secretos.
- Este paso no presume que una lista de canarios detecte todo dato sensible.
- Revisión/commit/evidencia: pendientes.

## H3 — Sustituciones y restitución

- Archivos propuestos: `server/privacy/pseudonyms.mjs`, `tests/privacy-pseudonyms.test.mjs`.
- Aceptación: entidades declaradas de fixtures se sustituyen con marcadores estables dentro del asunto y aislados entre ámbitos. Restituir solo marcadores conocidos; no reemplazar texto libre ni aceptar marcadores de otro asunto. Pruebas de colisión, reinicio de sesión simulado, Unicode y marcador dividido entre chunks.
- Mapa inicialmente en memoria sintética; no persistir correspondencias privadas en claro. Las respuestas restituidas se vuelven a proteger en los seguimientos. Mantener cita/procedencia de la fuente original por separado de su representación enviada.
- Revisión/commit/evidencia: pendientes.

## H3V — Primera rebanada vertical sin red

- Archivos propuestos: `tests/hybrid-offline-flow.test.mjs` y fixtures sintéticos de esa prueba; asignar cambios de interfaces solo si H1–H3 los requieren y registrar el motivo.
- Aceptación: componer recuperación sintética por ámbito, sustitución de entidades declaradas, puerta de salida, proveedor simulado, validación y restitución. Capturar los bytes completos, comprobar aislamiento y que una respuesta restituida se vuelva a proteger en el siguiente turno. No usar la red ni persistencia real.
- Reejecutar esta prueba contractual al introducir H4, H5 y H6, sustituyendo sus dobles de prueba. H7 cubre después la matriz completa de llamadas del producto; no será el primer contacto entre componentes.
- Revisión/commit/evidencia: pendientes.

## H4 — Detector local medido

- Archivos propuestos: `server/privacy/detector.mjs`, `tests/privacy-detector.test.mjs`, `eval/privacy/README.md`, `eval/privacy/cases.jsonl`, `scripts/eval-privacy.mjs`.
- Aceptación: pipeline local de reglas/detector con fallos que bloqueen salida; RFC/CURP/CLABE, nombres, relaciones, correos/domicilios e identificadores judiciales, incluyendo datos en historial/metadatos. Formatos no soportados se rechazan para envío.
- Separar desarrollo y examen retenido. Reportar por categoría omisiones, falsos positivos y hechos reidentificables; no solo promedio. Fijar con el coordinador los criterios del piloto antes de observar el examen y reservar revisión humana para ambigüedad. No equiparar ausencia de canarios con anonimización garantizada.
- Medir tiempo/memoria del detector real, sin descargar o cargar automáticamente modelos grandes. 24 GB no validan el objetivo físico de 8 GB. Un modelo conversacional instalado no se considera detector evaluado.
- Revisión/commit/evidencia: pendientes.

## H5 — Cifrado recuperable

- Archivos iniciales a inspeccionar: `server/store.mjs`, `server/main.mjs`, `src-tauri/src/`. Crear contrato de migración y lista definitiva de archivos antes de implementar; elegir una solución mantenida y registrar la decisión, no criptografía propia.
- Aceptación: proteger originales, fragmentos, índices, correspondencias y temporales. Migración reversible desde copia sintética, bloqueo, custodia de claves y recuperación fuera del equipo perdido. Restauración real de una copia con evidencia.
- Prueba negativa: revisar artefactos en disco tras bloqueo/fallo; permisos de archivos no cuentan como cifrado. No migrar ni borrar la base de usuarios de esta Mac.
- Revisión especializada/commit/evidencia: pendientes.

## H6 — Adaptador y selección por tarea

- Archivos propuestos: `server/providers/openrouter.mjs`, `server/providers/task-router.mjs`, `tests/openrouter-provider.test.mjs`, `tests/task-router.test.mjs`.
- Aceptación offline: transporte inyectable, ruta remota apagada por defecto, modelo y endpoint permitidos explícitos, sin fallbacks silenciosos, credencial fuera de la UI. Verificar contrato con documentación oficial vigente al implementar.
- Simular errores de cuota, timeout, fallo de privacidad y cancelación. La lista permitida y límites se comprueban antes de enviar. Separar tarifa máxima por token de presupuesto total; los reintentos consumen presupuesto y requieren la misma política.
- Proponer dos perfiles remotos; no declarar modelos ganadores sin H8. No reutilizar claves/configuración del PSF de desarrollo.
- Revisión/commit/evidencia: pendientes.

## H7 — Integración completa

- Archivos a inspeccionar/asignar: `server/main.mjs`, `server/service.mjs`, `server/conversation.mjs`, `server/proactive-drafts.mjs`, `server/skills.mjs` y componentes de ajustes/chat en `src/`; fijar lista exacta antes de editar.
- Aceptación: todas las generaciones pasan por la puerta autorizada; historial, fuentes y herramientas respetan el ámbito. Conversación natural, fuentes oficiales, borradores y horas se conservan. La UI presenta LEX AI; destinos y alcance se explican en ajustes/revisión de salida cuando sean relevantes.
- Desconexión o cuota agotada conserva archivos/búsqueda/horas y explica el estado. Sin activar un modelo alternativo local/remoto ni ampliar contexto silenciosamente. Revocación efectiva y modo solo local probados.
- Revisión/commit/evidencia: pendientes.

## H8 — Comparación y piloto

- Archivos propuestos: `eval/hybrid/README.md`, conjunto independiente público/sintético y reporte en `docs/qa/` (nombrar al definir protocolo).
- Aceptación: comparación ciega y pareada de dos rutas con las mismas tareas; calidad conversacional, citas, jurisdicción, abstención, preservación de hechos, costo por respuesta aceptada y latencia. Registrar modelo/proveedor efectivo y tratamiento aplicable. No usar el examen para entrenar.
- Llamadas reales solo con acceso autorizado y presupuesto explícito si existe cobro. Un resultado técnico no autoriza datos de clientes ni activa producción. Registrar qué falta de validación profesional y de 8 GB.
- Revisión/commit/evidencia: pendientes.

## H9 — Respaldo y trabajo compartido

- Definir después del piloto. Copia consistente cifrada a disco externo o Drive y restauración; no abrir una SQLite activa desde varias computadoras mediante sincronización de carpetas.
- El servicio compartido con permisos y concurrencia es otro frente. Su arquitectura y archivos requieren una decisión posterior; no está implícito en la selección de una carpeta del director.
- Revisión/commit/evidencia: pendientes.

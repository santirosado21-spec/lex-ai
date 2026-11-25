# Edición de borradores: protección contra pérdida accidental

Base inspeccionada: 54e3444. Sin cambios de proveedor, red, corpus ni política de egreso.

## Mapa que determina el alcance

- `server/main.mjs`: el modo intakePilot permite state, intake.* y library.*, pero rechaza /analyze y acciones engine.*. El modo general envuelve inference con createGenerationGateway, sin habilitar destinos remotos.
- `server/service.mjs`: la generación jurídica general sigue usando inference.generate. No se cambia ni se ejercita aquí.
- `server/intake-pilot.mjs`: createIntakeGenerator prepara sobres acotados y usa su propia compuerta para el proveedor existente. inspectLocal/inspectSource usan inspectLocalDocument. No se llama a esas rutas con datos nuevos en esta prueba.
- `src/IntakePilot.tsx`: la edición de un borrador existente guarda por intake.edit. Ya bloqueaba selector, biblioteca y otras operaciones durante la edición, pero cerrar/recargar o pulsar Descartar perdía el texto sin advertencia.

## Unidad implementada

La edición muestra si hay cambios respecto al borrador guardado. Si los hay, registra beforeunload para la advertencia del navegador y pide confirmación al descartar. Guardar con éxito o volver al texto guardado elimina la protección. Un error al guardar conserva texto y protección. Entrar sin cambiar nada no registra advertencia.

No hay autoguardado ni nueva persistencia en localStorage/sessionStorage. No se manda texto a otro destino. No se cambia el contrato ni la validación de intake.edit. Un cierre forzado o corte de energía sigue pudiendo perder cambios. El comportamiento de cierre nativo de Tauri/macOS no fue medido, por lo que no se promete esa cobertura.

## Prueba y evidencia

`tests/draft-edit-safety-ui.test.mjs` monta IntakePilot real con sus estilos y respuestas API sintéticas. Antes del cambio falla porque la edición modificada no cancela beforeunload. Después verifica advertencia en recarga real de Chromium, cancelación del descarte, error de guardado, éxito, confirmación del descarte y reversión al texto guardado. Solo observa intake.status e intake.edit; ninguna generación ni descarga.

Capturas desktop y 390 px tras error de guardado conservan la edición y muestran el aviso. Se revisan visualmente; no hay desbordamiento horizontal. Integrado en el paso Chromium existente de main-integration.

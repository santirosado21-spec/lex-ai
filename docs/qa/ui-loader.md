# Loader circular — 0.3.6

Dirección visual de Claude Opus 5.5 con frontend-design global compartida; Codex adaptó el recurso, integró y verificó. No hay dependencia nueva ni cambios de backend, inferencia, pesos o fuentes.

- TypeScript/Vite y Tauri Apple Silicon: PASS.
- Smoke conjunto avatar/loader: PASS, usando rutas locales reales con inferencia sintética controlada por la prueba. Reposo, proceso, respuesta, fallo y cancelación.
- Anillo animado y avatar estático; al activar movimiento reducido, anillo y letras sin animación. Loader decorativo dentro de la región de estado existente.
- Cancelar visible por encima del dock y sin desbordamiento horizontal en 390 y 320 px. Revisadas capturas de escritorio y 320 px. No se probó lector de pantalla ni dispositivo móvil físico.
- Flujo completo de UI: PASS, incluida importación, consulta, citas, DOCX y feedback, con inferencia simulada. No se repitió inferencia real ni entrenamiento para un cambio exclusivamente visual.

Evidencia local: `artifacts/ui-loader/` con dirección observada de Claude, capturas y logs. La UI continúa presentando LEX AI y no muestra nombres de modelos. El mínimo de la ventana nativa sigue en 1000 px. El instalador experimental conserva firma ad hoc, sin notarización ni prueba en segundo Mac limpio.

Verificación del paquete: PASS (versión, firma de desarrollo, backend y recursos, biblioteca real y estado de entrenamiento). DMG validado con hdiutil y SHA256 en el manifiesto de versión.

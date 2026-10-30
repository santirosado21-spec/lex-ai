# Avatar del asistente — 0.3.4

Recurso del dueño recibido el 30 de octubre de 2026. Claude Opus 5.5 dirigió ubicación, color y estados; Codex adaptó el componente y verificó la integración. La consulta usó las instrucciones de la skill frontend-design del repositorio global de Claude, suministradas por Codex. Se siguió dsystem compartido y se revisó react-best-practices del catálogo global de Codex.

- TypeScript/Vite y build nativo Tauri: PASS.
- 94 pruebas Node: PASS.
- Smoke del avatar: PASS. Reposo, generación, respuesta, error y cancelación sobre rutas locales reales con inferencia simulada controlada por una promesa. No se ejecutó Gemma.
- Reducción de movimiento: ojos y brillo sin animación. Avatar decorativo, sin foco ni acción falsa. Texto de procesamiento conserva role=status.
- Tamaños comprobados: 64 px en escritorio, 48 px en móvil y 32 px en generación/respuesta. Vistas 1440, 390 y 320 px, sin desbordamiento horizontal. Revisadas capturas de escritorio y 320 px.
- Flujo completo UI: PASS; conserva importación, fuentes, respuestas, exportación DOCX y feedback, con datos sintéticos.

Evidencia en `artifacts/ui-avatar/`: dirección observada de Claude, logs, smoke.json y capturas. La animación solo acompaña al estado existente; no indica certeza, calidad ni progreso porcentual. No se añadieron solicitudes externas ni dependencias. No se ejecutó axe ni una prueba de dispositivo móvil físico. El mínimo nativo sigue en 1000 px. Instalador experimental firmado ad hoc, sin notarización ni prueba en un segundo Mac limpio.

Verificación del paquete nativo: PASS (versión, firma de desarrollo, hashes de recursos/backend, biblioteca real y estado de entrenamiento). DMG verificado por hdiutil y SHA256 en el manifiesto versionado.

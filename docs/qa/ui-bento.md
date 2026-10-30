# Inicio bento — 0.3.3

Recurso del dueño: cuadrícula interactiva de stack técnico, recibida el 30 de octubre de 2026. Adaptación para trabajo jurídico con dirección visual de Claude Opus 5.5 y ejecución/verificación de Codex.

- Build TypeScript/Vite y app Tauri Apple Silicon: PASS.
- 94 pruebas Node: PASS.
- Smoke bento: PASS; asunto vacío, alcance de documentos/consultas, cambios de asunto, lector real y consulta guardada, estados del motor al cargar, foco luminoso con puntero, teclado y movimiento reducido.
- Anchos Chromium: 1440, 1000, 780, 390 y 320 px. Sin desbordamiento horizontal; objetivos de al menos 44 px y última tarjeta accesible por encima del dock. Revisión visual de escritorio, estado vacío y extremos de la vista móvil.
- Smoke del dock y flujo completo de la UI: PASS. Usan inferencia simulada o ninguna; no prueban la calidad del modelo.
- Verificación del paquete nativo: PASS; versión, firma de desarrollo, recursos/backend, biblioteca 35,452 artículos de 303 instrumentos y estado de entrenamiento experimental.

Durante la preparación del smoke se corrigieron dos supuestos del propio test: volver a la misma URL con fragmento no recarga el estado después de sembrar datos; y el motor estable no se consulta cada dos segundos (solo se sondea mientras inicia/descarga/verifica). El test recarga explícitamente para comprobar estados sembrados. No se añadieron consultas de red al componente ni se modificó el comportamiento del backend para satisfacer la prueba.

Evidencia: `artifacts/ui-bento/` con smoke.json, capturas, logs, dirección de Claude y package-check.json. La propuesta de Claude sugería axe; no se ejecutó axe. No se probó un dispositivo móvil físico ni un segundo Mac limpio. El instalador sigue sin notarización. No se alteraron pesos, corpus, permisos cloud ni rutas de Supabase/Vercel.

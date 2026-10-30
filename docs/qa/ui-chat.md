# Chat composer — 0.3.7

Fecha: 2026-10-30. Datos sintéticos; las pruebas de interfaz usan inferencia controlada y no miden calidad jurídica.

- `npm run build`: TypeScript y Vite PASS.
- `npm test`: 94/94 PASS.
- `npm run desktop:build`, `scripts/package-dmg.sh` y `scripts/verify-package.mjs`: PASS. Paquete 0.3.7 con firma ad hoc y biblioteca real de 35 452 artículos en 303 instrumentos; licencias MetalFx y Paper Shaders incluidas.
- `node scripts/ui-chat-smoke.mjs`: adjunto real por API local y asunto, Enter/Ctrl+Enter, Shift+Enter, eventos IME, crecimiento a seis líneas, sugerencias externas, error/cancelación, conservación de borrador y selección, éxito con citas, ausencia de contenido del otro asunto y navegación PASS. Renderizado MetalFx con WebGL por software, desmontaje durante consulta y movimiento reducido, alternativa sin WebGL y controles de 44 px a 1000/780/390/320 px PASS. Sin solicitudes remotas ni excepciones de página.
- `npm run test:ui`: flujo general PASS con movimiento reducido y reloj simulado. El shader tiene su prueba separada con reloj real.
- `LEX_UI_AVATAR_REPORT_DIR=artifacts/ui-chat/loader node scripts/ui-avatar-smoke.mjs`: avatar/loader, ciclo de solicitud, cancelación, errores y disposición móvil PASS.
- `node scripts/ui-dock-smoke.mjs`: navegación, conservación de borrador y separación entre barra y dock PASS.

Revisión visual de capturas de escritorio y 390 px. Se corrigió el fundido inicial de MetalFx que ocultaba brevemente el botón mientras esperaba el primer fotograma; la prueba comprueba ahora opacidad 1 del contenedor. El chequeo de ancho espera a que React aplique la navegación adaptable al cambiar el viewport. La prueba general usa movimiento reducido porque su reloj simulado interfería con el montaje/fundido del shader; no se forzaron clics para omitir comprobaciones de interacción.

Evidencia local: `artifacts/ui-chat/` (smoke.json, capturas, logs de build, backend y UI). La dependencia y las licencias se documentan en `docs/ui-resources/chat-composer-integration.md`.

Límites: Chromium automatizado, no prueba manual en WKWebView ni segundo Mac limpio. La ventana nativa conserva mínimo 1000 px; 320/390 px describen la adaptación del frontend en navegador. No hay nueva evaluación del modelo por este cambio de interfaz. El instalador usa firma ad hoc, sin notarización.

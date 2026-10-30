# Dashboard — 0.3.8

Fecha: 2026-10-30. Datos sintéticos sobre la API local real; no se ejecuta inferencia ni se evalúa calidad jurídica.

- `npm test`: 101/101 PASS. Incluye siete pruebas nuevas de agregación: aislamiento por ámbito y despacho, ámbito desconocido vacío, cambio de año, semanas locales con DST, tareas reabiertas y vueltas a completar, fallback de historial sin doble conteo, fechas inválidas/futuras y entradas inmutables.
- `node scripts/ui-dashboard-smoke.mjs`: PASS. Espacio vacío, tres asuntos y tres documentos reales por API; tareas con estados/historial reales; contadores y tabla de ocho semanas consistentes; ámbito independiente del asunto activo; borrador del chat conservado; apertura del expediente correcto; navegación móvil por Más.
- Chromium a 1440/1000/780/390/320 px: sin desbordamiento horizontal. Selector de 44 px; última acción de actividad accesible sobre el dock. Gráfica y tabla equivalentes, sin animación. Sin solicitudes remotas, errores de página ni identidad del motor en pantalla.
- `npm run test:ui`: PASS. Flujo general con inferencia sintética controlada y movimiento reducido.
- `npm run desktop:build`, `scripts/package-dmg.sh` y `scripts/verify-package.mjs`: PASS. DMG verificado, firma ad hoc y biblioteca real de 35 452 artículos en 303 instrumentos; licencias nuevas incluidas.
- `npm run build`: TypeScript + Vite PASS. Dashboard/Recharts queda en chunk separado, cargado al abrir esta vista.

Revisión visual de escritorio y móvil. Se añadió nombre accesible explícito al selector de ámbito; el label envolvente incorporaba las opciones a su nombre. La actividad adopta columnas en escritorio para reducir altura, manteniendo filas legibles en móvil. La prueba de la paleta usa su rol real `option`.

Evidencia local en `artifacts/ui-dashboard`: smoke.json, capturas, logs y consulta acotada a Claude Opus 5.5. Se usaron las skills globales dsystem, frontend-design y react-best-practices. La agregación y la vista se delegaron con archivos separados; Codex integró y verificó.

El monitor periódico detectó un build incompleto durante la edición (ciclo 3, 16:35 UTC); se conserva ese evento. Los builds y pruebas manuales posteriores pasaron. El monitor sigue cargado y su siguiente ciclo aplica el backoff existente; no se alteró su historial para ocultar el fallo.

Límites: pruebas de interfaz en Chromium, no verificación visual nativa en WKWebView ni en un segundo Mac. Los tamaños menores de 1000 px describen el frontend en navegador; la ventana de escritorio mantiene su mínimo de 1000 px. Firma ad hoc y sin notarización. No cambia el modelo base.

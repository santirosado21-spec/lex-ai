# Pase de diseño: app, integraciones y landing (2026-11-02)

Diseño e implementación: Claude Opus 5.5, directamente (indicación del dueño). Dirección: [direction-2026-11-02.md](../design/direction-2026-11-02.md). Referencias: impeccable (`SKILL.md`, `product.md`, `brand.md`), frontend-design oficial, Apple HIG para macOS y guía de complementos de Office.

## Cambios

- **App:** `src/design-system.css` (tokens canónicos, vocabulario de botones y campos, barra lateral, barra de herramientas, compositor, Configuración, Inicio). Modo oscuro corregido en el Asistente (sugerencias blancas, ⌘K) y en Inicio (tarjeta de asunto). El asunto aparece una sola vez arriba; «Abrir expediente» es un botón de icono. El micrófono vive dentro del compositor. Iconos distintos para Correo y Tiempo. Configuración con «Más información» plegable y sin primario deshabilitado cuando el asistente está listo. El cajón móvil cerrado ya no es tabulable. Checklist ya no repite su aviso.
- **Integraciones en la app:** Correo al estilo Mail (filas De, Para, Asunto; CC y CCO plegados; estado de conexión compacto). Tiempo y honorarios con temporizador como pieza principal, resumen en franja y sin estilos en línea. Word, Excel y SharePoint en tres pasos con código grande, cuenta regresiva y Copiar.
- **Paneles de Office:** identidad LEX AI, logo claro/oscuro, modo oscuro por sistema y por tema de Office, pantalla de vinculación en tres pasos, respuestas como tarjetas con fuentes en sello, «Cerrar sesión del panel» (olvida el token local). Se conservan todos los `id`, `data-*` y textos del puente.
- **Landing:** demostración del sello con pestañas «En LEX AI» / «En Word» y línea cita-pasaje; «Qué se queda en tu Mac»; herramientas agrupadas por tarea; sección de integraciones etiquetada «Próxima versión» mientras `catalogue.json` sea < 0.4.6; nuevo límite sobre integraciones; sin rayas. `theme.js` reemplaza el script en línea que la CSP de Vercel bloqueaba.

## Evidencia (shell local, datos sintéticos, inferencia simulada)

- `npm run build`: PASS. `npm test`: 269/269.
- 20 smokes: `landing`, `ui-smoke`, `ui-hig`, `ui-theme`, `ui-chat`, `ui-conversation`, `ui-voice`, `ui-office`, `ui-time-billing`, `ui-writing-email`, `ui-dashboard`, `ui-product-identity`, `ui-avatar`, `ui-pending`, `ui-checklist`, `ui-conflict`, `ui-agent-actions`, `ui-dock`, `ui-bento`, `ui-real-library`: PASS. En la línea base previa fallaban `ui-product-identity` y `ui-checklist` (controles y textos duplicados); ahora pasan.
- Smokes ajustados por cambios de interfaz legítimos: «Expediente» → «Abrir expediente»; etiqueta «Programar envío (hora de este equipo)»; abrir el cajón móvil antes de comprobar la navegación; nueva estructura de la landing (pestañas con flechas, vínculo de cita, etiqueta de integraciones, sin rayas, sin desbordamiento a 320 px).
- Capturas revisadas: app 1440 px claro y oscuro en todas las vistas, 390 px; paneles a 350 px vinculados y sin vincular, claro y oscuro (sin desbordamiento); landing 1440 claro/oscuro y 390.

## No verificado

- Ventana nativa Tauri y paneles dentro de Word/Excel reales tras este cambio (sólo Chromium con hosts simulados).
- Despliegue en Vercel: no se hizo push.
- Las capas antiguas de `styles.css` y `macos.css` siguen presentes debajo de la capa final; consolidarlas es limpieza pendiente.

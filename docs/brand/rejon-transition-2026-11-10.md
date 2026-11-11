# Rejon.AI — transición de nombre público

Decisión del dueño, 2026-11-10: el producto se presenta como **Rejon.AI**. Este cambio actualiza la app web/desktop en código fuente, la landing, la autodescripción del asistente, textos de correo, metadatos de DOCX y el nombre visible configurado para futuros builds Tauri. La prueba de UI utiliza datos sintéticos y un motor simulado.

## Compatibilidad y límites

- El identificador Tauri `mx.lexai.desktop`, claves de `localStorage`, rutas de datos `Library/Application Support/LEX AI`, servicio Keychain `LEX AI.product.openrouter`, nombre del paquete npm, rutas del repositorio y agentes de adquisición permanecen estables. Cambiarlos requiere plan de migración de datos/credenciales y pruebas de actualización.
- El DMG ARM 0.4.3 disponible en la landing es **LEX AI**, versión anterior. La página lo identifica así en el estado y en los pasos de instalación. No se ha construido ni verificado un instalador Rejon.AI.
- El monograma y el favicon actuales siguen siendo las piezas visuales previas con forma de L. La nueva identidad gráfica y los iconos de instalador requieren diseño y revisión aparte antes de un lanzamiento con la nueva marca.
- No se ha hecho búsqueda de marca IMPI, disponibilidad de dominio ni compra. El nombre elegido no equivale a habilitación jurídica o registral.

## Verificación técnica

`npm test`: 1104/1104; `npm run build`: pasó; `npm run test:ui`: pasó con datos e inferencia simulados; `node scripts/landing-smoke.mjs`: pasó con las tres tarjetas de descarga y sin solicitudes de descarga. No se probó un nuevo binario Tauri ni se activó inferencia de nube en la app.

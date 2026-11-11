# Rejon.AI — transición de nombre público

Decisión del dueño, 2026-11-10: el producto se presenta como **Rejon.AI**. Este cambio actualiza la app web/desktop en código fuente, la landing, la autodescripción del asistente, textos de correo, metadatos de DOCX y el nombre visible configurado para futuros builds Tauri. La prueba de UI utiliza datos sintéticos y un motor simulado.

## Compatibilidad y límites

- El identificador Tauri `mx.lexai.desktop`, claves de `localStorage`, rutas de datos `Library/Application Support/LEX AI`, servicio Keychain `LEX AI.product.openrouter`, nombre del paquete npm, rutas del repositorio y agentes de adquisición permanecen estables. Cambiarlos requiere plan de migración de datos/credenciales y pruebas de actualización.
- El DMG ARM 0.4.3 disponible en la landing es **LEX AI**, versión anterior. La página lo identifica así en el estado y en los pasos de instalación. No se ha construido ni verificado un instalador Rejon.AI.
- El monograma R editable quedó creado en [Figma](https://www.figma.com/design/qyHmTkSSjvsowzDG1nsLez), con variantes clara y oscura; se exportó a SVG para app/landing. Favicon y derivados de icono Tauri se regeneraron desde `src-tauri/icons/source.svg`. Falta construir y verificar un nuevo instalador antes de afirmar que la marca nueva está distribuida.
- No se ha hecho búsqueda de marca IMPI ni compra. La cuenta Vercel conectada no muestra `rejon.ai` (sólo `lex-ai-rust.vercel.app`); una consulta de disponibilidad lo mostró disponible el 2026-11-10. Esto no acredita titularidad ni garantiza disponibilidad futura. El dueño indicó que «eso» está en su cuenta; falta identificar el servicio antes de conectar DNS. El nombre elegido no equivale a habilitación jurídica o registral.

## Verificación técnica

`npm test`: 1104/1104; `npm run build`: pasó; `npm run test:ui`: pasó con datos e inferencia simulados; `node scripts/landing-smoke.mjs`: pasó con las tres tarjetas de descarga y sin solicitudes de descarga. No se probó un nuevo binario Tauri ni se activó inferencia de nube en la app.

El icono de escritorio se generó con la CLI de Tauri a partir de `src-tauri/icons/source.svg` y se inspeccionó en 512 y 32 px. `scripts/build-desktop.mjs` requiere `LEX_RUNTIME_INVENTORY` y `LEX_RUNTIME_ARTIFACTS` revisados; ambos faltan en esta sesión. Por ello no se creó paquete nativo ni se cambió el enlace de descarga. Los iconos móviles de `src-tauri/icons/android/` y `ios/` no se actualizaron: la distribución objetivo aquí es de escritorio.

Revisión independiente (Sol, sólo lectura): aprobó los SVG, referencias e iconos de escritorio. Señaló que el avatar en modo oscuro carecía de nombre accesible; se corrigió y aprobó la revisión puntual. Tras la corrección, `npm run build` y `npm run test:ui` volvieron a pasar.

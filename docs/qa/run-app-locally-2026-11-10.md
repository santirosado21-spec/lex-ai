# Cómo abrir y ver la app (para personas y agentes de IA)

Actualizado: 2026-11-10. Aplica a `main`, integración experimental. Sólo datos públicos o sintéticos.

## La app no está publicada en internet

- No existe una URL pública de la app. Vercel sólo publica la **landing** (`landing/`), no la aplicación.
- Cada persona la ejecuta en su propio equipo. Un enlace de la app de otra persona no funciona en otra computadora.
- Hospedar la app para varias personas (web alojada + componente local) **no está implementado**. Ver `docs/architecture/adr/0004-local-web-privacy-channel.md`. No subir documentos originales a un servidor para protegerlos después.

## Abrirla en local

```bash
npm ci
npm run build
npm run dev
```

`npm run dev` ([scripts/dev.mjs](../../scripts/dev.mjs)) imprime una línea como:

```
LEX AI: http://127.0.0.1:4318/#token=<64 caracteres hexadecimales>
```

- El servidor escucha sólo en `127.0.0.1` (puerto 4318 en desarrollo), por lo que otras máquinas no pueden conectarse.
- El `token` se genera **de nuevo en cada arranque** ([server/main.mjs](../../server/main.mjs)). Al detener y volver a iniciar, el enlace anterior deja de servir.
- El token da acceso a los datos locales (`.data/` en desarrollo, o `LEX_DATA_DIR`). **No pegarlo en chats, issues, PR, commits ni capturas.** Un agente de IA no debe guardarlo en archivos del repo ni en su memoria.
- Tras cambiar código de interfaz hay que ejecutar `npm run build` otra vez: el servidor sirve `dist/`.
- Si el puerto 4318 está ocupado, detener el proceso anterior antes de reiniciar.

## Comprobar sin abrir un navegador

```bash
npm test                      # unitarias, sin red
node scripts/ui-smoke.mjs     # recorre la interfaz; inferencia simulada y marcada como tal
node scripts/ui-dashboard-smoke.mjs
```

Las pruebas de interfaz usan Chrome instalado y datos sintéticos. Una prueba pasada no demuestra calidad jurídica, privacidad ni funcionamiento en un equipo de 8 GB.

## Convenciones de la interfaz (para quien la modifique)

- Los estilos se apilan en este orden: `styles.css`, `tailwind.css`, `macos.css`, `design-system.css`. **La última capa manda**: poner correcciones al final de [src/design-system.css](../../src/design-system.css), sección "Polish 2026-11-10", no en capas anteriores.
- Colores y fuentes salen sólo de las variables definidas en `:root` (`--bg`, `--surface`, `--ink`, `--seal`, `--line`, `--focus`, `--font-ui`, `--font-display`...), con valores para claro y oscuro. No usar `#fff`, `white` ni hex sueltos.
- Dirección de diseño y tokens: [docs/design/direction-2026-11-02.md](../design/direction-2026-11-02.md).
- Cifras en `--font-ui` con `tabular-nums`; Newsreader sólo en títulos y prosa (sus ceros antiguos parecen la letra "O").
- Contenedor de página con ancho máximo común de 1120 px; objetivos táctiles de 44 px en pantallas táctiles.
- Texto visible en español. No mostrar nombres de modelos ni proveedores en la interfaz ordinaria. Usar "panel", no "dashboard".
- Revisar cada cambio en claro, oscuro y 390 px de ancho, y correr las dos pruebas de interfaz de arriba.

## Estado verificado

- Pulido de interfaz en el commit `7679531`: 1104/1104 pruebas, `ui-smoke` y `ui-dashboard-smoke` PASS, con capturas en Chrome.
- **No medido:** la app de escritorio (Tauri/WKWebView), equipos físicos de 8 GB, Windows e Intel.

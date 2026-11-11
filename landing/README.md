# Landing pública de Rejon.AI

Sitio estático, sin framework ni dependencias de ejecución. La raíz de despliegue es `landing/`: sirve HTML, CSS, JavaScript, catálogo y assets locales. Para revisión local normal puede usarse `python3 -m http.server 4175 --directory landing` desde la raíz del repositorio.

La dirección visual es “Sello y pizarra”: pizarra clara, papel, tinta y un solo acento granate. Newsreader se usa para títulos y Schibsted Grotesk para interfaz. Las fuentes son WOFF2 locales de `@fontsource`; sus licencias OFL y hashes están en `assets/fonts/`. El logo de la página es la copia de `src/assets/lex-mark.svg`; `assets/favicon.svg` conserva el icono de la app.

`catalogue.json` es la fuente de disponibilidad por plataforma; los controles sólo se habilitan con metadatos completos y válidos según el esquema 3 descrito abajo.

`vercel.json` permite solamente recursos y conexiones del mismo origen; no hay formularios, analítica, cookies de aplicación ni recursos remotos. La página no recibe documentos ni se conecta al runtime de escritorio.

La versión 0.4.3 se presenta como experimental y sin notarización de Apple. La página declara que requiere Apple Silicon, 8 GB de RAM, ~3 GB libres y una preparación inicial de ~1.95 GB. El snapshot de la Biblioteca federal es 30/10/2026, no exhaustivo, y la versión todavía no se ha probado en una Mac física de 8 GB.

## Catálogo de plataformas (schemaVersion 3)

El catálogo ahora tiene `platforms.mac-arm64`, `platforms.mac-x64` y `platforms.windows-x64`. Cada entrada conserva su propia versión y estado, URL inmutable, bytes, SHA-256 y requisitos; no hay versión global. La única descarga real es **0.4.3 Apple Silicon**, anterior, local y experimental. Intel y Windows están pendientes con campos `null`; no se redirigen a ARM. El nuevo flujo híbrido no está publicado y no se acredita cifrado ni hardware físico de 8 GB.

Para habilitar una entrada se requieren `status` (`experimental-local-legacy`, `experimental` o `published`), versión numérica de tres componentes, bytes enteros positivos, SHA-256 hexadecimal minúsculo de 64 caracteres y requisitos positivos `minimumMemoryGB` / `minimumFreeDiskGB`. La URL debe coincidir literalmente con `https://github.com/santirosado21-spec/lex-ai-descargas/releases/download/vVERSION/LEX-AI-VERSION-SUFFIX`: sufijos `arm64.dmg`, `x64.dmg`, `x64.exe` o `x64.msi` según plataforma. Admitir un sufijo no prueba que exista tal instalador. Una entrada inválida queda inerte sin impedir otras válidas. Sólo se solicita `catalogue.json` del mismo origen; copiar el hash usa el portapapeles del usuario.

Prueba focalizada sin red: `node --test tests/landing-downloads.test.mjs`. Vista local: `python3 -m http.server 4175 --directory landing`. Prueba de navegador: `node scripts/landing-smoke.mjs` sirve la landing local con las cabeceras Vercel y guarda reporte/capturas en un directorio nuevo `artifacts/landing/20261110-downloads-*`; comprueba las tres plataformas, fixtures sólo interceptados, teclado, portapapeles y cinco anchos sin solicitar instaladores.

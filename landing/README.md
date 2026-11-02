# Landing pública de LEX AI

Sitio estático, sin framework ni dependencias de ejecución. La raíz de despliegue es `landing/`: sirve HTML, CSS, JavaScript, catálogo y assets locales. Para revisión local normal puede usarse `python3 -m http.server 4175 --directory landing` desde la raíz del repositorio.

La dirección visual es “Sello y pizarra”: pizarra clara, papel, tinta y un solo acento granate. Newsreader se usa para títulos y Schibsted Grotesk para interfaz. Las fuentes son WOFF2 locales de `@fontsource`; sus licencias OFL y hashes están en `assets/fonts/`. El logo de la página es la copia de `src/assets/lex-mark.svg`; `assets/favicon.svg` conserva el icono de la app.

`catalogue.json` es la única fuente de disponibilidad de la descarga. `script.js` la solicita desde el mismo origen. Mientras `downloadUrl`, `bytes` o `sha256` sean `null`, el control muestra “Disponible muy pronto”, queda deshabilitado y no contiene un enlace. Cuando se publiquen los tres valores reales, el botón, tamaño y SHA-256 se actualizan sin cambiar el HTML. Nunca introducir una URL, tamaño o hash de ejemplo.

`vercel.json` permite solamente recursos y conexiones del mismo origen; no hay formularios, analítica, cookies de aplicación ni recursos remotos. La página no recibe documentos ni se conecta al runtime de escritorio.

La versión 0.4.2 se presenta como experimental y sin notarización de Apple. La página declara que requiere Apple Silicon, 8 GB de RAM, ~3 GB libres y una preparación inicial de ~1.95 GB. El snapshot de la Biblioteca federal es 30/10/2026, no exhaustivo, y la versión todavía no se ha probado en una Mac física de 8 GB.

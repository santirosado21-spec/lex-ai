# Landing pública LEX AI

Sitio estático sin framework ni dependencias de ejecución. Raíz de despliegue: este directorio `landing/`. Sirve `index.html`, CSS, JS, catálogo y assets locales. No necesita build. Para revisión local: `python3 -m http.server 4175 --directory landing` desde la raíz del repositorio.

Dirección visual: propuesta real de Claude Opus 5.5 «Expediente foliado», en `docs/architecture/landing-design.md`; implementación de Codex siguiendo la skill frontend-design suministrada. La foto de portada se espera en `assets/lex-cover.webp`, creada por el coordinador. No se distribuyen capturas con datos reales: el preview es HTML con datos ficticios.

Interacciones: cinco pestañas ARIA (flechas según orientación, Home/End), anclas, preguntas expandibles y diálogo de privacidad. El único movimiento automático es la línea de verificación, desactivado por prefers-reduced-motion. No hay formularios, tracking, cookies de aplicación, llamadas remotas ni conexión al runtime del escritorio. `catalogue.json` es metadata pública estática; no hay Supabase configurado ni fetch pendiente que pueda ejecutarse accidentalmente.

`vercel.json` restringe scripts, estilos, imágenes y fuentes al mismo origen; bloquea conexiones, formularios, objetos y marcos. Debe desplegarse con raíz `landing/` para aplicar esa configuración. No contiene rutas fuera de esta carpeta ni URLs falsas de descarga. No implica que se haya publicado el sitio.

Las fuentes provienen de las dependencias locales @fontsource: IBM Plex Sans (400/500/600 normal) y Source Serif 4 (400/500 normal), únicamente archivos Latin WOFF2. Se incluyen las licencias OFL completas en `assets/fonts/`. Las versiones exactas se registran en `assets/fonts/provenance.json`.

Límites de producto en el copy: app 0.3.5 experimental, firma ad hoc, sin notarización; candidato entrenado separado y de importación manual, nunca predeterminado. 32 casos técnicos no equivalen a validación jurídica. Corpus snapshot 30/10/2026, 35.452 artículos y 303 instrumentos, 910 muestras cotejadas: no exhaustivo ni garantía de vigencia. No hay URL pública de descarga por ahora.

Identidad pública: LEX AI. La UI y el catálogo no muestran nombres del runtime/modelo base. `assistantName` sustituye el identificador técnico en el catálogo; procedencia y licencias permanecen en la documentación técnica/legal.

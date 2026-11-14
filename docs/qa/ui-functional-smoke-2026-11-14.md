# Pruebas funcionales de plataforma SIN inferencia — 2026-11-14

Alcance (main 05:05): mantener pruebas funcionales de plataforma ademas de
adquisicion; la inferencia real (Ollama Mac via puente Codex del usuario) es lo
UNICO bloqueado por el puente. Todo lo demas se probo aqui en el entorno de pruebas
(loopback local + Playwright chromium headless).

## Resultado: 20/20 harnesses ejecutables en verde (1 corregido), 1 bloqueado por entorno, build en verde

PASS (20):
- ui-smoke (integracion principal, inferencia MOCKEADA explicita, datos
  sinteticos): 15 grupos de checks — onboarding 390px sin overflow, despacho,
  asunto+importacion TXT y lectura, biblioteca con filtros, paleta de comandos,
  analisis estructurado mockeado con citas y riel de evidencia, descarga DOCX
  real, feedback/aprobacion/rollback, tareas con persistencia tras reload,
  sidebar agrupado, API public-library con indice sintetico temporal
  (paginacion, articulo completo, procedencia), transportes library.status
  missing/invalid, sources.status con fixture (polling 15s), training.status,
  busqueda de corpus oficial, 700px responsive, 0 excepciones de pagina.
- ui-chat, ui-avatar, ui-bento, ui-checklist, ui-conflict, ui-conversation,
  ui-dashboard, ui-dock, ui-hig, ui-office (word/excel/sharepoint panel),
  ui-pending, ui-product-identity, ui-prompt-limit, ui-theme (tras correccion,
  ver abajo), ui-time-billing, ui-voice (transcripcion insertada sin enviar),
  ui-writing-email, ui-agent-actions, landing.
- npm run build (tsc --noEmit && vite build): verde en 4.3s.
- Verificacion visual: artifacts/ui-theme/settings-light-1440.png inspeccionado
  — riel oscuro con marca correcta en apariencia clara, lienzo claro, radio
  "Claro" activo, sin overflow. (La banda del barra de asunto cruzando
  "Word, Excel y SharePoint" es artefacto conocido de captura fullPage con
  header sticky, no defecto de producto.)

## Hallazgo 1 (corregido): ui-theme-smoke quedo obsoleto tras 3884148
El commit 3884148 (riel de navegacion oscuro en apariencia clara) cambio la
marca del riel: con tema claro el sidebar muestra la marca OSCURA
(theme-mark-dark) porque el riel es oscuro (src/styles.css:499-501). El smoke
aun exigia theme-mark-light visible en .brand. Producto correcto, prueba
obsoleta: se actualizaron las dos aserciones al comportamiento intencional
(riel oscuro => marca oscura en ambos temas explicitos) y el texto del check.
ui-theme-smoke vuelve a PASS. Misma clase de obsolescencia que 7a984b9 ya
reparo una vez: conviene revisar aserciones de marca al tocar el riel.

## Hallazgo 2 (bloqueado por entorno/diseno, NO defecto): ui-real-library-smoke
Exige resources/public-library.sqlite (indice publico CONGELADO: 35,452
articulos / 303 leyes), artefacto local git-ignorado ausente en este entorno.
Reconstruirlo desde corpus cuarentenado equivaldria a activar corpus en
producto — prohibido. Queda BLOCKED por entorno hasta una decision sobre el
indice congelado; el harness equivalente con indice sintetico temporal SI paso
dentro de ui-smoke (checks 10-11).

## No corrido (bloqueado por puente Mac, como instruyo main)
- scripts/e2e.mjs (test:e2e): inferencia local real (Ollama en
  /Applications/Ollama.app — ruta Mac del usuario). Solo esto espera el puente.

## Nota de cobertura
Estos harnesses prueban la app web local (server/main.mjs + UI), no el empaque
Tauri de escritorio ni la inferencia real. Ningun dato real de clientes; todos
los fixtures son sinteticos.

# Icono de LEX AI para macOS

Actualizado el 1 de noviembre de 2026. Dirección de diseño: Claude Opus 5.5 (modelo observado `claude-opus-5-5`); integración y verificación: Codex, siguiendo dsystem y la skill global compartida `frontend-design`. Codex suministró la skill y una descripción del icono; Claude no inspeccionó archivos ni imágenes directamente.

Se conserva el monograma geométrico L/E. El fondo cambia a azul tinta `#1f4a73`, la L a papel `#f5f5f4` y las dos barras a menta `#9fd3c4`. Se aumenta el margen exterior transparente para la presentación en macOS. No se usan assets externos ni generación de imágenes: la fuente editable del proyecto es SVG.

## Fuente y reproducción

`src-tauri/icons/source.svg` es la fuente vectorial. `node_modules/.bin/tauri icon src-tauri/icons/source.svg` produce las representaciones PNG, ICNS e ICO. Este cambio conserva las derivadas existentes de plataformas móviles y Windows Store; el alcance es escritorio.

El mismo monograma L/E se usa en la aplicación (`src/assets/lex-mark.svg`) y en el favicon de la landing (`landing/assets/favicon.svg`): fondo azul tinta `#1f4a73`, L de papel y barras menta. Las variantes web son SVG escalados, no logos alternos.

Se declara `bundle.icon` explícitamente en `src-tauri/tauri.conf.json`: antes, los paquetes compilados carecían de `CFBundleIconFile` y del recurso ICNS. `scripts/verify-package.mjs` comprueba ahora la declaración y el hash del icono incluido.

## Verificación del paquete

Compilación Tauri de la app 0.3.8 aprobada, con el toolchain aislado documentado en README. Firma ad hoc y `node scripts/verify-package.mjs` aprobadas, incluyendo coincidencia del icono, versiones y pruebas existentes del backend empaquetado. Informe: `artifacts/icon-refresh/package-check.json`. Se reconstruyó la app local; no se creó un release ni se reemplazó un DMG histórico.

Durante la primera compilación efectiva, el copiado de recursos quedó bloqueado en `fclonefileat` sobre una derivada duplicada dentro de las dependencias generadas. Se detuvo solo esa compilación, se regeneró `.desktop/app/node_modules` con `npm ci --omit=dev` usando el lockfile existente y la siguiente compilación terminó correctamente. No se cambiaron dependencias del proyecto.

## Aplicación instalada

Actualizado el icono de `/Applications/LEX AI.app`, con copia de respaldo local en `artifacts/icon-refresh/installed-before-20261102T035633Z.bundle-backup`. Se preservó su versión instalada 0.1.0 y sus recursos funcionales; no se cerró el proceso ni se modificaron documentos o datos del despacho. Se retiraron únicamente metadatos FinderInfo/ResourceFork que impedían firmar el bundle. No se alteraron cuarentena ni políticas del sistema. Firma ad hoc verificada con `codesign --verify --deep --strict`.

El recurso instalado coincide con el ICNS del repositorio (SHA256 `493b7bb3e3db0a5158293827380d611d71bc60a277678a73dd3bfdc7a0282bd0`). Evidencia local: `artifacts/icon-refresh/installed-icon.json` y `finder-installed.png`; el nuevo icono se comprobó visualmente en Obtener información de Finder. Un proceso que ya estaba abierto puede conservar su icono anterior hasta su siguiente apertura. Los DMG y releases históricos no se sustituyen.

## Propuesta recibida de Claude

**Proposal: ink folio mark**

- **Ground:** Standard macOS squircle (824 px on a 1024 canvas) in legal ink `#1f4a73`. Flat, with at most a 3% top-down tonal lift. No gloss.
- **L:** Paper `#f5f5f4`, solid geometric strokes 118 px thick with square ends. Stem at x 300–418, y 262–762. Foot runs to x 700. Optical center sits slightly left, so the open right side reads as a page margin.
- **E bars:** Two bars the same thickness as the L, with a 64 px gap from the stem so the E stays abstract. Top bar spans x 482–700, middle bar x 482–640, giving a stepped, folio-like rhythm. Fill is softened mint `#9fd3c4`, the one thread of recognition from the old icon.
- **Small sizes:** Hand-tune 16 and 32 px. At 16 px, drop the middle bar, pixel-snap strokes to 3 px, and keep a 2 px gap from the stem.
- **Avoid:**
  - Teal ground
  - Thin hairlines
  - Serif or calligraphic L
  - Folded-corner page clichés
  - Glyph shadows or bevels
  - Gradients used as decoration
  - Wordmarks or extra marks inside the squircle

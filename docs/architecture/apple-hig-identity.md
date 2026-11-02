# LEX AI: navegación de trabajo e identidad documental

## Dirección revisada

Claude Code realizó una revisión real de código público/sintético con `Read` limitado a `/private/tmp/lex-hig-review`, sin herramientas de red ni acceso a documentos del despacho. Resultado en `artifacts/ui-hig/claude-review.json`; `modelUsage` confirma `claude-opus-5-5`. Codex integró y comprobó las recomendaciones. No se atribuye a Claude una revisión visual completa de CSS: su entrada fueron tres archivos y los resúmenes HIG verificados.

La [guía oficial de barras laterales de Apple](https://developer.apple.com/design/human-interface-guidelines/sidebars) fundamenta una jerarquía simple. La navegación principal queda en Asistente, Asuntos y Escritos; el expediente es segundo nivel. Las herramientas de corpus, evaluación y configuración siguen disponibles en la paleta, sin imponer al abogado explorar el corpus antes de preguntar.

La [guía oficial de toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) fundamenta la barra contextual: selección del asunto, expediente, búsqueda y control de sidebar. No se dibujan falsos controles de ventana. Atajos: ⌘K acciones; ⌘, configuración; ⌃⌘S sidebar. Enter envía y Shift+Enter introduce línea; se conserva protección IME.

Se retiró Dock de la aplicación y MetalFx del composer. El botón es estático y el avatar representa la nueva marca. Se retiraron fuentes web del punto de entrada y se usa tipografía del sistema. Las animaciones CSS se detienen con movimiento reducido. El dashboard sigue cargándose bajo demanda como herramienta secundaria.

## Identidad en Figma

[Archivo editable de identidad LEX AI](https://www.figma.com/design/4O4XgcaSNSMEvAQjUQbc0C?node-id=2-22).

Concepto original: dos documentos unidos por una curva que representa una referencia. No reutiliza la L verde ni símbolos de balanza/mazo. La conexión curva incorpora la observación de Claude sobre evitar la lectura de una N. No se copió una marca de Apple.

- Tablero de revisión: `2:22`.
- Componente marca tinta: `2:5`.
- Componente marca blanca: `2:10`.
- Componente icono macOS: `2:15`.
- Variables locales: colección `LEX identidad`, tinta y blanco.
- Export vectorial real Figma utilizado por la interfaz: `src/assets/lex-figma-mark.svg`.
- PNG de icono: export de componente Figma, generado por MCP; root descarga y genera formatos Tauri.

El tablero incluye comparaciones16/32px, marca grande e icono, con componentes instanciados. Las hojas y conexión son vectores editables; no hay interfaz rasterizada como sustituto de diseño. Tipografía de tablero Inter para exportación legible; la aplicación utiliza la fuente del sistema.

## Flujos y límites

Escritos usa respuestas persistidas del asunto activo, sin inventar documentos. Abrir escrito llama `answer.open`; Abrir original llama `document.open`, ambos con IDs de asunto y registro. El backend conserva el aislamiento y decide la aplicación del sistema. Exportar DOCX sigue disponible. El navegador informa si la apertura local no está disponible.

La revisión de accesibilidad mantiene paneles de citas y resultados montados con `hidden`, tabs con flechas/Home/End, Escape respeta la capa superior, y el texto transmitido no se anuncia fragmento por fragmento.

El objetivo8GB corresponde al runtime seleccionado por backend, no una medición de hardware físico de8GB. No afirmar rendimiento real hasta disponer de evidencia. La interfaz no expone proveedores ni nombres de modelos.

## Validación

`npm run build`: TypeScript y Vite PASS. `scripts/ui-hig-smoke.mjs` verifica navegación, borradores conservados, sidebar, documentos, fuente sistema, ausencia de canvas y overflow a1440/1000/780/390/320px. Worker no pudo abrir loopback (`EPERM`); root ejecutó script: PASS, y conserva resultado/capturas en `artifacts/ui-hig`. Ninguna prueba de UI invoca inferencia.

La consulta sin documentos se habilita exclusivamente para `legal-researcher`, habilidad inicial. Las otras habilidades conservan el requisito de documento privado. La selección explícita del usuario se respeta al cambiar asunto y la interfaz explica el requisito.

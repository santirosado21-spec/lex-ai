# Dirección de diseño: app, integraciones y landing (2026-11-02)

Autor de la dirección e implementación: Claude Opus 5.5. Por indicación del dueño (2026-11-02), el diseño lo implementa Claude directamente, no Codex. Verificación: Claude en shell local con capturas y smokes.

## Fuentes consultadas

- `~/code/ai-skills/impeccable/skill/SKILL.md` y `reference/product.md`, `reference/brand.md` (leyes compartidas, registro producto y marca).
- `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md` (tics de diseño generado, escritura en la interfaz).
- Apple Human Interface Guidelines para macOS: barras laterales, barras de herramientas, controles y modo oscuro (conocimiento de la guía oficial; no se descargó una copia).
- Componentes 21st.dev ya integrados en `src/components/ui/` (prompt bar, loader, avatar).
- Capturas reales del estado actual (1440 px claro/oscuro, 390 px, paneles de Office a 350 px).

## Diagnóstico del estado actual

1. **Modo oscuro roto en el Asistente.** Las sugerencias del estado vacío son tarjetas blancas con texto casi invisible; el atajo ⌘K de "Buscar" es un bloque blanco. Hay colores fijos (`#fff`, `white`) que ignoran los tokens.
2. **Dos sistemas de tokens superpuestos.** `src/styles.css` define `--paper/--accent:#1f4a73/...` y `src/macos.css` lo sobrescribe con `--bg/--seal/...`. El azul `#1f4a73` ya no pertenece a la marca.
3. **Barra lateral poco Mac.** 14 destinos con filas de ~46 px y texto de 15 px; ocupa toda la altura. En macOS una barra lateral usa filas de 28-32 px, texto de 13 px e iconos de 16 px.
4. **El asunto aparece tres veces arriba**: texto plano en la barra, selector a la derecha y subtítulo de la página. "Expediente" es un enlace granate suelto.
5. **"Dictar" flota fuera del compositor**, debajo de él. El selector de habilidad usa texto granate (acento en un estado inactivo). Texto auxiliar redundante: "Escribe un mensaje para empezar."
6. **Encabezados inconsistentes.** Tiempo y honorarios usa una etiqueta en mayúsculas espaciadas encima del título; Asistente usa un título pequeño; el resto, un título grande. Debe haber un solo componente de encabezado.
7. **Plantilla de métricas heroicas** en Tiempo y honorarios: cuatro tarjetas iguales con número grande. El Panel ya usa una franja unida; unificar a esa franja.
8. **Botón primario deshabilitado en rosa pálido** ("Preparar LEX AI" cuando ya está listo). Un estado deshabilitado no debe parecer una acción de marca.
9. **Configuración:** párrafo de 12 líneas en la columna izquierda; la etiqueta "Dirección del sitio (solo para SharePoint)" aplasta su campo.
10. **Correo:** formulario de ancho completo (1070 px) con campos gigantes; no se parece a redactar un correo.
11. **Paneles de Word, Excel y SharePoint** usan otra marca: verde azulado `#075d63`, sin logo, sin modo oscuro, tipografía y espaciado distintos. Parecen de otro producto.
12. **Landing desactualizada:** no menciona Word/Excel/SharePoint, Mail, dictado ni honorarios. La lista de herramientas es una cuadrícula de 10 filas idénticas con glifos decorativos (↗ □ ▤ ◌). El sello de la fuente usa un borde lateral de color (prohibido por la guía). Título con raya (—).

## Identidad que se conserva

- Tinta `#0F1B2D`, granate "sello" `#8C1D2C`, papel frío `#EEF1F4`; en oscuro `#0E141C` / `#D4616F`.
- Logo `lex-mark.svg` / `lex-mark-dark.svg`.
- Newsreader para títulos editoriales y la prosa de respuestas; Schibsted Grotesk en la landing.
- Granate reservado para cita/fuente, acción primaria y selección. Verde sólo para un estado verificado explícito.
- Honestidad: nunca afirmar validación jurídica, vigencia, cobertura completa ni nombres de modelo/proveedor en la UI.

## Tokens canónicos (todas las superficies)

Definidos una sola vez en `src/macos.css` para `:root`, `:root[data-theme="light"]`, `:root[data-theme="dark"]` y `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. Los paneles de Office y la landing replican los mismos valores en su propio CSS.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#EEF1F4` | `#0E141C` | fondo de ventana |
| `--surface` | `#FFFFFF` | `#151D28` | contenido |
| `--surface-2` | `#F7F8FA` | `#1A2430` | controles, filas alternas |
| `--sidebar` | `#E9EDF1` | `#111821` | segunda capa neutra (barra lateral, barra de herramientas) |
| `--ink` | `#0F1B2D` | `#E8ECF2` | texto principal |
| `--ink-2` | `#4A5568` | `#AAB4C3` | texto secundario |
| `--ink-3` | `#6B7685` | `#7F8A9A` | texto terciario, marcadores de posición |
| `--line` | `#D9DEE5` | `#2A3646` | separadores |
| `--rule-strong` | `#C7CED8` | `#455268` | bordes de controles |
| `--seal` | `#8C1D2C` | `#D4616F` | acento |
| `--seal-hover` | `#731724` | `#E47783` | |
| `--seal-soft` | `#F6E7EA` | `#3A2029` | selección, cita |
| `--ok` / `--ok-soft` | `#2F7D6B` / `#E3F1ED` | `#65B6A1` / `#16302B` | |
| `--warn` / `--warn-soft` | `#8A5A00` / `#FBF0D9` | `#E0B25C` / `#33280F` | |
| `--danger` / `--danger-soft` | `#A1271C` / `#F9E5E2` | `#EE7B6F` / `#3A1C19` | |
| `--focus` | `color-mix(in oklab, var(--seal) 55%, transparent)` | igual | anillo de foco 3 px |
| `--radius-s/m/l` | 6 / 8 / 12 px | | |
| `--control-h` / `--control-h-s` | 44 / 44 px | | objetivos ≥ 44 px según `docs/brand/redesign-brief-2026-11-02.md` |
| `--font-ui` | `-apple-system, BlinkMacSystemFont, "Schibsted Grotesk", system-ui, sans-serif` | | controles, etiquetas, datos |
| `--font-display` | `Newsreader, Georgia, serif` | | títulos de página y prosa de respuesta |

Regla: ningún componente usa `#fff`, `white`, `#000` o un hex suelto; sólo tokens. El texto sobre `--seal` usa `--surface` en claro y `--bg` en oscuro (contraste ≥ 4.5:1).

## App (registro producto, macOS)

Escena: una abogada en un despacho de Ciudad de México, con un contrato en Word en una ventana y LEX AI al lado, a media tarde con luz de oficina, revisando cláusulas durante horas. Pide una herramienta tranquila y densa que desaparezca en la tarea; claro por defecto, oscuro cuando el sistema lo pide.

1. **Vocabulario único de componentes.** Botón primario (relleno `--seal`), secundario (`--surface` + borde `--rule-strong`), simple (texto `--seal`), destructivo (texto/relleno `--danger`). Alto 44 px (contrato de accesibilidad del brief de marca; la densidad se logra con tipografía y espaciado, no reduciendo objetivos), radio 6-8 px, 13-14 px de texto. Deshabilitado: `--surface-2` con texto `--ink-3`, nunca granate pálido. Campos y selects de 32 px con el mismo borde. Estados hover, active, focus-visible, disabled y loading en todos.
2. **Barra lateral (HIG).** Ancho 232 px, fondo `--sidebar`. Encabezados de sección 11 px semibold `--ink-2` (sin mayúsculas forzadas). Filas de 44 px sin separación entre ellas, 14 px, iconos de 16 px, radio 6 px; seleccionada con `--seal-soft` y texto `--seal`. Contador de Pendientes como cápsula discreta. Agrupación: **Trabajo** (Asistente, Asuntos, Escritos, Correo y seguimiento); **Herramientas jurídicas** (Biblioteca federal, Conflictos, Checklist, Pendientes, Acciones propuestas, Tiempo y honorarios); **Sistema** (Panel, Inicio, Calidad del asistente, Configuración). Despacho y estado "Local" al pie de la barra.
3. **Barra de herramientas.** Izquierda: mostrar/ocultar barra lateral + selector de asunto (único lugar donde aparece el asunto, con insignia de jurisdicción). El acceso al expediente es un botón de icono con etiqueta accesible "Abrir expediente" junto al selector. Derecha: Buscar con ⌘K legible en ambos temas. Alto 52 px, fondo `--sidebar` con separador inferior.
4. **Encabezado de página único** para todas las vistas: h1 en `--font-display` 26 px, una línea de descripción en `--ink-2`, acciones alineadas a la derecha. Sin etiquetas en mayúsculas encima. En el Asistente el encabezado es compacto (20 px) y no repite el asunto.
5. **Compositor.** El micrófono vive dentro de la fila de herramientas del compositor (junto al clip), como botón de icono con estado de grabación en el mismo sitio; se elimina el botón "Dictar" flotante. Selector de habilidad en texto `--ink`. Se elimina "Escribe un mensaje para empezar." La pista de teclado queda en `--ink-3`.
6. **Estado vacío del Asistente.** Logo de 32 px, título, una frase. Sugerencias como filas de lista sobre `--surface` con separadores, no cajas blancas sueltas.
7. **Resúmenes numéricos** (Panel, Tiempo y honorarios): franja única unida con divisores, cifras con `font-variant-numeric: tabular-nums`, sin tarjetas iguales.
8. **Configuración** como formulario agrupado estilo Ajustes del Sistema: columna izquierda con título y como máximo dos líneas; detalles largos en una divulgación "Más información". Estado del asistente: punto + texto; si ya está listo, no mostrar el primario deshabilitado.
9. **Movimiento:** 150-200 ms, `ease-out` exponencial, sólo para cambios de estado; respetar `prefers-reduced-motion`.
10. **Responsive:** barra lateral como cajón bajo 768 px; controles de 44 px en táctil; sin desbordamiento horizontal a 320 px.

## Integraciones

### Dentro de la app

- **Word, Excel y SharePoint (Configuración):** tres pasos visibles. 1) Preparar complementos: instrucción breve y referencia a `Preparar complementos.command`. 2) Vincular: botón "Generar código"; el código de un solo uso se muestra grande en cifras tabulares con letra espaciada, cuenta regresiva hasta su vencimiento y botón Copiar. 3) Acceso: "Revocar acceso al asunto" como acción destructiva simple. El campo de SharePoint queda dentro de una divulgación "¿Usas SharePoint Online?" con etiqueta encima del campo.
- **Correo y seguimiento:** composición tipo Mail con ancho máximo de 760 px. Estado de Mail como fila compacta arriba (punto + texto + botón). Filas De / Para / Asunto con etiquetas a la izquierda; CC y CCO detrás de "Mostrar CC y CCO". Cuerpo con altura mínima razonable. La aprobación del mensaje exacto se mantiene como paso explícito.
- **Tiempo y honorarios:** encabezado único; aviso fiscal como nota en línea; temporizador como pieza principal con el tiempo transcurrido en cifras tabulares grandes; entrada manual y acuerdo en secciones con separadores, no tarjetas anidadas.

### Paneles de Office (Word, Excel, SharePoint)

Guía aplicable: diseño de complementos de Office (panel de 320-350 px, marca discreta arriba, patrones tipo Fluent, sin modales). Se adopta la identidad LEX AI.

- Cabecera fija: logo (claro/oscuro), "LEX AI", y cuando hay vínculo, cápsula con el asunto y punto de estado. Pie: "Se procesa en este Mac" + "Desvincular" cuando aplique.
- Pantalla de vinculación: tres pasos numerados cortos (abre LEX AI, Configuración › Vincular complemento, escribe el código) y un campo de 6 caracteres con letra espaciada y cifras tabulares; botón primario a todo el ancho.
- Espacio vinculado: secciones en este orden: Preguntar (consulta + "Preguntar a LEX AI"), Selección (leer, revisar, guardar), Revisión del documento (sólo Word: tipo, revisar, sugerencias seleccionables, aplicar con control de cambios), Hoy. Respuestas con el mismo sello de cita que la app.
- Tokens idénticos a la app, modo oscuro por `prefers-color-scheme` y por el tema de Office cuando esté disponible. Fuente del sistema del host. Se conservan todos los `id`, `data-*` y textos que usan los scripts y `scripts/ui-office-smoke.mjs`.

## Landing (registro marca)

Escena: un socio de despacho que llega desde una recomendación, en su laptop, decidiendo si confiar documentos de clientes a una herramienta nueva. Lo que necesita ver: que la respuesta vuelve a su fuente y que sus documentos no salen de su Mac.

- **Se conserva** la identidad (Newsreader + Schibsted, tinta, granate, papel frío) y el titular. La audacia se gasta en un solo lugar: **la demostración del sello en el hero**. Al pasar el cursor o enfocar [D1], el pasaje correspondiente se ilumina y se dibuja una línea de unión entre cita y pasaje. Una pestaña alterna la misma consulta vista "En LEX AI" y "En Word" (panel lateral ilustrativo). Respeta `prefers-reduced-motion` y funciona con teclado.
- El sello usa borde completo y fondo `--seal-soft`, nunca borde lateral de color.
- **Herramientas agrupadas por tarea**, en texto, sin glifos decorativos ni cuadrícula idéntica: *Preguntar y comprobar* (Asistente, Biblioteca federal), *Preparar y enviar* (Escritos en DOCX, Correo con aprobación del mensaje exacto, dictado local), *Dar seguimiento* (Asuntos, Pendientes, Checklist, Conflictos, Acciones propuestas, Tiempo y honorarios).
- **Nueva sección "Donde ya trabajas"**: Word, Excel, SharePoint Online y Mail, con una maqueta HTML/CSS del panel. Marcada como **"Próxima versión"** mientras `catalogue.json` publique una versión anterior a 0.4.6. Texto honesto: vinculación con código de un solo uso, sesiones que vencen, propuestas con control de cambios, nada se edita sin un clic tuyo; SharePoint Online requiere sesión de Microsoft 365.
- **"Qué se queda en tu Mac"** (banda oscura actual): dos listas concretas. En tu Mac: documentos, consultas, asistente, dictado. Este sitio: sólo la descarga y la ficha pública de la versión.
- Descarga, pasos de instalación (secuencia real, numerada) y límites se mantienen alimentados por `catalogue.json`; añadir el límite de integraciones.
- Copia: sin rayas (—), sin flechas añadidas, sin etiquetas en mayúsculas espaciadas, sin cadenas "A · B · C" decorativas. Título: "LEX AI: respuestas con su fuente a la vista".
- Sin recursos externos; fuentes ya alojadas. Sin desbordamiento a 320-390 px; navegación compacta en móvil.

## Verificación (Claude)

Capturas a 1440/1024/768/390/320 en claro y oscuro de cada vista, landing y los tres paneles a 350 px; smokes existentes (`landing-smoke`, `ui-*`), `npm run build` y `npm test`. Se registra lo que no pudo verificarse (Tauri nativo, Word/Excel reales).

## Decisiones tomadas durante la implementación

- **Objetivos de 44 px.** La HIG de macOS permite controles más pequeños, pero el brief de marca vigente fija objetivos ≥ 44 px y siete smokes lo verifican. Se mantiene el contrato; la sensación Mac viene de la fuente del sistema, la segunda capa neutra de la barra lateral y la jerarquía, no del tamaño de los objetivos.
- **Capa final de estilos.** `src/design-system.css` se importa al final y resuelve las capas anteriores (`styles.css`, `macos.css`) con los tokens canónicos. Consolidar y borrar las reglas antiguas queda como limpieza posterior, con los mismos smokes como red.
- **Fuente de interfaz.** `--font-sans` pasa a la fuente del sistema (SF Pro en Mac). Newsreader queda en títulos de página, estados vacíos y prosa de respuestas.
- **Landing y CSP.** El script en línea que aplicaba el tema antes de pintar estaba bloqueado por `script-src 'self'` en Vercel; ahora es `landing/theme.js`.
- **Paneles de Office.** La política del puente (`style-src 'self'`) impide estilos en línea; todo vive en `office-addin/taskpane.css`. El logo se copió a `office-addin/` porque el puente sirve sólo ese directorio. «Cerrar sesión del panel» olvida el token en la pestaña; la revocación en el servidor sigue en Configuración.

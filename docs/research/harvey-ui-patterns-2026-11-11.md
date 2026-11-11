# Patrones de UI de Harvey vs superficie Rejon — 2026-11-11

Encargo del producto: «pulir el UI para que sea similar al de Harvey». Harvey
es un producto empresarial cerrado; esta nota usa únicamente material público
(su blog de diseño y de producto, páginas de recursos) citado con URL, y lo
contrasta con el inventario real de la superficie Rejon en este repo. Las
afirmaciones sobre la UI real de Harvey tras login no son verificables desde
aquí; la inspección visual directa (navegador) queda pendiente y se declara en
cada punto. Nada aquí cambia código de UI todavía.

## Principios públicos de diseño de Harvey (fuentes primarias)

De su propio blog de diseño
(harvey.ai/blog/how-we-approach-design-at-harvey):

- «We design the way lawyers write: saying the most with the least. Every
  pixel works hard so our users don't have to.» Densidad informativa alta,
  cero ornamento que no trabaje.
- «Bridge the familiar with the future»: patrones conocidos de herramientas de
  abogados (documento, correo, tablas) como ancla, con la capa de IA integrada
  en ese flujo en vez de una consola aparte.

De su blog de producto (harvey.ai/blog/a-more-unified-harvey-experience,
harvey.ai/blog/raising-the-bar-with-harvey,
harvey.ai/resources/videos/unified-assistant-tour):

- **Asistente unificado**: drafting y research en UNA interfaz continua;
  «model orchestration» enruta cada consulta al mejor dato/workflow. La
  estrategia declarada es expandir herramientas específicas y luego
  «collapse that complexity into a simple, unified interface».
- **Vault + Assistant**: análisis de archivos complejos y salidas ajustadas
  sin salir del flujo («stay in flow from start to finish»); creación de
  consultas del Assistant desde Vault.
- Ayudas de prompt dentro del flujo («magic prompt», prompts guardados,
  mejora de prompt) para reducir la carga de entrada.
- Edición/revisión colaborativa sobre el propio documento, no en un panel de
  chat separado (según resenña pública de UX, fuente secundaria:
  note.com/ai_no_design/n/naa045cf769f5 — tratar como impresión de tercero).

## Inventario real de la superficie Rejon (este repo, src/)

React 19 + Tailwind, app Tauri macOS. Vistas actuales: `App`,
`ChatSidebar` (asistente), `MatterOverview`, `MatterTasks`,
`DocumentLibrary`, `DocumentText`, `SourcesView`, `ChecklistView`,
`ConflictCheckView`, `CommandPalette`, `PendingView`, `ReplyDraftEditor`,
`AgentActionsView`, `LocalEmailView`, `TimeBillingView`,
`OfficeIntegration`, `TrainingView`, `VoiceInput`. Sistema de diseño propio
(`design-system.css`, fuentes IBM Plex/Newsreader/Schibsted), landing
estática separada (`landing/`, raíz del despliegue Vercel).

## Contraste e hipótesis de brecha (a verificar con inspección)

1. **Asistente como barra lateral vs interfaz unificada.** Rejon tiene el
   asistente en `ChatSidebar` (panel) y las tareas en vistas separadas
   (MatterTasks, ChecklistView). El patrón público de Harvey colapsa
   drafting+research en un solo flujo continuo. Hipótesis: reducir cambios de
   contexto llevando acciones del asistente al documento/matter abierto.
   Verificar: cómo se ve la transición chat→documento en Harvey real.
2. **Del chat al documento.** Harvey enfatiza editar/revisar sobre el
   documento. Rejon tiene `DocumentText` y `ReplyDraftEditor`; hipótesis:
   revisar cómo las citas/hallazgos del asistente aterrizan en el texto (hoy
   ¿salto de vista o edición en sitio?). Inspección local pendiente.
3. **Ayudas de prompt.** Harvey expone magic prompt/prompts guardados. Rejon
   tiene `CommandPalette` y `assistant-presentation.ts`; hipótesis: acciones
   sugeridas contextuales dentro del flujo del asistente.
4. **Densidad tipográfica.** Harvey declara «every pixel works hard»; Rejon ya
   usa un sistema editorial sobrio (Plex/Newsreader). Brecha probable menor;
   confirmar con comparación visual lado a lado.
5. **Vault ↔ Assistant.** Equivalente Rejon: `DocumentLibrary` ↔
   `ChatSidebar`. Hipótesis: lanzar consultas del asistente con documentos
   seleccionados como contexto sin salir de la biblioteca.

## Pendiente declarado

- Inspección visual directa de Harvey (sitio público y, si hay acceso demo,
  el producto) con navegador: capturas lado a lado antes de proponer cambios
  concretos de UI. Esta nota no propone cambios de píxel todavía.
- Inspección visual local de la app Rejon: no es posible en este entorno (la
  app es Tauri/Vite local y el navegador remoto no alcanza localhost);
  requiere sesión con la app servida o capturas de la máquina del dueño.
- Ninguna afirmación sobre la UI real de Harvey tras login debe tratarse como
  verificada por esta nota.

## Verificación visual directa — 2026-11-11 (navegador, sitio público)

Inspección visual del sitio público de Harvey (harvey.ai, capturas en
/downloads/cloud-browser-20261111-191202.png, -191210.png, -191215.png).
El producto tras login sigue sin ser accesible; las observaciones de UI de
producto provienen de las capturas de producto que Harvey publica en su
propia página y blog (evidencia de marketing, no del producto en vivo).

Tokens medidos (getComputedStyle, portada):

- Tipografía: familia sans propia "HarveySans" para UI/texto y "HarveySerif"
  para titulares display (h1 96px, peso 400, tracking -1.2px). Cuerpo 16px/24px.
- Color: tinta casi-negra cálida rgb(15,14,13) sobre blanco cálido; gris
  apagado rgb(112,109,102) para texto secundario; botón primario negro pleno
  con texto rgb(250,250,249).
- Radio: 4px en botones; botón 14px/500, padding 0 12px, sin borde.

UI de producto visible en capturas oficiales:

- Raíl lateral izquierdo OSCURO con navegación: New Thread, Agents, Vaults,
  Command Center (activo en píldora), More; sección "Apps" (Contract
  Intelligence). Lienzo principal claro cálido.
- Título de vista en serif ("Whitford Lane's Command Center"); acciones
  arriba-derecha; botón primario negro "Ask Harvey".
- Tarjetas blancas redondeadas, bordes mínimos, datos densos (métricas,
  gráficas) — "every pixel works hard" confirmado en la práctica.
- Blog propio (29-jul-2025, "A More Unified Harvey Experience", captura
  anotada): ventana de prompt simplificada, fuentes de conocimiento
  personalizadas, recomendaciones de workflow, selector de modelo/estilos de
  escritura/Magic Prompt, matter y proyecto detectables por consulta, drafts
  y chat "en un solo lugar" (fin del cambio de contexto drafting↔chat).

Contraste con Rejon (verificado en tokens): Rejon ya comparte el patrón
serif-editorial (Newsreader) + sans de trabajo (IBM Plex) y paleta sobria;
las brechas visibles son de ESTRUCTURA (asistente en panel lateral separado
vs flujo unificado con raíl oscuro + lienzo claro + drafting in situ) más que
de tipografía. Pendiente declarado: render local de la app Rejon para el
lado a lado (headless Chrome disponible en el entorno de build).

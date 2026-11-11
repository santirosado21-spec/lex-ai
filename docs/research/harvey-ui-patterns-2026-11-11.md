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

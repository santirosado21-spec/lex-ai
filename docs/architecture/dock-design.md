# Propuesta: dock de navegación para LEX AI

**Qué tomar del HeroDock.** Solo el patrón de interacción: una barra de botones con icono y etiqueta, y el estado activo. Se descartan el héroe fullscreen, el brillo azul de Dali, el badge y los tooltips. La superficie usa los tokens del Expediente: piedra translúcida con un borde fino de 1px y radio de unos 16px. El estado activo es tinta sólida con un subrayado tipo folio. La elevación al pasar el cursor solo aplica con `@media (hover:hover)`, y se anula con `prefers-reduced-motion`.

**Posición y breakpoints**
- **≤780px:** dock fijo abajo, centrado, con márgenes de 8px y `env(safe-area-inset-bottom)`. El sidebar se oculta por completo con `display:none`. No queda el riel de 56px, para no tener dos landmarks de navegación.
- **>780px:** el sidebar sigue igual (232 ↔ 68). Ofrecería el dock en escritorio como preferencia opcional, apagada por defecto. Si se activa, solo aparece con el sidebar colapsado y el riel de 68px se oculta en ese momento. Mi recomendación es dejar el escritorio para una segunda fase.

**Acciones (6)**
1. Inicio
2. Asistente
3. Asuntos
4. Documentos
5. Biblioteca
6. **Buscar**: abre la paleta CmdK, que ya da acceso a Investigación, Habilidades, Fuentes, Modelos y Configuración.

No agregaría una séptima acción "Más", porque Buscar ya cumple esa función.

**Semántica y estados**
- El contenedor es `<nav aria-label="Navegación principal">` con enlaces reales.
- La página activa se marca con **`aria-current="page"`**, no con `aria-selected`, que es para tabs y listboxes. Las subrutas también marcan su sección: el detalle de un asunto marca Asuntos.
- Buscar es un `<button>` con `aria-haspopup="dialog"` y `aria-expanded` sincronizado con la paleta. Al cerrarla, el foco vuelve al botón.
- Las etiquetas visibles son el nombre accesible (WCAG 2.5.3), así que no hace falta `aria-label` aparte.
- Foco con `:focus-visible`: anillo de 2px con offset, que quede dentro del dock.
- El área de toque mide al menos 44×44px.
- Al presionar, una escala de 0.97 solo cuando no hay reduced-motion.
- Mientras CmdK u otro modal está abierto, el dock queda `inert`.

**Espacio reservado**
- Definir `--dock-h` (unos 64px más el safe area). `main` recibe `padding-bottom: calc(var(--dock-h) + 12px)` y `scroll-padding-bottom` igual, para que el foco nunca quede tapado (WCAG 2.4.11).
- El composer del Asistente se apila sobre el dock con `bottom: var(--dock-h)` y nunca va debajo. Ocultar el dock al escribir no lo recomiendo: rompe la orientación.

**Riesgos que bloquean**
1. **Composer superpuesto.** Si hoy el composer usa `bottom:0` fijo, hay que pasarlo a la variable antes de integrar el dock. Si no, tapa la entrada de texto local.
2. **Ancho de 320px.** Seis etiquetas no caben con "Documentos" y "Biblioteca" a 11px. Hay que medirlo. El fallback es mostrar "Docs" como etiqueta visible y nombre accesible, con el título completo, y nunca ocultar etiquetas.
3. **Dependencias y licencia del componente de 21st.** Revisar si trae framer-motion, assets de Dali o una licencia incompatible. Conviene reescribirlo con CSS y los tokens propios antes que importarlo tal cual.
4. **Navegación duplicada.** El sidebar y el dock no deben coexistir visibles ni en el árbol de accesibilidad.

**No bloqueantes:** los atajos de teclado de CmdK siguen igual, el dock no agrega atajos propios. Hay que verificar el contraste del texto sobre la superficie translúcida en modo claro y oscuro (4.5:1).

Todo esto es diseño sin revisar el repositorio; nada está implementado ni probado.
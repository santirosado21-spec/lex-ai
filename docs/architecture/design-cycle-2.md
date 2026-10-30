# LEX AI: dirección de diseño final

**Concepto:** *"Mesa limpia"*. El asistente ocupa el centro, el blanco domina y el negro marca la acción. La identidad LEX vive en la tipografía serif de las respuestas y en un único azul reservado a la evidencia: si algo es azul, es una cita verificable. Se eliminan el crema, el beige y los paneles permanentes.

## Tokens

| Token | Hex | Uso |
|---|---|---|
| `lienzo` | #FFFFFF | Fondo principal y composer |
| `superficie` | #F5F5F4 | Sidebar, filas hover, rail |
| `línea` | #E3E3E0 | Bordes de 1 px y divisores |
| `tinta` | #141414 | Texto y botones primarios (fondo negro, texto blanco) |
| `secundario` | #66665F | Metadatos y fechas (contraste 5,6:1 sobre blanco) |
| `evidencia` | #1F4A73 | Citas, foco de teclado y enlaces a fuentes |

Los estados (error, pendiente, desactualizado) se expresan siempre con **icono + texto**, nunca solo con color. Radio de 6 px, sin sombras salvo en menús. Densidad compacta: filas de 36 px y espaciado base de 4 px.

## Navegación

Sidebar de 232 px, plegable a iconos, agrupada en tres secciones:

- **Trabajo:** Asistente (antes Inicio + Espacio de trabajo; conserva las rutas y solo cambian las etiquetas), Asuntos, Documentos, Investigación
- **Biblioteca:** Fuentes públicas (nueva), Conocimiento, Habilidades
- **Sistema:** Monitor local, Configuración (incluye *Modelo local*)

Arriba va el selector **Despacho / Asunto**, siempre visible porque define el alcance. Abajo, una píldora de estado real: «Gemma · cargado» o «Gemma · no disponible».

## Home / Asistente

- **Vacío:** saludo breve, el asunto activo y el composer centrado (máximo 720 px). Debajo, tres accesos con contenido real del asunto: los últimos documentos importados, las conversaciones recientes y «Importar PDF/DOCX/TXT/MD».
- **Composer:** área multilínea con borde `línea`. Su barra inferior lleva el alcance («Asunto X · 12 documentos»), adjuntar, selector de Habilidad y el botón negro «Preguntar». Atajo ⌘↵.
- **Conversación:** la pregunta aparece en Plex, alineada a la derecha y sobre `superficie`. La respuesta va en Source Serif sin caja, con citas numeradas en `evidencia`. Al pie de cada respuesta: Exportar DOCX, 👍/👎 con comentario y Copiar. Si la respuesta usa fuentes normativas, se muestra un aviso fijo y sobrio: «Basado en la versión del [fecha de la fuente]. No confirma vigencia actual ni sustituye revisión profesional».
- **Rail derecho (360 px, plegable con ⌘.):** pestañas **Fuentes** y **Resultados**. *Fuentes* lista los fragmentos citados con documento, página y fecha; al hacer clic en una cita, el rail se abre y resalta el fragmento correspondiente. *Resultados* agrupa los DOCX generados y las propuestas de aprendizaje con Aprobar, Rechazar y Revertir, más el historial de versiones. El rail se abre solo cuando hay evidencia y nunca aparece vacío.
- **Estados honestos:** «Buscando en documentos…» y «Generando…» solo se muestran si el backend emite esos eventos. En cualquier otro caso, un indicador único sin etapas inventadas. Errores reales: modelo no cargado, sin resultados en el alcance o documento ilegible, cada uno con su acción concreta. «Sin evidencia suficiente» es un estado válido y visible.

## Vista Fuentes públicas

Tabla densa con columnas **Fuente oficial · Tipo · Última comprobación · Estado de descarga · Versión/fecha · Acción**.

- **Filtros como pestañas:** Todas, Pendientes de revisión, Con errores, Descargando.
- **Detalle lateral de cada fuente:** URL oficial, hash, historial de versiones y el último error con su texto literal.
- **Estados:** Actualizada, Pendiente de revisión, Error (con motivo) y Nunca descargada.
- **Botones:** «Comprobar ahora» en secundario, con borde; «Aprobar versión» en negro.
- **Monitor local:** es una página aparte que muestra CPU, memoria, índice y cola. El modelo se configura en Configuración, no en el monitor.

## Responsive

- **≥1280 px:** sidebar, conversación y rail abiertos a la vez.
- **1024–1279 px:** el rail se superpone a la conversación como panel, sin empujar el contenido.
- **<1024 px:** sidebar en iconos y rail a pantalla completa con botón de cerrar.
- **Ventana mínima de Tauri 900×600:** el composer nunca baja de 560 px de ancho y las tablas de Fuentes ocultan Tipo y Versión.

## Criterios de aceptación

1. **Funciones intactas:** existen los nueve destinos y siguen operativas todas las funciones actuales: importar, preguntar, citas clicables, DOCX, feedback, propuestas con aprobación/rollback y cambio de despacho/asunto. Los tests existentes pasan sin cambios de lógica.
2. **Sin restos del tema anterior:** no queda ningún color fuera de los 6 tokens, ni crema ni beige. Todo texto cumple WCAG AA y el foco de teclado es visible en `evidencia`.
3. **Citas trazables:** cada cita abre el rail y resalta su fragmento, y cada respuesta normativa muestra la fecha de la fuente junto al aviso de no vigencia.
4. **Progreso medido:** ningún indicador de progreso o etapa aparece sin un evento real del backend, y cada error muestra causa y acción.
5. **Fuentes y monitor reales:** Fuentes públicas permite filtrar por pendientes y errores con datos reales, y el Monitor local es independiente de Modelo local. Todo se usa por teclado y se ve correctamente a 900×600.

Modelo observado: claude-opus-5-5. Codex suministró contexto y skills; consulta sin herramientas.

# Dirección visual del dashboard — Claude Opus 5.5

# Dashboard: Vista del despacho

## Concepto
Es una hoja de control de un despacho, no un panel SaaS. El elemento memorable es la gráfica de ocho semanas, tratada como un registro sobrio. El resto queda callado.

## Tokens
**Color**
- Papel `#FFFFFF` para los paneles.
- Piedra `#EEF0EC` para el fondo de la página.
- Línea `#D8DCD8` para bordes de 1 px.
- Pizarra `#26313B` para texto, línea de completadas y botón primario.
- Pizarra media `#64717C` para texto secundario y línea de abiertas.
- Foco `#2F5F8A`: anillo de 2 px con offset de 2 px.

**Tipografía**
- Source Serif 4 para el H1 (40/48 en escritorio, 30/36 en móvil, peso 500) y para las cifras de conteo (32, `tabular-nums`).
- IBM Plex Sans para la interfaz: 14/20, etiquetas 13/18 y títulos de asunto 15/22 en peso 600.
- Todo en minúsculas de oración. Sin versalitas, flechas ni separadores "·".

**Espacio y forma**
- Base de 8 px. Hueco entre secciones de 24 px (16 px en móvil). Padding de panel de 24 px (16 px en móvil).
- Radios según jerarquía: panel 12, control 8, barra 3.
- Sin sombras ni degradados.
- Controles de al menos 44 px de alto.

## Layout
```
1440 / 1000
┌ Vista del despacho ─────────── [Ámbito ▾] [Nuevo asunto] ┐
│ Calculado con los datos guardados en este equipo.        │
├──────────────────────────────────────────────────────────┤
│ Asuntos │ Tareas pendientes │ Documentos │ Completadas   │ ← una sola franja
├────────────────────────────────┬─────────────────────────┤
│ Tareas, últimas 8 semanas      │ Asuntos y avance        │
│ (8/12 col)  [Ver como tabla]   │ (4/12)                  │
├────────────────────────────────┴─────────────────────────┤
│ Actividad reciente                                       │
└──────────────────────────────────────────────────────────┘
```
- **1000:** la gráfica ocupa el ancho completo; debajo van Asuntos y Actividad en dos columnas.
- **780:** una columna; la franja de conteos queda en 2×2.
- **390/320:** una columna, conteos en 2×2, gráfica de 200 px de alto y leyenda debajo. El dock inferior no tapa contenido (padding inferior igual a la altura del dock más 16).
- Todo va alineado a la izquierda.
- Ningún panel mide menos de 280 px de ancho. Nunca más de dos regiones por fila.

## Ámbito (solo en esta página)
- Un select etiquetado "Ámbito" con las opciones "Todo el despacho" y luego cada asunto, mostrado como título y cliente.
- Se guarda en la query de la URL. **No toca el asunto activo global.**
- Debajo del H1 aparece "Mostrando: [ámbito]".
- Con un asunto elegido, el CTA primario pasa a "Abrir expediente" y "Nuevo asunto" queda como secundario.

## Conteos
- **Asuntos** y **Documentos**: totales del ámbito.
- **Tareas pendientes**: `status: pending`. Si alguna tiene `plannedDate` anterior a hoy, añadir "N con fecha planificada pasada". No usar "vencimiento".
- **Tareas completadas**: formato "7 de 19 (36,8 %)", con un decimal. Si no hay tareas, mostrar "Sin tareas registradas" en lugar de 0 %.

## Gráfica
- Ocho semanas ISO (lunes a domingo, hora local). La última se rotula "Semana en curso".
- **Abiertas** cuenta `createdAt` dentro de la semana: línea discontinua 4/4 en pizarra media.
- **Completadas** cuenta `completedAt` dentro de la semana: línea sólida de 2 px en pizarra, con relleno plano al 8 %.
- Etiquetas directas al final de cada línea, para no depender del color.
- Sin dobles conteos ni datos inferidos.
- **Accesibilidad:** el SVG lleva `role="img"` y un `aria-label` resumen. El botón "Ver como tabla" alterna una tabla con columnas Semana, Abiertas y Completadas.

## Asuntos y avance
- Cada fila muestra título, cliente y jurisdicción, más "5 de 8 tareas" y una barra de 6 px.
- Orden: más pendientes primero.
- Sin tareas: "Sin tareas. Añádelas desde el expediente."
- La fila completa es un enlace a "Abrir expediente".

## Actividad reciente
- Fusiona `documents.createdAt`, `answers.createdAt` y `tasks.history[].at`, ordenado de más reciente a más antiguo.
- Filas de 56 px: hora, verbo, objeto y asunto. Verbos: "Documento añadido", "Consulta respondida", "Tarea creada", "Tarea completada", "Tarea reabierta".
- Se muestran 12 filas y luego "Mostrar más".
- Sin personas, avatares ni notificaciones.

## Vacíos
- **Sin asuntos:** "Aún no hay asuntos. Crea uno para registrar documentos y tareas." con el CTA [Nuevo asunto].
- **Gráfica sin datos:** se mantienen los ejes y se muestra "Sin tareas abiertas ni completadas en las últimas ocho semanas."
- **Asunto sin actividad:** "Este asunto aún no tiene actividad." con el CTA [Abrir expediente].

## Navegación
- "Dashboard" se añade entre Inicio y Asistente, en el sidebar y en el dock.
- Si el dock está lleno, va dentro de "Más".
- Inicio, Asistente, expedientes, documentos y tareas no cambian.

## Movimiento
- Un solo momento: la línea de completadas se dibuja en 400 ms en la primera carga.
- Con `prefers-reduced-motion` se muestra estática.
- El hover solo cambia el color.

## Plantilla frente a cambios con propósito
| De la plantilla app-1 | Cambio para LEX AI |
|---|---|
| Sidebar | Se mantiene el sidebar existente, con una entrada nueva |
| Cuatro stat cards | Una franja dividida por reglas; la ratio aparece como fracción exacta |
| Área de 8 semanas | Se conserva, sin degradado: discontinua frente a sólida, con tabla alternativa |
| Proyectos activos | Asuntos con avance real de tareas y acceso al expediente |
| Actividad reciente | Eventos reales fusionados, sin personas |

## Revisión
- **Primer plan:** cuatro cards redondeadas con sombra y un degradado en la gráfica. Lo descarté por ser el kit SaaS genérico.
- **Ajuste:** cambié a una franja de reglas sobre fondo piedra y una gráfica plana con patrón de línea.
- **Lo que se quitó:** iconos dentro de los conteos y porcentajes redondeados.

## Ajustes de integración de Codex

El ámbito vive en el estado de App y no modifica la URL de conexión ni el asunto activo global. La cabecera general oculta los controles de asunto en Dashboard para no confundirlos con su filtro. Se conserva Inicio y el acceso móvil a Dashboard está en Más.

La serie «Finalizaciones» cuenta eventos reales del historial de tareas, incluso una nueva finalización tras reabrir una tarea. La fracción de tareas completadas refleja el estado actual. La interfaz explica esa diferencia. La actividad muestra los ocho movimientos más recientes; la lista de asuntos permite ampliar los seis iniciales. La gráfica se muestra sin animación y ofrece una tabla equivalente.

No se incorporan cifras, personas, fotos, notificaciones ni fechas de demostración del recurso. Recharts se carga solo al abrir Dashboard; las tipografías y recursos permanecen locales.

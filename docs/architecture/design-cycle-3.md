# Diseño UI LEX AI: continuidad del trabajo por asunto

## Prioridad de implementación
1. Paleta de comandos (Cmd/Ctrl+K)
2. Resumen del asunto con actividad real
3. Biblioteca de documentos con lector
4. Atajo de extracto a Asistente
5. Estado del modelo y entrenamiento

Todo se deriva del estado existente `{workspace, matters, documents, answers, feedback, proposals, skills, sources}`. No se persiste nada nuevo.

## 1. Paleta de comandos

**Componente:** `CommandPalette` usa el patrón combobox ARIA. Tiene un `input role="combobox"`, `aria-controls` hacia un `listbox` y `aria-activedescendant`.

- **Apertura:** con Cmd/Ctrl+K, desde cualquier vista, incluido el composer. Si el foco está en un textarea con texto seleccionado, la paleta no lo altera. Al cerrar, el foco vuelve al elemento de origen.
- **Encabezado de alcance:** chip fijo con el texto "Asunto activo: {nombre}", o "Sin asunto activo · solo navegación". No es editable dentro de la paleta. Se cambia de asunto con el comando "Cambiar asunto…".
- **Grupos, en este orden:**
  - Documentos del asunto
  - Análisis (answers del asunto)
  - Navegación (vistas)
  - Acciones reales (Importar documento, Nueva consulta, Abrir propuestas pendientes)
  - Cada grupo muestra un máximo de 5 resultados, más la fila "Ver todos en Biblioteca".
- **Fila:** icono a la izquierda, título, descripción secundaria (tipo · fecha, o primera línea de la pregunta) y, a la derecha, el atajo o estado ("Pendiente de revisión").
- **Teclado:**
  - ↑/↓ recorren todas las filas y saltan los encabezados de grupo.
  - Home/End llevan a la primera y última fila.
  - Enter ejecuta.
  - Esc borra la consulta; si ya está vacía, cierra la paleta.
  - El pie muestra "↑↓ navegar · ↵ abrir · Esc cerrar".
- **Búsqueda:** coincidencia local, normalizada sin acentos, sobre título y nombre de archivo. El texto completo solo se busca si la consulta tiene 3 caracteres o más, con debounce de 150 ms. Los resultados se descartan si cambia el asunto (generación de petición o AbortController).
- **Estados:**
  - Vacío: "Sin coincidencias en {asunto}".
  - Error del backend: mensaje en línea con la acción "Reintentar". La navegación sigue disponible.

## 2. Resumen del asunto

**Layout:** dos columnas a partir de 1100 px (8/4), una columna a 700 px.

- **Ficha (`DossierHeader`):** nombre, cliente, materia y fechas de creación y actualización, solo con los campos que existan. Los campos ausentes no se muestran; no se usan "—" falsos.
- **Documentos recientes:** 5 filas de `FileRow` con el enlace "Biblioteca".
- **Análisis recientes:** pregunta, número de fuentes y fecha. Al pulsar, se abre en el Asistente.
- **Actividad (`ActivityFeed`):**
  - Eventos derivados de los timestamps: documento importado, consulta respondida, retroalimentación registrada, propuesta creada o resuelta.
  - Orden descendente, agrupado por día (Hoy / Ayer / fecha).
  - Fila: icono, acción, detalle y hora en `<time datetime>`.
  - Los eventos sin timestamp se excluyen.
  - Lista semántica `<ol>`.
- **Texto fijo bajo el feed:** "Actividad registrada localmente. No incluye plazos ni tareas."

## 3. Biblioteca de documentos

- **Barra de controles:**
  - Búsqueda (`input type="search"`).
  - Tipo: `<select>` con los valores reales de los documentos.
  - Orden: recientes, nombre, tamaño.
  - El contador va en una región `aria-live="polite"`: "12 de 30 documentos".
  - Los filtros viven en la URL o el estado de la vista y se reinician al cambiar de asunto.
- **Fila (`FileRow`):** icono por tipo, nombre, tipo · tamaño · fecha y un menú con acciones reales (Abrir, Preguntar sobre este documento). No hay acción de "Eliminar" si no existe API.
- **Lector:**
  - Por encima de 1100 px, panel dividido lista/lector. A 700 px, el lector ocupa toda la vista con el botón "← Biblioteca".
  - El texto se muestra en Source Serif con medida de unos 70 caracteres.
  - Ubicación por párrafo ("Párr. 14") si se segmenta; nunca se muestran números de página.
  - Si existe el análisis activo, el rail derecho muestra respuesta y evidencias. Una evidencia de este documento resalta el pasaje con `<mark>`.
- **Importar:** botón primario que usa la API existente.
  - Errores por archivo, en línea.
  - Estado vacío: "Este asunto aún no tiene documentos. Importar".

## 4. Del extracto al Asistente

- Al seleccionar texto en el lector aparece una barra flotante con "Preguntar al Asistente". También se activa con Cmd/Ctrl+Shift+A y es accesible por teclado (botón alcanzable con Tab tras la selección).
- **Resultado:** abre el composer con el extracto citado como bloque (documento + párrafo) y el cursor listo para escribir. No envía automáticamente.
- **Etiqueta obligatoria sobre el composer:** "La búsqueda abarca todo el asunto activo; el extracto se incluye como contexto". Solo si el backend expone el filtrado por documento se mostrará "Solo este documento".

## 5. Modelo y entrenamiento

**Ubicación:** Ajustes › Modelo local, más un indicador compacto en la barra lateral ("Gemma local · listo / cargando / no disponible").

- Muestra solo los campos que entregue la API: modelo base, adaptador activo, versión y métricas reales con fecha.
- Si no hay API: "Estado de entrenamiento no disponible en esta versión".
- **Distinción visual:** "Candidato experimental" en gris con borde, frente a "Base". Nunca se muestra "validado".

## Sistema visual

- **Color:** blanco y gris #F5F5F4 para superficies, #141414 para texto. El azul #1F4A73 queda reservado a evidencia, foco y selección.
- **Forma:** bordes de 1 px, sin sombras salvo en la paleta y la barra flotante.
- **Movimiento:** 120 ms de opacidad; se desactiva con `prefers-reduced-motion`.
- **Foco:** anillo de 2 px en azul de evidencia, con offset.

## Decisiones y concesiones

- **Paleta sin búsqueda global entre asuntos:** reduce el riesgo de mezclar confidencialidad entre asuntos, a costa de exigir un paso más.
- **Párrafos en lugar de páginas:** menos familiar para el abogado, pero veraz.
- **Sin colecciones ni tareas:** no se simulan; aparecerán cuando exista persistencia.

## Criterios de aceptación

1. Cmd/Ctrl+K abre la paleta; ↑↓/Enter/Esc funcionan y el foco vuelve al origen. VoiceOver anuncia la opción activa y el alcance.
2. Al cambiar de asunto con una búsqueda en curso, no aparecen resultados del asunto anterior.
3. Cada evento de actividad corresponde a un timestamp existente. Con datos sintéticos sin fechas, el feed queda vacío y lo explica.
4. Ninguna vista muestra números de página, plazos, tareas o métricas no provistas por la API.
5. El atajo de extracto rellena el composer sin enviarlo y muestra la etiqueta de alcance del asunto completo.
6. A 700 px no hay desplazamiento horizontal; el lector y el rail pasan a vistas apiladas navegables.
7. Todo control es un `button`, `a`, `input` o `select` nativo. Ningún botón carece de acción real.
8. Los errores del backend muestran el mensaje y "Reintentar"; los estados vacíos ofrecen la acción real correspondiente.
9. Ningún contenido de documento sale del equipo, ni siquiera en logs de la UI.

Modelo observado: claude-opus-5-5

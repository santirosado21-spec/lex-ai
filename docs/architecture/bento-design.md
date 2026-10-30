# Dirección de diseño — Claude Opus 5.5

# Propuesta: Inicio LEX como mesa de trabajo del asunto

**Principio:** se conserva el efecto del recurso (bento asimétrico y GlowCard con retícula) y se descarta el contenido ficticio. Las cifras son conteos reales del alcance activo. No hay gráficos, terminal ni porcentajes.

## Estructura

**Composer arriba, sin cambios:** saludo en Source Serif y el campo «Pregunta sobre este asunto…» a todo el ancho. Las dos quickactions se eliminan y sus acciones pasan a las tarjetas.

**Desktop (grid de 12 columnas, gap 16px):**
- Fila 1: **Asunto activo** (7 col × 2 filas) | **Motor local** (5 col)
- Fila 2: (continúa Asunto activo) | **Documentos del asunto** (5 col)
- Fila 3: **Respuestas fundamentadas** (8 col) | **Asuntos recientes** (4 col)

**Tablet (≤1100px):** 6 columnas. Asunto activo ocupa el ancho completo y las demás tarjetas se reparten por pares.

**Mobile (≤780px):** una sola columna en este orden: Asunto activo, Respuestas, Documentos, Asuntos recientes y Motor, este último como franja compacta. Se añade un padding inferior equivalente a la altura del dock.

## Tarjetas (5)

1. **Asunto activo:** título en serif, cliente y jurisdicción como metadatos (Plex Sans). Muestra conteos reales con `tabular-nums`: «12 documentos · 4 respuestas». Acciones: *Importar documento* y *Cambiar asunto*.
   - Vacío: «Sin asunto activo. Selecciona o crea un asunto para trabajar con sus documentos.» Acción: *Crear asunto*.
2. **Documentos del asunto:** los 4 más recientes del alcance, con nombre y fecha de importación. Acciones: *Importar* y *Ver todos*.
   - Vacío: «Aún no hay documentos en este asunto.»
3. **Respuestas fundamentadas:** las últimas 3 consultas del asunto, con la pregunta truncada y la fecha. Acciones: *Abrir* y *Exportar DOCX*.
   - Vacío: «Las respuestas que generes aparecerán aquí con sus fuentes.»
4. **Asuntos recientes:** hasta 5 asuntos, cada uno con cliente y jurisdicción. Acción: *Activar*.
   - Vacío: «No hay otros asuntos todavía.»
5. **Motor local:** estado textual «Listo», «Iniciando…» o «No disponible», más la línea fija «Inferencia y documentos en este equipo». Sin latencias.
   - Acción *Reintentar* solo si hay error.
   - El estado se anuncia con `role="status"`.

## Efecto accesible

- El spotlight es un pseudo-elemento `aria-hidden`: un `radial-gradient` posicionado con `--x/--y` y actualizado por `pointermove` mediante rAF.
- La retícula es de 24px en tono piedra y solo se revela bajo el spotlight, con una opacidad máxima del 6%.
- Con teclado, `:focus-visible` y `:focus-within` muestran el mismo brillo centrado de forma estática, con un borde de acento sobrio.
- Ningún contenido ni acción depende del hover. Las acciones siempre son visibles y las tarjetas no son clicables en bloque: cada botón es su propio destino de foco.
- `prefers-reduced-motion`: el foco luminoso deja de seguir el cursor; se muestra una retícula fija y tenue y el borde sobrio de foco.
- `pointer: coarse`: el efecto no se aplica en dispositivos táctiles.
- El contraste de texto es AA en todos los estados; el brillo nunca se pone por debajo del texto.

## Restricciones para Codex

- Solo se usan datos ya cargados en el store: matter, documents y answers del alcance, la lista de matters y el estado del motor. No hay fetches nuevos.
- Los conteos se derivan de esos arrays.
- Mientras los datos cargan se muestra un skeleton con la geometría final, sin números de relleno.
- Verificación:
  - un test de los estados vacíos;
  - axe sin violaciones;
  - comprobar que el orden de tabulación coincide con el orden visual en las dos disposiciones.

## Decisiones de integración de Codex

Se usa «Consultas del asunto» para no presentar fundamentación como garantía. Se mantiene el orden DOM en escritorio y móvil para conservar la secuencia de teclado. El estado de carga ya pertenece al contenedor de Inicio. No se agrega skeleton independiente ni otra consulta al backend.

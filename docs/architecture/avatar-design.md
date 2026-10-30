# Dirección de diseño — Claude Opus 5.5

# Decisión: avatar LEX como indicador de presencia, no como mascota

**Ubicaciones (solo estas tres)**
1. **Asistente vacío:** orbe de 64 px a la izquierda de marcaLEX, alineado con la altura de su caja. El logotipo se queda igual. En móvil (<640 px) baja a 48 px.
2. **Cabecera de respuesta:** orbe de 32 px antes de marcaLEXsmall. El logotipo pequeño se mantiene.
3. **Generación:** el orbe de 32 px de la respuesta en curso sustituye al spinner. El texto de estado real se queda a su lado.

Queda fuera de: dock, bento Inicio, mensajes del usuario, citas, errores, ajustes y cualquier otra pantalla.

**Forma y color**
- Siempre **circle**. El squircle competiría con los iconos del dock.
- Un solo color: **azul pizarra**, gradiente aprox. `#4A5D78` → `#8A9BB3` con brillo superior izquierdo. La sombra no debe superar el borde del orbe.
- El grano va en opacidad ≤ 0,12, con un único `<filter>` feTurbulence compartido por id. Así se evita crear un filtro en cada mensaje.
- Los otros 11 colores no se exponen en esta superficie. El color no se asocia a modelo, modo ni calidad.

**Estados reales**
- **Reposo** (vacío e historial): estático, ojos abiertos, sin parpadeo.
- **Procesando** (desde enviar hasta fin de stream o cancelación): parpadeo cada 3,6 s y una leve oscilación de luminosidad del brillo. Solo anima la instancia activa.
- **Completado, cancelado o error:** vuelve a estático de inmediato. El error se comunica con el texto y el estilo de error existentes, no con el avatar.

**Interacción**
- Elemento no interactivo: sin whileTap, sin hover, sin `cursor: pointer`.
- Se elimina la dependencia de motion. Todo se resuelve con keyframes CSS activados por `data-state="processing"`.

**Accesibilidad**
- Orbe con `aria-hidden="true"`. El estado de generación lo anuncia el texto real en `aria-live="polite"`.
- Con `prefers-reduced-motion: reduce`, sin parpadeo ni oscilación. El estado se lee solo por el texto.
- El borde del orbe necesita un contraste de al menos 3:1 sobre piedra/blanco. Si no lo alcanza, se añade un anillo de 1 px `#3A4A60` al 40 %.
- Los ojos no transmiten información.

## Integración de Codex

La app solo muestra una instancia del avatar a la vez (vacío, procesando o respuesta). Cada instancia tiene un identificador SVG único; no se introduce un filtro global con ciclo de vida independiente. Se conserva la marca textual LEX AI en la respuesta y LEX en el vacío. El avatar sustituye el pequeño emblema L en la respuesta para evitar acumular tres marcas. El borde usa azul pizarra sólido. No hay dependencia motion: no existe una acción de pulsación que animar.

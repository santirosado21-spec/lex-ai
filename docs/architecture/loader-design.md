# Dirección visual — Claude Opus 5.5

**Elijo A: anillo que enmarca el avatar estático, letras debajo.** Mantiene la continuidad del orbe (vacío → generando → respuesta) y conserva lo reconocible del recurso: el anillo con sombra interior y las letras escalonadas. Ajuste: las letras dicen **«Procesando»**, no «LEX AI». El orbe ya identifica la marca, y repetirla no informa del estado.

**Ubicación:** bloque inline en la fila del mensaje del asistente, alineado a la izquierda. Sin fondo degradado ni overlay. «Cancelar» sigue en el composer.

**Medidas**
- Anillo de 56px, `border-radius:50%`, con el avatar de 32px centrado y sin parpadeo.
- Hueco de 8px y luego las letras en IBM Plex Sans 13px/500, `letter-spacing:.02em`, color tinta.
- Bloque total de unos 56×84px.

**Colores (sombra interior escalada)**
`inset 0 3px 5px #fff, inset 0 6px 9px var(--azul-pizarra-claro), inset 0 14px 14px var(--azul-pizarra)`. Anillo con `rotate` lineal de 5s. El avatar va en una capa hermana para que no gire.

**Letras**
Un `<span>` por letra con `animation-delay: i*0.1s`. Ciclo de 3s que pasa la opacidad de .35 a 1 y vuelve. No se usa escala para evitar saltos de layout.

**Accesibilidad**
- Las letras llevan `aria-hidden`.
- Hermano `role="status" aria-live="polite"` en `sr-only` con el texto «Procesando tu consulta localmente».
- Al terminar, se retira y se anuncia la respuesta.

**Movimiento reducido**
`prefers-reduced-motion: reduce` detiene el giro y el pulso. El anillo queda estático y el texto, a opacidad 1.

**Implementación**
`LexLoader.tsx` con `LexLoader.css` local y `@keyframes` propios. Sin styled-jsx ni dependencias. La prop `label` va con «Procesando» por defecto.

## Integración de Codex

Se conserva ai-loader.tsx y la exportación Component del recurso aportado. El estado vivo ya existe en el contenedor de generación; el loader interno es decorativo para evitar anuncios duplicados. Se eleva la opacidad mínima de las letras a 0.75 para conservar contraste. El anillo gira sin transformar al avatar, que permanece estático. El componente reutilizable conserva size/text y añade children/decorative.

# Avatar aportado por el dueño

El recurso original está en `avatar-supplied.md`. Se adaptó en `src/components/ui/components-primitives-avatar.tsx` y su CSS, dentro de la estructura `@/components/ui` → `src/components/ui` que ya utiliza la app. TypeScript, Tailwind con prefijo `tw:` y la configuración compatible con shadcn ya existen; no hace falta inicializarlos de nuevo.

## Diseño y skills compartidas

Codex consultó dsystem global compartido y la skill frontend-design del repositorio instalado de Claude: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`. Se proporcionó su contenido a Claude Opus 5.5 en una consulta acotada sin herramientas. No se afirma que Claude exploró archivos: su dirección está conservada en `docs/architecture/avatar-design.md` y el resultado del CLI en `artifacts/ui-avatar/claude-design.json`. Codex revisó además la skill global `vercel:react-best-practices` para hooks, renderizado, bundle y accesibilidad.

## Adaptación funcional

- Asistente vacío: avatar estático de 64 px junto a LEX; 48 px en móvil.
- Generación: avatar de 32 px con parpadeo y brillo suaves mientras la solicitud está activa. El texto real conserva `role="status"`.
- Respuesta guardada: avatar estático de 32 px junto a la marca textual LEX AI.

No aparece en Inicio, dock, citas, mensajes del usuario ni errores. El mismo color azul pizarra no codifica calidad, certeza ni disponibilidad. No realiza llamadas de red, no gestiona inferencia y no cambia la lógica de la consulta. `blinking` procede del estado existente de generación. La finalización, cancelación o error desmonta la instancia animada.

Se conservan las variantes de color, tamaño y forma del recurso para reutilización, más `slate`; LEX utiliza solo circle/slate. Props: `blinking`, `color`, `size`, `shape`, `className`, `decorative` y `label`. El valor por defecto es estático. Como componente independiente puede exponer un nombre accesible; en LEX es decorativo porque el texto contiguo ya identifica al asistente.

El recurso usaba `motion` para deformarse al pulsar sin realizar una acción. Aquí el avatar no es interactivo; se elimina esa deformación y se usan keyframes CSS para el parpadeo. Por tanto, no se instala una dependencia que ya no se importa. No necesita imágenes Unsplash ni assets remotos: gradientes y grano SVG son locales. Un `useId` evita colisiones del filtro; hay un único filtro por instancia visible. CSS aislado bajo `lex-avatar`, sin estilos insertados por cada render. Movimiento reducido desactiva ojos y brillo; colores forzados conservan un contorno y ojos visibles.

## Verificación

```sh
npm ci
npm run build
node scripts/ui-avatar-smoke.mjs
npm run test:ui
```

El smoke usa un servidor local real, documentos sintéticos y una inferencia simulada controlada por la prueba. Verifica reposo, procesamiento, respuesta, error y cancelación; tamaños 64/48/32 px; exclusión de Inicio; movimiento reducido, ausencia de foco y solicitudes externas; escritorio y 390/320 px. No ejecuta Gemma ni evalúa calidad jurídica. Capturas y resultados en `artifacts/ui-avatar/`.

El recurso aportado por el dueño no incluye licencia externa verificable; se conserva su procedencia sin atribuirle una licencia inventada. La app nativa mantiene el mínimo de 1000 px; tamaños móviles corresponden a Chromium.

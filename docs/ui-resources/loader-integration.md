# Loader circular aportado por el dueño

Recurso recibido directamente en el mensaje del 30 de octubre de 2026: `ai-loader.tsx`, anillo luminoso rotatorio y letras escalonadas. Se conserva el componente en `src/components/ui/ai-loader.tsx`, con CSS aislado en `ai-loader.css`. La exportación `Component` del demo sigue disponible, junto al nombre descriptivo `AILoader`.

## Contexto y estructura

La app ya soporta React, TypeScript, Tailwind 4 y estructura compatible con shadcn. `@/components/ui` resuelve a `src/components/ui`; se utiliza esa carpeta porque el código está organizado bajo `src`, no en la raíz del sistema. La configuración y los comandos reproducibles están en `dock-integration.md`. No se ejecutó un init ni se añadieron dependencias.

El recurso utiliza `style jsx`, propio de styled-jsx y no disponible en esta app Vite. Se reemplaza por una importación de CSS con clases/keyframes prefijados `lex-ai-loader`/`lex-loader`. No necesita proveedor de contexto, imágenes, logos, iconos ni assets externos; los efectos son CSS locales. No se añaden imágenes Unsplash para un indicador que no las utiliza.

## Uso

```tsx
import {AILoader, Component} from '@/components/ui/ai-loader';
import Avatar from '@/components/ui/components-primitives-avatar';

// Compatible con el demo original; defaults localizados.
<Component size={180} text="Procesando" />

// Uso real dentro del status existente de la app.
<AILoader size={56} text={stream ? 'Presentando' : 'Procesando'} decorative>
  <Avatar size="sm" decorative />
</AILoader>
```

Props: `size` (180 por defecto, limitado a 24–240 y con fallback para valores no finitos), `text` («Procesando»), `children` opcional en el centro y `decorative` (false). No mantiene estado de negocio ni simula progreso. El avatar es una capa hermana al anillo y no rota ni parpadea durante esta vista.

Se integra solo durante la consulta, dentro del panel del Asistente. No utiliza `fixed`, fondo de pantalla completa, modal ni captura de foco. El compositor mantiene Cancelar visible. El indicador desaparece al completar, cancelar o fallar. El texto cambia al presentar la respuesta validada; no introduce fases artificiales.

Las letras visuales y el anillo son decorativos. En uso independiente, el componente expone una región de estado con nombre completo. En la app se marca `decorative` porque el contenedor ya anuncia el texto real de generación: no se duplican regiones vivas. Movimiento reducido detiene giro y pulso; colores forzados mantienen contorno y texto. La opacidad mínima se elevó de 0.4 a 0.75 para mantener legibilidad. Se respeta la paleta clara de LEX, sin invertir colores según el tema del sistema.

## Skills y verificación

Se reutilizaron las lecturas de dsystem global compartido, frontend-design del repositorio global oficial de Claude y react-best-practices del catálogo de Codex. Codex proporcionó la skill de diseño a Claude Opus 5.5 en una consulta acotada sin herramientas. Dirección observada: `docs/architecture/loader-design.md`; evidencia local: `artifacts/ui-loader/claude-design.json`. No se atribuye al recurso una licencia externa que el dueño no proporcionó.

```sh
npm run build
LEX_UI_AVATAR_REPORT_DIR=artifacts/ui-loader node scripts/ui-avatar-smoke.mjs
npm run test:ui
```

Se amplió el smoke existente del avatar para comprobar ambos componentes juntos: reposo, proceso, respuesta, fallo, cancelación, movimiento reducido, ausencia de red externa y Cancelar accesible por encima del dock a 390 y 320 px. La inferencia es simulada y controlada por la prueba. Se revisaron capturas de escritorio y móvil; no se afirma prueba de lector de pantalla físico. La ventana nativa conserva su mínimo de 1000 px.

# Bento del espacio de trabajo

El recurso proporcionado por el dueño se conserva íntegro en `bento-supplied.md`. Claude Opus 5.5 dirigió la adaptación visual siguiendo dsystem y la skill oficial frontend-design de Anthropic; su propuesta está en `docs/architecture/bento-design.md`. Codex implementa, integra y verifica. No se atribuye al recurso una licencia externa no documentada.

## Integración

`src/components/ui/interactive-tech-stack-bento-grid-with-hover-effects.tsx` adapta la cuadrícula asimétrica, el foco luminoso y la retícula del recurso a Inicio. Su CSS se limita al prefijo `lex-bento`. El compositor permanece primero. Las cinco tarjetas muestran el asunto activo, sus documentos, sus consultas, asuntos recientes del despacho y el estado real del motor local.

Los datos proceden del estado ya cargado por la aplicación. Documentos y respuestas se filtran por asunto; cambiarlo actualiza el contenido. Los documentos abren el lector existente y las preguntas abren la respuesta guardada. Las acciones de expediente, documentos, investigación y configuración utilizan las rutas locales existentes. No se agregan solicitudes de red, gráficos aleatorios, porcentajes de calidad ni simulaciones de despliegue.

Se conserva el orden de lectura y tabulación entre tamaños de pantalla. Todas las acciones están visibles sin hover. Los nombres largos se parten, las acciones tienen objetivos de al menos 44 px y el efecto decorativo respeta movimiento reducido y punteros táctiles. La posición del foco luminoso se actualiza mediante variables CSS y requestAnimationFrame, sin renderizar React en cada movimiento.

## Estructura y dependencias

El alias `@/components/ui` apunta a `src/components/ui`, la ubicación del código React en este proyecto. Tailwind 4 con prefijo `tw:`, TypeScript, Lucide y la estructura compatible con shadcn ya se incorporaron al adaptar el dock; este recurso no necesita instalar dependencias, proveedores ni imágenes externas. Véase `dock-integration.md` para la configuración reproducible. No se ejecuta `shadcn init` sobre los estilos existentes.

## Comprobación reproducible

```sh
npm ci
npm run build
node scripts/ui-bento-smoke.mjs
node scripts/ui-dock-smoke.mjs
npm run test:ui
```

El smoke específico utiliza un despacho temporal, documentos sintéticos y respuestas sembradas expresamente como fixtures. No ejecuta inferencia. Comprueba estados vacíos, alcance por asunto, apertura real de documentos y respuestas, cambios de estado del motor, anchuras 1440/1000/780/390/320 px, objetivos táctiles, foco, movimiento reducido y ausencia de solicitudes externas. Evidencia local en `artifacts/ui-bento/`. Los tamaños móviles se prueban en Chromium; la ventana nativa conserva su mínimo de 1000 px. No se afirma haber ejecutado axe ni pruebas de un dispositivo físico.

# Dashboard adaptado de app-1

El recurso del dueño se conserva íntegro en `dashboard-supplied.md`. La aplicación ya dispone de React, TypeScript, Tailwind y estructura compatible con shadcn; `@/components/ui` resuelve a `src/components/ui`.

Se adapta `app-1.tsx` como nueva sección Dashboard. Conserva la organización de indicadores, gráfica de ocho semanas, asuntos y actividad, integrada en la navegación existente. Los módulos `app-1-utils/sidebar`, `app-1-data` y `app-1-sidebar` no venían en el recurso: se reutiliza el shell de LEX AI y se derivan los datos de AppState. No se instalan primitivas Radix ajenas al flujo ni se introducen avatares, personas o datos ficticios de producción.

El ámbito del dashboard es independiente del asunto activo. Todos los contadores, tareas y eventos se filtran por los asuntos del espacio local; las tareas además comprueban workspaceId. Abrir un expediente sí selecciona el asunto correspondiente. Inicio y el chat se conservan, incluidos sus borradores al navegar al dashboard.

La fracción «Tareas completadas» usa el estado actual; «Finalizaciones» en la gráfica cuenta transiciones reales del historial, incluida una nueva finalización después de reabrir una tarea. Son ocho semanas de calendario local, de lunes a domingo, con la actual parcial. No se calculan plazos legales, productividad de personas, avance jurídico ni porcentajes ficticios.

Recharts 3.10.1 y react-is 19.3.1 quedan fijados. Se consultaron el [repositorio oficial](https://github.com/recharts/recharts) y la [API oficial de AreaChart](https://recharts.github.io/en-US/api/AreaChart/). React instalado es 19.3.1. La vista se carga bajo demanda mediante React.lazy y utiliza una tabla equivalente para accesibilidad. No hay imágenes, CDN, fuentes o llamadas de datos externas. Las licencias MIT se conservan en `resources/licenses`.

Claude Opus 5.5 produjo una dirección visual acotada con la skill global frontend-design suministrada por Codex. Codex integró la navegación, coordinó la implementación y verificó datos, flujos y paquete. El diseño y los ajustes se registran en `docs/architecture/dashboard-design.md`.

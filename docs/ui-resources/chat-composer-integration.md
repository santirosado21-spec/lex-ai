# Barra de chat aportada por el dueño

Integración del recurso MetalPromptBar en Inicio y Asistente. El original se conserva en `chat-composer-supplied.md`. React, TypeScript, Tailwind y la estructura shadcn ya estaban disponibles; los componentes viven en `src/components/ui` mediante el alias `@/components/ui`.

La barra es controlada por App: adjuntos y habilidades usan las operaciones reales del asunto, sin chips ficticios de modelo o «Auto». Enter y Cmd/Ctrl+Enter envían, Shift+Enter añade una línea y la composición IME no envía. Crece hasta seis líneas. El borrador solo se limpia tras una respuesta satisfactoria; error y cancelación conservan texto y selección. Los controles tienen al menos 44 px.

Se incorpora `metal-fx@2.0.11` con versión exacta. El recurso omitía el hook de tema; se usa el tema claro existente explícitamente. El anillo se desmonta durante generación, con movimiento reducido, colores forzados o página oculta. Si WebGL no está disponible, el botón mantiene un borde CSS estático y sigue funcionando. Se anula el fundido inicial del contenedor de MetalFx para que la etiqueta y la flecha nunca esperen al primer fotograma del shader. No se requieren imágenes, CDN ni proveedores de contexto adicionales.

Fuentes consultadas: [repositorio oficial MetalFx](https://github.com/Jakubantalik/metal-fx) y [licencia de Paper Shaders](https://github.com/paper-design/shaders/blob/main/LICENSE). MetalFx tiene licencia MIT e incluye shaders derivados de Paper Shaders bajo Apache 2.0. Sus licencias y NOTICE se conservan en `resources/licenses`, también en el paquete de escritorio.

Claude Opus 5.5 aportó dirección visual en una consulta acotada con la skill global frontend-design suministrada por Codex. Codex revisó la dependencia oficial, coordinó la implementación y ejecutó las pruebas. La dirección y los ajustes están en `docs/architecture/chat-composer-design.md`.

# Kimi y Cursor en dsystem — 2026-11-03

Autorización del dueño: incorporar Kimi Desktop y Cursor al workflow de desarrollo. Rige AGENTS.md; la prohibición vigente de usar Claude prevalece sobre la skill global y documentos históricos. Codex conserva decisiones, diseño, implementación principal, verificación e integración. Esto no añade modelos externos al asistente de producto.

## Reparto

| Herramienta | Encargo | Entrega verificable |
|---|---|---|
| Codex | Coordinar, diseñar, implementar, revisar e integrar | Diff y comprobaciones proporcionales al cambio |
| Kimi Desktop | Análisis de un problema, alternativas, propuestas de UI y crítica de contexto sanitizado | Propuesta escrita con supuestos; no sustituye pruebas |
| Cursor Desktop | Revisar un módulo o implementar archivos expresamente asignados | Diff acotado, comprobaciones ejecutadas y limitaciones |
| localllm | Texto sencillo y verificable cuando compense la llamada | Resumen o JSON contrastado por Codex; no código de producción |
| opinion | Objeción independiente cuando exista una incertidumbre concreta | Opinión autocontenida; no inspección ficticia de archivos |

No convocar a todos para cada cambio. Kimi es la opción adicional para análisis; Cursor para trabajo técnico acotado. Codex puede resolver tareas cortas directamente. Si falla un colaborador o agota cuota, continuar sin bucles de reintento.

## Acceso y límites

- Kimi instalado: `/Applications/Kimi.app`, versión **3.2.24**, identificador `com.moonshot.kimichat`. La UI muestra Kimi Work, sesión iniciada y selector **K3 / High**. No confundirlo con una instalación verificada de Kimi Code. El aviso inicial Reconnecting desapareció. Cuota, precio marginal y acceso API no comprobados.
- Cursor instalado: `/Applications/Cursor.app`, versión **3.28.7**, sesión iniciada. La UI mostró **Grok 4.7 High** y se cambió el entorno de **Cloud** a **This Mac**. Esto describe la sesión observada; comprobarlo de nuevo antes de cada encargo. No usar Auto sin verificar el proveedor ni seleccionar Claude.
- No se encontraron `kimi`, `cursor-agent`, `agent` ni `cursor` en PATH. Cursor incluye un lanzador en su app; eso no demuestra acceso al CLI de agentes. No se instalaron CLIs ni se configuraron claves.
- Solo usar las prestaciones ya incluidas en las cuentas. No activar pagos, recargas, upgrades ni consumo adicional de pago. No prometer acceso gratuito o ilimitado por tener la app instalada.
- La ejecución This Mac conserva las herramientas en esta Mac, pero el proveedor puede recibir el contexto del modelo. Usar solo desarrollo sanitizado, fuentes públicas y ejemplos sintéticos. Nunca abrir datos de clientes, credenciales ni archivos privados para estos colaboradores.

## Protocolo de encargo

1. Leer AGENTS.md, agent-routing.md, tablero y estado Git. Determinar qué archivos ya están modificados; no atribuirles un dueño sin evidencia.
2. Preparar objetivo, contexto mínimo, archivos propios y excluidos, skills pertinentes con fuente, restricciones, formato de entrega y criterio de aceptación. Si el colaborador no tiene acceso a las skills, copiar únicamente su guía aplicable.
3. Para Kimi, pegar un encargo autocontenido; por defecto no adjuntar el repositorio, habilitar plugins ni conceder acceso a carpetas. Para Cursor, empezar por análisis y habilitar escrituras solo dentro de la asignación. Si hay material sensible en el árbol, usar una carpeta sanitizada en lugar de abrirlo completo.
4. Verificar cuenta, modelo explícito distinto de Claude, entorno y cualquier aviso de coste antes de enviar. No cambiar permisos globales para desbloquear una tarea.
5. No editar simultáneamente los mismos archivos. Cada delegado debe saber que hay otros cambios y preservarlos. Sin publicación, comunicaciones, acciones destructivas ni decisiones legales de alto impacto por iniciativa del delegado.
6. Codex contrasta la respuesta y el diff con la fuente, ejecuta pruebas necesarias y registra qué se ejecutó realmente. Una sugerencia o un chat terminado no acredita implementación, pruebas ni validación jurídica.

Cursor carga `.cursor/rules/lex-workflow.mdc` y AGENTS.md. `.cursorignore` excluye datos, secretos y artefactos del contexto ordinario, pero **no impide acceso desde terminal o MCP**: no tratarlo como aislamiento de seguridad.

## Comprobación de incorporación

Sesión del **2026-11-03**, alrededor de las **21:15–21:17**, hora de Ciudad de México:

- **Cursor: respuesta efectiva.** Se abrió esta carpeta desde Open Folder; la interfaz confirmó proyecto `lex-ai`, rama `main`, entorno `This Mac` y modelo `Grok 4.7 High`. Se envió una única prueba de solo lectura restringida a AGENTS.md, esta guía y la regla `.mdc`. El chat `Workflow incorporation test` mostró `Explored 3 files`, respuesta final y estado Completed. Identificó a Codex como coordinador, su propio alcance acotado y la exclusión de datos privados. Reportó no editar ni ejecutar terminal/MCP. El indicador Changes muestra el árbol de trabajo previo, no cambios atribuibles a esta consulta. No se hizo commit ni se pulsó su acción de publicación.
- **Kimi: respuesta pendiente de validación.** Se envió una única consulta autocontenida, sin archivos ni acceso al repositorio, pidiendo tres comprobaciones propuestas de aislamiento con ejemplos ficticios. El selector mostró K3 / High. La UI permaneció generando sin contenido; se detuvo y mostró `Output stopped`. No hay una contribución de análisis ni prueba de inferencia completada que atribuirle. No se infiere si la causa fue red, cola o cuota y no se reintentó.
- **Configuración local: comprobada.** Se verificaron los seis archivos de configuración/documentación, el frontmatter `alwaysApply: true`, la instrucción de no usar Claude y las referencias entre documentos; `git diff --check` pasó sobre los archivos versionados modificados por esta incorporación. Se conservaron los cambios previos. No cambió código de la app y no se ejecutó su suite por esta tarea documental.

Ese corte se integró mediante las apps y reglas del proyecto. La ampliación posterior añade [cuatro conectores API opcionales y traspaso web](remote-collaborators.md), sin servicio en segundo plano ni activación automática. La siguiente asignación real debe volver a comprobar disponibilidad y cuota, especialmente en Kimi.

Actualización posterior del dueño: dispone de Grok en Cursor/Grok Bot, cuentas de Hugging Face y OpenRouter y DeepSeek Harness descargado. **Grok no es Groq.** Se comprobó `/Applications/DeepSeek Harness.app`, identificador `com.deepseek.dsh`, versión `0.2.1-rc.5`; su UI mostró `DeepSeek-V4.1-Flash`, esfuerzo High y acceso Workspace Write en un workspace por defecto. No se vinculó esta carpeta, no se enviaron encargos y no se comprobó cuenta/cuota ni procedencia de descarga. No asumir que el acceso de esa app habilita la API de Hugging Face.

## Fuentes consultadas

- Skill dsystem: `/Users/santiagorosado/.agents/skills/dsystem/SKILL.md`, leída por Codex; ajustada a la instrucción posterior de no usar Claude.
- [Reglas de Cursor](https://cursor.com/docs/rules): formato `.mdc`, reglas del proyecto y AGENTS.md.
- [Archivos ignorados de Cursor](https://cursor.com/docs/reference/ignore-file): alcance y limitación frente a terminal/MCP.
- [Productos de Kimi](https://www.kimi.com/en/help/others/product-comparison): diferencia entre app, Work y Code. La instalación y la sesión reales se verificaron mediante metadata local y UI; no se deduce una suscripción de esa documentación.

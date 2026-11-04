# Revisión del escritorio y últimos cambios de Claude — 2 de noviembre de 2026

Encargo: analizar por qué la versión de escritorio no está sirviendo al dueño. Se inspeccionó `/Applications/LEX AI.app`, los commits recientes y el árbol local sin integrar. No se modificó ni reemplazó la aplicación, su base de datos ni sus documentos. Los probes usan despachos temporales sintéticos. No se consultaron otros modelos.

## Hallazgos

1. **La instalación no contiene las últimas correcciones.** La app instalada declara 0.4.3 y sus módulos se prepararon a las 16:07 del 2 de noviembre, hora de CDMX. `server/runtime-memory.mjs` coincide con el árbol actual, pero `server/service.mjs` no. No contiene `classifyConversationIntent`. Los commits `ffca2b6` (16:33, apariencia y conversación) y `85df52f` (16:36, alias Constitución/CPEUM) son posteriores al paquete instalado. La ventana Configuración tampoco muestra los controles nuevos de apariencia. Compartir el número 0.4.3 no garantiza compartir implementación.

2. **La instalación recupera fuentes ajenas a la intención de la pregunta.** La ventana nativa mostraba la consulta «hola que puedes hacer para mi soy abogado penal» con una respuesta sobre un contrato sintético y el Código Civil para el Distrito Federal. El probe aislado reproduce la selección del contrato y los artículos 1796 y 1797 para esa consulta en un asunto CDMX. También selecciona esos documentos para «hola» o «¿Cuál es la capital de Francia?». En el probe se intercepta la llamada de inferencia; se comprueba qué contexto se enviaría, sin fabricar una respuesta del modelo.

3. **La corrección conversacional es parcial incluso en el código actual.** `classifyConversationIntent` exige expresiones completas de una lista y limita el mensaje a ocho palabras. «hola» y «qué puedes hacer» reciben una respuesta conversacional, pero la presentación del dueño no. En CDMX se abstiene por falta de fuentes; en un asunto federal selecciona, entre otros, el artículo 2590 del Código Civil Federal y el 107 del Código Militar de Procedimientos Penales. «¿Cómo puedes ayudarme en un asunto penal?» también se envía a investigación jurídica. Recompilar por sí solo no resuelve estas frases.

4. **El ámbito del asunto bloquea indebidamente fuentes federales solicitadas.** `explicitArticleReference` limita sus candidatos a la jurisdicción del asunto; la biblioteca federal y los alias nuevos se consultan solo con `MX-FED`. Con un asunto `MX-CMX`, pedir el artículo 1797 del **Código Civil Federal** selecciona artículos del **Código Civil para el Distrito Federal** tanto en la instalación como en el árbol actual. Pedir el artículo 20 de la Constitución en el árbol actual se abstiene en CDMX y recupera correctamente el artículo 20 en un asunto federal. Hay que distinguir el ámbito del expediente y el ordenamiento expresamente solicitado, preservando el aislamiento de documentos privados.

5. **La interfaz impide aprovechar respuestas sin inferencia.** `src/App.tsx:161` y `src/components/ui/metal-prompt-bar.tsx:14` requieren motor preparado y asunto; ciertas habilidades además requieren documento. Así, los saludos y preguntas sobre capacidades que el servicio ya puede responder sin inferencia siguen bloqueados en la UI con el motor detenido. Al abrir la instalación observada, el motor estaba detenido; no se observó un fallo de arranque de la app.

## Verificación realizada

- `npm run build`: PASS.
- `npm test`: **211/211**, sin omitidas ni fallos, en el árbol observado. No acredita que los casos anteriores estén resueltos.
- `codesign --verify --deep --strict /Applications/LEX AI.app`: PASS. No acredita notarización.
- Apertura e inspección de la ventana Tauri mediante Computer Use: PASS; respuesta problemática y estado detenido observados directamente.
- Probe comparativo de recuperación: **28 combinaciones** (dos versiones × dos ámbitos × siete preguntas). Resultados completos en `artifacts/desktop-audit/probe.json`; script en el mismo directorio.
- Inferencia **real** con el runtime incluido en la instalación, modelo pequeño ya existente y despacho temporal sintético: inicialización PASS; consulta exacta al artículo 1797 del CCF con cita comprobada PASS, **3.466 ms**; exportación DOCX de **13.784 bytes** con cabecera ZIP. No se verificó visualmente ese DOCX ni se evaluó la corrección jurídica de la respuesta. El probe prohíbe descargas de modelos y solicitudes fetch externas. Resultado en `artifacts/desktop-audit/runtime-probe.json`.
- La inferencia real anterior se ejecutó en esta Mac de 24 GB: no valida hardware de 8 GB ni el conjunto de tareas jurídicas.

## Orden de corrección recomendado

1. Cubrir presentación profesional/preguntas de capacidades y separar esos mensajes de investigación y análisis documental; evitar que un saludo con una petición jurídica sustantiva oculte esa petición.
2. Resolver ordenamientos federales explícitos desde asuntos locales y rechazar sustituciones silenciosas de código; mantener despacho/asunto como frontera para documentos privados.
3. Alinear las condiciones de envío de la UI con los requisitos reales de cada tipo de petición.
4. Verificar estos recorridos en la ventana Tauri, empaquetar con una versión nueva y comprobar que el bundle contiene exactamente las correcciones. Preservar instalación previa y datos al actualizar.

Dictado, Office, horas y ampliaciones de corpus tienen cambios concurrentes sin integrar. No atribuirlos a una entrega de escritorio ni empaquetarlos indiscriminadamente como solución a estos fallos.

El motor local pudo contestar una consulta acotada; la evidencia señala problemas de entrega, clasificación de intención y selección de fuentes. La solicitud del dueño no especificó todavía si también experimenta otro error de apertura, descarga o función particular.

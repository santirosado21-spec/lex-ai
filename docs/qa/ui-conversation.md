# Asistente único — interfaz conversacional

La vista Asistente ofrece una sola conversación. No hay selector de conversación frente a recuperación. La habilidad predeterminada es **Automática**; las habilidades especializadas quedan disponibles como opciones, sin exigir al usuario clasificar cada mensaje.

El hilo mezcla cronológicamente `state.chatTurns` y `state.answers` del mismo ámbito. Una presentación profesional, una pregunta jurídica y su seguimiento aparecen en el mismo recorrido. La interfaz presenta referencias comprobadas únicamente cuando la respuesta tiene `citationIntegrity: true` y citas reales; otras respuestas indican que no hay fuentes verificadas. Las fuentes se pueden revisar desde su respuesta y el panel de contexto muestra las del análisis seleccionado.

La conversación general funciona sin asuntos ni documentos. Las respuestas jurídicas públicas de ese ámbito pueden mostrar fuentes, pero no acciones DOCX, apertura o feedback que requieren un asunto. Dentro de un asunto, el compositor admite adjuntar documentos y las respuestas fundamentadas conservan esas acciones. Escritos continúa limitado a registros de un asunto.

El compositor conserva Enter, Shift+Enter, compatibilidad IME, foco, crecimiento acotado, cancelación y borrador ante error. Cambiar de asunto cancela la petición, limpia el borrador y evita mezclar historiales. Un fallo en el módulo opcional de dictado no bloquea el trabajo escrito. Configuración explica que los recursos vienen incluidos y se preparan localmente.

## Verificación

La versión anterior con dos modos fue sustituida por petición del dueño. Sus pruebas no se presentan como verificación de este nuevo recorrido. El script actualizado `scripts/ui-conversation-smoke.mjs` utiliza respuestas sintéticas del modelo, API local real y Chromium; no acredita inferencia real ni calidad jurídica. El informe resultante se guarda en `artifacts/ui-conversation/smoke.json` junto con las capturas. El recorrido unificado pasó el 2 de noviembre de 2026. También pasaron `npm run build`, `npm run test:ui`, `node scripts/ui-chat-smoke.mjs` y `node scripts/ui-avatar-smoke.mjs`. Las capturas de 1440 y 390 px se inspeccionaron visualmente; el smoke también comprueba 768 y 320 px.

El script comprueba presentación profesional → fuente jurídica pública → seguimiento, sin cambios manuales de modo; hilos mixtos por asunto; exportaciones disponibles solo con ámbito válido; adjuntos; aislamiento; cancelación; dictado no disponible; y 1440/768/390/320 px sin desbordamiento.

Los smokes históricos del análisis usan habilidades explícitas cuando su objetivo es comprobar el contrato de fuentes, mientras el nuevo recorrido comprueba la selección automática. Se aplicó React Best Practices en la revisión de estado derivado, dependencias de efectos, controles con etiqueta y separación de contratos. Se conserva el diseño visual existente; no se atribuye una revisión a Claude, cuya consulta anterior no devolvió una propuesta por falta de cuota.

La verificación detectó y corrigió una carrera real al cancelar: el botón podía pasar de `type=button` a `type=submit` durante su propio clic y volver a enviar el formulario. La cancelación ahora impide la acción predeterminada antes de actualizar el estado. El smoke espera la propagación efectiva del aborto HTTP y comprueba que no se guarda el turno cancelado. Los dobles sintéticos de compositor/avatar también esperan la señal de aborto, evitando completar artificialmente una respuesta antes de que el servidor reciba la cancelación.

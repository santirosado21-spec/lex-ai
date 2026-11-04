# Conversación en todos los modos y asuntos como proyectos (2026-11-03)

Pedido del dueño: no tener que cambiar de modo para conversar, y cambiar de asunto como en los proyectos de ChatGPT.

## Comportamiento

- **Sin bloqueos de modo.** El botón Preguntar sólo exige texto, espacio creado y asistente listo. Una habilidad elegida enfoca el trabajo jurídico, pero saludos y tareas generales siguen en conversación (`server/assistant-router.mjs`). Si la habilidad necesita un documento que no existe, LEX AI lo pide conversando, sin inferencia.
- **Asuntos como proyectos.** El Asistente muestra a la izquierda los asuntos (más «Conversación general») y, dentro del asunto activo, sus conversaciones con «Nueva conversación». Cada conversación se titula con su primera pregunta.
- **Hilos.** `threadId` opcional (`[A-Za-z0-9_-]{1,64}`) en `analyze` modo `auto` y `chat`. Se guarda en cada turno y filtra el historial que recibe el modelo. Sin `threadId` todo funciona como antes (hilo principal del asunto). Los documentos y el aislamiento siguen siendo por asunto: ningún hilo ve otro asunto.
- **Compuerta de evidencia intacta.** Una pregunta jurídica sin fuente sigue respondiendo con la abstención conversacional, sin inventar artículos.
- El hilo seleccionado por asunto se recuerda en `localStorage` (`lex-ai.threads`), sólo como comodidad.

## Evidencia

- `tests/conversation-threads.test.mjs`: habilidad elegida + saludo → conversación; hilos aislados dentro de un asunto; hilo inválido rechazado; documento faltante pedido en conversación. `npm test` 272/272.
- 19 smokes de app PASS. `ui-chat` y `ui-hig` se ajustaron: antes exigían el botón deshabilitado con una habilidad sin documento.
- Prueba visual con inferencia simulada: dos asuntos, dos conversaciones en uno; el hilo nuevo arranca con 0 mensajes previos y el primero conserva los suyos; sin desbordamiento a 900 px.

## No verificado

- Calidad de la conversación con el modelo real en 8 GB.

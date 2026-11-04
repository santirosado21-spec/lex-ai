# QA de dictado

1. En Configuración, elegir la opción recomendada o ligera y pulsar **Activar dictado**. Confirmar progreso, cancelación y que un archivo con hash inválido no queda listo.
2. En un asunto, pulsar **Dictar texto**. macOS debe mostrar su autorización de micrófono con la descripción de LEX AI. Denegarla y confirmar el mensaje accionable; autorizarla y comprobar el medidor.
3. Grabar una frase, finalizar y comprobar que el texto queda en la consulta para editar. Confirmar que no se envía hasta pulsar **Preguntar**.
4. Comprobar cancelar, el tope de dos minutos, falta de memoria, tiempo de transcripción y modo oscuro/claro con teclado.

Prueba automatizada prevista: `node scripts/ui-voice-smoke.mjs`. Usa los flags de Chromium `--use-fake-device-for-media-stream` y `--use-fake-ui-for-media-stream`, un `MediaStream`/`AudioContext` sintético y una API `stt` falsa. No usa micrófono, red ni material de cliente. No se ejecutó en este entorno porque la política de sandbox no permite el servidor loopback que necesita Playwright.

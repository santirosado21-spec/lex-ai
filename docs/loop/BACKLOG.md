# Backlog del loop

Lo lee y reescribe `scripts/loop/run.mjs`. Cada tarea debe conservar todos los campos. `status`: todo, in-progress, retry, needs-review, done, parked. `type`: auto (la ejecuta el loop) u owner-gate (solo el dueño).

## T0 Validador: el número de artículo no respalda cifras sueltas
- type: auto
- status: done
- attempts: 0
- depends:
- files: server/grounded-output.mjs, tests/grounded-output.test.mjs
- accept: Resuelto fuera del loop en c15030d. Con fuente article "47" y cita sin 47, "dentro de 47 días" se rechaza como UNSUPPORTED_PARAGRAPH; "el artículo 47" se acepta; "uno de los" no respalda "1".

## T1 Proveedor simulado con el contrato de createInference
- type: auto
- status: todo
- attempts: 0
- depends: T0
- files: server/inference-mock.mjs, tests/inference-mock.test.mjs
- accept: createMockInference({responses}) devuelve el mismo contrato que createInference en server/inference.mjs (outputContract, status, initialize, generate(messages,{signal,outputSchema,responseFormat}) como generador asíncrono, stop). Aplica las mismas validaciones de entrada que generate local (roles, máximo 16 mensajes, responseFormat json|text, text sin outputSchema, señal abortada). Graba en .sent una copia profunda de exactamente lo recibido. Sin red ni claves. Pruebas: respuesta grabada en trozos, entradas inválidas rechazadas, cancelación, y que mutar los mensajes después de enviar no altera lo grabado.

## T2 Política de salida por asunto y registro de auditoría
- type: auto
- status: todo
- attempts: 0
- depends: T1
- files: server/egress-policy.mjs, tests/egress-policy.test.mjs
- accept: createEgressGuard({provider,policyFor,audit}) envuelve cualquier proveedor con el contrato de T1. Políticas por asunto: "solo-local" (rechaza todo envío remoto), "nube-contexto-reducido" (solo pregunta, historial del hilo y fuentes públicas L*), "nube-fragmentos-permitidos" (además fragmentos privados D* autorizados). La política se decide en código antes de llamar al proveedor, también en reintentos y errores. El registro de auditoría guarda despacho, asunto, destino, política, categorías y fecha, nunca el texto del prompt. Seudónimos: sustitución reversible solo en local de nombres declarados del asunto.

## T3 Prueba de datos centinela
- type: auto
- status: todo
- attempts: 0
- depends: T2
- files: tests/egress-canary.test.mjs
- accept: Dos despachos y dos asuntos sintéticos con cadenas CANARIO-xxxx marcadas como no enviables. Con el proveedor simulado detrás del guardián de T2, ningún byte grabado contiene un canario bajo ninguna política, incluidos reintentos, errores del proveedor y cambio de asunto en el mismo hilo.

## G1 Cuenta del proveedor y solicitud de retención cero
- type: owner-gate
- status: todo
- attempts: 0
- depends:
- files:
- accept: Decisión y alta del dueño (Sign in with ChatGPT comercial o API por despacho). El loop no la toca.

## G2 Primera evaluación real en la nube con tope de gasto
- type: owner-gate
- status: todo
- attempts: 0
- depends: T3, G1
- files:
- accept: Presupuesto explícito del dueño y casos sintéticos/públicos.

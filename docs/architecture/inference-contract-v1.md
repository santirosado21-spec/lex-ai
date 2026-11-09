# H1: contrato de inferencia y captura sin red

Fecha: 2026-11-09. Alcance: proveedor de prueba explícito, sin conexión al arranque de la app. `createMockInference` no sustituye `createInference`. El motor de producto sigue local.

## Superficie observada

`server/main.mjs` consume `status()`, `initialize()` y `stop()`. `server/service.mjs` consulta `outputContract` y genera con `outputSchema`. `server/conversation.mjs` y `server/proactive-drafts.mjs` generan texto con `responseFormat:'text'` y `signal`.

| Miembro | Contrato H1 |
| --- | --- |
| `outputContract` | `paragraph-citations-v1`; permite que el consumidor seleccione su validador. No prueba que una respuesta de fixture sea jurídicamente correcta. |
| `status()` | Promesa con estado `stopped` o `ready`, `busy`, progreso y `simulated:true`. No inventa medidas de RAM, hardware compatible o calidad. |
| `initialize()` | Prepara inmediatamente el simulador, sin descargas ni procesos. El motor real puede responder `starting` y progresar de forma asíncrona: esta diferencia es intencional. |
| `generate(messages, options)` | Generador asíncrono de strings. Se ejecuta al empezar a consumirlo, no al construir el iterador. Una generación activa a la vez. |
| `stop()` | Marca `stopped` y cancela la generación activa. Es idempotente. Un iterador suspendido en un `yield` libera `busy` cuando su consumidor lo reanuda/cierra; una espera de fragmento se interrumpe. |

Opciones de generación compartidas: `signal`, `outputSchema`, `responseFormat` (`json` por defecto o `text`). Roles: `system`, `user`, `assistant`; de 1 a 16 mensajes con contenido string. Máximo de caracteres de entrada: catálogo actual (7000), o un presupuesto menor inyectado al simulador. Esquema JSON hasta 16000 caracteres serializados. Como el motor actual, `text` rechaza un esquema truthy; `null` no activa esquema. No se cambian estas reglas de producción en H1. La prueba pareada en `tests/inference.test.mjs` aplica las mismas entradas límite a ambos motores, con dependencias simuladas del real.

El simulador rechaza además datos no JSON, ciclos y getters. No emula coerciones de objetos de JavaScript, hardware, temporización real del modelo ni todas las condiciones de error del proveedor. No realiza una inferencia real ni valida semánticamente el esquema de la respuesta: eso corresponde a los consumidores. Limita el texto emitido a 32768 caracteres, igual que el límite de respuesta del runtime inspeccionado.

## Fixtures y capturas

Constructor: `createMockInference({responses, chunkDelayMs:0, maxInputCharacters})`. Cada respuesta es un string o una lista de chunks. Se copia al construirlo. `chunkDelayMs` permite probar cancelación durante una espera sin un modelo real; `stop` o `signal` interrumpen esa espera. Agotar fixtures produce error, nunca una respuesta inventada. Validación fallida o cancelación previa no capturan ni consumen respuesta; una operación ya capturada consume su fixture aunque luego sea cancelada. Reiniciar conserva cola e historial de esa instancia; una nueva instancia comienza con otro historial.

`engine.sent` devuelve copias profundas del historial. Cada registro contiene los campos de la solicitud, `serialized` y `bytes` (`Uint8Array`). Mutar entradas después del primer avance del iterador, las respuestas originales o una captura devuelta no altera el historial.

El sobre de prueba es `{version:1,messages,responseFormat,outputSchema?}`. Se conserva toda propiedad JSON de los mensajes, incluidos metadatos; `outputSchema` solo se incluye si fue proporcionado. Objetos con claves ordenadas lexicográficamente, arrays en orden, sin espacios, UTF-8 de esa cadena. No hay normalización Unicode ni recorte de mensajes. Ejemplo canónico:

```json
{"messages":[{"content":"Prueba sintética","role":"user"}],"responseFormat":"text","version":1}
```

Los bytes corresponden exactamente a **este sobre simulado**. No son el cuerpo HTTP de OpenRouter ni del runtime Ollama. H6 deberá probar también la serialización final de su propio adaptador, destino y cabeceras para no confundir dos límites distintos. Nada de esto autoriza enviar datos sin H2.

## Interfaces de composición propuestas para H2–H6

Son contratos de diseño, todavía sin implementación. Antes de integrarlos con producción, revisarlos contra los consumidores y registrar cualquier cambio de API.

| Puerto | Entrada/salida propuesta | Invariante verificable |
| --- | --- | --- |
| Detector local | `detect({scope,text,signal}) → detections` con rangos y categoría | Fallo o rangos inválidos bloquean salida; la confianza no concede permiso. |
| Correspondencias por ámbito | `protect({scope,messages,detections}) → {messages,mappingVersion}` y `restore({scope,text,mappingVersion}) → text` | Marcadores solo del despacho/asunto; la correspondencia nunca viaja al proveedor. |
| Almacenamiento | `saveSnapshot({scope,version,data})`, `restoreSnapshot({scope,version})`, `rollback({scope,toVersion})` | Restaurar/revertir no mezcla ámbitos; el almacenamiento persistente requiere H5. En H3V se usa memoria sintética. |
| Selección de ruta | `select({scope,task,policyVersion}) → {destination,model,policyVersion}` | Lista cerrada y política autorizada; sin modelo alternativo implícito. |
| Puerta de salida | Recibe ámbito, política, destino y solicitud preparada; invoca `provider.generate` solo si están permitidos | El proveedor no recibe mapas de identidad ni decide sus propios permisos; bloquear produce cero capturas. |

`scope` debe identificar despacho, asunto e hilo cuando corresponda; no lo aporta un documento ni se añade silenciosamente al sobre remoto. La evidencia pública conserva sus identificadores/versiones para las citas. H1 documenta estos puertos, no los implementa ni declara aislamiento multiusuario validado.

## Casos contractuales para la primera composición H3V

1. En `DESPACHO_A/ASUNTO_A/HILO_A`, proteger el nombre ficticio «Persona de prueba Alfa», conservar el mapa en un doble local, capturar el sobre y restituir la respuesta. El canario de identidad no aparece en los bytes.
2. Guardar versiones sintéticas v1 y v2 de correspondencias, restaurar v1 y revertir desde v2: solo los marcadores de v1 se resuelven; un marcador desconocido no se inventa. Restaurar en `DESPACHO_B` debe fallar sin generar captura.
3. Seleccionar una tarea de borrador sin red y comprobar su destino permitido. Revocar la política antes de generar impide la captura. Una respuesta restituida que se usa como historial se protege de nuevo antes del siguiente envío.

Estos son criterios para H3V, no pruebas aprobadas por H1. Los bytes de H1 permiten observar el límite; el detector, cifrado, restauración persistente y selección real siguen pendientes.

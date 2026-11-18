# Ruta de nube pseudonimizada (primer corte vertical, sin cablear)

Estado: módulos y pruebas offline. NO está conectada a `server/main.mjs`, a la UI ni al chat. Cero llamadas reales a OpenAI.

Flujo: detector local -> mapa de pseudónimos local -> compuerta de egreso (categoría `pseudonymized`) -> `server/providers/openai.mjs` -> restauración local.

Piezas:
- `server/providers/openai.mjs`: transporte. Apagado por defecto. La clave se lee en el servidor por llamada. Tope del dueño local: `maxCalls` (0 por defecto, sin red) y `maxTotalTokens` opcional. `store:false`, sin herramientas, respuesta truncada = error.
- `server/cloud-route.mjs`: ruta y concesiones por hilo (`createCloudGrants`, visibles con `status()` y revocables). Falla cerrado: detección incompleta, identificador residual, marcador desconocido, alcance distinto, concesión revocada a mitad de llamada.
- `server/egress-policy.mjs`: la categoría `pseudonymized` existe, pero solo se concede si `server/privacy/eligibility.mjs` verifica un registro de evaluación heldout contra el código en ejecución (versión, hashes de fuentes, hash del protocolo con umbrales, hash del corpus del manifiesto). La ruta construye el detector ella misma de una lista cerrada y re-verifica en cada petición; no acepta un objeto detector ni un booleano. Los registros no están firmados: el control real es que el registro sea un commit revisado. Hoy no existe ningún registro elegible (el baseline v1 falló y está retirado).
- `server/privacy/detector-variants.mjs`: capa experimental sobre v5 (v5 intacto) para identificadores con espacios/guiones, O/0 I/1 y nombres en mayúsculas. Afinada solo en dev; sin evaluación independiente.
- `scripts/measure-cloud-leak.mjs`: fuga residual en dev. Baseline v5: mayúsculas 4/4 casos con fuga, OCR 4/12, espaciados 10/12. Con variantes: 0/4, 4/12 (rfc/curp), 6/12 (account/phone/case_id). Siguen filtrándose.
- Presupuesto, ocupado y llamadas se reservan de forma síncrona antes de cualquier await; la reserva se devuelve si no hubo envío.

Límites que siguen abiertos (no ocultar):
1. Ningún detector está evaluado como elegible. Sin registro verificable la ruta rechaza. Hasta medir omisión/falsos positivos sobre el corpus acordado, NO enviar datos reales.
2. Pseudonimizar no es anonimizar: fechas, montos, estructura y contexto pueden reidentificar. Los nombres no detectados salen en claro.
3. El mapa de reidentificación vive en memoria. El sellado AES-GCM existe (`pseudonym-persistence.mjs`) pero falta persistirlo y custodiar la clave.
4. Falta cablear servicio/chat/borradores, UI de concesiones y selección de modelo por el dueño.
5. Modelo y tope los fija el dueño; el código no asume ninguno.

## Adenda: custodia de clave y tope en USD
- `server/providers/openai-keychain.mjs`: Llavero de macOS, solo darwin, apagado por defecto. La clave la escribe el usuario en un diálogo nativo con respuesta oculta y llega a `security -i` por stdin: nunca en argv, entorno, logs, archivos ni front. Verificado solo con dobles; NO probado en un Mac (lo cubre el guion de Mac, pendiente). Es custodia, no autoriza egreso ni gasto.
- `server/providers/openai.mjs`: `pricing` + `maxUsd` es una ESTIMACIÓN local con tarifa fijada (peor caso reservado antes de enviar). No es un límite de la cuenta y no garantiza el USD real. `reasoningEffort` configurable (none evita gastar el límite de salida en razonamiento).

# Créditos API OpenAI — ventana hasta el 16 de noviembre de 2026

El dueño informó que la organización API de Rejon.AI tiene USD 20 disponibles hasta el 16 de noviembre y que espera USD 100 mensuales después. Es una declaración del dueño, no una lectura de la consola de facturación. Los créditos de API no amplían la cuota de la sesión Codex. No comprar créditos ni activar recargas automáticas.

## Uso previsto

1. Conectar una clave de proyecto **sólo de desarrollo** en Keychain, sin mostrarla ni guardarla en Git. Confirmar acceso con una consulta de catálogo y una generación mínima de texto inventado. Registrar modelo solicitado/observado, tokens, latencia, ID de respuesta y costo estimado. No registrar la clave ni prompts privados.
2. Comparar `gpt-6-luna` y `gpt-6.1-sol` sobre tareas de desarrollo públicas o sintéticas, con el mismo paquete congelado. Luna: extracción simple y línea base; Sol: razonamiento y revisión de salidas. Reservar `gpt-6-astra` para un defecto difícil de privacidad/integración o una revisión que cambie código crítico. No gastar en Astra por rutina.
3. Priorizar el examen de calidad de tareas jurídicas S2b.2 sólo tras congelar el sobre y confirmar que no se filtran respuestas esperadas. Obtener evidencia de formato, citas y errores; la revisión de Lorenzo y Pedro sigue siendo necesaria. En paralelo, probar el transporte H6 con sobres sintéticos y guardas locales, sin activar la app comercial.
4. Mantener un techo interno de USD 20 para esta ventana y detener nuevas llamadas antes de alcanzarlo. Presupuestar hasta USD 18 en experimentos y dejar USD 2 de margen por redondeo o diferencias de tarifa. No intentar consumir el saldo por consumirlo. Confirmar en la consola de la organización cuánto crédito queda y su fecha exacta de vencimiento.

## Puertas de ejecución

- Sólo texto público o inventado, revisado antes de salir. Sin expedientes, originales, mapas, llaves, correo, Drive, herramientas remotas, carga de archivos, búsqueda web de la API ni fallback automático.
- Usar Responses API con `store:false`, modelo exacto, esfuerzo y `max_output_tokens` acotados. Esto evita almacenar el estado de respuesta por defecto; no equivale a Zero Data Retention ni elimina otras retenciones del proveedor.
- Una clave de desarrollo no pasa al producto. La integración H6 de Rejon.AI permanece apagada hasta que H4/H5, política de sobre, presupuesto por despacho/asunto y revisión independiente pasen sus gates.
- El gasto estimado de nuestro proceso no es un límite de toda la organización. Una protección de cuenta requiere un límite duro de proyecto en la consola; su aplicación no es instantánea y puede excederse ligeramente. No cambiar límites compartidos sin conocer el proyecto y su uso.

## Precios de referencia consultados el 10 de noviembre

Tarifa estándar por millón de tokens de entrada/salida: Luna USD 0,10/0,50; Sol USD 2/10; Astra USD 10/50. Las tarifas y la disponibilidad deben comprobarse antes de cada lote importante. Fuentes oficiales: [modelos](https://developers.openai.com/api/docs/models), [precios](https://developers.openai.com/api/docs/pricing), [créditos API de ChatGPT](https://developers.openai.com/api/docs/guides/chatgpt-api-credits), [controles de gasto](https://developers.openai.com/api/docs/guides/spend-limits), [datos y retención](https://developers.openai.com/api/docs/guides/your-data).

## Estado inicial

El dueño guardó una clave de desarrollo en Keychain y la lectura local de esa entrada pasó. Dos intentos del mismo chequeo sintético recibieron HTTP 401; no hubo respuesta de modelo, usage ni recibo de costo. El primer intento mostró sólo un error genérico; el segundo mostró el código HTTP tras añadir diagnóstico sin cuerpo remoto. Se detuvieron los reintentos. Se pidió una clave API nueva del proyecto correcto; no se ha comprobado el saldo ni la fecha de vencimiento en la consola. OpenRouter es otra cuenta y otro presupuesto.

Preparación local: `scripts/openai-dev/smoke.mjs --dry-run` pasó sin red; tres pruebas dirigidas, `npm test` 1107/1107 y `npm run build` pasaron. Revisión independiente Sol aprobó el chequeo tras corregir ID de respuesta y validación de usage. Ninguno de estos resultados acredita conectividad, saldo ni cargo real. El HTTP 401 acredita que la clave guardada no autenticó esta petición; no identifica por sí solo si el problema es clave, proyecto, organización o permiso.

Después el dueño reemplazó el ítem Keychain. Un `GET /v1/models/gpt-6-luna` devolvió HTTP401; un último `GET /v1/models` devolvió HTTP401 con código `invalid_api_key`. Ambos fueron de catálogo y no generaron texto. No se probó otro POST con esa clave ni se reintentará hasta corregir el origen de la credencial. El chequeo de desarrollo ahora hace un GET exacto antes del POST y ofrece `--auth` para comprobar acceso sin generación. Cuatro pruebas dirigidas, suite1108/1108, build y revisión independiente acotada pasaron. Este preflight no verifica saldo ni permiso de generación.

El dueño confirmó que generó la clave desde el proyecto Rejon.AI en API Platform. La lectura Keychain confirmó forma `sk-proj-`, ASCII y ausencia de espacios extra. Tras más de 15 minutos desde la actualización del ítem, `--auth` volvió a recibir GET HTTP401. No se hizo otra generación. La hipótesis de propagación ordinaria no resolvió este caso; quedan por comparar los últimos cuatro caracteres del ítem con la fila activa del proyecto y revisar restricciones de clave/organización. La [referencia de autenticación](https://developers.openai.com/api/reference/overview) señala que algunas actualizaciones pueden tardar más; no identifica esta causa concreta.

# OpenRouter — comprobación de cuenta y ruta gratuita

Fecha local: 2026-11-10. Sólo se usó una clave de producto guardada por el dueño en Keychain y texto ficticio. La clave no se mostró, registró ni incorporó al repositorio. No se envió ningún documento o dato de cliente.

## Observado

1. Existe el ítem fijo `LEX AI.product.openrouter` / `product-api-key` en Keychain. El lector H6b.1 lo recuperó sin imprimir el valor.
2. `GET /api/v1/key` mediante H6a devolvió `connected: true`, `isFreeTier: false` y `hasSpendingLimit: true`. No se registraron identificadores ni importes de la cuenta. Esto verifica autenticación de la clave, no generación ni conexión de la aplicación.
3. El catálogo público devolvió 12 modelos `:free` con todos los campos de precio publicados en cero en ese momento. Para `google/gemma-4-26b-a4b-it:free`, la lista autenticada de endpoints mostró `google-ai-studio` con precios cero.
4. Un envío ficticio con el adaptador y política `zdr: true`, `data_collection: deny`, endpoint fijado y precios máximos cero falló con `provider_failed`. Diagnóstico directo: HTTP 404, «No endpoints found matching your data policy (Zero data retention)».
5. Una segunda prueba directa, también ficticia y con precios máximos cero, omitió sólo `zdr`; recibió HTTP 429 «Provider returned error». No hubo respuesta de modelo ni recibo de uso. Se detuvieron los intentos.

## Límite de la conclusión

La cuenta de OpenRouter **sí autenticó** la clave exclusiva; ningún modelo completó una generación. El adaptador de producto sigue apagado y sin importar en el flujo activo. No se puede usar esta ruta gratuita para información de clientes ni declarar política de retención cero, costo real de factura, calidad jurídica o rendimiento en 8 GB. No relajar el gate privado por el resultado de una prueba ficticia. Revisar disponibilidad/política de rutas y después repetir una prueba acotada, sin bucles automáticos.

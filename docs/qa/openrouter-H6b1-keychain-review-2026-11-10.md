# H6b.1 — lectura optativa de Keychain

Fuentes congeladas para esta revisión:

- `server/providers/openrouter-keychain.mjs`: SHA-256 `563a8d3aebf987902b358383784197b9e9ceeaa2ad6a4df7016eeb515cd3689b`.
- `tests/openrouter-keychain.test.mjs`: SHA-256 `43ebf31e4f7bdfb1f73e2ef332e9ab177faac9c7c3fc5dcfb60e4856b2eec7b3`.

Astra implementó sólo estos dos archivos. Codex inspeccionó la fuente y ejecutó 6/6 pruebas simuladas junto con las 8/8 del transporte y `npm run build`; todo pasó. Un segundo agente Sol revisó el código sin editarlo y emitió `APPROVE_STATIC_SLICE`, sin bloqueantes. Su aprobación se limita al lector aislado.

El lector está apagado por defecto, usa el servicio fijo `LEX AI.product.openrouter` y la cuenta `product-api-key`, y llama a `/usr/bin/security` sin shell ni entorno heredado. No hay escritura, provisión, revocación, importación en la app activa o alternativa a la clave PSF. La salida de la herramienta se limita y se limpia como buffer; la cadena JavaScript devuelta no puede borrarse con garantía.

**No medido:** lectura real de Keychain, reglas de acceso del ítem, conexión a la cuenta OpenRouter, generación remota, protección de datos de cliente, uso en equipo de 8 GB. Es una pieza de desarrollo con datos sintéticos. H4/H5 y la configuración de una credencial exclusiva siguen pendientes.

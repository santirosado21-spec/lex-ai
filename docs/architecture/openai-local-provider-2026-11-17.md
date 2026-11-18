# Proveedor local OpenAI-compatible (experimental, desactivado)

Estado: **experimental, desactivado por defecto**. Rejon sigue usando Ollama con el modelo de `resources/model-catalog.json`. Esto no integra Colibrí ni mide ahorro.

## Cómo se activa
`LEX_INFERENCE_BACKEND=openai-local`, con `LEX_OPENAI_BASE_URL` (por defecto `http://127.0.0.1:8000/v1`), `LEX_OPENAI_MODEL` opcional. Solo acepta `http://` en 127.0.0.1, localhost o ::1, sin credenciales en la URL. Se conecta a un servidor que el usuario ya arrancó: no descarga modelos, no lanza ni detiene procesos.

## Qué está probado
`tests/inference-openai.test.mjs`, contra un servidor simulado: validación de dirección, listado de modelos, envío del esquema de Rejon como `response_format` `json_schema` estricto, streaming, rechazo de respuestas cortadas (`finish_reason: length`) o interrumpidas, entradas inválidas.

## Qué NO está probado ni resuelto
- Que un servidor real (por ejemplo Colibrí) cumpla el esquema estricto: el cliente lo pide, no se verificó el servidor.
- Calidad en español jurídico, memoria y latencia en el equipo del usuario.
- El guardia de memoria de 3 GiB de `server/inference.mjs` **no aplica** a este proveedor.
- Si el servidor externo carga otro modelo, la calidad medida con el modelo por defecto no se transfiere.

## Fallo basal de la suite
`npm test` falla en este entorno una prueba que también falla sin este cambio: `tests/extractor-ocr-fallback.test.mjs` ("scanned PDF without text layer falls back to local OCR and stays quarantined"). No es regresión de este proveedor. La suite no está al 100 % verde.

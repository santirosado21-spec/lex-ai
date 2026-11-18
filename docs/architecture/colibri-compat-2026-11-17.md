# Colibrí: compatibilidad con el motor de Rejon (diseño, sin integrar)

Estado: **no instalado, no integrado, sin benchmark**. Fuentes: README de https://github.com/JustVugg/colibri y https://github.com/JustVugg/colibri/blob/HEAD/docs/gguf.md (leídos el 17 nov 2026). Aprobación de repo por el usuario: 17 nov 18:10. Mac del usuario confirmada: M5 24 GB (18:21). Mínimo oficial de Rejon sigue en 8 GB.

## Qué hace y qué no
- Offloading de expertos de modelos MoE a disco/RAM/GPU. No comprime; la cuantización viene del GGUF. No ayuda a modelos densos (el Qwen3.5 2B de Rejon).
- Servidor local con API OpenAI (`/v1/chat/completions`, streaming, respuestas JSON) en 127.0.0.1:8000. En macOS hay backend Metal para varios motores, activado con `COLI_METAL=1`; no verificado para el modelo que nos interesaría.

## Superficie que usa Rejon hoy (server/inference.mjs)
| Uso en Rejon | Ollama | Colibrí (según README) | Brecha |
| --- | --- | --- | --- |
| Chat en streaming | `/api/chat`, NDJSON | `/v1/chat/completions`, SSE | Adaptador de formato de stream |
| Salida estructurada | campo `format` con JSON Schema | "JSON replies"; esquema estricto no documentado | **Sin verificar**: es la brecha principal |
| Descarga de modelo | `/api/pull` | `coli` setup propio, GGUF aparte | Rejon no podría descargar por sí mismo |
| Lista de modelos | `/api/tags` | `/v1/models` | Mapeo simple |
| Descarga de memoria | `keep_alive: 0` y `/api/generate` | no documentado | Sin verificar |
| Opciones (ctx, tokens, truncate, shift) | `options`, `truncate`, `shift` | parámetros OpenAI | Mapeo parcial |

## Puerta de decisión antes de escribir código
1. Un modelo MoE candidato con calidad jurídica en español mejor que el 2B, medida con el golden set de Rejon (no existe medición hoy).
2. Memoria total medida en el M5 de 24 GB (pesos, caché KV, macOS) y latencia por token.
3. Respuesta estricta al esquema de Rejon por `/v1` (prueba de contrato con un modelo pequeño, sin datos de clientes).
Si falla 1 o 3, no se integra. Reemplazar el motor por defecto queda fuera: Colibrí sería, como mucho, un proveedor opcional detrás de la interfaz de inferencia, solo para equipos de 16 GB o más.

## Límite
Esto es análisis de lectura. No se descargó ningún modelo ni se ejecutó Colibrí.

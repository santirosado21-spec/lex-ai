# OpenRouter — prueba pagada ZDR, sólo datos ficticios

Fecha local: 2026-11-10. Autorización del dueño: hasta **USD 6** de créditos existentes para pruebas. No se autorizó compra, recarga automática ni documentos de cliente. Clave exclusiva del producto en Keychain; no se copió al repositorio ni se imprimió. El adaptador activo de la app no cambió.

## Preflight

- La cuenta autenticada mostró un límite de clave configurado; el límite restante de la clave es distinto del presupuesto de pruebas acordado. El tope de esta actividad se controla por los recibos registrados aquí, no por un cambio de configuración de la cuenta.
- Se consultaron en vivo el catálogo de endpoints del modelo y `/api/v1/endpoints/zdr`. Se eligió un endpoint exacto presente en ambas listas, activo y sin `safety_retention: true`. Precio del endpoint comprobado antes del envío. Cada solicitud fijó modelo, `provider.only`, `allow_fallbacks: false`, `zdr: true`, `data_collection: deny`, `require_parameters: true`, `max_price` y límite de tokens. Sin herramientas ni adjuntos.
- OpenRouter documenta que `max_price.prompt` y `completion` están en USD por millón de tokens. Los precios del catálogo API se expresaron por token y se convirtieron para fijar los máximos. [Enrutamiento y límites](https://openrouter.ai/docs/guides/routing/provider-selection), [política ZDR](https://openrouter.ai/docs/guides/privacy/zdr).

## Resultados observados

| Tarea ficticia | Modelo solicitado / endpoint fijado | Máximo USD por millón de tokens, entrada/salida | Resultado | Tokens entrada/salida | Costo USD reportado y confirmado en metadata de generación |
| --- | --- | --- | --- | --- | --- |
| Conectividad, responder `OK` | `openai/gpt-oss-120b` / `primeintellect/fp4` | 0.05 / 0.10 | HTTP 200, `OK`, `finish_reason: stop`; proveedor observado PrimeIntellect | 80 / 39 | 0.000005785 |
| Extraer obligaciones y dato faltante de contrato enteramente ficticio | `google/gemma-4-26b-a4b-it` / `primeintellect/bf16` | 0.02 / 0.04 | HTTP 200, identificó las dos obligaciones y jurisdicción faltante; proveedor observado PrimeIntellect | 90 / 47 | 0.000002290 |

**Total reportado de las dos generaciones:** USD **0.000008075**. Presupuesto autorizado no consumido según estos recibos: USD **5.999991925**. La vista de cuenta redondeó el uso diario a cero; los metadatos individuales de generación confirmaron los importes anteriores. Esto no es conciliación de factura ni garantía de precio futuro. No se necesitan más generaciones para demostrar conectividad.

## Límites

Las respuestas no prueban exactitud jurídica, fidelidad de citas, resistencia a datos confidenciales, calidad conversacional o desempeño en 8 GB. ZDR limita la retención del proveedor; el texto sigue saliendo del equipo y otras capas requieren controles propios. El detector local H4, la bóveda H5, la política de egreso H3V y el router integrado H7 aún bloquean el uso de documentos reales. Los dos envíos fueron pruebas directas acotadas: el adaptador H6a sigue limitado a `:free` y apagado en la app. El próximo cambio de código debe añadir una ruta pagada optativa con un presupuesto verificable y revisión independiente antes de integrarla.

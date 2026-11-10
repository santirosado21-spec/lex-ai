# PSF: siguiente experimento tras detectores insuficientes

Paquete externo revisado: sólo métricas de desarrollo público/sintético y arquitectura, sin textos de clientes, credenciales, corpus reservado o archivos. Registro local en artifacts/sf/privacy-next-step-20261110. Codex mantiene decisiones, código, integración y verificación.

| Asiento | Aporte observado |
| --- | --- |
| Sol | Builders y revisores independientes de contratos, corpus/CI, citas y pruebas; tokens/cuota no expuestos. |
| Astra | Código crítico de privacidad/bóveda y diagnóstico de su propio detector; no se usó para la documentación rutinaria. |
| Kimi | Una respuesta textual,74.339ms, solicitado kimi-code/k3.1-pro mediante perfil sin herramientas. Identidad efectiva y tokens no atestados. |
| Gemini | Un intento con gemini-3.8-flash-high, selección comprobada en catálogo agy y explícita en CLI;31.798ms, el arnés no obtuvo respuesta final utilizable. Identidad efectiva/usage desconocidos, no se atribuye causa a cuota o indisponibilidad. Sin retry. |
| Local | Una llamada localllm18,5s, etiqueta observada gemma4:e4b-it-q4_K_M. Borrador de memoria truncado/incompleto, descartado; no decide seguridad o código. |

Sin Claude, Cursor/Auto, Perplexity o generaciones OpenRouter en este corte. Las cuatro generaciones Groq120b/16.447tokens de S2b.1c se registran aparte; son experimento sintético de formato, no votos ni proveedor comercial. Las cantidades anteriores no pretenden sumar toda la historia del proyecto o el consumo de contextos SF no expuesto.

Kimi objeta comparar nuevos modelos sin separar cobertura de pérdidas de integración, y propone un experimento de trazabilidad con pesos/reglas/paths fijos. Es consistente con el diagnóstico offline independiente, pero una opinión no prueba causalidad. Su hipótesis porcentual sobre FN es propuesta no medida; no se adopta como resultado, objetivo a forzar o gate de egreso.

Decisión del coordinador: primero instrumentación sin cambio de conducta, códigos finitos locales y comparación exacta de los60resultados con el baseline congelado. Cualquier diferencia se diagnostica antes de interpretar mejora. No reparar con gold, bajar umbrales, omitir clases o afinar con el examen300. Posponer otro modelo/adaptación supervisada hasta atribuir las causas observables. La opinión no valida custodia, anonimización, memoria8GB o producto.

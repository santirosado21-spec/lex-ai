# Diagnóstico del candidato importado: renderer Gemma 4

Investigación local y de código oficial del 30/10/2026. Este agente leyó reportes, configuración, tokenizadores y `/api/show`; no hizo peticiones `/api/chat`, `/api/generate`, carga de modelos ni uso de GPU. Las inferencias mencionadas pertenecen a las evaluaciones que ejecuta el principal.

## Diferencia comprobada

El adaptador MLX v2 obtuvo 32/32 casos técnicos. El modelo importado empezó devolviendo bloques Markdown JSON, semejantes a la base. Esto por sí solo no distingue una pérdida del ajuste por recuantización de un prompt diferente.

Sí se comprobó una diferencia concreta de prompt:

| Evidencia del primer caso | Valor |
|---|---|
| ID | `37e818fdf557e03841b2348a7ce197e1d11190a1c0ce185e0aef162f4f171dfa` |
| Prefijo HF usado por entrenamiento/MLX | 171 tokens |
| Reconstrucción del renderer `gemma4` | 167 tokens |
| `prompt_eval_count` observado en Ollama | 167 |
| Reconstrucción del renderer `gemma4-large` | 171 tokens; texto exactamente igual al prefijo HF |
| Tokens faltantes | `[100, 45518, 107, 101]` |

El suffix real que debe añadirse, sin escapes de Markdown, es:

```text
<|channel>thought
<channel|>
```

La comparación se hizo con `AutoTokenizer` local y `apply_chat_template(..., add_generation_prompt=True, enable_thinking=False)`. Para esos mensajes de system/user sin herramientas ni imágenes, todo el texto previo al suffix coincide. Las pruebas de inferencia existentes aportan además un conteo de prompt consistente con el renderer corto.

## Por qué el template mostrado no era la explicación completa

`/api/show` devuelve `template: "{{ .Prompt }}"`, pero el Modelfile generado también declara `RENDERER gemma4` y `PARSER gemma4`. El manifiesto del modelo importado confirma `renderer: gemma4`. Por tanto, esa plantilla simple no significa que `/api/chat` envíe mensajes sin formato: el renderer nativo construye el prompt.

En [renderer.go de Ollama v0.40.6](https://github.com/ollama/ollama/blob/v0.40.6/model/renderers/renderer.go), `gemma4` y `gemma4-small` crean `Gemma4Renderer` sin `emptyBlockOnNothink`. Solo `gemma4-large` activa ese campo. En [gemma4.go de la misma versión](https://github.com/ollama/ollama/blob/v0.40.6/model/renderers/gemma4.go), la sección de generation prompt añade el bloque vacío únicamente cuando ese campo está activo y thinking está desactivado.

El archivo `chat_template.jinja` exportado conserva la plantilla HF, pero el importador eligió el renderer genérico. La selección debe ser explícita en el Modelfile:

```text
FROM .
RENDERER gemma4-large
PARSER gemma4
```

La ruta de importación Safetensors admite estas directivas y las transmite a la configuración del modelo. El exportador ya las incluye y registra sus valores en el manifiesto. La prueba CPU del paquete comprueba ambas directivas exactas.

## Prueba discriminante mínima

1. Conservar el modelo fallido y su reporte. Crear otro nombre/importación usando **los mismos archivos de pesos** y solo el cambio de renderer.
2. Repetir un caso de abstención ya evaluado, con los mismos mensajes, `think:false`, temperatura 0, `num_predict:384` y sin `format`.
3. Comprobar `prompt_eval_count=171` en ese caso. Si la respuesta vuelve al JSON compacto aprendido, el cambio de renderer explica la regresión observada en ese ejemplo.
4. Ejecutar nuevamente los mismos 32 casos, conservando contratos del evaluador y referencias base/candidato. La prueba de un caso no certifica todos los comportamientos ni valida exactitud jurídica.

Si continúa fallando con el prompt correcto, la siguiente prueba debe separar la fusión del runtime: cargar una copia fusionada en MLX con el mismo prefijo y comparar un caso contra base+adaptador. Eso requiere una nueva ejecución GPU del principal; no se realizó en esta investigación.

## Recuantización: segundo diagnóstico

El `LoRALinear.fuse(dequantize=False)` instalado en MLX-LM 0.32.2 dequantiza la matriz adaptada, suma `scale * B.T @ A.T` y vuelve a cuantizarla con los bits y grupos originales. El principal probó el renderer corregido con 171 tokens y la respuesta aún conservó el formato Markdown de la base. Por tanto, corregir el prefijo no bastó.

La medición CPU en [`artifacts/training/delta-comparison.json`](../artifacts/training/delta-comparison.json) comprobó hashes completos de las siete matrices y sus companions. Todas cambiaron respecto a la base. El SHA-256 del adaptador exportado coincide exactamente con el adaptador v2 actual: `2534b68c6cd2e944452e98b42be1f33405a25171ade4574c1ea12443b5c73fd0`. No se perdió el archivo del adaptador ni se omitieron nombres de capas.

Se dequantizaron en NumPy 96 filas equiespaciadas de cada matriz y se comparó el delta retenido, `W_export - W_base`, con el esperado, `8 * B.T @ A.T`. Los resultados son una muestra de las matrices, no métricas del modelo completo:

| Módulo | Proyección del delta retenido sobre el esperado | Coseno | Error relativo del delta |
|---|---:|---:|---:|
| q26 | 0.218 | 0.156 | 1.586 |
| v26 | 0.125 | 0.094 | 1.593 |
| q27 | 0.115 | 0.075 | 1.768 |
| v27 | 0.123 | 0.093 | 1.579 |
| q28 | 0.137 | 0.102 | 1.595 |
| v28 | 0.091 | 0.064 | 1.681 |
| q29 | 0.126 | 0.077 | 1.850 |

El ajuste no desapareció byte a byte, pero su componente alineado quedó reducido al 9–22 % en esta muestra y apareció error mayor que el delta esperado. El máximo absoluto muestreado del delta fue 0.0039–0.0058, frente a pasos q4 medios de 0.0086–0.0124. Esto respaldó la hipótesis de degradación por recuantización.

El principal hizo después la prueba discriminante real que consta en [`probe-fusion.json`](../artifacts/training/probe-fusion.json), con dos prompts idénticos en MLX: base+adaptador produjo los objetivos exactos; la fusión q4 volvió al estilo base; la fusión con **solo las siete proyecciones adaptadas densas** conservó exactamente las dos respuestas del adaptador. Son dos casos diagnósticos; faltan las pruebas completas del nuevo paquete importado.

Se implementó `scripts/fuse-trained-adapter.py` para esa fusión selectiva y el exportador la usa en un proceso separado. Nunca llama a `dequantize_model` ni usa `mlx_lm.fuse --dequantize` global. El paso CPU valida las siete matrices densas y preserva sus bytes; los expertos congelados continúan cuantizados. El renderer `gemma4-large` sigue siendo obligatorio. La revisión nueva requiere importación, memoria medida y repetición de los 32 casos antes de cualquier promoción.

Al crear una revisión manual del paquete existente, registrar el cambio de Modelfile y sus nuevos hashes como una modificación posterior. Conservar el hash del exportador original como procedencia de la transformación original, sin atribuir retrospectivamente aquella ejecución a una versión nueva del script.

## Retención de memoria entre peticiones en Ollama 0.40.6

El principal observó crecimiento de memoria del runner aproximadamente de 16.95 a 20.70 GiB durante 32 peticiones. La lectura de código ofrece una explicación compatible con retención de prefijos; no demuestra por sí sola una fuga de memoria.

En [prefix_cache.go v0.40.6](https://github.com/ollama/ollama/blob/v0.40.6/mlxrunner/prefix_cache.go), `newPrefixCache` crea un trie que vive durante toda la vida del modelo. El umbral de expulsión está fijado en código:

```go
const maxPagedOutBytes int64 = 8 << 30
```

Es un umbral de 8 GiB para snapshots fuera de la ruta activa, **no un límite total de memoria del proceso**. La política intenta expulsar nodos elegibles y termina si no encuentra otro candidato; tampoco incluye pesos, estado activo ni temporales. No existe una lectura de entorno o parámetro que ajuste esa constante en los archivos de runner, cliente, servidor y configuración revisados.

[pipeline.go](https://github.com/ollama/ollama/blob/v0.40.6/mlxrunner/pipeline.go) ya llama `mlx.ClearCache()` después de cada generación y registra `mlx.ActiveMemory()` como memoria retenida. Vaciar buffers libres del allocator no elimina las referencias vivas del trie. Ajustar `OLLAMA_CONTEXT_LENGTH=8192` sigue siendo útil para acotar cada prompt, pero no limita los snapshots acumulados entre conversaciones. Tampoco debe confundirse el wired limit de [runner.go](https://github.com/ollama/ollama/blob/v0.40.6/mlxrunner/runner.go) con un tope de toda la memoria activa.

La opción disponible sin recompilar es descargar el modelo entre peticiones o lotes. [envconfig.KeepAlive](https://github.com/ollama/ollama/blob/v0.40.6/envconfig/config.go) acepta `OLLAMA_KEEP_ALIVE=0`. La [API chat](https://docs.ollama.com/api/chat) también permite `keep_alive:0` para descargar inmediatamente después de la petición. El evaluador actual no envía ese campo, por lo que cambiar el entorno del servidor permite probar esta política sin alterar su código ni el contrato emparejado. Si otro cliente envía explícitamente `keep_alive:'2m'`, ese cliente necesita adoptar la política; el default del servidor no basta para él.

Esta política intercambia memoria estable por recarga del modelo y pérdida de reutilización de prefijos. Debe medirse en varias peticiones seguidas, confirmando salida del runner/liberación antes de la siguiente carga, latencia, memoria del sistema y swap. Para una optimización posterior, un runtime propio podría exponer un presupuesto de snapshots mucho menor y probar su expulsión; no se recompiló ni modificó Ollama durante este diagnóstico. No aumentar límites globales de memoria para ocultar el crecimiento.

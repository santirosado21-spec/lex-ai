# Distribución experimental de Gemma 4 entrenado localmente

El exportador [`scripts/export-trained-model.py`](../scripts/export-trained-model.py) prepara una **copia experimental para importar y evaluar en Ollama**. No registra el modelo en Ollama, no modifica el catálogo de LEX, no publica archivos y no convierte un entrenamiento completado en una afirmación de calidad jurídica.

## Estado de verificación

Implementación y pruebas CPU verificadas el 30/10/2026. Dieciséis pruebas sintéticas pasan: concatenación y separación reversible de expertos, orden gate→up de cada experto, preservación de bytes U32/F16/BF16, reconstrucción affine de routers, siete proyecciones adaptadas densas, configuración/tokenizer, hashes, procedencia y rechazo de layouts inesperados. El lector independiente `safetensors.safe_open` también acepta los shards exportados. El `config.json` real del checkpoint contiene 30 overrides de routers de 8 bits; todos pasaron el validador de configuración.

**Candidato seleccionado: v2 de 400 pasos, exportación v2-r2.** La fusión densa selectiva se exportó e importó realmente en Ollama 0.40.6: [32/32 casos técnicos pasan](../artifacts/training/lex-gemma4-lora-v2/behavior-imported.json), sin regresión por tarea frente a base y adaptador. Las dos sondas previas en MLX también coincidieron con base+adaptador; la fusión recuantizada q4 perdió el comportamiento aprendido. Véase el [diagnóstico](model-import-diagnosis-2026-10-30.md).

**E2E final PASS.** El [reporte final](../artifacts/training/runtime-v2-r2/verification.json), terminado `2026-10-30T14:53:56.695Z`, verifica contrato sintético → biblioteca federal → respuesta validada con dos fuentes → DOCX. Usó el servicio real con transporte experimental sin esquema, máximo 512 tokens, y registró el escape de **4 controles LF/CR/TAB literales dentro de strings JSON**. Se conservó la validación de estructura, IDs y citas; no se repararon conclusiones ni textos de cita. Los 32 casos técnicos previos se reutilizaron tras comprobar hashes/contratos, declarado como `behavioralEvidenceReused:true`; su evaluación usa JSON estricto y no se modificó para aceptar esa normalización. La memoria del último recorrido no se midió: `peakGiB:null`, no cero.

La app conserva el modelo Gemma original y su generación con esquema previamente probada. Este candidato se entrega separado para importación manual en un runtime compatible; la UI no lo selecciona automáticamente. El PASS con transporte experimental no demuestra integración como modelo predeterminado. Clientes independientes deben seguir los parámetros, normalización limitada y validación de fuentes descritos en el README del paquete.

La continuación **v3 de 150 pasos adicionales queda rechazada**, aunque terminó el entrenamiento: ambas sondas de aplicación fallaron, con repetición y una cita alterada. No se exporta ni se promueve v3. Los resultados, hashes y límites están en el [reporte de ciclo 3](qa/cycle-3-report.md). Ningún PASS técnico equivale a exactitud semántica, competencia profesional o vigencia legal.

El agente que implementó el exportador no cargó el modelo ni utilizó GPU. Las ejecuciones reales fueron realizadas por el coordinador. La fase de fusión del comando siguiente sí utiliza MLX y debe ejecutarse cuando la GPU esté disponible.

## Entradas y comando

- Python de `.venv-training`, con `mlx-lm==0.32.2` y NumPy. El proceso coordinador comprueba esa versión sin importar MLX.
- Base local completa `mlx-community/gemma-4-26b-a4b-it-4bit`, revisión `0d77464eeb233a2da68ebf9d7dc4edaac7db956d`.
- `base-model-manifest.json` generado por el descargador. Se verifican SHA-256 y tamaños de todos sus archivos antes de fusionar; debe cubrir todos los pesos y la configuración/tokenizer.
- Directorio del adaptador con `adapter_config.json` y `adapters.safetensors`.
- Una copia local del texto completo de Apache License 2.0. Puede provenir de un `LICENSE` del modelo, o prepararse antes desde [Apache](https://www.apache.org/licenses/LICENSE-2.0.txt). El exportador nunca la descarga.
- Espacio adicional libre para el intermedio fusionado y la salida: aproximadamente dos veces los pesos base, más 2 GiB de margen. Los pesos originales permanecen intactos.

Ejemplo desde la raíz del proyecto; sustituir el directorio del adaptador por el checkpoint realmente evaluado:

```bash
.venv-training/bin/python scripts/export-trained-model.py \
  --base artifacts/training/base-gemma4-26b \
  --adapter artifacts/training/adapters-gemma4 \
  --output artifacts/training/lex-gemma4-candidate \
  --source-manifest artifacts/training/base-model-manifest.json \
  --license-file /ruta/local/Apache-2.0.txt
```

`--output` debe ser nuevo y estar separado de base/adaptador. No hay `--force`. `--shard-mib 512` es el valor por defecto y puede ajustarse de 1 a 4096 MiB. Un tensor mayor que el objetivo ocupa un shard propio, siempre escrito por bloques, sin cargarlo completo.

## Etapas y memoria

1. Validar rutas, procedencia, versión, licencia, configuración y espacio libre.
2. Lanzar `scripts/fuse-trained-adapter.py` en un proceso hijo con modelo y adaptador locales. El helper exige exactamente las siete proyecciones q/v adaptadas de las capas 26–29 y ejecuta `LoRALinear.fuse(dequantize=True)` **solo sobre ellas**. No llama `dequantize_model`, no elimina la configuración cuantizada y no convierte el modelo completo. Usa MLX-LM 0.32.2, `mlx_lm.utils.save`, límite de memoria recomendado (máximo 19 GiB) y caché de 256 MiB. Las variables offline están activadas. La memoria real se registra en `fusion-report.json`.
3. Esperar a que termine ese proceso. Luego lanzar un proceso CPU separado para transformar los safetensors fusionados.
4. Escribir y validar shards, índice, configuración, tokenizer, licencia, model card, Modelfile y manifiestos en un directorio temporal propio.
5. Renombrar la salida completa al destino final. El contexto temporal elimina únicamente su intermedio y cualquier salida incompleta al terminar o fallar. Nunca borra base ni adaptador.

La transformación no importa MLX, PyTorch ni ejecuta GPU. Lee encabezados y copia segmentos binarios de 8 MiB. No reúne un shard de varios GiB en un array. Solo los routers se materializan como arrays NumPy; hay un límite explícito de 64 MiB por matriz de salida y se procesa uno por vez. En la arquitectura real, cada router F32 ocupa aproximadamente 1.38 MiB y los 30 suman 41.25 MiB. La memoria de esta fase queda muy por debajo de 5 GiB; el pico real de fusión y de carga del runtime se registra por separado.

## Transformaciones precisas

**Atención adaptada:** conservar q26/v26, q27/v27, q28/v28 y q29 como matrices densas de punto flotante evita recuantizar y perder el pequeño delta entrenado. El paso CPU exige las siete, comprueba sus shapes contra el config y rechaza U32 o companions `scales`/`biases` en esos módulos. Copia sus bytes sin transformarlos. Las siete matrices suman aproximadamente 143 MiB en BF16, frente a unos 40 MiB cuantizadas; no implica convertir los 26B parámetros a precisión flotante. El manifiesto declara `precision: adapted-dense/rest-unchanged` para la fusión; la conversión posterior de routers a F32 se documenta por separado.

**Expertos:** se aceptan exclusivamente grupos completos `language_model.model.layers.N.experts.switch_glu.{gate_proj,up_proj,down_proj}.{weight,scales,biases}`, para todas las capas declaradas. Se comprueban número de expertos, dimensión oculta/intermedia, rango, dtype, empaquetado U32 y dimensiones de grupos affine de 4 bits / 64 elementos.

Gate y up se concatenan en el eje 1, por experto: primero las filas gate de ese experto, luego sus filas up. Se aplica la misma operación a los pesos empaquetados y a sus scales/biases, produciendo `.experts.gate_up_proj.*`. Concatenar los blobs enteros sería incorrecto porque mezclaría identidades de expertos. Down solo cambia de nombre a `.experts.down_proj.*`. No se dequantizan ni recuantizan expertos durante esta transformación.

**Routers:** hay una incompatibilidad adicional en el importador Ollama inspeccionado. `sourceQuantization` no conserva overrides MLX por módulo y `prequantMetadata` aplica la cuantización global a cada blob. Los routers q8 podrían quedar etiquetados como q4. Para evitarlo, el exportador reconstruye únicamente esos routers en CPU usando `q * scale + bias`, conserva el resultado como F32 y elimina sus companions y overrides. Es una dequantización, no una nueva cuantización. F16/BF16 se convierten a F32 antes del cálculo. La equivalencia numérica del modelo completo sigue requiriendo evaluación después de la fusión/importación.

Se examinan **todos** los overrides: cualquier módulo distinto de un router affine q8 / group 64, cualquier configuración duplicada contradictoria o cualquier capa faltante provoca un error. No se adivinan formatos. La configuración real contiene 30 routers de esta forma.

**Texto y tokenizer:** se conserva el prefijo `language_model.model.`, admitido por Ollama. Se rechazan pesos que no pertenezcan al prefijo textual; solo entonces se anulan `vision_config` y `audio_config`. Se conservan configuración textual, tokens EOS, generación y los archivos locales de tokenizer/template disponibles, prefiriendo los guardados por MLX. No se distribuyen archivos Python del checkpoint. El resultado no ofrece visión/audio.

**Renderer obligatorio:** el Modelfile declara `RENDERER gemma4-large` y `PARSER gemma4`. En Ollama 0.40.6, `gemma4` genérico omite el bloque de pensamiento vacío que este checkpoint y su entrenamiento usan con `think:false`; `gemma4-large` sí lo añade. Copiar `chat_template.jinja` no selecciona automáticamente ese renderer. Véase [el diagnóstico y la comparación de tokens](model-import-diagnosis-2026-10-30.md). La corrección conserva los pesos; debe verificarse con una importación separada y los mismos casos de evaluación.

## Importación aislada y prueba real

Elegir un puerto libre distinto del runtime de LEX y una carpeta nueva de almacenamiento. El exportador no lanza estos comandos. Usar el **mismo binario Ollama incluido en la app**, cuya ruta debe localizarse en la compilación actual; no sustituirlo por otro Ollama global sin registrar la diferencia.

En una terminal, con las rutas reales:

```bash
export LEX_CANDIDATE_OLLAMA_BIN='/ruta/real/al/ollama-incluido'
export OLLAMA_HOST='127.0.0.1:11445'
export OLLAMA_MODELS="$PWD/artifacts/training/ollama-candidate-store"
"$LEX_CANDIDATE_OLLAMA_BIN" serve
```

En otra terminal, con el mismo host y binario:

```bash
export LEX_CANDIDATE_OLLAMA_BIN='/ruta/real/al/ollama-incluido'
export OLLAMA_HOST='127.0.0.1:11445'
"$LEX_CANDIDATE_OLLAMA_BIN" create lex-gemma4-candidate \
  -f artifacts/training/lex-gemma4-candidate/Modelfile
"$LEX_CANDIDATE_OLLAMA_BIN" show lex-gemma4-candidate
"$LEX_CANDIDATE_OLLAMA_BIN" run lex-gemma4-candidate \
  'Responde únicamente con la palabra: prueba'
"$LEX_CANDIDATE_OLLAMA_BIN" stop lex-gemma4-candidate
```

El servidor recibe `OLLAMA_MODELS`; el cliente se conecta mediante `OLLAMA_HOST`. El nombre candidato y el almacenamiento separados evitan reemplazar el modelo de la app. La prueba de una palabra solo verifica ejecución: después deben correr el holdout jurídico, abstención, integridad de citas, JSON, resistencia a instrucciones en documentos, flujo DOCX y regresión general, comparando base MLX, base+adaptador y modelo final importado. Registrar versiones, hashes y picos de memoria. Terminar el servidor aislado después de las pruebas para liberar recursos.

## Integridad y licencia

`export-manifest.json` contiene origen y revisión exacta, hashes de los archivos base, configuración y hashes del adaptador, hash del script, versión MLX-LM, transformaciones, lista de routers densos y SHA-256/tamaño de cada archivo exportado. `export-manifest.sha256` verifica el propio manifiesto. La licencia completa y la model card fuente se incluyen con una nota de modificaciones; los NOTICE de la base se conservan si existen.

Los hashes detectan modificaciones accidentales pero no son una firma de autoría. La revisión de entrenamiento/datos y los resultados de evaluación deben acompañar cualquier publicación futura. El exportador emite inicialmente `experimental-not-evaluated-not-promoted`; la evidencia posterior se registra separadamente, sin reescribir los manifiestos ya verificados. Para v2-r2 hay compatibilidad, 32 casos técnicos y E2E sintético comprobados; la calidad jurídica no está validada. La decisión de promover/publicar es independiente de que el script termine sin errores.

## Paquete portátil y gate de entrega

`scripts/package-trained-model.py` exige reporte de runtime `PASS`, gate técnico aprobado, hashes de modelo/adaptador/dataset/evaluación coherentes, licencia, tokenizer, configuración, Modelfile, índice y todos los shards referidos. Rechaza inventarios incompletos, adaptadores distintos y runtime fallido. El directorio de exportación original permanece intacto.

El TAR elimina rutas locales del manifiesto distribuido. `DISTRIBUTION.json` declara el hash del manifiesto original verificado, el hash nuevo distribuido y `redactionOnly:true`; los hashes de pesos/configuración permanecen iguales. Esto vincula explícitamente la prueba del original con la transformación de metadatos del paquete. No es una nueva ejecución del modelo ni publicación automática.

Paquete producido: [LEX-Gemma4-Experimental-v2.tar](../artifacts/LEX-Gemma4-Experimental-v2.tar), **14.372.300.800 bytes**, SHA256 `2b172c99001ab5de8e28ff9d469e0655101b559bcd36464ec2a4b364f84a558b`. La [verificación](../artifacts/training/distribution-verification.json) comprueba 52 miembros y manifiestos original/distribuido; el archivo `.tar.sha256` acompaña la entrega. Es un archivo local, no una publicación remota ni activación predeterminada.

El instalador separado [LEX-AI-0.3.0-arm64.dmg](../artifacts/LEX-AI-0.3.0-arm64.dmg) está reconstruido: el [reporte de paquete](../artifacts/cycle-3-package-check.json) terminó PASS a las `2026-10-30T14:55:03.296Z`, con hashes del código empaquetado comprobados y firma ad hoc. El coordinador verificó el DMG con `hdiutil`; SHA256 `58de3bfc32119f1fbf00db90c34b1770f2db94d31ff7889d15e64c8e56d5d83d`. No está notarizado y no se probó en un segundo Mac limpio. La biblioteca incluye 35.452 artículos de 303 instrumentos, con 910 muestras cotejadas mediante otro extractor: ni el paquete ni esa muestra representan toda la legislación mexicana o una revisión jurídica exhaustiva.

Pruebas reproducibles, sin GPU:

```bash
.venv-training/bin/python -m unittest discover -s tests -p model_export_test.py -v
```

## Fuentes de la conversión

- [MLX-LM 0.32.2, fusión](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/fuse.py) y [LoRALinear](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/tuner/lora.py).
- [Ollama Gemma 4, prefijos y expertos](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/mlxrunner/model/gemma4/gemma4.go).
- [Ollama prequant, metadata global](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/create/prequant.go), [configuración de importación](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/create/create.go) y [resolución de cuantización](https://github.com/ollama/ollama/blob/4d22e65d493f281adce5e4de7f2cd1efa847cd13/mlxrunner/model/quant.go).
- [Importación oficial Ollama](https://docs.ollama.com/import), [modelo fuente](https://huggingface.co/mlx-community/gemma-4-26b-a4b-it-4bit/tree/0d77464eeb233a2da68ebf9d7dc4edaac7db956d), [licencia Gemma Apache-2.0](https://ai.google.dev/gemma/apache_2).

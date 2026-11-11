# Nym — procedencia acotada de avisos de licencia

2026-11-10. Investigación pública de fuentes primarias; no decisión jurídica ni autorización de redistribución. Se aplicó PSF. Solo se crearon este documento y `resources/privacy-nym-license-research-v1.json`; no se modificaron candidato, manifiestos, freezes, código o evaluación. No hubo descarga de pesos/tokenizer, ejecución de modelo/runtime, acceso al gold, clones, instalación, llamadas a modelos o envío de datos privados.

**Resultado:** se encontró un aviso MIT auténtico y completo en el repositorio de código declarado por Nym, fijado a commit. La ficha oficial del modelo base declara MIT, pero no lista un archivo LICENSE. El vínculo entre ese aviso de código, la revisión base observada y los pesos exactos Nym sigue sin verificarse; `redistributionCleared=false` permanece explícito.

## Fuentes fijadas y alcance de cada evidencia

El recurso candidato leído al comenzar fue `resources/privacy-nym-int8-candidate-v1.json`, SHA-256 `0cc0bdd5af9847ba8915917c715becbe66be5adfe7395efba01673571204f297`, correspondiente a `Wismut/nym-pii-multilingual-small@4348999cd3c2e20c49615e9af7c6bbb45b64cd85`, variante int8. Se conservó sin cambios. Su metadata previa registraba LICENSE no listado y un GET al LICENSE fijado con HTTP404; aquel cuerpo404 **no es una licencia**. Esa observación histórica no se sustituyó ni se volvió a solicitar.

La [API pública de commits de byteowlz/nym](https://api.github.com/repos/byteowlz/nym/commits?per_page=1) devolvió commit **`7806040e61e3bf584af396e67fa1d45f15af039c`**, fecha declarada de commit2026-10-29T23:41:16Z. Ese pin corresponde al head observado durante esta investigación, **no a un commit de entrenamiento/exportación de los pesos demostrado por la ficha Nym**.

La [API LICENSE fijada a ese commit](https://api.github.com/repos/byteowlz/nym/license?ref=7806040e61e3bf584af396e67fa1d45f15af039c) devolvió HTTP200, SPDX declarado MIT y el contenido completo base64. Se decodificaron los **1.093 bytes originales**, con copyright **2026 byteowlz** y aviso completo de permiso/condición/descargo; el texto íntegro auténtico, incluidos whitespace y saltos de línea, está conservado en el JSON, sin sintetizar ni completar MIT de memoria.

Hash del aviso decodificado: **`e472349c75aebe097074c210e5bbbeacf1dd4fd9366e8d312538a40d47260967`**. El blob Git calculado desde esos bytes coincide con el blob reportado **`ae9f5af95675c4e3909936d51eb78b4553eec4f7`**. La API anuncia el URL raw fijado `https://raw.githubusercontent.com/byteowlz/nym/7806040e61e3bf584af396e67fa1d45f15af039c/LICENSE`; no se hizo otro GET a él. Esta evidencia es del archivo LICENSE del **repositorio de código**. No se presupone su aplicabilidad a cada artefacto entrenado/quantizado publicado en otro repositorio.

La [API oficial de jhu-clsp/mmBERT-small](https://huggingface.co/api/models/jhu-clsp/mmBERT-small?blobs=true) reportó revisión **`abc32620dd4f6ab06f5fbe905dc25f310618e09f`**, última modificación declarada2025-10-17T16:06:00Z, licencia `mit` y siete archivos, ninguno LICENSE. Se descargó únicamente su [ficha README fijada a esa revisión](https://huggingface.co/jhu-clsp/mmBERT-small/raw/abc32620dd4f6ab06f5fbe905dc25f310618e09f/README.md):29.646 bytes, SHA-256 **`a56c26f251c188a1c0b783fcddb461e78f754b61ee948975fafbb2b77c863353`**. La ficha declara MIT en front matter/badge; no contiene el aviso completo de permiso MIT/copyright específico buscado.

El pin base observado hoy no identifica por sí solo el pin histórico usado para inicializar Nym. El recurso candidato no declara esa revisión de entrenamiento; queda `actualNymTrainingBaseRevision=null`. Tampoco se inspeccionaron teacher/distillation/datasets, ni se infiere la cadena de titularidad o un permiso de redistribución de un tag `license:mit`.

## Presupuesto y parada

Se ejecutaron **4 de máximo6 GET**, con **61.255 bytes de cuerpo** en **2.264,296 ms**. Todos devolvieron200, sin redirección, autenticación, proxy, cookie o reintento. Límites:256 KiB por respuesta,1 MiB combinado,15 s absolutos por request,60 s lote, un request a la vez. Los cuerpos, SHA-256, content type, URL exacto y tiempos de inicio/fin están en el JSON. Ningún enlace de la ficha se ejecutó ni siguió como instrucción.

| Operación | Fuente | Estado | Bytes | SHA-256 cuerpo HTTP |
| --- | --- | ---: | ---: | --- |
| 1 | GitHub commits, límite1 | 200 | 4.851 | `87dfae0aafc500f0591948e127422e52a4842b3a3d33b266bde0d57cecbec2dd` |
| 2 | GitHub LICENSE, ref de40 caracteres | 200 | 2.536 | `f0a93b7a78fa72a1741ff73b6e1b4b1861fed31fa22e54f4a3747bf29359fae0` |
| 3 | HF base metadata con blobs | 200 | 24.222 | `65f822f7b2799123a263ea33800121a835f87e64c10f731b5d5199fff1e081d5` |
| 4 | HF base README en pin observado | 200 | 29.646 | `a56c26f251c188a1c0b783fcddb461e78f754b61ee948975fafbb2b77c863353` |

La investigación se **detuvo por LICENSE no listado en la metadata base**, sin gastar las dos operaciones restantes ni probar rutas alternativas. No hubo un nuevo GET404 al LICENSE base: `not-listed` y `not-requested` se distinguen de un404 observado. No se siguieron los enlaces al GitHub mmBERT, licencias genéricas o datasets como fallback. El contador4 pertenece a este corte; las seis solicitudes históricas de preparación del candidato, incluido su404, siguen siendo evidencia aparte.

## Pendiente

El aviso auténtico del código ya está preservado, pero siguen sin acreditarse el aviso aplicable a los pesos exactos seleccionados, el vínculo del commit de código con su exportación, el pin base real y la cadena de fuentes de entrenamiento/distillation. Este corte no resuelve esos puntos ni decide licencias. No se fabrica un archivo LICENSE para el modelo, no se cambia su aprobación y no se activa descarga, inferencia, producción o redistribución por encontrar este aviso.

Verificación local: cuatro cuerpos HTTP rehasheados, aviso MIT y blob Git comprobados desde sus bytes, suma de bytes/presupuesto y conservación del recurso candidato verificadas. No son pruebas de calidad, privacidad, cumplimiento jurídico o rendimiento de Nym.

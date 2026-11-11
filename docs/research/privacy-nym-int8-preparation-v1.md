# Nym int8 — preparación de metadatos v1

2026-11-10. PSF, encargo Sol para investigación/preparación; identidad efectiva del modelo no atestada por herramienta. No es una decisión de seguridad ni código de producción. [Manifiesto inactivo](../../resources/privacy-nym-int8-candidate-v1.json), SHA-256 `0cc0bdd5af9847ba8915917c715becbe66be5adfe7395efba01673571204f297`. Sólo se crean estos dos archivos; sin commits, otros modelos, datos privados, entrenamiento, corpus de desarrollo/golds o examen retenido.

## Variante y adquisición pequeña realmente realizada

Repositorio [Wismut/nym-pii-multilingual-small](https://huggingface.co/Wismut/nym-pii-multilingual-small/tree/4348999cd3c2e20c49615e9af7c6bbb45b64cd85), revisión exacta `4348999cd3c2e20c49615e9af7c6bbb45b64cd85`. Se inspeccionaron primero los metadatos pequeños públicos cacheados de71ad54f; después se hicieron **6GET/18.249B**, límite6GET/2.097.152B, sin redirecciones seguidas, reintentos, autenticación ni dependencias nuevas. Pesos/tokenizer grande: **cero descargados**. No hay inferencia ni sesión ONNX cargada.

El JSON conserva cada solicitud al realizarla: URL solicitada/observada, horaUTC de inicio/fin, estado HTTP, bytes, SHA-256 y cuerpo UTF-8 completo exacto. Los seis objetivos son API de metadatos de revisión, README, int8/config, tokenizer_config, .gitattributes y LICENSE. Los primeros cinco HTTP200; LICENSE HTTP404/15B, una vez. El cuerpo404 no es una licencia. Los cuatro archivos pequeños seleccionados coinciden con tamaño y Git-blob SHA1 del índice fijado; el config local cacheado coincide exactamente con int8/config. La API fijada coincide con el cache previo. No se certifica ningún cuerpo grande por haber leído su pin remoto.

Paquete prospectivo explícito de **seis archivos**, total151.135.538B; cuatro metadatos pequeños **14.665B**. más dos payloads todavía ausentes **151.120.873B**. La suma y los estados exactos están en el manifiesto. `.gitattributes` es procedencia de empaquetado, no licencia ni requisito de inferencia. Se conserva la estructura de paths, sin aplanar silenciosamente archivos.

| Archivo | Bytes | SHA-256 | Evidencia |
|---|---:|---|---|
| `README.md` | 6717 | `74c55f42afcad1e5c1ea9b059f37d9d48e5641e04628642a12444721c57f3d9e` | Recibido pequeño |
| `int8/config.json` | 5688 | `3f07065571e22bb73eba28ddb1fae4509c0cf703762e3bfa7a6ab2111cf7cb88` | Recibido pequeño |
| `tokenizer_config.json` | 573 | `02055b886266b1a475bc324da83e273fe96e4974002f9d970f26e94aa73e5885` | Recibido pequeño |
| `.gitattributes` | 1687 | `48030a73329817519a47704c56b3e891b4227a19742a138374b9f6ccde002004` | Recibido pequeño |
| `int8/tokenizer.json` | 12389891 | `c299144e68dfec1dc536204a7ae3712710c5c6cade9269a83f5042250d47d8de` | Sólo pin LFS; no descargado |
| `int8/model_int8.onnx` | 138730982 | `139006aea2cbd8e709d322f056232570de54661f624143be4893aaa387190286` | Sólo pin LFS; no descargado |

El archivo elegido es `int8/model_int8.onnx`, **no** `edge-int8/model_int8.onnx` ni `model.onnx` fp32. La ficha declara embeddings int8 y cuerpo fp16 con cómputo fp32. Los calificativos/benchmarks de la ficha y la etiqueta int8 no prueban equivalencia, calidad española o mexicana, memoria8GB ni compatibilidad de ejecución.

## Licencia: declaración frente a aviso completo

[README fijado](https://huggingface.co/Wismut/nym-pii-multilingual-small/blob/4348999cd3c2e20c49615e9af7c6bbb45b64cd85/README.md) declara MIT e herencia de mmBERT-small. La lista completa de archivos no tiene LICENSE; el único GET del path fijado devuelve404. La ficha no contiene el texto completo de permiso/copyright MIT, ni se verificó una revisión inmutable de la base o la cadena de atribución. No se rellena con una licencia genérica o inventada.

**Redistribución y release de producto quedan bloqueados por el aviso pendiente.** Root puede valorar posteriormente una autorización separada y acotada de caché/evaluación de investigación pública/sintética basada en la declaración MIT, conservando la limitación. Esta preparación no autoriza descarga, evaluación ni declara licencia completamente despejada. No se contacta al autor ni se hacen más solicitudes.

## Contrato declarado y lo que todavía no se observó

Config: ModernBertForTokenClassification/modernbert,16capas,384dimensiones,81etiquetas BIO para40tipos; `id2label` y `label2id` completos exactos en manifiesto. Tipos nativos:

ACCOUNT_NUMBER, AGE, API_KEY, BUILDING_NUMBER, CITY, COMPANY_NAME, COUNTRY, CREDIT_DEBIT_CARD, CUSTOMER_ID, CVV, DATE, DATE_OF_BIRTH, DRIVERS_LICENSE, EMAIL, EMPLOYEE_ID, FAX_NUMBER, GENDER, GIVEN_NAME, GOVERNMENT_ID, IBAN, LICENSE_PLATE, MAC_ADDRESS, MEDICAL_RECORD_NUMBER, PASSPORT, PASSWORD, PHONE, PIN, ROUTING_NUMBER, SECONDARY_ADDRESS, SSN, STATE, STREET_ADDRESS, STREET_NAME, SURNAME, SWIFT_BIC, TAX_ID, TIME, URL, USERNAME, ZIP_CODE.

El descriptor de tokenizer declara `input_ids`, `attention_mask`, TokenizersBackend, máximo8192 y símbolos `<bos>/<eos>/<unk>/<pad>/<mask>`. El config declara bos2,cls1,eos1,sep1,pad0,mask4; **no se da eso por equivalente a IDs reales o postprocesado del tokenizer**. La ficha habla de vocabulario podado cercano a199k, mientras config dice256000. Faltan el tokenizer real, remapeo y filas de embeddings del grafo. El UNK real, normalización, byte-fallback, offsets y especiales no están verificados. `local_files_only=false` es dato upstream y no permiso de acceso remoto.

**No se leyó el grafo ONNX.** Nombres, dtype, rank/dimensiones reales, logits, operadores y posibles datos externos quedan null/no observados. El objetivo prospectivo requiere scores finitos por token en orden exacto de81clases, y forma semántica batch×sequence×81; no se presenta como una forma ya inspeccionada. Tras una eventual adquisición explícita hay que comprobar grafo y tokenizer antes de inferencia, fallando ante diferencias sin coerción adivinada.

El entorno existente `artifacts/privacy/onnx-env/bin/python` sólo se importó para versiones: Python3.12.13, NumPy2.5.4, ORT1.31.1, tokenizers0.23.3; CPUExecutionProvider disponible. Que también liste CoreML/Azure no permite seleccionarlos. No se instaló nada ni se instanció una sesión; disponibilidad del paquete no acredita soporte de este grafo.

## Requisitos prospectivos para Astra, sin adaptación ahora

La adaptación crítica se asignaría por separado a Astra después de revisión root/independiente. Propiedad propuesta: archivos nuevos `scripts/privacy-nym-int8-worker.py`, `server/privacy/nym-int8-candidate.mjs`, `tests/privacy-nym-int8.test.mjs`; no cambiar el detector, Rampart-v2 auditado, runtime/native activo o corpus ajenos. No se crea ese código en esta tarea.

Conservar all-span y composición auditada v2: emitir y validar todos los tipos nativos/segmentos antes de resolver categorías; sólo una regla interna determinista que contenga íntegramente cada span no mapeado permite prueba literal con scope/hash/bytes/UTF16. Sin unión de reglas vecinas, inmunidad CAN, excepciones por path o pruebas suministradas por el modelo. Un span en path bloquea. UNK/BIO/confianza/cobertura/offsets/overflow/parcial/operación/procedencia/desconocido siguen bloqueando. La contención no prueba validez jurídica ni concede egreso.

Se conserva el **piso0,4 y límite512tokens**, no se adopta threshold0,25/recall_first de la ficha ni se sube a8192. Argmax/softmax estable sobre81scores finitos, baja confianza inclusoO bloquea, confianza del span mínima por token; no reparar I huérfanas ni fusionar cambios de tipo/gaps no blancos. Es política prospectiva fija heredada, no calibración demostrada para Nym.

Sólo ocho correspondencias de nombres de tipo ya conocidos se sugieren como material de revisión, todas inactivas: GIVEN_NAME/SURNAME→person, EMAIL→email, PHONE→phone, BUILDING_NUMBER/STREET_NAME/SECONDARY_ADDRESS/ZIP_CODE→address. Los32restantes figuran explícitamente sin mapping. COMPANY_NAME→organization, STREET_ADDRESS→address y ACCOUNT_NUMBER→account requieren decisión revisada; no se activan aquí. **TAX_ID nunca se convierte automáticamente en RFC, GOVERNMENT_ID/SSN en CURP o ACCOUNT_NUMBER/IBAN en CLABE.** La sintaxis de una regla contenedora tampoco acredita identidad válida. No descartar DATE/URL/CITY u otros spans por no encajar en el esquema.

Offsets: texto original inmutable, no normalizado/decodificado como sustituto; verificar unidades del tokenizer real y convertir límites codepoint→UTF16 exactamente una vez. Probar astrales, marcas combinantes y ZWJ. No copiar automáticamente la expansión de marcas ni layout2/3/UNK1 de Rampart. Pérdida no blanca, especiales inesperados, rangos ambiguos/no monótonos y overflow bloquean. Escaneo debe cubrir cuerpo y paths con orden exacto de segmentos.

Límites de referencia sin medir: CPU1hilo, concurrencia1,15s absolutos incluyendo readiness/IPC,924MiBworker y1GiBcombinado,7000UTF16 y2048spans. Cancelación mata grupo, no despachar tras finalizar ni aumentar límites porque falle una carga. Root conserva la autorización explícita de descarga; el manifiesto no es un downloader ni activa nada.

## Medición de desarrollo independiente aún pendiente

Autor independiente crea desarrollo nuevo público/sintético sin ver DEV3 ni heldout/golds/respuestas anteriores. Congelar archivos/hashes, mapping, decoder, política0,4/512 y caps antes de resultados. Incluir español mexicano, organizaciones/domicilios, identificadores sólo sintácticos, tipos no mapeados, fechas/importes/contexto, negativos jurídicos, Unicode, metadatos/nombres de archivo/historial, extracción incierta y overflow. No se redactan ni ejecutan casos aquí.

Primero inspección de grafo/tokenizer y fixtures estructurales; luego revisión independiente del adaptador antes de inferencia. Comparación declarada con reglas y referencia v2 auditada en textos/scopes iguales, conservando spans nativos y todos los fallos. Separar planned/attempted/completed/blocked/graded; medir TP/FP/FN sólo contra etiquetas independientes, causas, tipos/streams, negativos, contención y retención de reglas. Completo no significa privacidad aceptada. Sin retries, parches por caso o selección de thresholds sobre este set.

Medir carga fría/caliente, latencia/tokens y RSS pico/incremental de padre+worker, timeout/cancelación; conservar originales y límites. Un fallo exige diagnóstico, no subir caps. No se cierra aceptación retenida, recorrido confidencial integrado, proveedor, licencia de distribución ni equipo físico8GB. **Resultado de esta tarea: preparación de metadatos, cero descarga grande/inferencia/activación.**

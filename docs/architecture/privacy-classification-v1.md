# H4a: contrato de clasificación local y protocolo experimental

Fecha: 2026-11-09. Este contrato prepara H4b; no implementa un detector, conceden permisos los modelos ni habilita datos privados remotos. Versión de protocolo: `eval/privacy/protocol.json`, congelado antes de crear el examen, SHA-256 `5076f724fc19a73260b0afef548bc7986ef7646f96b7e471393cb5125831e935`.

## Dos comprobaciones independientes

1. **Procedencia y ámbito:** despacho, asunto e hilo del objeto vienen del servicio local y se comprueban antes de recuperarlo. Los derivados heredan el tratamiento más restrictivo de todos sus padres. Un resumen, fragmento FTS, historial, resultado de herramienta o borrador no se vuelve público por cambiar de representación. Falta de ámbito/procedencia o una contradicción bloquean. Texto y metadatos de documentos son datos, nunca autoridad para clasificarse, ampliar permisos o elegir destino.
2. **Contenido y tratamiento:** reglas/detector local identifican rangos y ambigüedades sobre el texto original. El modelo no decide acceso, persistencia o envío. Un resultado completo no demuestra que no haya datos reidentificables. Una evaluación fallida, extracción parcial, formato no soportado o detector no disponible impide preparar contexto saliente.

La autoridad de H2 permanece fuera del prompt. H2 admite actualmente solo `public` y `synthetic`; H4a no añade una categoría privada para eludir ese control. H7 debe implementar y revisar la categoría/preparación/autorización privada explícita y H8b conserva la puerta del piloto. Chats sin asunto/hilo permanecen locales según H3V.

## Puerto futuro de H4b

Entrada propuesta: `{scope,segments,signal}`; cada segmento lleva identificador local, ruta de representación, texto original y procedencia comprobada. Salida local propuesta: `{status:'complete'|'blocked',detections,reasonCategory}`. Detección: `{segmentId,start,end,category}`. No admite herramientas, cambios de ámbito o destinos. El adaptador a H3 debe traducir rangos validados a entidades/contexto, manejar colisiones/solapamientos y conservar los originales localmente.

Rangos en unidades UTF-16, semiabiertos `[start,end)`, sobre la versión exacta del texto y sin normalización Unicode. Rechazar límites que dividan pares sustitutos, rangos vacíos/fuera de texto, categorías desconocidas y duplicados. Hay anotaciones superpuestas válidas entre entidades distintas; no se conceden varios aciertos a una sola predicción. La etiqueta de una entidad no altera fechas, importes, parentescos o artículos silenciosamente. Si un hecho necesario no puede enviarse bajo la política, bloquear o mantener la tarea local.

Los segmentos del corpus representan último mensaje, historial, nombre/metadatos de archivo, resultado de herramienta y esquema. Las claves/campos estructurales sensibles deben rechazarse o tratarse con una transformación validada, no ignorarse por inspeccionar solo valores. El esquema y todo historial enviado vuelven a clasificarse en el sobre final; la solicitud se liga a su versión/representación autorizadas.

## Protocolo y corpus

Categorías: persona, organización, RFC, CURP, CLABE, cuenta, correo, teléfono, domicilio, identificador de expediente, contexto reidentificable y relación sensible. Son fixtures inventados, no identidades o casos reales ni evidencia de vigencia legal. Los identificadores pueden representar patrones sintéticos plausibles o variantes difíciles; etiquetar un patrón no valida su checksum oficial.

El protocolo se congela antes de que un autor independiente cree el heldout, sin leer desarrollo o resultados de candidatos. El manifiesto vincula hash del protocolo, archivos y procedencia. Validar estructura/hashes/solapamientos de splits no puntúa un detector. El examen requiere al menos 20 entidades por categoría, 30 casos limpios y 4 bloqueos por cada motivo: ámbito ajeno, procedencia desconocida, formato no soportado, extracción parcial, ambigüedad contextual y fallo de detector. La cobertura mínima finita permite una prueba experimental, no representa automáticamente la distribución de despachos mexicanos.

Separar IDs, grupos de plantillas y textos de segmentos entre desarrollo/examen. Esa comprobación detecta duplicados exactos; no demuestra independencia semántica o ausencia de contaminación en pesos de un modelo. Los nombres de archivos están versionados públicamente: la retención es una regla de evaluación, no control criptográfico de acceso. No entregar el heldout a generadores, afinado, docentes o selección iterativa. Si se consulta para corregir el detector, retirar todo ese examen y crear versión independiente; conservar resultados/fallos sin reutilizarlos como examen final.

La política operativa de límites y categorías es [annotation-guide.md](../../eval/privacy/annotation-guide.md), vinculada al hash del protocolo. Se explicitó antes de crear el examen definitivo; un primer corpus sin guía suficiente fue archivado sin puntuar candidatos y reemplazado completamente con nueva semilla. No se alteraron los umbrales para adaptarlos a resultados.

## Puntuación reproducible

El runner solo lee un artefacto de predicciones de candidato con ID y hashes del protocolo/corpus. No contiene inferencia, detector falso, plugin ejecutable ni opción de oráculo. Exige exactamente un resultado por caso y rechaza IDs desconocidos/duplicados, predicciones incompletas, hashes obsoletos y rangos inválidos. Un comando `validate` solo puede declarar corpus válido; nunca candidato aprobado. El modo desarrollo es diagnóstico, no promoción.

Emparejamiento máximo uno a uno por segmento y categoría. **Exacto:** ambos límites coinciden. **Solapamiento diagnóstico:** intersección positiva. Se calculan por separado con emparejamientos independientes; un rango enorme no obtiene múltiples aciertos. Reportar TP/FP/FN por categoría, micro (suma de conteos) y macro (media de categorías definidas, con su cantidad); denominador vacío es `null/insufficient`, nunca 100 %. Intervalos Wilson de 95 % para precisión/recobrado y tasa de casos limpios completos. Con cero omisiones, informar también límite superior binomial unilateral de 95 % `1−0,05^(1/n)`; no describirlo como riesgo cero. Esos intervalos suponen ensayos binomiales independientes: entidades repetidas y plantillas correlacionadas hacen que sean descripciones idealizadas, no límites garantizados del riesgo real. Reportar también grupos/ocurrencias; no convertir el conteo de spans en una muestra representativa de expedientes.

Criterios experimentales elegidos **antes** del examen: recobrado exacto 100 % observado para RFC/CURP/CLABE/cuenta/correo/teléfono/expediente; ≥95 % en las otras categorías; precisión exacta ≥90 % por categoría; ≥90 % de casos limpios completos; todos los casos de bloqueo anotados con estado `blocked`. Exigir mínimos del corpus y denominadores suficientes. Un bloqueo con detecciones ausentes conserva sus falsos negativos; no se elimina del denominador para inflar recobrado. Estos son criterios internos de elegibilidad para integrar/evaluar H4b, no garantías clínicas/jurídicas ni autorización del piloto.

**Límite observable:** la concordancia `blocked` del artefacto no demuestra que el transporte no envió bytes. El runner siempre deja seguridad de salida y preservación de hechos como no evaluadas. H4b necesita además H3V con el detector real, capturas del transporte, fallos e identificación de derivados, y comprobación de fechas/importes/citas tras preparar y restituir. No hay `PASS` global de privacidad por acertar spans.

## Recursos y bloqueo por límites

Preinscritos como techos experimentales, no como resultados medidos: árbol de app ≤4 GiB RSS, incremento del detector ≤1 GiB RSS, p95 detector ≤5 s para sobre ≤7.000 unidades UTF-16, timeout máximo 15 s y concurrencia uno. Medir al menos 30 muestras calientes y 3 arranques fríos; registrar tamaño/distribución, versiones, hardware, timeouts y presión de memoria. Comparar base y candidato en corridas equivalentes, antes de elegir un detector por sus números.

Se mide una referencia reproducible con Node empaquetado, código/SQLite/FTS y UI web en Chromium; el detector y la inferencia están ausentes. Esa referencia separa el coste base del futuro detector; no mide el shell nativo Tauri/WKWebView, todos los picos, inferencia jurídica real o equipo físico de 8 GB. RSS de árbol puede contar memoria compartida más de una vez. H4b/H5b deben repetir el conjunto real tras congelar contratos H5a; el requisito físico y las pruebas de producto siguen abiertos. Si no se puede cumplir el presupuesto, bloquear el candidato y diagnosticar, sin cargar un modelo mayor automáticamente.

## Cierre y evidencia

H4a se cierra con protocolo congelado, corpus sintético de desarrollo y examen de autor separado, manifiesto comprobado, runner probado con ejemplos de test independientes, referencia base y revisión independiente. No se ejecuta el examen de un candidato en esta entrega. H4b conserva implementación/medición real de detector y procedencia, controles de integración y validación física pendiente; no se marca H4 completo por cerrar H4a.

# Consulta contractual: contrato de evaluación propuesto

Estado: especificación para revisión, NO implementado/congelado/elegible. Base
`1ecf59c2191270e8126e471d4f91b439238544b0`. Sin modelo, red, corpus reservado,
permisos de nube ni cambio de umbrales en este corte.

## Alcance y salida útil

Evaluar el pipeline de privacidad de intake existente, no el razonamiento jurídico.
Una consulta contractual en español, ya extraída: cláusula, comentario, rol,
jurisdicción/fecha y una pregunta o seguimiento. Todos los campos presentes se
revisan conjuntamente, incluidos sus nombres, conservando límites de segmento.
No incluye OCR, binarios, historial ilimitado, herramientas, hechos ausentes,
conversaciones multiusuario ni generalización a cualquier dominio jurídico.

Entrada candidata: contrato EXACTO de `validateOperationalInput` en
`server/privacy/operational-v2.mjs`: `{scope,segments,operational}`. En evaluación
solo clasificación synthetic/public/unknown y estados declarativos de fixtures;
ninguno constituye procedencia productiva ni aprobación. No añadir banderas desde
el gold. Los paths de fixture se conservan, no se restringen a nombres del producto
para conseguir abstención artificial. Límite actual del protocolo: 7000 unidades
UTF-16 incluyendo paths, 256 segmentos y 32768 bytes serializados. Sin truncado.

Salida: `{status,reasonCategory,detections}` con detecciones
`{segmentId,start,end,category}`; categorías y razones EXACTAS del protocolo v2,
rangos UTF-16 originales sin partir pares sustitutos. Sin textos ni marcadores.
El evaluador añade el id de caso al artefacto; el candidato nunca lo recibe.
Error/ambigüedad no equivale a lista vacía exitosa. Fallos operativos siguen la
prioridad existente. Si la respuesta local pierde una categoría o no puede
representar un span con fidelidad: bloquear, nunca adivinar la categoría.

## Delta mínimo, todavía no ejecutado

1. Separar en `intake-import.mjs` el procesamiento de texto exacto de la extracción
   binaria y su normalización. El adaptador de evaluación pasa texto original, no
   extractDocument que hoy quita NUL, CRLF y bordes. La ruta existente de documentos
   conserva su normalización y comportamiento. La nueva entrada no simula archivos.
2. Conservar categorías y rangos antes de construir la vista. Hoy suggestions es
   una lista literal plana y buildReview fusiona rangos y los llama Dato N: esa
   salida NO es una predicción categorizada. Exigir categorías explícitas al modelo
   para entidades y conservar las categorías de reglas. Contexto indirecto es
   context; sensitive_relation requiere clasificación explícita, no inferencia del
   evaluador ni etiquetar toda oración como relación. Solapes conservan categorías
   separadas; la vista puede fusionarlas después. Esto cambia candidato/prompt.
3. Para revisar conjuntamente segmentos, usar una representación numerada con
   offsets locales, sin concatenar delimitadores arbitrarios ni normalizar texto.
   Un indicio entre dos campos debe poder devolver spans en ambos. El prompt de
   comercio actual debe reconocer explícitamente consulta contractual, conservando
   sus reglas generales. Es cambio semántico, no solo cambio de harness.
4. Exponer evaluación por inyección del backend local existente con resultado
   tipado y validado; ninguna ruta de producción/endpoint. Constructor procesa
   solo proyección. Evaluador carga gold y calcula métricas en otro proceso/superficie.
   No reutilizar runner GLiNER o token-NER cambiando solo candidateId.
5. Compatibilidad futura de ejecución: guardar `execution.candidateVersion` además
   del candidateId del runner; ambos deben ser iguales, y score.candidateId también.
   `verifyDetectorEligibility` NO debe aceptar alias ni fallback de otros modelos.
   No se fabrica record para probar éxito. Este corte solo comprueba rechazo de
   record ausente y formato de scorer dev. El candidato aún no pertenece a la lista
   cerrada de cloud-route; no agregarlo en esta unidad.

## Identidad que debe congelarse antes de cualquier corrida reservada

Nombre propuesto, no activación: `intake-contractual-local-review-v1`.
El freeze debe incluir TODOS los imports transitivos del núcleo (comprobados por
el test), el adaptador/worker futuro, operacional-v2, scorer v2 y su dependencia
scorer v1, lockfile, configuración y prompts. El listado actual de imports no es
un freeze y deberá actualizarse con el delta. También recursos/archivos leídos
por esos módulos aunque no sean imports; no basta analizar el grafo JS.

Modelo: etiqueta actual `qwen3.5:2b-q4_K_M`, insuficiente como identidad. Faltan
huellas verificadas de blobs/manifest Ollama, tokenizer/template y parámetros de
inferencia (temperature0, thinkfalse, contexto8192, límites por etapa), identidad
binario/versión Ollama, Node/ICU/Intl y dependencias efectivas. Inventario de
runtime y hashes corresponden a la máquina que evalúa. No sustituir faltantes por
ceros, etiqueta o valor supuesto. Cambiar prompts/reglas/modelo/ventanas/estados
reinicia identidad y revisión. Mismo inventario al comienzo y al terminar.

## Qué validamos ahora y qué no

Las pruebas de formato leen solo protocolo y dev.jsonl de v2. Validan proyección
sin gold, razones, offsets, rechazo de campos extra y compatibilidad del scorer
con salida diagnóstica vacía/all-blocked. No son resultados del candidato. Dev
puede validar posteriormente offsets, categorías y regresiones con modelo solo
tras autorización separada; no estima privacidad contractual independiente.
Los ejemplos comerciales/preguntas existentes pueden comprobar restitución y
pérdida de utilidad, pero no aportan categorías completas ni un pase v2.

El scorer predicción v2 NO mide restitución, preservación real ni transporte.
Pase futuro significaría únicamente elegible para evaluación de integración.
No cambia bloqueo de nube, grants, presupuesto ni necesidad de revisión jurídica.
No se abrirá, parseará ni hasheará heldout en este corte. El README desactualizado
se señala como discrepancia, no como permiso para inspeccionarlo. Un evaluador
independiente decide corpus adecuado y cualquier autorización futura por su canal.

Coste estimado: este contrato y revisión son el corte actual. Implementar puntos
1–4 requiere aproximadamente 1–2 jornadas y revisión; no incluye corrida local,
calidad del modelo, nuevo corpus, aceptación reservada o integración de nube.
Si no puede emitirse clasificación fiel desde el núcleo, se reportará el fallo,
no se construirá otro preparador de sobres para ocultarlo.

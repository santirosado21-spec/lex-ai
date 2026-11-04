# Objetivo vigente del producto y del entrenamiento — 2026-11-03

El dueño reiteró que el entrenamiento debe conducir al producto final definido, no reducir su objetivo a charla. Esta decisión conserva el alcance del [plan de competencia jurídica](legal-competence-plan-2026-11-03.md) y las actualizaciones de AGENTS.md. Las decisiones técnicas del piloto no sustituyen requisitos de producto.

## Producto que queremos entregar

**Un único asistente jurídico conversacional, privado y ligero para despachos mexicanos**, extensible a otras jurisdicciones. Debe permitir conversar, investigar, analizar documentos y preparar/revisar escritos dentro del mismo hilo, con selección automática de la habilidad apropiada y sin obligar al abogado a buscar manualmente las fuentes. Comercio exterior es una especialidad opcional, no su límite.

- Conversación natural en español: responder a la intención real, seguir correcciones, conservar contexto del hilo y variar el detalle según la petición. Un saludo no desencadena análisis jurídico.
- Trabajo jurídico sustentado: usar pasajes oficiales pertinentes y documentos del asunto, citar la evidencia de cada afirmación jurídica, distinguir hechos, texto documental y conclusión, conservar versión y procedencia; no completar lagunas con artículos o plazos inventados.
- Diez áreas iniciales: constitucional, civil, familiar, penal, laboral, mercantil, fiscal, amparo, administrativo y seguridad social. Preguntar jurisdicción, hechos y documentos faltantes cuando cambian la respuesta. La aptitud por área requiere evidencia y revisión profesional.
- Continuidad útil: entender seguimientos, cambios de tema y referencias al turno anterior, con historial de chats separados y límites firmes entre asuntos y despachos. El aislamiento lo impone el software, no una promesa del modelo.
- Trabajo con documentos y escritos: analizar, resumir, comparar y redactar borradores revisables, conservar citas/versiones y permitir abrir/exportar los escritos. Preparar un escrito no equivale a presentarlo.
- Control del abogado: proponer próximos pasos útiles dentro de las capacidades reales y pedir aprobación para las acciones que la requieran. No fingir envíos, acceso a otros expedientes ni ejecución de herramientas.
- Producto local orientado a 8 GB: documentos, recuperación e inferencia privados permanecen en el equipo. Interfaz identificada como LEX AI; procedencia técnica veraz en materiales internos y avisos legales. No presentar la medición en este Mac de 24 GB como validación física de 8 GB.

## Qué aporta cada componente

El ajuste conductual enseña **cómo** usar contexto y evidencia: conversación, seguimientos, citas pertinentes, rechazo de distractores, preguntas de hechos/jurisdicción, abstención y análisis documental. No se busca memorizar leyes ni sustituir recuperación, cobertura de fuentes, validación de citas o revisión profesional.

El runtime y las habilidades aportan recuperación automática, contexto del asunto, memoria acotada, formatos y acciones permitidas. El almacenamiento y control de acceso aseguran aislamiento, persistencia e historial. La aplicación aporta edición, apertura y exportación. Entrenar un adaptador no implementa estas capacidades por sí solo ni habilita acciones que el software no tenga.

## Cobertura real de la noche

La corrida `artifacts/raft/night-20261103-conversation` es **etapa 1, base conversacional**, con 512 conversaciones y 128 retenidas. Otros 200 casos jurídicos sólo participan en validación. Conservar los objetivos jurídicos en el mensaje system no equivale a entrenarlos con respuestas y evidencia; evaluar pérdida jurídica tampoco equivale a actualizarlos.

El corpus RAFT completo contiene los tipos `grounded`, `followup`, `missing-facts`, `local`, `abstain` y `synthetic-document`, además de `chat`. El perfil completo excedió memoria durante backward; la restricción debe resolverse mediante una receta medida, preservando evidencia y diálogos completos, antes de programar su siguiente etapa. No se declara una segunda etapa jurídica iniciada ni en cola automática. No cargar un segundo entrenador ni modificar la receta/datos firmados de la corrida activa. Conservar la fase actual como candidato separado para comparar su efecto.

La auditoría concreta de IDs/tipos está en `artifacts/raft/night-20261103-conversation/product-alignment.json`: los 512 ejemplos actuales son `chat`; el resto de conductas no tiene ejemplos de actualización en esta etapa. El candidato sigue inactivo.

## Criterio de aceptación del entrenamiento completo

Comparar base y candidato con el mismo runtime, recuperación, fuentes y contexto. Medir por separado conversación, fidelidad y pertinencia de citas, distractores, abstención, hechos/jurisdicción, seguimiento y documentos; incluir casos por área y continuidad/aislamiento en la app real. Conservar respuestas y fallos, métricas por grupo y procedencia de los ejemplos. Las leyes de evaluación sellada no se usan para construir entrenamiento ni seleccionar hiperparámetros.

Una pérdida menor o la puntuación mecánica de diez casos no basta. Exigir mejora demostrada respecto a la base en las conductas objetivo sin empeorar abstención/atribución de evidencia, además de revisión semántica y profesional por área para afirmaciones jurídicas. Verificar compatibilidad del adaptador con el runtime de producto y su formato de cuantización. Revisar rendimiento e instalación en hardware de destino, conservando comparación emparejada de habilidades.

La promoción requiere revisión humana explícita, candidato versionado y rollback. No activar un adaptador por terminar épocas, caber en memoria o aprobar comprobaciones de formato. Los campos con evaluación pendiente deben conservar ese estado: no fabricar notas, umbrales aprobados o validación profesional.

## Corrección de integración — 2026-11-04

La conversación básica debe funcionar con el modelo base instruido sin entrenar otro adaptador. Antes de atribuir un fallo al modelo o iniciar entrenamiento, revisar versión instalada, intención/ruta, template/roles, historial, salida cruda y validadores de la app. Se reprodujeron rechazos indebidos de listas, cálculo y placeholders; la corrección y su evidencia están en [chat base 0.4.12](../qa/general-chat-base-0.4.12.md). El ajuste debe mejorar comportamientos específicos medidos, no compensar una integración que sustituye respuestas generales válidas por avisos de falta de fuentes.

## Aclaración de naturalidad — 2026-11-04

El dueño aclara que el síntoma es contestar como un bot de RAG, no pedir fuentes literalmente. El contrato pasa a conversación por defecto: recuperación para solicitudes jurídicas/documentales y sus seguimientos, sin que coincidencias incidentales transformen charla en una respuesta legal. La prueba de aceptación debe incluir escuchar sin ofrecer tareas, cambios de tema, instrucciones y continuidad de varios turnos, con revisión de respuestas completas. Los asserts de formato, saludos, suma o ausencia de citas no demuestran naturalidad. [Evidencia y limitaciones de 0.4.13](../qa/dialogue-routing-context-0.4.13.md).

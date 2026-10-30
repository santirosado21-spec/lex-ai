# Flujo del abogado y prioridades de LEX

Investigación de producto: 30 de octubre de 2026. Este esquema es una inferencia de diseño, no un procedimiento jurídico obligatorio ni un catálogo de plazos. El litigio es un caso de uso; revisión contractual, asesoría corporativa y otros trabajos también necesitan contexto, documentos, investigación, borradores y seguimiento.

## Evidencia pública consultada

El [centro de ayuda del Portal de Servicios en Línea del PJF](https://www.serviciosenlinea.pjf.gob.mx/juicioenlinea/Home/Ayuda) separa consulta del expediente, presentación de promociones, acuses, notificaciones y lista de acuerdos. Esa separación muestra que generar un escrito y acreditar su presentación son hechos distintos. LEX debe registrar documentos y decisiones con procedencia, sin presentar una exportación como trámite realizado.

La [pantalla oficial de presentación](https://www.serviciosenlinea.pjf.gob.mx/juicioenlinea/Presentacion/RegistroDemanda) organiza información de promovente, oficina, documentos y resumen; describe la vinculación de promociones con órgano, tipo de asunto y número de expediente. No se inició trámite ni se introdujeron datos. La inferencia para producto es conservar contexto suficiente y una revisión humana explícita antes de cualquier entrega externa.

El [manual oficial de consulta del SJF](https://www.internet2.scjn.gob.mx/Flip/SJF/6/) distingue búsquedas sobre rubro, texto, precedentes y datos de localización de tesis, así como campos de ejecutorias. Su contenido indexado fue accesible en búsqueda; la apertura directa devolvió 403. No se asume haber leído todo el manual. La [consulta de Apéndices del SJF](https://sjf2.scjn.gob.mx/busqueda-principal-apendice) identifica la incorporación de tesis y precedentes publicados. La inferencia de producto es guardar registros y pasajes identificables, no solo respuestas narrativas.

## Flujo propuesto y estado del producto

| Etapa | Necesidad práctica inferida | LEX actual / vacío |
|---|---|---|
| Abrir asunto | Cliente, objetivo, jurisdicción, alcance y responsables | Cliente/jurisdicción presentes; objetivo, etapa y responsables ausentes |
| Reunir evidencia | Versiones, anexos, procedencia y legibilidad | Importación local e índice; faltan versiones, OCR y relaciones entre anexos |
| Investigar | Pregunta, autoridad, registro, fecha y pasaje | Corpus con fuentes y citas; falta carpeta de investigación persistente por asunto |
| Preparar borrador | Convertir hechos y evidencia en texto revisable | Respuesta y DOCX; falta edición persistente y comparación de versiones |
| Revisar | Distinguir verificación de citas de conclusión profesional | Feedback y aprobación de notas; falta revisión del borrador con estados y observaciones |
| Dar seguimiento | Saber el siguiente paso y conservar lo efectivamente ocurrido | Actividad real y tareas manuales; no seguimiento de notificaciones ni acuses externos |

No se infieren fechas procesales del contenido de documentos. La fecha manual de una tarea es una elección del usuario, no una fecha calculada o verificada por LEX.

## Backlog priorizado por utilidad

| Prioridad | Entrega | Datos/API necesarios | Criterio de aceptación |
|---|---|---|---|
| P0 implementado | Tareas manuales por asunto | `task.create`, `task.list`, `task.update`; almacenamiento local `task` | Crear título/nota/fecha opcional, completar/reabrir, filtrar; persiste; aislamiento entre asuntos |
| P1 | Ficha de objetivo y etapa | Campos opcionales `objective`, `stage`, `reference`, edición auditable de asunto | Ningún campo inventado; guardar y recuperar cambios |
| P1 | Borradores y revisiones | Entidad `draft`, versiones inmutables, observaciones, `draft.save/version/compare` | Comparar texto y recuperar una versión previa sin modificar originales |
| P1 | Colección de investigación | `research.save/list`, fuente/version/pasaje, pregunta y matterId | Reabrir evidencia exacta desde el expediente y mostrar versión |
| P1 | Documentos versionados | Relaciones original/revisión/anexo, hashes, clasificación manual | Vincular dos versiones sin sobrescribir; recuperar procedencia |
| P2 | Evidencia escaneada | OCR local con estado, confianza y referencia al original | Marcar errores de extracción; texto y original verificables |
| P2 | Registro manual de actuaciones | Fecha aportada, tipo, autoridad opcional, adjunto del acuse y origen | Diferenciar declaración del usuario de evidencia documental |
| P2 | Lista de revisión del borrador | Checklist editable por asunto, evidencia enlazada, revisiones con fecha | No afirmar aprobación profesional por checks automáticos |
| Diferido | Calendario procesal automático | Reglas por procedimiento, versión normativa, hecho detonante probado, calendario jurisdiccional y revisión experta | Requiere diseño y validación específicos; fuera del piloto actual |
| Diferido | Presentaciones/notificaciones externas | Integración autorizada, permisos, identidad, firmas y recibos | Nunca confundir exportación local con presentación oficial |

## Contrato de tareas implementado

`task.create({matterId,title,note?,plannedDate?})`: título 1–200 caracteres útiles, nota hasta 4.000; fecha opcional `YYYY-MM-DD` existente, años 0001–9999. Empieza pendiente, sin plantillas o valores ficticios. `task.list({matterId,status?})` acepta `pending` o `completed`. `task.update({matterId,taskId,status})` solo cambia estado. ID, despacho, asunto, creación y contenido son inmutables en ese endpoint; campos adicionales se rechazan.

SQLite conserva timestamps e historial de creación/completado/reapertura. Completar dos veces no duplica eventos. No hay eliminación, recordatorios, envío externo, inferencia ni cálculo de vencimientos. `state.tasks` pertenece al único despacho del almacenamiento; la UI filtra asunto y toda lectura/mutación específica verifica su ámbito.

## Verificación

`node --test tests/matter-tasks.test.mjs tests/service.test.mjs`: 20 PASS en pasada conjunta inicial; 4 pruebas específicas de tareas PASS tras añadir aislamiento entre despachos. Cubre reinicio del servicio, aislamiento, campos inmutables, fechas bisiestas e imposibles, longitudes y estados. `npm run build`: PASS. El smoke ampliado prueba tarea con fecha/nota, recarga de navegador, completar/reabrir y filtros; usa únicamente fixtures sintéticos y no llama a Gemma.

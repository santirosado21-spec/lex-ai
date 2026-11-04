# Agente conversacional y actualización nativa 0.4.10

Fecha: 2026-11-03. Codex; sin Claude.

## Problema observado

El usuario mostró «Hola» respondido como análisis de contrato, con citas. El proceso abierto provenía de `/Volumes/LEX AI/LEX AI.app`, versión **0.4.2**; la copia en `/Applications` aún era **0.4.8**. Entregar el DMG 0.4.9 no había actualizado la aplicación abierta.

También se reprodujo una regresión real del código 0.4.9: con un asunto poblado y palabras del saludo en su documento, la recuperación podía convertir un turno conversacional en análisis fundamentado. La prueba añadida falló antes de la corrección con «JSON mixto inválido», porque el servicio esperaba una respuesta jurídica en lugar de conversación. No se atribuye todo el fallo a la versión antigua.

## Cambio

Se distinguen los saludos sociales puros. Saludos, preguntas sobre capacidades, tareas generales y recuerdo personal conservan su intención conversacional aunque haya coincidencias documentales o una habilidad jurídica seleccionada. La recuperación sigue acotada por despacho/asunto; esas coincidencias no se entregan al modelo en estos turnos. Las solicitudes jurídicas y documentales explícitas mantienen prioridad, recuperación y validación de citas. No se elimina ni reescribe el historial antiguo.

## Evidencia

- Suite Node: **349/349 PASS**. Regresión con «Hola», «Buenos días», «Gracias», «¿Cómo estás?» y organización de reunión; asunto con documento coincidente y habilidad Investigador jurídico. No entrega el documento a la generación conversacional.
- UI/API real con inferencia sintética: **PASS**, `artifacts/ui-conversation/smoke.json`; incluye «Hola» en asunto poblado y habilidad jurídica.
- TypeScript/Vite: **PASS**.
- Inferencia real del paquete y actualización nativa: resultados al cierre.

Esta entrega conserva el modelo base pequeño. El candidato de entrenamiento permanece separado. Intel bajo Rosetta y esta Mac de 24 GB no constituyen validación física Intel ni de 8 GB. Paquete con firma local, aún sin notarización Apple.

La prueba nativa de tres turnos encontró otra limitación de memoria. Esta candidata queda sustituida por 0.4.11; véase [corrección de continuidad](conversational-native-fix-0.4.11.md).

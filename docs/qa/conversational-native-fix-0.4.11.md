# LEX AI 0.4.11 — conversación y continuidad verificadas

2026-11-03. Codex implementa y verifica; no se usa Claude.

## Diagnóstico y cambio

La app abierta de la captura era 0.4.2 en un disco montado; la copia de Aplicaciones era 0.4.8. Se corrigió también una regresión de 0.4.9: coincidencias documentales podían convertir saludos en análisis jurídico dentro de un asunto. Saludos, presentaciones, capacidades y tareas generales conservan la vía conversacional sin documentos no solicitados; las peticiones jurídicas explícitas mantienen prioridad y fuentes verificadas.

La prueba nativa de 0.4.10 confirmó el saludo pero detectó una negación falsa de memoria al preguntar por la profesión. El ensayo local posterior mejoró la respuesta profesional, pero el modelo aún negó un nombre que sí figuraba en sus mensajes. Se conservan los resultados y mensajes sintéticos en `artifacts/conversation-native-20261103/recall-v2.json` y `recall-v3.json`.

La corrección usa el contexto de conversación para responder libremente y una consulta extractiva para nombres/profesiones expresamente declarados por el usuario. Esta consulta lee únicamente los mensajes de usuario del mismo despacho, asunto e hilo; consulta hasta 64 turnos y cita la declaración exacta. No adopta nombres inventados por el asistente ni declaraciones negadas/hipotéticas. Si no encuentra un dato, lo indica sin pedir al modelo que lo invente. Es memoria de la aplicación, no una mejora atribuida al entrenamiento del modelo.

## Verificación

- TypeScript y Vite: PASS.
- Suite Node: **351/351 PASS**, incluyendo aislamiento por hilo/asunto, recuerdo frente a un modelo que niega memoria y rechazo de identidades hipotéticas/negadas y nombres inventados por el asistente.
- UI con API real y respuestas sintéticas: PASS, incluido «Hola» con asunto, documento coincidente y habilidad jurídica seleccionada; chats, búsqueda, persistencia, menú pequeño y cancelación.
- Evaluación local de seis turnos: **PASS**, [resultados](../../artifacts/conversation-native-20261103/recall-final.json). Hola, capacidades para abogado penal, recuerdo de profesión, declaración de nombre, recuerdo de nombre y consulta en otro hilo sin ese dato. Se distingue por turno la generación del modelo de la consulta extractiva.
- Paquete universal con inferencia real arm64: **PASS**, [JSON](../../artifacts/lex-chat-0.4.11-arm64-check.json), incluyendo Hola con documento y habilidad jurídica seleccionada, recuerdo y separación de chats.
- Paquete x64 con inferencia real bajo Rosetta: **PASS**, [JSON](../../artifacts/lex-chat-0.4.11-x64-check.json).
- Aplicación **0.4.11 instalada** en `/Applications/LEX AI.app`, proceso y backend activos. Los hashes de conversación, consulta de contexto, router y servicio coinciden con el código probado: [registro](../../artifacts/conversation-native-20261103/installed-0.4.11.json).
- Firma local e integridad del nuevo DMG: **PASS**. [Instalador universal 0.4.11](../../artifacts/LEX-AI-0.4.11-universal.dmg).
- La repetición visual final de 0.4.11 queda **pendiente de desbloquear la sesión**: `CGSSessionScreenIsLocked` confirmado. La comprobación visual de 0.4.10 sí detectó la falla y se conserva como fallo; no se presenta como éxito de la versión final. No se alteró la seguridad ni se intentó desbloquear automáticamente la Mac.

## Entrega y límites

Modelo base pequeño, sin activar el candidato de entrenamiento. macOS 14+, objetivo de 8 GB RAM; las pruebas en esta Mac de 24 GB y x64 bajo Rosetta no validan un Intel físico ni una máquina de 8 GB. Firma local sin notarización Apple. La app anterior y la base local se respaldan antes de reemplazar la copia instalada, manteniendo los datos privados fuera del repositorio.

Tamaño DMG: 2239931706 bytes. SHA256: `82fccc13ef128b21f2a58feb5841f643fc28bacad579f9eaa24785cd4e7cd213`.

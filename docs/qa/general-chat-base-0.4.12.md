# Conversación base en LEX AI 0.4.12 — 2026-11-04

El dueño pregunta por qué no puede conversar al descargar un modelo conversacional y confirma que la app pide fuentes o responde extraño en conversación normal. **La conversación básica no debe depender de ajustar pesos.** El entrenamiento de conductas jurídicas especializadas es una tarea separada. Codex diagnosticó y corrigió la integración usando sólo datos sintéticos y el modelo base incluido; no se usó Claude ni otro modelo remoto.

## Causa reproducida

La vía automática de chat aplicaba `validateConversationText` con las mismas reglas estrictas que los párrafos conversacionales dentro de una respuesta jurídica con fuentes. Cualquier número, incluso una lista o «4», se interpretaba como afirmación sin respaldo. Todos los corchetes se trataban como citas no autorizadas, incluidos `[Tu Nombre]` y `[tema específico]` de un correo. Palabras como «semana» se rechazaban incluso en una propuesta de reunión.

Con el motor real se conservaron los textos de salida y se comprobó que el control previo habría rechazado exactamente las mismas respuestas que la corrección permite. El primer ensayo real completó saludo, lista y cálculo, pero falló con los placeholders del correo: evidencia preservada en `artifacts/chat-general-20261104/source-base-real.json`, **FAIL**. No se atribuye ese resultado al entrenamiento ni se presenta como prueba aprobada.

## Cambio

El chat general llama explícitamente al validador con política de conversación general. Permite cantidades no jurídicas, numeración de listas y referencias temporales ordinarias. Los corchetes admiten únicamente etiquetas de placeholder de un vocabulario acotado, sin números, enlaces, cierres defectuosos ni IDs de fuentes. `[L1]`, `[D2]`, `[CCF]` y `[Artículo 42]` siguen rechazándose.

Las cantidades o duraciones detectadas con contexto jurídico conservan el requisito de evidencia; también se mantienen las detecciones de afirmaciones jurídicas y se corrige la omisión de segunda persona «puedes apelar». La salida mixta/jurídica mantiene su política estricta por defecto y la comprobación de fuentes, citas, números y respaldo por párrafo. Los mensajes de usuario no pueden activar opciones de validación. Estas reglas son léxicas: no prueban corrección semántica o competencia profesional.

No se modificaron el modelo base, su catálogo, el historial del abogado ni los adaptadores nocturnos. El candidato de entrenamiento rechazado permanece inactivo.

## Pruebas

- **374/374** pruebas Node aprobadas después de la corrección final. Incluyen cuatro pruebas nuevas de cantidades/listas, placeholders, rechazo de afirmaciones/citas jurídicas sin fuente y el recorrido de servicio que conserva la salida del modelo.
- **54/54** pruebas dirigidas de conversación, contexto, respuesta mixta y fuentes, aprobadas.
- TypeScript/Vite: compilación aprobada; comprobación de sintaxis de los verificadores y `git diff --check` aprobados.
- Inferencia real local: **8/8 turnos** aprobados con el modelo base y workspace temporal sintético; evidencia `artifacts/chat-general-20261104/source-base-real-v2.json`.

Los ocho turnos cubren saludo, lista de tres ideas, «2 + 2 = 4», correo con placeholders, presentación de nombre/profesión, recuerdo del nombre, aislamiento de otro chat y solicitud de contrato no adjuntado. Los cinco primeros usan generación real; el recuerdo y la ausencia del nombre usan memoria extractiva acotada; pedir un contrato ausente utiliza aclaración del servicio. No se atribuyen esas tres respuestas al modelo.

El primer test nuevo detectó una omisión previa al reconocer «puedes apelar»; se corrigió y se repitió la suite. No se ocultó la falla. El primer build nativo no encontró Cargo en PATH; el segundo detectó ausencia del target Intel en la toolchain actual. Se corrigió la ruta y se instaló `rust-std` Intel mediante Rustup oficial antes de volver a compilar. No se descargaron modelos ni se compraron servicios.

## Instalación y límites

En la inspección inicial existían `/Applications/LEX AI.app` 0.4.11 y `/Volumes/LEX AI/LEX AI.app` 0.4.2; no había proceso LEX AI activo. Esto demuestra dos copias disponibles, no cuál utilizó el dueño. La corrección se empaquetó como 0.4.12 universal y se comprobó con inferencia real del servicio empaquetado antes de actualizar Aplicaciones con copia de respaldo.

Estado de instalación: **0.4.12 instalada en Aplicaciones**, firma local e igualdad de hashes del servicio, router, conversación y validador comprobadas. Respaldo y registro en `artifacts/chat-general-20261104/installed-0.4.12.json`. No se modificó el directorio privado de datos. No equivale a prueba visual de la ventana ni a validación física de Intel/8 GB. Se conservarán resultados posteriores, hashes y evidencia de firma local; no se afirma notarización Apple.

## Hallazgo adicional con el paquete completo

La primera verificación del paquete universal, con la biblioteca real de 35.452 artículos, conservada en `artifacts/chat-general-20261104/package-0.4.12-arm64.json`, **falló**: «¿Cuánto es 2 + 2? Responde sólo el resultado» se transformó en respuesta jurídica sobre el artículo 333 por una coincidencia incidental con «resultado». El ensayo de workspace vacío no había reproducido esa contaminación.

Se añadió una detección cerrada de operaciones aritméticas explícitas, con números/operadores e instrucción de salida opcional. Usa la vía de tarea general y descarta coincidencias documentales/jurídicas no solicitadas después de recuperar. No clasifica como aritmética preguntas sobre plazos, impuestos, documentos ni artículos. Se añadió prueba de router y una fuente sintética con la palabra «resultado» a la prueba del servicio; ambas pasan, junto con los controles legales existentes. La verificación final del paquete se repite con salida nueva, sin sobrescribir el fallo.

## Verificación final de Apple Silicon e instalación

El segundo ensayo del paquete completo pasó: `artifacts/chat-general-20261104/package-0.4.12-arm64-v2.json`, **PASS**, con biblioteca incluida y motor local real. La suma produce «4», la lista mantiene tres puntos y el correo conserva placeholders ordinarios sin pedir fuentes. El verificador comprueba también arranque offline, integridad del modelo, firma, arquitectura, controles de acceso y chats aislados. La prueba x64 bajo Rosetta se registra aparte; no equivale a un Intel físico.

La versión instalada se respaldó antes de sustituirla y se verificó la firma después de copiar. La aplicación estaba cerrada durante el cambio. No se tocaron expedientes, historial ni preferencias del despacho. La ventana nativa no se abrió para inspeccionar datos del usuario: la evidencia de respuestas procede del servicio empaquetado con fixtures sintéticos, no de una captura de su workspace.

La verificación x64 bajo Rosetta terminó **PASS**, con los siete turnos del servicio empaquetado: `artifacts/chat-general-20261104/package-0.4.12-x64.json`. El instalador antiguo `/Volumes/LEX AI` (0.4.2) se desmontó normalmente, sin forzar; la única copia instalada para usar es `/Applications/LEX AI.app` 0.4.12. No se afirma validación en Intel físico ni en 8 GB, notarización o retest visual nativo.

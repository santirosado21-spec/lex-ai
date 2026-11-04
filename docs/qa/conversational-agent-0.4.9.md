# LEX AI 0.4.9: agente conversacional

Fecha: 2026-11-03. Cambios de esta entrega implementados e integrados por Codex. No se incorporó código de Claude y se respetó la instrucción de no volver a usarlo.

## Comportamiento

Panel lateral con Nuevo chat, búsqueda del historial local, selección del contexto y conversaciones por asunto. En ventanas de hasta 1100 px, el botón Chats abre un diálogo lateral con cierre por Escape y retorno de foco. El historial y el contexto seleccionado sobreviven a recargar; las conversaciones generales siguen disponibles sin asunto. El envío usa el mismo asistente automático y la memoria permanece aislada por despacho, asunto e hilo.

Se corrigió que al recargar se seleccionara el primer asunto aunque el usuario hubiera elegido una conversación general. El título del chat deriva de su primer mensaje. No se añadió eliminación ni renombrado de conversaciones en esta entrega.

## Verificación

- TypeScript y Vite: PASS.
- Suite Node: 348/348.
- `scripts/ui-conversation-smoke.mjs`: PASS; API real y respuestas explícitamente sintéticas, múltiples chats, memoria de contexto en las llamadas, búsqueda, persistencia, aislamiento entre asuntos, diálogo a 1000 px, teclado y ausencia de desbordamiento a 1440/768/390/320 px.
- `scripts/ui-hig-smoke.mjs`: PASS; navegación y disposición de escritorio. Esta prueba no representa una revisión independiente de Apple HIG.
- `scripts/ui-prompt-limit-smoke.mjs`: PASS; voz sintética, límite accesible, recuperación, claro/oscuro y 320 px.
- Compilación Tauri universal: PASS; ejecutable nativo con arm64 y x86_64, Node 22.22.3 universal construido desde los binarios oficiales con SHA256 verificado y motor privado universal.
- Inferencia real del paquete arm64: **PASS**, [JSON](../../artifacts/lex-chat-0.4.9-arm64-check.json). Tres turnos sintéticos: respuesta 1,18 s; recuerdo «Jacaranda» 1,04 s; hilo aislado 1,43 s.
- Inferencia real del paquete x64 bajo Rosetta: **PASS**, [JSON](../../artifacts/lex-chat-0.4.9-x64-check.json). Tres turnos sintéticos: respuesta 8,58 s; recuerdo «Jacaranda» 9,85 s; hilo aislado 20,18 s. Backend x64 confirmado y motor forzado a x86_64; no es validación de un Intel físico ni de 8 GB. El componente opcional de dictado incompatible se rechaza antes de descargar o ejecutar.

## Fallo real conservado y corrección

La primera ejecución real saludó correctamente pero repitió el saludo al pedir recuperar «Jacaranda». Evidencia: `artifacts/lex-chat-0.4.9-arm64-first-failure.json` y `artifacts/lex-chat-0.4.9-arm64-first-failure-turns.json`. El historial se entregaba al modelo pequeño dentro del mismo JSON que la pregunta nueva; se sustituyó por roles nativos user/assistant y una pregunta actual final. Se conserva la selección de turnos, la memoria extractiva y los presupuestos de `buildUnifiedContext`, así como la comprobación de salida sin fuentes verificadas. Una prueba comprueba el orden de roles y la última pregunta, y la prueba de persistencia verifica la memoria como datos no confiables. La aceptación exige repetir inferencia real, no solo pasar mocks.

La siguiente ejecución real recuperó correctamente «Jacaranda» (1,04 s), pero la pregunta personal en un hilo nuevo encontró coincidencias jurídicas por «palabra»/«trabajo» y entró indebidamente al formato fundamentado. Evidencia conservada: `artifacts/lex-chat-0.4.9-arm64-second-failure.json`. Se diagnosticó el origen en el uso de coincidencias de recuperación después del router conversacional. Las solicitudes explícitas de recordar nombre, palabra o presentación mantienen la recuperación acotada, pero descartan esos hits como evidencia y pasan al chat; las preguntas sobre plazos y despidos siguen entrando a consulta jurídica. Se añade comprobación de esa distinción.

## Requisitos y límites

macOS 14 Sonoma o posterior, objetivo mínimo de 8 GB RAM y 10 GB libres para instalar y conservar el paquete y datos iniciales. La documentación oficial del motor permite Apple Silicon y x86, este último con CPU: https://docs.ollama.com/macos . La RAM mínima es un objetivo de producto, no una medición en hardware físico de 8 GB. No se dispone de validación física Intel. El dictado empaquetado se identifica explícitamente como arm64 y se rechaza en Intel antes de descargar o ejecutar; la conversación escrita es independiente.

Firma local ad hoc; sin notarización Apple. La distribución validada por Gatekeeper sigue pendiente. Ningún mecanismo de seguridad del sistema fue desactivado. El paquete contiene el modelo base pequeño, no el candidato experimental en entrenamiento. Documentos e inferencia permanecen locales. El instalador no incluye el almacenamiento privado del desarrollador.

## Reproducción

```sh
npm run build
npm test
node scripts/ui-conversation-smoke.mjs
LEX_TARGET_ARCH=universal LEX_NODE_SOURCE=/ruta/node-universal node scripts/prepare-desktop.mjs
# Cargo requiere los targets aarch64-apple-darwin y x86_64-apple-darwin.
node_modules/.bin/tauri build --target universal-apple-darwin --bundles app
LEX_APP_PATH='src-tauri/target/universal-apple-darwin/release/bundle/macos/LEX AI.app' bash scripts/sign-local.sh
LEX_VERIFY_CHAT=1 node scripts/verify-package.mjs 'src-tauri/target/universal-apple-darwin/release/bundle/macos/LEX AI.app' artifacts/lex-chat-0.4.9-arm64-check.json
LEX_VERIFY_ARCH=x64 LEX_VERIFY_CHAT=1 node scripts/verify-package.mjs 'src-tauri/target/universal-apple-darwin/release/bundle/macos/LEX AI.app' artifacts/lex-chat-0.4.9-x64-check.json
LEX_TARGET_ARCH=universal LEX_APP_PATH='src-tauri/target/universal-apple-darwin/release/bundle/macos/LEX AI.app' bash scripts/package-dmg.sh
```

Las pruebas x64 ejecutadas en Apple Silicon usan Rosetta; no equivalen a medir un Intel físico. Las llamadas con inferencia se serializan frente al entrenamiento mediante un lock propio, que debe retirarse al terminar la verificación. No se modifica la receta ni los checkpoints de entrenamiento.

## Entrega final

Instalador: [LEX AI 0.4.9 universal](../../artifacts/LEX-AI-0.4.9-universal.dmg). Firma ad hoc verificada y `hdiutil verify`: **PASS**.

Tamaño: 2,240,780,369 bytes. SHA256: `d68d6ef74b618c836c5a4f2ba92d98c50af9e853b0862d4ff003ffe09d7c5b14`.

El modelo real pasó tres turnos en arm64 y x64: saludo, recuerdo en el mismo hilo y ausencia de ese dato en un hilo diferente. El menú pasó las pruebas de interfaz con datos sintéticos. No se envió ningún mensaje ni archivo a Lorenzo, ni se publicó el instalador. La receta de entrenamiento conserva SHA256 `6f2476deead4cfb30636f001cdc3f39a3b20c2e31713992193ac877240bf9639`; no se activó el candidato entrenado. Se retiró únicamente el lock de coordinación de esta entrega y el supervisor existente mantiene su comprobación de recursos.

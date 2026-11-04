# Diálogo, recuperación y contexto — LEX AI 0.4.13

2026-11-04. El dueño aclara que la app no pide fuentes literalmente: **contesta como un bot de RAG**, con respuestas rígidas y orientadas a documentos. El objetivo es una conversación continua que use fuentes cuando hacen falta. La corrección 0.4.12 de listas/corchetes no había evaluado esa calidad. Codex implementa y verifica, sin Claude ni otros modelos externos.

## Evidencia anterior y cambio

`artifacts/dialogue-style-20261104/before-0.4.12.json` captura ocho turnos sintéticos con el modelo base y el servicio instalado. Al decir «Hoy terminé agotado del trabajo» ofrecía documentos, reuniones y preguntas para un cliente. Una historia sobre una llave acababa en abstención por falta de evidencia; pedirla menos dramática producía un error de número/artículo/fecha. Hablar de misterio después de decir que se era abogado también se desviaba a una abstención. Se conservan las respuestas crudas y prompts.

La vía automática buscaba documentos y leyes en cada turno y permitía que coincidencias incidentales cambiaran un turno clasificado como charla a generación jurídica estructurada. Su mensaje system insistía en trabajo para abogados, documentos y borradores, y el historial de chat compartía los 700 tokens reservados a turnos jurídicos, recortando respuestas previas aunque no hubiera fuentes.

Se cambia el contrato de entrada: **diálogo por defecto**. Las solicitudes jurídicas, documentales y seguimientos de respuestas fundamentadas mantienen recuperación acotada y validación de fuentes. Los turnos de charla van directamente a generación conversacional con su propio historial; no buscan ni reciben pasajes. No basta encontrar una palabra en una ley para cambiar el propósito del turno. El router sigue siendo heurístico y puede necesitar ampliación para intenciones no reconocidas; no se afirma clasificación semántica perfecta.

Se usa un mensaje de conversación más sencillo, sin presentar al interlocutor como una ventanilla de documentos. El contexto de chat conserva pares completos de mensajes cuando caben, en roles nativos. Emplea el presupuesto liberado de pasajes, manteniendo contexto total 4.096, reserva 512, máximo 7.000 caracteres y pregunta actual sin truncar. Se omiten turnos anteriores completos cuando ya no caben; la memoria extractiva acotada y el aislamiento por despacho/asunto/hilo se conservan.

La validación de conversación distingue frases cotidianas como «dentro de su bolsillo» o «la historia debe empezar» de afirmaciones jurídicas detectadas. El contrato mixto/jurídico sigue estricto por defecto; las fuentes, IDs y citas por párrafo se comprueban como antes. Estos controles son léxicos y no equivalen a prueba semántica de corrección legal.

## Comparación de estilo: resultado parcial

Se probaron mensajes más largos, ejemplos de tono y un perfil de generación recomendado en la [ficha oficial del modelo](https://huggingface.co/Qwen/Qwen3.5-2B). El perfil más variable se aplicó sólo al experimento local: empeoró la redacción e introdujo inconsistencias/truncamiento. **No se cambió el muestreo de producción**. No se descargaron modelos ni activaron adaptadores. Los ensayos y fallos están preservados junto a `qualitative-review.json`.

La candidata de instrucción mínima (`after-source-v3-minimal.json`) completa los ocho turnos como conversación sin fuentes; la historia ya no produce una abstención jurídica ni error al continuar, y una pregunta general sobre misterio recibe una respuesta sobre ese tema. Esto demuestra una corrección funcional, **no que la naturalidad esté resuelta**.

Persisten torpezas de español, consejos no solicitados tras pedir sólo charla, inconsistencias en una historia y un término inventado al explicar suspenso. Se revisaron las salidas completas; no se califican como buenas por no fallar un assert. Estos ejemplos son desarrollo observado, no una prueba ciega. Los historiales generados difieren entre versiones, así que la comparación de experiencia no se presenta como ablation de una sola variable.

## Pruebas y entrega

- **378/378** pruebas Node aprobadas, incluyendo aislamiento, permisos, rechazo de citas/afirmaciones jurídicas sin respaldo, fuentes oficiales y conversación.
- Cuatro pruebas nuevas verifican historial completo y límites, omisión de turnos sin cortar la pregunta, separación de lenguaje cotidiano/jurídico y ausencia de recuperación durante charla/creación con documentos coincidentes.
- Dos pruebas antiguas exigían recuperar en saludos y convertir una coincidencia vaga en una respuesta jurídica. Se sustituyen por comprobaciones del nuevo contrato: cero búsquedas en saludo/charla, y consulta jurídica explícita con citas. La prueba de offsets/hashes de fragmentos se conserva con una petición jurídica explícita; no se elimina la verificación.
- La suite dirigida inicial expuso esas expectativas antiguas y otra aserción que confundía «usar evidencia» con llamar siempre al método público `search`; se corrigió el test para comprobar el resultado con fuentes, sin exigir una implementación concreta del buscador.
- TypeScript/Vite aprobados. El verificador del paquete añade charla de tres turnos e historia con seguimiento y conserva las salidas. Su PASS es funcional: no acredita naturalidad ni validación profesional.

Estado: **0.4.13 instalada en Aplicaciones**, con respaldo de 0.4.12, firma local y hashes del código comprobados; registro `artifacts/dialogue-style-20261104/installed-0.4.13.json`. El directorio privado de datos no se modificó. No se afirma prueba visual de la ventana ni validación física de Intel o 8 GB. Base y adaptador nocturno rechazado permanecen separados e intactos.

## Regresión de plantilla detectada durante empaquetado

El primer paquete 0.4.13 falló en el correo por campos legítimos que el mensaje mínimo dejó generar: `[día de la semana]` y `[mencionar el motivo general, ej: discutir el avance del proyecto X]`. Se preservan `package-0.4.13-arm64.json` y `general-chat-minimal-prompt.json` como **FAIL**. No se instaló ese paquete.

Se extendieron los inicios de etiqueta admitidos para plantillas con día/mes/año e indicaciones de completar campos. Siguen limitadas a 80 caracteres, sin saltos de línea, corchetes anidados o enlaces; IDs y referencias como `[L1]`, `[D2]`, `[CCF]` y `[Artículo 42]` siguen rechazados. Se mantiene el límite y las comprobaciones jurídicas fuera de esas etiquetas. La reproducción de ese correo se añadió al test; 378/378 pruebas y los ocho turnos de `general-chat-minimal-prompt-v2.json` pasaron con inferencia real. Es una corrección de formato, no una validación del tono.

## Verificación del paquete final

`artifacts/dialogue-style-20261104/package-0.4.13-arm64-v2.json`: **PASS funcional**, doce turnos con motor base real, biblioteca incluida, firma e integridad verificadas. Se confirma en el paquete la charla sin fuentes y la historia con continuación. Se conservaron también las respuestas torpes: el PASS no elimina las limitaciones de `qualitative-review.json`. El muestreo y los pesos permanecen iguales a la base. La prueba x64 bajo Rosetta se registra aparte; no es Intel físico.

Se amplió además el reconocimiento de cambio de tema/charla/creación antes de heredar un seguimiento jurídico: «Y sólo quiero platicar» y «Y escribe un cuento» vuelven a chat, mientras «¿y cuál es el plazo para apelar?» mantiene la vía jurídica. El test del router cubre ambos casos.

La instalación conserva explícitamente la evaluación de naturalidad como **parcial**, no aprobada por estilo. Las respuestas completas antes/después y los ensayos rechazados se mantienen disponibles. No se activó ningún adaptador, no hubo un nuevo entrenamiento y el muestreo determinista de producción no cambió. La ventana del workspace privado no se abrió para inspección; la prueba funcional usa el servicio empaquetado y datos sintéticos.

## Diferencia observada bajo Rosetta

El ensayo completo x64 (`package-0.4.13-x64.json`) se detuvo en la lista: un texto normal sobre «código, documentos y herramientas» se rechazaba porque el validador trataba cualquier «código» como ordenamiento jurídico. El texto crudo de `x64-list-diagnosis.json` confirma un falso positivo, no una respuesta jurídica del modelo. Se desambiguaron «código» y «artículo»: los códigos jurídicos con título y las referencias a artículos numerados/romanos siguen activando el control; programación y artículos de blog no lo hacen por la mera palabra. La política mixta/jurídica mantiene su comportamiento estricto por defecto.

La lista real x64 pasa la corrección (`x64-list-guard-recheck.json`) y las ocho pruebas de guard/contexto pasaron ejecutadas con Node x64 bajo Rosetta. El paquete final se recompone con el recurso JavaScript actualizado, se vuelve a firmar y su recorrido arm64 completo vuelve a pasar (`package-0.4.13-arm64-v3.json`). No se presenta el primer ensayo x64 fallido como aprobado: su recorrido completo no se repitió después; permanece esa limitación de cobertura, sin validación física de Intel.

Una repetición completa de Node tras esa corrección tuvo 377/378 por una carrera en el test previo de concurrencia de dictado (`stt.test.mjs`), sin cambios en el código de audio. Se conserva `artifacts/dialogue-style-20261104/tests-full-with-stt-race.log`; la suite aislada de dictado pasó 5/5 y se repite el conjunto sin inferencia paralela. No se relajó el test ni se modificó dictado para ocultarlo.

La repetición completa sin inferencia paralela pasó **378/378**, con registro `tests-full-final.log`. No se cambió código ni test de dictado. El ensayo fallido, el aislado 5/5 y las pruebas x64 8/8 quedan junto al reporte para no ocultar la carrera previa. La corrección final se recompone en el recurso JavaScript del bundle 0.4.13, se firma de nuevo y se verifica contra el código fuente; una construcción desde cero con el preparador incluye el mismo archivo actualizado.

## Ejemplo del dueño y verificación nativa de la copia activa

El dueño compartió «Hola» respondido con análisis del contrato simulado y tres citas. La inspección del proceso **7375** confirmó que la ventana abierta procedía otra vez de `/Volumes/LEX AI/LEX AI.app`, **0.4.2**, mientras `/Applications/LEX AI.app` contenía **0.4.13** con hashes iguales al código probado. Se confirmó en la UI el mismo texto que compartió el dueño. No se atribuye esa respuesta a la nueva versión, al entrenamiento o sólo al tono del modelo.

Se observó que el campo de entrada estaba vacío y Preguntar deshabilitado; se cerró la app mediante su menú normal, sin descartar un borrador, y se comprobó la salida de sus tres procesos. Se desmontó normalmente el disco del instalador y se abrió la ruta explícita de Aplicaciones. Sus procesos nativo/backend/motor proceden ahora de esa ruta.

Se creó un chat nuevo dentro del **mismo asunto sintético**, conservando el contrato de prueba e **Investigador jurídico** seleccionado. Se escribió y envió **Hola** desde la ventana nativa. La respuesta visible fue **«¡Hola! ¿En qué puedo ayudarte hoy?»**, sin botones de citas ni análisis de contrato. Los chats previos permanecen; no se borró ni reescribió el historial. La ventana quedó abierta en el chat nuevo correcto.

Evidencia: `artifacts/dialogue-style-20261104/native-greeting-active-copy-20261104.json`. Esta sí es comprobación visual nativa de esa regresión puntual; no convierte las limitaciones de naturalidad anteriores en aprobadas. Para futuras actualizaciones, verificar la ruta del **proceso activo**, además de los archivos instalados, y preservar texto no enviado antes de cambiar de copia.

### Causa de la reapertura recurrente: acceso del Dock

La entrada persistente de LEX AI en el Dock apuntaba a `file:///Volumes/LEX%20AI/LEX%20AI.app/`, por lo que el acceso conservaba la copia del instalador. Se reparó esa única entrada para apuntar a `file:///Applications/LEX%20AI.app/`, conservando posición y las otras apps fijadas; se retiró el bookmark obsoleto. Se respaldaron las preferencias originales fuera del repositorio, con permiso 0600, antes de cambiar la referencia y recargar normalmente el Dock del usuario. No se cambió su apariencia ni sus otras entradas.

Después de recargar se volvió a leer la referencia y se confirmó el destino de Aplicaciones; la app activa sigue siendo 0.4.13 y el disco antiguo permanece desmontado. Registro: `artifacts/dialogue-style-20261104/dock-shortcut-repair.json`. La vía UI de Dock no estuvo disponible; se usó la API de preferencias `defaults` conservando el dominio existente. La prueba nativa del saludo sí se realizó desde la ventana de la aplicación.

# Escritorio 0.4.4 — conversación y distribución autónoma

Petición del dueño, 2 de noviembre de 2026: conversación real con el modelo, además de recuperación jurídica, y un instalador que incluya los recursos sin exigir una instalación separada del motor.

## Comportamiento entregado

- **Conversar** es el modo inicial: inferencia local de texto, mensajes visibles en orden e historial reciente del ámbito elegido. Admite conversación general del despacho sin crear asunto ni importar documentos. No recupera documentos privados ni leyes; sus respuestas se identifican como conversación sin fuentes verificadas.
- **Con fuentes** conserva habilidades, recuperación, controles de citas y DOCX. Se corrigió la resolución de códigos federales y Constitución expresamente solicitados desde un asunto CDMX, sin ampliar el acceso a documentos de otros asuntos.
- Cambiar de modo conserva el borrador y cancela la petición anterior. Cambiar de asunto mantiene separados los historiales. Un fallo del dictado opcional no bloquea el espacio.
- El paquete incorpora únicamente el candidato ligero fijado de **1.945.781.358 bytes**, el motor privado, la biblioteca y sus avisos/licencias. El escritorio prepara los archivos locales al abrirse; no descarga modelos en ese recorrido ni carga pesos para inferencia hasta preguntar. Comprueba integridad, espacio necesario más reserva, y permite detener la preparación. No modifica los candidatos experimentales grandes.

## Evidencia

- Build de TypeScript/Vite y bundle Tauri: PASS.
- Suite final: **230/230**, sin pruebas omitidas.
- UI conversacional: PASS con API real e inferencia sintética explícita; conversación general, historial, aislamiento, cancelación, borrador, modos y ventanas de 1440/768/390/320 px.
- Smokes previos principal, compositor y avatar: PASS tras seleccionar explícitamente Con fuentes para sus recorridos jurídicos.
- **Inferencia real:** presentación de una abogada ficticia, redacción de correo y posterior reducción del mismo correo. PASS, sin asunto, documentos ni llamadas externas; tiempos de generación **2.872 / 2.598 / 2.706 ms** en esta corrida. `artifacts/desktop-audit/chat-workflow-real.json` conserva las respuestas completas.
- El verificador del paquete arranca el backend desde una carpeta de datos nueva, con PATH limitado, motor privado y modelo incluido; comprueba que llega a listo sin entrar en descarga. Firma ad hoc, hashes de módulos y capas, versión y biblioteca se verifican contra el árbol actual.

## Fallo observado y conservado

La pregunta «¿Cómo me llamo y a qué me dedico?» después de una presentación produjo confusión entre usuario y asistente. El historial sí se conserva y se envía con su ámbito correcto; las pruebas con diferentes instrucciones no resolvieron de forma fiable esa confusión. No se presenta como memoria personal validada. Se conserva `artifacts/desktop-audit/chat-identity-recall-failure.json`.

Se contrastó la plantilla nativa con un formato explícito basado en la [plantilla del editor](https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/chat_template.jinja) y el [modo raw documentado del motor](https://github.com/ollama/ollama/blob/main/docs/api.md). El contraste no mejoró el caso; se retiró ese cambio para no entregar complejidad sin beneficio demostrado. Resultados de diagnóstico conservados en `artifacts/desktop-audit/memory-native-failures.json` y los registros temporales de la sesión. No se afirma que la plantilla fuera la causa raíz.

## Límites

La conversación puede equivocarse y no acredita conocimientos jurídicos ni una memoria fiable de todos los detalles. Para conclusiones jurídicas se mantiene el recorrido Con fuentes y la revisión profesional. Las mediciones se hicieron en esta Mac de 24 GB; no certifican rendimiento en hardware físico de 8 GB. Firma ad hoc no equivale a notarización. No se compró capacidad, publicó un release ni envió documentos a servicios externos.

## Participación

Codex coordinó, implementó conversación, inicio e integración, ejecutó inferencia real y verificó el conjunto. Dos trabajadores Codex implementaron el empaquetado y la interfaz con archivos asignados; el responsable de empaquetado hizo además una revisión de backend y detectó dos detalles de ámbito y reserva de disco que se corrigieron. Claude fue consultado por CLI para interacción y devolvió `usage_limit_reached` HTTP 429; no se atribuye a Claude una revisión completada. Se aplicaron dsystem, frontend-design como guía disponible y React Best Practices.

## Artefacto y actualización local

Instalador `artifacts/LEX-AI-0.4.4-arm64.dmg`: **2.202.734.474 bytes**, SHA-256 `ccc745e2ca40a4a3feb0e8509145dec879e50b005647ec4b59eb0ee0c5787942`. Imagen comprobada por hdiutil. Verificador final **PASS** en `artifacts/desktop-audit/package-044-final.json`. La copia instalada se actualizó a 0.4.4 conservando datos; app anterior y copia SQLite consistente en `artifacts/desktop-update/before-0.4.4-20261103T001938Z/`. El arranque nativo mostró primero verificación y luego LEX AI listo, sin pulsar preparar, y permitió seleccionar Conversación general. No se afirma instalación en un segundo Mac limpio.

Comprobación nativa adicional: en la copia instalada se seleccionó Conversación general, se envió una presentación profesional y se observó una respuesta real de organización de trabajo, sin citas de un contrato. Captura observada directamente mediante Computer Use. Se dejó la app abierta y lista. El seguimiento de tres turnos se probó por separado contra el servicio con inferencia real; no se atribuye ese recorrido completo a la ventana nativa.

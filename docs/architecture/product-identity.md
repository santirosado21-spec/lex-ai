# Identidad del producto: LEX AI

Decisión del dueño, 30 de octubre de 2026: la experiencia se presenta como LEX AI, cuyo comportamiento combina instrucciones de tarea, habilidades, fuentes recuperadas y contexto del asunto. No se muestra el nombre del modelo subyacente en el flujo ordinario.

## Implementación

`src/assistant-presentation.ts` define etiquetas y mensajes del producto por estado conocido. Ni nombres/IDs del runtime, ni mensajes o errores arbitrarios se interpolan en el panel, sidebar o bento. Estados desconocidos muestran «Estado no disponible». Fallos de las operaciones engine se convierten en un mensaje de producto desde el cliente API.

El laboratorio pasa a «Evaluación de LEX AI»: conserva estado, progreso, cantidades conocidas y resultado técnico, sin mostrar modelo base, candidato, rutas, métricas de implementación ni texto libre del supervisor. Las etiquetas y campos visibles están enumerados; no se muestran claves desconocidas. La landing local y su catálogo usan la misma identidad y explican habilidades/contexto, sin atribuirse la creación de tecnología de terceros ni prometer exactitud jurídica.

El mensaje de sistema identifica al asistente como LEX AI y describe su contexto de trabajo; no inventa detalles de implementación o entrenamiento. Se preservan las reglas de fuentes, citas, alcance por asunto y salida estructurada. El error de generación anterior a inicialización también utiliza la identidad de producto.

## Límites deliberados

Es una capa de presentación, no un mecanismo de secreto o cifrado. El backend, los archivos locales, el catálogo técnico y los diagnósticos internos conservan procedencia verificable. No se eliminan licencias, avisos de terceros ni registros históricos. Tampoco se filtran documentos, fuentes o citas para borrar palabras: el contenido del despacho conserva su integridad.

No cambia el modelo, sus pesos, el corpus ni la selección del candidato experimental. Los textos sobre funcionamiento local, descarga inicial, requisitos y limitaciones se mantienen. La landing sigue sin despliegue remoto por los accesos pendientes y sin descarga pública; se modifica su fuente local.

## Verificación

`node scripts/ui-product-identity-smoke.mjs` usa nombres, IDs, rutas y mensajes técnicos sintéticos deliberados en la API y el registro de evaluación. Comprueba que no aparecen en el DOM de onboarding, inicio, barra lateral, configuración, paleta o evaluación, incluidos estados desconocidos y errores de inicialización. El progreso real sigue visible. No se afirma ocultación frente a inspección de archivos o red local.

Las skills dsystem y frontend-design global compartida ya consultadas siguen aplicando. Este ajuste de identidad y textos ejecuta la dirección explícita del dueño; no introduce una composición visual nueva ni requiere otra consulta de diseño de Claude.

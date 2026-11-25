# Transiciones de ficha y balance de demo local

Corte: ebe9afd, 25 de noviembre de 2026. Registro de recorrido, no cambio de
producto ni prueba de app nativa. No se invocaron modelos ni biblioteca ausente.

## Cambios sin guardar: recorrido medido

Se usaron dos fichas sintéticas, componente real, Chrome local y API/store del
producto. El guion temporal reutilizó harnesses existentes y se retiró del repo.

- Editar comentario de ficha A y cancelar cambio a B conserva ID y comentario.
- Cancelar cierre o descarte conserva comentario y beforeunload preventivo.
- Aceptar cambio abre B; volver a A recupera guardado, no edición descartada.
- Aceptar cierre y reabrir recupera A guardada; las dos fichas persistidas no
  cambian por descartar una edición local.
- En IntakePilot completo, comentario pendiente bloquea tarea, biblioteca y
  documentos. Cancelar cierre mantiene comentario y bloqueos. Descartar con
  confirmación recupera guardado y habilita otra vez tarea.

Recorrido final: 1/1 PASS, 6.83 s. Prueba existente draft-edit-safety también
PASS. No hubo pérdida silenciosa reproducida y no se propone parche funcional.
El primer intento de verificar tarea usó un selector accesible equivocado;
se corrigió a #intake-task y se repitió el recorrido completo con resultado PASS.

No se probó cambio de asunto: el piloto de fichas no expone ese selector una vez
guardado. App tiene otra ruta con selector de asunto y no monta este componente.
No se inventó una transición mediante un harness nuevo. La comprobación previa
de ausencia de dos textos en SQLite solo es ausencia textual, no demostración
de cifrado; no se amplía aquí esa afirmación.

## Balance frente a demo útil para abogado

Capacidades medidas en esta secuencia de trabajo, con sus límites:

- Lectura de soporte sintético y comparación local de dos versiones, con
  cambios de número/negación visibles. La importación usó respuestas locales
  simuladas existentes; no prueba anonimización real del modelo.
- Ficha manual con comentario, contexto declarado y citas comprobadas contra
  copia local. No es análisis jurídico ni comprobación de aplicabilidad.
- Búsqueda Unicode corregida, selección ambigua explícita, guardado y reinicio
  con cita original [46,54) conservada. Regresión integrada publicada ebe9afd.
- Word explícito de una ficha guardada, con advertencia histórica, autoría y
  salida sin cifrado. DOCX y renders reales inspeccionados en revisión previa.
  No mezcla con Word de pendientes ni envía a terceros.
- Control documental y Word de pendientes son otro producto ya recorrido,
  no una revisión contractual consolidada.

Bloqueos reales, no sustituidos por tests sintéticos:

- Modelo local detenido por techo de recursos antes de respuesta funcional.
  No permite dictamen de calidad/privacidad; no repetir esta noche.
- Falta artefacto SQLite público exacto en rutas permitidas. Staging ahora
  exige identidad congelada, pero faltan pruebas con DB real y paquete real.
- No hay validación nativa completa, distribución lista para usuarios ni
  valoración jurídica de un abogado. El cotejo del CCF observado no acredita
  vigencia ni aplicabilidad. No promover capturas/candidatos por conveniencia.

## Propuesta, no implementación

La demo que sí puede defenderse hoy es auxiliar local de revisión manual:
leer/cotejar, escribir observaciones con evidencia y entregar una ficha Word.
No presentarla como abogado automático ni investigación jurídica completa.

La siguiente unidad de producto de mayor valor que no necesita modelo ni DB
sería una entrega explícita de varias fichas seleccionadas del mismo expediente:
un Word de revisión manual que evite descargar y reunir a mano una ficha por
cada cláusula. La fricción se deriva del límite actual verificado de exportar
UNA ficha, no de un fallo de persistencia. Todavía no se midió una sesión de
abogado con muchas fichas; es una propuesta de valor, no necesidad confirmada.

Esto amplía deliberadamente la unidad elegida antes. Requiere decisión antes
de implementar: no mezclar pendientes ni borradores, sin autoexport, preservar
cada revisión/cita/contexto/autoría, histórico por ficha, selección y orden
explícitos, validación atómica del snapshot y advertencia de archivo sin cifrar.
No se propone otra demo/framework ni más microtests como sustituto del avance.

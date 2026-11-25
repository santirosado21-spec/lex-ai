# Word: aplicación de sugerencias con objetivo y revisión

Base main eac990bde919f2271bb6cf2081da1cbf20e2b88f, 25 nov 2026.

## Defecto reproducido

El componente real word.js reemplazaba una selección ajena por el reemplazo de
la sugerencia. Si no había reemplazo, utilizaba el mensaje explicativo, incluso
una observación organizativa. También conservaba selección de una revisión
anterior al pedir otra revisión que fallaba. La nueva regresión ejecutada sobre
main falla porque observa una escritura en una selección ajena.

## Cambio

- Exige target y replacement no vacíos y distintos. Notas sin sustitución y
  referencias cuyo reemplazo es idéntico quedan para revisión manual.
- Muestra texto requerido y reemplazo. Exige igualdad exacta, sin trim ni
  normalización, entre selección Word y target antes de cambiar tracking o texto.
- Conserva en memoria el body.text revisado y lo coteja antes de escribir.
  Invalida selección/resultados al pedir revisión, cambiar tipo de documento o
  terminar una aplicación. Bloquea doble revisión/aplicación mientras esperan.
- Si sync falla tras encolar el cambio, no dice que no cambió nada: pide
  comprobar Word y exige nueva revisión antes de reintentar.
- No cambia auditoría, puente, modelos, corpus, privacidad ni permisos.

## Medido

Chrome con HTML/JS reales, auditOfficeDocument real vía ruta HTTP interceptada,
Office/Word simulados y sólo documentos sintéticos. Casos: selección ajena sin
escritura ni cambio de tracking, positivo exacto, nota organizativa y referencia
sin cambio bloqueadas, body distinto, fallo/nueva revisión, tipo cambiado,
cambio durante lectura, respuesta tardía tras cambiar tipo y sync fallido después de encolar escritura. UI 1 PASS.
Mutar por separado la guarda de respuesta tardía también hace fallar el caso;
la vista previa conserva CSS actual (texto corrido, legible).
Mutar por separado igualdad de selección y cotejo body hace fallar la regresión;
ambas restauradas. Puente/HTTPS existentes 6 PASS. Workflow exacto: 25 UI PASS,
341 contratos = 338 PASS + 3 SKIP, total 366 = 363 PASS + 3 SKIP. Build PASS,
node --check y git diff --check PASS. Capturas 390 y 1280 inspeccionadas: texto
y acciones legibles, sin desbordamiento horizontal; captura desde scroll 0.

## No medido / límites

No Microsoft Word real, Mac ni inferencia. body.text no detecta cambios sólo de
formato ni distingue ubicaciones repetidas con el mismo texto exacto. El usuario
elige la selección. Office.run no es una transacción atómica: una edición externa
entre la lectura sincronizada y el commit puede competir; este corte no promete
eliminar esa carrera. No se cambia automáticamente modo de tracking al terminar,
sigue el comportamiento anterior de trackAll. El reemplazo genérico existente
para placeholders se muestra explícitamente, no completa el dato ni interpreta
su contenido. No se rediseña el complemento ni se activa distribución.

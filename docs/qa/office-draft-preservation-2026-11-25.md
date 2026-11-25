# Office: conservar edición local de borradores

Preparación LOCAL, base main 3fdca9a80d88b1c6db164dd3c3afbadfe26d0a7e.
No publicado ni desplegado por cuota Vercel agotada. 25 nov 2026.

## Defecto

El botón Ver conversación del asunto borraba editores con cambios sin guardar.
La regresión nueva sobre base falla: no aparece confirmación y la edición se
pierde al reemplazar el historial. La misma función se comparte entre Word,
Excel y SharePoint. No depende de inferencia.

## Cambio

assistant.js sigue texto guardado por editor y conjunto de editores sucios.
Antes de recargar historial pide confirmación para descartar; si se cancela no
hace petición. Revalida después del await si hubo escritura local mientras
llegaba historial. Una apertura/guardado de versión en curso retiene el historial.

Guardar captura texto enviado; al terminar actualiza versión y baseline sólo
para ese texto, sin sobrescribir lo que se escribió durante await. Si hay texto
posterior, lo conserva como sin guardar y lo avisa. Fallo mantiene baseline,
versión y edición. beforeunload pide confirmación al salir/recargar con cambios
sin guardar o apertura/guardado pendiente. No hay autosave ni almacenamiento
nuevo de texto privado en localStorage/sessionStorage, ni cambio de backend.

## Medido

- 3 UI PASS: HTML y JS reales de Word, Excel y SharePoint, endpoints de
  historial/borradores simulados con sintéticos. SharePoint usa opener simulado
  y tenant sintético; no tenant ni Microsoft real.
- Casos en cada host: cancelar/aceptar descarte, edición durante carga de
  historial, historial mientras guardado pendiente, edición durante guardado,
  guardado fallido y reintento con expectedVersion correcto, recarga cancelada.
- Ajuste tras revisión focal: espera explícita a botón Guardar habilitado tras
  respuesta y aviso específico de edición posterior; historial en vuelo termina
  durante apertura de versión retenida por la prueba. Mutaciones aisladas
  savedText=editor.value y quitar pendingEdits post-await fallan 3/3 cada una;
  ambas restauradas. Sin cambio de lógica.
- Mutación aislada de confirmación inicial hace fallar Word, restaurada.
- Workflow: 369 tests, 366 PASS, 3 SKIP, 0 FAIL. Puente/HTTPS/borradores 9 PASS.
- Build, diff --check y sintaxis JS PASS. Chrome 390/1280 Word inspeccionado:
  aviso y texto editado legibles, sin overflow. Los otros hosts corrieron los
  mismos casos y capturas, sin pretender que eso sea Microsoft real.

## Límites

Cambios siguen sólo en memoria hasta Guardar. beforeunload depende del host y
navegador, no protege crash/cierre forzado; un host Office puede no mostrar ese
aviso. No probado Word/Excel/SharePoint real ni Mac. Fallo de red tras guardado
servidor puede producir conflicto de versión al reintentar: no se sobrescribe
silenciosamente y la edición local queda; no se agrega reconciliación nueva.
El texto de selección para importar al asunto queda fuera de este corte.
No modelos, nube, datos cliente, corpus, distribución ni permisos nuevos.

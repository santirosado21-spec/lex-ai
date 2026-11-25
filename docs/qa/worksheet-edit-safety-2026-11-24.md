# Control documental: cambios sin guardar

Base: e891004. Continúa la protección de edición local del borrador en la otra superficie editable del mismo flujo: IntakeTradeWorksheet.

Antes: onDirty impedía cambiar tarea o exportar mientras se editaba un renglón, pero cerrar/recargar la ventana o pulsar Descartar y recargar perdía el cambio sin advertencia.

Ahora: beforeunload solo mientras hay edición, confirmación al descartar y texto visible que pide guardar antes de cerrar o recargar. La recarga confirmada conserva la edición si falla la lectura. Guardar o recargar con éxito, o volver a los valores guardados, retira la advertencia. No hay autoguardado, nueva persistencia, cambio de API, estados, exportación ni proveedor.

Prueba real del componente: el test existente falla antes por ausencia de protección de salida. Después cubre recarga Chromium real cancelada, descarte cancelado, fallo al guardar, guardado correcto, descarte confirmado con lectura fallida y correcta, y reversión al valor guardado. Se conserva el resto de la regresión de progreso manual. El test ya está conectado a CI.

Capturas del componente con estilos reales, datos sintéticos y error de guardado a 1280 y 390 px: aviso legible, valores conservados, sin desbordamiento horizontal. No se probó cierre nativo Tauri/macOS ni recuperación tras caída o corte de energía. No se ejecutó inferencia ni se activó corpus.

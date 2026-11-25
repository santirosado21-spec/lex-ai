# Fecha del documento en la zona del servicio

Base: 20a2376, unidad independiente de propagación de advertencias. El encabezado DOCX usaba UTC aunque workspace-utils y SourcesView muestran fechas en America/Mexico_City. createService ya recibe plannerTimeZone, con ese mismo valor por defecto; no existe una preferencia de zona documental separada en el espacio de trabajo.

Se usa la configuración existente plannerTimeZone para exportaciones de respuestas, propuestas aprobadas, escritos y piloto. buildAnswerDocx acepta timeZone explícita y conserva America/Mexico_City como valor por defecto del producto, no zona universal ni inferida del host. Se rechaza zona inválida. No se añade configuración de usuario ni cambia timestamp, respuesta, cita o expediente guardado.

Un valor YYYY-MM-DD representa un día civil y no se desplaza al día anterior. Fechas de recuperación suministradas por la fuente conservan su texto original; solo su fallback a fecha de respuesta usa la zona documental. Excel/PowerPoint y lista de pendientes sin fecha no cambian.

Pruebas antes FAIL/después PASS: 2026-11-25T02:30:00Z produce 24 de noviembre en CDMX y 25 en Tokio; 06:30Z produce 25 en CDMX. Zona inválida rechazada, fecha sin hora intacta, metadata de fuente intacta y entrada sin mutación. Servicio real con plannerTimeZone Asia/Tokyo exporta respuesta almacenada de 2026-11-24T20:30Z con fecha 25, sin modificarla. Regresiones de citas, borradores y piloto pasan. Test conectado a CI portable.

Render del documento sintético de cruce UTC/CDMX inspeccionado: encabezado 24 de noviembre, texto de prueba legible en una página. Esta muestra no tiene citas por diseño y no es evidencia de propagación de fuentes. No se interpreta fecha jurídica de operación ni se cambia la fecha de un acto. No se probó Mac/Tauri.

# Lista interna de pendientes documentales

Base: 2204920. Reutiliza los controles locales de valoración/pedimento y sus estados guardados. No activa las skills S1 offline ni genera análisis jurídico local o remoto.

Nueva descarga Word: lista interna separada en Por revisar (definir siguiente paso), Solicitado (dar seguimiento) y Recibido (cotejo pendiente). Omite Cotejado/No aplica. Conserva cada renglón, incluidas copias, su indicación existente de qué cotejar, referencia y observación del usuario. No inventa documentos faltantes, responsables, plazos, montos ni nuevas obligaciones. Si no hay pendientes lo declara sin concluir cumplimiento. Un estado desconocido bloquea la nota.

Endpoint intake.exportWorksheetPending exige el mismo expediente cifrado y tarea admitida que exportWorksheet. Solo lee estados guardados, no borradores del formulario. El botón se bloquea durante edición sin guardar. No actualiza el expediente ni consume envíos. La nota contiene datos del expediente y se descarga localmente, sin compartirla. No es carta al cliente ni calificación de cumplimiento.

La exportación usa un documento específico, no la plantilla general de análisis jurídico, para evitar encabezados o fuentes que sugieran una opinión legal. El Excel existente conserva su contrato y contenido. No se alteran proveedores, corpus ni reglas de privacidad.

Verificación: pruebas de grupos, copias, referencias, ausencia de pendientes y rechazo de estado desconocido; endpoint real dentro de piloto cifrado con escritura y lectura DOCX mediante mammoth; bloqueo de tarea no admitida y cero envíos adicionales; componente real prueba descarga y bloqueo durante edición. La nota sintética se convirtió a PDF con LibreOffice y se inspeccionó visualmente: una página, títulos y estados legibles, sin encabezado de análisis jurídico ni fuentes vacías. UI a 390 px inspeccionada sin overflow. No se usaron datos reales ni se probó el diálogo nativo Tauri.

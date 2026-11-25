# Citas en encabezados Word

El exportador convertía IDs conocidos del cuerpo y de las listas en notas al pie, pero omitía la conversión cuando la misma cita estaba en un encabezado Markdown. Resultado: ID interno visible, sin nota asociada en el punto del encabezado.

Los encabezados H1/H2/H3 usan ahora el mismo reconocimiento de citas, manteniendo su estilo heredado. Los runs de encabezado no fuerzan tamaño/fuente de párrafo normal. Citas repetidas conservan Ibíd. y primera nota; corchetes desconocidos permanecen literales. No cambia la fuente guardada, el texto original ni el mapa de referencias.

Prueba antes 1 FAIL/1 PASS; después 12 PASS entre citas, fecha, piloto y escritos. Inspección OOXML comprueba tres niveles, cuatro notas consecutivas, repetición y ausencia de IDs internos en encabezados; metadata y tabla de fuentes conservadas. Fixture sintético directo del exportador DOCX, no ejecución del pipeline de generación. Render LibreOffice de una página inspeccionado: jerarquía, superíndices, cuatro notas y dos fuentes legibles, sin choque con pie de página. Build sin errores. Test ya existente de exportación por servicio continúa pasando y se añade a CI portable.

Esto prueba fidelidad de exportación, no la exactitud jurídica del contenido ni permisos de acceso a las URL sintéticas. No se ejecutó modelo, no hay compras ni adquisición/activación de corpus.

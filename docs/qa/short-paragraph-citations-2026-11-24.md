# Referencia por párrafo sin excepción de longitud

El contrato de generación de server/service.mjs exige referencias en ambos párrafos y la skill declara no-uncited-paragraphs. El validador compartido omitía todo párrafo de hasta 60 caracteres. Contraejemplo sintético confirmado: una afirmación breve sobre vencimiento sin referencia y un segundo párrafo con cita válida recibían citationIntegrity=true.

Se retira únicamente el filtro de longitud. Todo párrafo no vacío delimitado por línea en blanco requiere una referencia verificada. No se intenta inferir si una frase es sustantiva, un encabezado o un plazo: el contrato no permite encabezados sin cita. No se añaden ni reparan referencias y no cambia el texto. Espacios y párrafos vacíos siguen admitidos. La validación de IDs y citas textuales queda igual.

Test antes: 3 PASS y 1 FAIL. Después: 49 PASS entre nueva regresión, salida vinculada, truncamiento y servicio. Regresión cubre afirmaciones breves antes/después del párrafo citado, encabezado sin referencia rechazado, separadores CRLF/espacios/tabulador y párrafos breves citados. Servicio real con proveedor sintético falla sin guardar ni emitir tokens. Contrato paragraph-citations-v1 actual sigue aceptado en la comprobación final compartida. Build final sin errores.

Alcance: integridad estructural, no exactitud jurídica ni respaldo semántico de cada oración. Dos afirmaciones dentro del mismo párrafo aún se comprueban como un bloque, no por oración. No se ejecutó ningún modelo ni se cambió el papel exclusivo de anonimización del modelo local. La ruta antigua de respuesta jurídica no se migra ni activa con este cambio. Corpus de prueba temporal sintético, sin adquirir o activar biblioteca ni skills offline.

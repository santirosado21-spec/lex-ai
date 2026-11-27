# Cotejo del informe OpenCode sobre Reglamento Aduanero

24nov2026,09:14 America/Mexico_City. Sin cambios de extractor, PDF, corpus o app.

## Evidencia propia

Fuente: https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf . Archivo adquirido hoy, SHAcompleto en acquisition-manifest.json. El TXT tiene SHA16e057257e205eae30d189aece258ac9f16044722d50374c4a23414202a90f6b, coincide con el informe OpenCode.

Conteo independiente usando encabezados de artículo antes del primer TRANSITORIOS:282encabezados,249numeralesbase distintos1–249sin huecos,33sufijos. Esto es conteo estructural, no validación jurídica ni de texto completo.

Inspección de píxeles del PDFpp32–34y82:
- P32: fracciones romanas de art84 se ven correctamenteI–V; sus formas de extracción con letra l requieren tratamiento derivado y verificación contextual.
- P33: bloque CapítuloII/Exenciones/SecciónPrimera queda al pie. P34empiezaelart88. Es diseño del original, no pérdida de contenido.
- P34: el punto anterior al numeral en Artículo.88 está también en la imagen. El parser debe reconocer ese encabezado sin alterar el original.
- P34: SecciónSegunda/Abastecimiento… queda al pie, su cuerpo continúa después. La jerarquía derivada debe conservar esa relación entre páginas.
- P82: encabezado de transitorios de reformas contiene extracto deAnexo2RGCE2018; se ve apartadoIIyuna línea de puntos. No prueba una tabla o apartadoIperdido por extracción. No completar contenido ausente por intuición.

## Alcance corregido del informe

Que TXT sea byteidéntico a pdftotext no prueba que todo defecto provenga del mapa de texto del PDF. Debe separarse diseño original, texto codificado y comportamiento del extractor.

No modificar PDFs oficiales para mover títulos, normalizar comillas o insertar tablas. Mantener original/SHA; cualquier corrección debe vivir en una representación derivada con procedencia y prueba de fidelidad.

Los hallazgos sobre arts34y38-C no contradicen que un importer les pegue títulos al final: el PDF puede estar bien y el defecto estar en el corte estructurado. Esa comparación precisa necesita salida del importer, no soloPDF/TXT.

## Siguiente cierre sustantivo propuesto

Producir un candidato aislado de Reglamento con cuerpo estructurado y anexos/transitorios conservados aparte, a partir de la versión actual del importer. Antes de cambiar código, inspeccionar su salida para arts34/38-C/88yfronterapp81–90 y documentar qué problemas siguen reales. Si existe defecto, corregir solo delimitación/normalización derivada y medir contraPDF+DOF, no contar másartículoscomoéxito.

Puertas antes de biblioteca utilizable:
1. Todos los282encabezados del cuerpo mapeados una sola vez a páginas fuente; notas/títulos no pegados al artículo incorrecto; bloques posteriores preservados y tipados, nunca descartados silenciosamente.
2. Diferencias frenteDOFdocumentadas por artículo/párrafo, con resolución independiente de las nueve discrepancias históricas y lectura de condiciones temporales. No exige asumir que solo existen nueve.
3. Muestra visual/textual independiente y registro de lo no revisado. Conteo249+33no sustituye fidelidad.
4. Metadatos de publicación/reforma/entradaenvigor y estado de revisión separados, sin certificación general inferida del encabezado.
5. Solo después, decisión de promoción del candidato en índice de prueba separado, prueba de búsqueda/cita/versión y revisión de cambios antes de sustituir el índice congelado. La appactiva y producción siguen fuera de esta unidad.

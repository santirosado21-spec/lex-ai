# Rejon.AI · Cotejo de una operación y Reglamento aduanero

## Qué puede probar el despacho

El paquete privado r26.1 incluye una orden y un informe de servicio ficticios. La factura identifica el informe y el informe cita la orden de salida. Con sólo la factura en la pregunta, el piloto recupera la salida al extranjero y la línea donde el taller explica qué ajustó. El abogado puede leer el texto original en su equipo, marcar sus soportes, volver a buscar y revisar el mensaje antes del envío. El folio común permite localizar documentos. La identidad física del equipo requiere cotejar sus características y la evidencia de salida y retorno.

Si aparecen dos órdenes incompatibles o dos números de serie distintos, el piloto pide precisar los soportes. En el expediente ficticio de garantía, dos preguntas quedaron sin fundamento sugerido porque los documentos no establecían una sola operación con salida al extranjero. La búsqueda con líneas elegidas también funciona para preguntas sobre otros temas. Los documentos de cada expediente se abren con su clave local.

## Qué se observó

| Comprobación | Resultado |
|---|---|
| Envío de la nota y de la lista de cotejo | Dos respuestas reales, 745 tokens de entrada y 191 de salida en total. Se cotejó el mensaje de cada envío con la vista previa. Para probar la instalación se reprodujeron las respuestas con la misma huella de solicitud. |
| Texto que salió del equipo | Pasaje público, pregunta normativa e instrucciones. Las pruebas buscaron los nombres de los archivos, el cliente ficticio, el asunto, los folios, la pregunta original y las líneas del expediente en el cuerpo de la solicitud. En este recorrido quedaron en el equipo. |
| Uso de la respuesta | La nota propuso cotejar pedimentos, anexos, números de serie, inventarios e informes. La pregunta auxiliar devuelta por OpenAI carecía de la forma esperada. La aplicación conservó la cita y la lectura verificadas y atribuyó al despacho la pregunta auxiliar de sustitución. |
| Restauración y Office | Se reabrieron los dos borradores después de reiniciar el servicio. LibreOffice convirtió la nota y la lista a PDF desde Word, Excel y PowerPoint. En los seis resultados se recuperaron la pregunta, el cliente ficticio, la cita del artículo 117 y los dos soportes. El tercer documento de otra operación quedó fuera. |
| Edición del Reglamento | Se conservaron el PDF de 90 páginas y su huella SHA-256. Poppler extrajo los 282 encabezados anteriores a los transitorios. PDF.js cotejó cada encabezado con su página y verificó dos pasajes. El primero corresponde al artículo 150, párrafo primero, en la página 50. El segundo es el artículo 174, párrafo único, en la página 58. |

El expediente de inspección sirvió para desarrollar la recuperación documental. En la última medición independiente de protección se ocultaron 7 de 7 identificadores directos y 1 de 2 indicios indirectos, y se conservaron 4 de 6 hechos. Esta entrega cambia la selección documental y la lectura local. La garantía de anonimización integral, la validación jurídica por los socios y la equivalencia de cobertura con Luthor permanecen abiertas. [Evaluación de privacidad](privacidad-preguntas-retorno-r25.md)

La instalación de r26.1 se probó en Chromium en este Mac a 320, 390, 768 y 1280 píxeles de ancho y con movimiento reducido. El lanzador reabrió el expediente y reprodujo el respaldo por cuota con dos claves simuladas. La suite registró 1464 pruebas aprobadas, diez omitidas y cero fallos. La huella SHA-256 del ZIP privado es `239e8c0b649ee0d59fd331f4f89e85abe3745c5b8b14ca13d956cd0a7eb7d3ac`.

## Reproducción en el proyecto

El paquete contiene las instrucciones para el abogado en `piloto/LEEME.md`. La edición de Diputados está fijada por SHA-256. Para reconstruir el índice y cotejar la extracción con un segundo lector, ejecuta los dos comandos desde la raíz.

```sh
python3 scripts/index-customs-regulation.py
node scripts/check-customs-directory.mjs
```

El recorrido de navegador se puede ejecutar con transporte simulado mediante `node scripts/check-pilot-linked-evidence.mjs .`. La opción `--replay=artifacts/contexto-r26/completo` reproduce las respuestas observadas sin gasto adicional. Las respuestas, las huellas de solicitud, las capturas y los documentos de esta prueba contienen únicamente datos públicos y ficticios y se conservan localmente en `artifacts/contexto-r26/`. [Edición oficial del Reglamento](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf)

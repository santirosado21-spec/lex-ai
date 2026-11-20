# Cotejo de productores en la certificación de origen

Rejon r30.1 permite revisar una discrepancia entre la certificación y el registro de producción en la web local. El abogado puede comprobar el numeral 4 del Anexo 5-A, revisar el mensaje completo, recuperar los datos del expediente y exportar la nota.

## Dos usos comprobados

**Libros de práctica acreditados.** La procedencia se comprueba con la huella de los bytes del libro, la huella del texto extraído y una lectura local completa. Sólo se ofrecen las celdas de la ficha aprobada si el resultado protegido conserva el hecho y sustituye el folio. Una reserva nueva puede dejar una celda para uso local. La pregunta acreditada puede aportar su parte sustantiva protegida. El servicio reconstruye el fundamento jurídico desde el índice de la edición. Las coordenadas y nombres locales permanecen en el equipo.

Se enviaron a OpenAI dos consultas distintas. En una, H1 declaraba varios productores y H2 identificaba uno. El modelo describió la discrepancia y pidió una relación de productores. En la otra ambos soportes declaraban uno. El modelo distinguió esa coincidencia de la comprobación pendiente de la identidad y del lugar de producción. El servicio exigió el marcador del folio y las referencias H1 y H2. Cada archivo exportado debe mostrar el folio restituido y el vínculo de ambos hechos con B2 y B3.

**Archivos propios de prueba.** El abogado elige dos líneas del mismo asunto e indica cuál corresponde a la certificación. OpenAI recibe el numeral público y las instrucciones para tres supuestos. Rejon compara las cantidades y elige la recomendación en el equipo. Una misma cantidad exacta produce el resultado de coincidencia. Dos cantidades incompatibles producen el resultado de diferencia. La aplicación pide revisión si no puede leer una cantidad, si los intervalos admiten más de una interpretación, si las funciones explícitas de las líneas están intercambiadas o si sus folios explícitos difieren. Corresponde al abogado comprobar que ambos soportes se refieren a la misma operación.

Se usaron tres libros nuevos. Los valores fueron 31 y 47, 31 y 31, y 31 y una constancia pendiente. Los tres produjeron exactamente los mismos bytes de solicitud. Se efectuó un envío real para el primero y se reprodujo la misma respuesta en los otros dos. Las recomendaciones seleccionadas fueron distintas. Al abrir la nota se recuperaron las dos celdas elegidas en cada caso. Se volvió a obtener el PDF de la Secretaría de Economía y su huella coincidió con la copia incluida en el piloto. [T-MEC, capítulo 5 y Anexo 5-A](https://www.gob.mx/cms/uploads/attachment/file/465786/05ESPProcedimientosdeorigen.pdf)

## Consumo observado

| Envío real | Entrada | Salida |
|---|---:|---:|
| Prueba inicial con discrepancia | 483 | 98 |
| Prueba inicial con coincidencia | 484 | 112 |
| Discrepancia con referencias obligatorias a los hechos | 504 | 81 |
| Coincidencia con referencias obligatorias a los hechos | 505 | 101 |
| Tres recomendaciones públicas para el cotejo en el equipo | 320 | 95 |

La primera lectura del libro coincidente sugería aclarar el propio folio. Se corrigió la instrucción para usarlo como referencia de la operación y exigir que la lectura se apoye en los hechos elegidos. Las cinco llamadas utilizaron la clave principal. Las repeticiones de respuestas cotejaron la huella del cuerpo completo de cada petición.

## Pruebas del lector de privacidad

Se ajustó la protección de rasgos distintivos de embalaje, instalaciones y referencias posteriores a un dibujo. Se midió la proyección completa de cada expediente tras la revisión con el modelo local real.

| Muestra | Directos cubiertos | Indicios cubiertos | Hechos legibles |
|---|---:|---:|---:|
| Cinco colecciones históricas, 38 documentos | 35/35 | 31/32 | 48/50 |
| Materiales y origen, cuatro textos | 6/6 | 5/5 | 5/6 |
| Empaque de desarrollo, cuatro textos | 5/5 | 4/4 | 5/7 |
| Aguacate, amarre e incidencia vial, tres textos nuevos | 3/3 | 2/4 | 3/7 |

En r29, el empaque de desarrollo tenía un indicio protegido de cuatro. En el expediente adicional, r29 y r30 dieron los mismos conteos. La prueba nueva conservó por separado el original, las anotaciones previas y las predicciones de cada versión. Una procedencia regional y la descripción de un incidente vial quedaron parcialmente visibles. La huella de las anotaciones es `921c70566ed1955ea25722992ffbc5980b7cb008acf9ec4d10b99360ba312536`. Los tres textos se restituyeron y ninguna línea de este expediente se ofreció a la nube. Estos ensayos no demuestran anonimización completa.

## Distribución y verificación

Las instrucciones de los dos ejercicios se encuentran en `piloto/LEEME.md`. Al abrir el lector, Rejon consulta el catálogo de Ollama en la propia máquina. El navegador recibe el estado del lector requerido. El servicio no inicia el modelo durante esa comprobación. En esta instalación se encontró `qwen3.5:2b-q4_K_M`. La aplicación permite volver a comprobarlo después de instalarlo.

Para repetir la prueba del flujo de trabajo, usar `node scripts/check-pilot-origin-annex.mjs RUTA_APP RUTA_RESULTADOS` con `--caso=discrepancia`, `--caso=coincidencia` o `--propia=difieren|coinciden|pendiente`. Para la repetición local añadir `--replay=RUTA_RESPUESTA`. Los resultados de esta entrega están en `artifacts/origen-r30/`. La prueba humana de los socios, la segunda clave real, Windows y una máquina de 8 GB continúan pendientes.

El ZIP privado `Rejon-Comercio-Local-20261120-r30.1.zip` ocupa 120 813 624 bytes. Su SHA-256 es `4f0e76c84b1cf8a3c3cfeb6d528c964a5714d16b0957e8322f6e2e22c29d6243`. La suite aprobó 1 477 pruebas, con diez omitidas y cero fallos. El lanzador arrancó dos veces con terminal interactiva y claves temporales simuladas. El ensayo verificó el respaldo por cuota y el consumo atribuido a cada cuenta.

Desde una extracción nueva de ese ZIP se reabrieron las cinco notas en Chromium. LibreOffice abrió los quince archivos y los convirtió a PDF. En las páginas se verificaron los soportes, la cita, la pregunta y la respuesta elegida o restituida. También se cotejó el texto de las celdas en los cinco XLSX. El selector se probó a 320, 390, 768 y 1 180 píxeles, con animación normal y movimiento reducido. En el caso de cantidad pendiente se simuló la ausencia inicial del modelo y se recuperó la lectura con la instalación local. Esta repetición usó las respuestas reales registradas anteriormente.

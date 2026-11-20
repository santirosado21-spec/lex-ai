# Protección de expresiones y contexto en el expediente

La versión r27 permite reservar una expresión en el expediente cifrado, antes o después de adjuntar los documentos. Al consultar los soportes se ocultan las coincidencias aunque difieran en acentos, mayúsculas o espacios. El original sigue disponible para la restitución y exportación. Antes de llamar al proveedor, el servicio examina el texto del mensaje que acaba de reconstruir. Si contiene una reserva activa, detiene el envío antes de solicitar la clave o consumir un intento.

Se probaron la persistencia tras reiniciar, la retirada de una reserva, las revisiones caducadas, las coincidencias superpuestas, la normalización Unicode y los espacios de un salto de línea. Una reserva añadida durante la preparación de la pregunta obliga a revisar de nuevo sus soportes. El control se aplica a nuevos envíos de este piloto. Una expresión puede referirse a un dato privado o a vocabulario de una fuente pública. Si coincide con el texto de un artículo, la interfaz muestra el conflicto antes de enviar.

## Medición automática con el modelo local

Cada fila cuenta menciones completas ocultas y expresiones útiles conservadas en la proyección conjunta del expediente. Un indicio parcialmente visible cuenta como omisión. La anotación mide la visibilidad del rasgo, no la posibilidad demostrada de identificar a una persona. En estas mediciones no se hicieron solicitudes de nube.

| Expediente sintético | Identificadores directos | Indicios ocultos | Hechos conservados | Comparación |
|---|---:|---:|---:|---|
| Inspección de un medidor | 7/7 | 2/2 | 6/6 | En r26.1 se obtuvieron 1/2 y 4/6 en las dos últimas columnas. Este expediente guio el cambio. |
| Calibración | 7/7 | 2/2 | 1/6 | La base dio 1/2 y 0/6. Se usó en el desarrollo. Se perdieron hechos sobre el instrumento y su módulo. |
| Seguro de transporte | 7/7 | 2/2 | 2/5 | La base dio 1/2 y 2/5. El texto se fijó antes del cambio. Sus construcciones se tuvieron en cuenta al diseñarlo. |
| Origen de dos materiales | 6/6 | 0/5 | 2/6 | Texto redactado por otro modelo local después de fijar el detector. Se anotó antes de ejecutarlo. Los indicios incluían una región, un inmueble, rastros físicos y menciones posteriores. |

Se restituyeron los cuatro textos de cada uno de estos expedientes. En cinco colecciones históricas se restituyeron 38 documentos. La cobertura conjunta fue de 35/35 menciones directas y 31/32 indicios, con 48/50 hechos conservados. La reserva independiente sobre origen muestra el límite de generalización del lector. El número de muestras y la falta de una calificación ciega por abogados impiden extrapolar los resultados a clientes reales.

Las entradas están en `eval/privacy-trade/dialogo-*-r27.json`. Las predicciones y las comparaciones con la versión anterior están en `artifacts/privacidad-r27/`. Se puede repetir cualquier expediente mediante `node scripts/measure-intake-dialogue.mjs RUTA_DEL_JSON`. El navegador reprodujo desde el ZIP dos respuestas anteriores con el mismo cuerpo de solicitud, confirmó el bloqueo de un mensaje con una expresión reservada y reabrió la nota y la lista.

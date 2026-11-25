# Localizar texto dentro del soporte local

Base: fbb2444. Alcance: el visor existente IntakeCaseDocument, disponible al editar el borrador o consultar el soporte del expediente. No añade lectura de archivos ni destinos.

El texto ya cargado se puede buscar de forma exacta, sensible a mayúsculas y acentos, sin regex ni interpretación jurídica. Resalta hasta 200 coincidencias no superpuestas y permite pasar a la anterior o siguiente. El texto original no cambia. No es búsqueda de toda la carpeta ni sustituye revisar el documento.

La consulta se borra al cambiar soporte, alternar entre marcadores y originales o cerrar el visor. No se guarda en almacenamiento ni se incorpora a solicitudes API. La lectura del soporte conserva su endpoint existente. No cambia la protección, reservas, inserción de marcadores o contenido exportado. No usa modelo, nube ni corpus adicional.

Pruebas: helper con límites, puntuación literal, acentos, mayúsculas, emojis y coincidencias no superpuestas; componente real con dos soportes sintéticos, cambio de vista, limpieza al cerrar/reabrir, navegación, texto inalterado y solo tres llamadas intake.readDocument sin consulta. Pruebas conectadas al paso Chromium existente. Capturas desktop y 390 px inspeccionadas, sin overflow y con la coincidencia activa distinguible.

Límites: solo el texto visible ya extraído, no el PDF original; distinciones Unicode sin normalización; máximo 200 resaltados; cierre nativo Tauri y datos reales no probados.

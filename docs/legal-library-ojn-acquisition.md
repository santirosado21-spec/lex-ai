# Adquisición futura desde el Orden Jurídico Nacional (OJN)

Estado: plan offline; no se ejecutaron solicitudes durante esta preparación. El índice de partida es [resources/legal-library-catalog-ojn-index.json](../resources/legal-library-catalog-ojn-index.json), que contiene conteos de tipos, no textos.

El OJN se identifica en las capturas como compilación informativa. La propia página señala al Periódico Oficial, Gaceta o Boletín de cada entidad como medio de publicación oficial para normatividad estatal y municipal. Por eso una respuesta OJN sirve para descubrir y catalogar; no basta por sí sola para afirmar autenticidad, vigencia o completitud.

## Lo que muestran exactamente las capturas

Para una página centralizada, por ejemplo `estatal.php?liberado=si&edo=9`, el HTML contiene estos formularios GET:

| Propósito | Acción / campos observados | Solicitud que reproduce el HTML |
| --- | --- | --- |
| Buscar una frase | `busqueda.php`; `frase` y oculto `edo=N` | `GET https://www.ordenjuridico.gob.mx/busqueda.php?frase=Ley&edo=N` (o `frase=Codigo`) |
| Filtrar por tipo | formulario `form2`: acción inicial `despliegaedo.php`, ocultos `ordenar`, `edo=N`, `idi`; selector `catTipo` | El script cambia la acción a `despliegaedo2.php?edo=N` y envía GET. Para Ley: `GET https://www.ordenjuridico.gob.mx/despliegaedo2.php?edo=N&ordenar=4&edo=N&idi=&catTipo=4`; para Código: el mismo patrón con `5`. |

El `edo` repetido es intencional en esta representación: una vez está en la acción asignada por JavaScript y otra en el campo oculto. No se debe “normalizar” ni suponer que `idi` es opcional hasta comprobar una respuesta real. Los ids `4` (Ley) y `5` (Código) aparecen en las capturas centralizadas analizadas; la adquisición debe tomar el id de la opción de cada página guardada, no codificarlo como una garantía del sitio.

Dieciséis capturas no contienen esos formularios: incluyen un iframe a `compilacion.ordenjuridico.gob.mx/poderes2.php?edo=N`. Ese iframe no fue capturado ni consultado. Para ellas, primero hay que verificar un flujo separado y no aplicar a ciegas las rutas anteriores.

## Plan de solicitudes deliberadamente pequeño y cortés

Antes de enviar tráfico, registrar la fecha, versión del recolector y el hash de cada respuesta. El valor ya observado de `robots.txt` es 404; debe conservarse como evidencia de esa comprobación, no interpretarse como permiso para evadir otros controles.

1. Usar únicamente HTTPS y el host `www.ordenjuridico.gob.mx` para el listado inicial. Enviar un `User-Agent` identificable, por ejemplo: `LEX-AI-LegalLibraryResearch/0.1 (public legal-source cataloguing; no client documents)`.
2. Ejecutar una sola solicitud GET de listado, esperar **al menos 2 segundos** antes de cualquier otra solicitud al OJN, y no hacer peticiones concurrentes. Empezar con una entidad y un tipo: Ley o Código, nunca “Todos los ordenamientos”.
3. Aceptar sólo una respuesta HTML de listado de hasta **2 MiB**. Si excede ese límite, guardar metadatos del rechazo y detener esa entidad/tipo; no descargar en streaming sin una decisión explícita. Rechazar redirecciones a hosts no permitidos y respuestas que no sean HTML en esta etapa.
4. Extraer sólo la página, la URL final, encabezados de cache si existen, el total/paginación que muestre el propio sitio, títulos, ids y enlaces de documento. No descargar documentos en la pasada de inventario. Persistir una cola deduplicada por URL canónica y hash de respuesta.
5. Si la respuesta expone paginación, recorrerla de forma secuencial al mismo límite de 1 solicitud / 2 s, con un máximo inicial de 100 páginas por entidad/tipo y 2 MiB por página. Si no expone paginación, registrar `paginación no observada`; no inferir que se recibieron todos los resultados.
6. Reanudar únicamente desde la cola persistida. Un error HTTP, un cambio de HTML, una redirección inesperada o un límite de tamaño detiene esa rama y queda como anomalía revisable; no se reintenta en bucle.

Los límites son medidas de seguridad operativa para la fase de lista, no estimaciones del tamaño real del corpus y no prueban completitud.

## Validación de enlaces de instrumentos

Una URL de detalle descubierta no se trata como texto oficial automáticamente.

- Resolver el enlace relativo contra la URL de listado y guardar URL original, URL final, cadena de redirecciones, título y fecha de consulta.
- En la primera pasada permitir sólo `https://www.ordenjuridico.gob.mx` / `https://ordenjuridico.gob.mx`. Para un enlace externo, requerir una regla de allowlist registrada para el anfitrión institucional de la entidad antes de solicitarlo.
- La allowlist externa exige evidencia humana de que el anfitrión corresponde al gobierno, Congreso o Periódico Oficial de la entidad; un nombre que parezca oficial o un dominio similar no es suficiente. Un subdominio `*.gob.mx` puede ser una señal adicional, no una prueba de la edición ni de su vigencia.
- Validar TLS, rechazar cambios de host o esquemas no HTTPS, y no enviar credenciales ni datos de materias. Mantener por separado el enlace OJN de descubrimiento y la publicación estatal/federal que confirme el documento.
- En una fase documental posterior, fijar un límite por descarga distinto y conservador antes de bajar PDFs/HTML, calcular SHA-256, detectar HTML de error disfrazado de PDF y conservar la procedencia. Esa fase no está autorizada por este plan de índice.

## Dos verificaciones para Claude (máximo dos solicitudes reales)

1. Solicitar la ruta de tipo Ley para una página **centralizada** (CDMX, `edo=9`, `catTipo=4`) con los campos anteriores. Confirmar URL final, si los dos `edo` e `idi` son necesarios, tipo de contenido, títulos devueltos, total publicado y cómo se expresa la paginación.
2. Desde esa única respuesta, seguir **un** enlace de detalle que haya pasado la validación de host. Confirmar si es una ficha OJN o un documento, los campos que identifican instrumento/fecha, la cadena de redirecciones y si la página enlaza una publicación oficial de la entidad.

Claude debe informar los bytes, estado HTTP, URL final y cualquier divergencia del HTML capturado; no debe descargar en lote, inferir vigencia, ni afirmar completitud. Si cualquiera de las dos comprobaciones cambia el contrato de formulario, actualizar el parser, el catálogo y este documento antes de programar adquisición.

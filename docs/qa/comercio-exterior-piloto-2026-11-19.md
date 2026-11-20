# Rejon.AI para un despacho mexicano de comercio exterior

**Corte del 19 de noviembre de 2026.** El flujo de mayor valor para probar con los socios empieza con una pregunta concreta sobre una operación, reúne evidencia del expediente y produce un memo con fuentes y una matriz editable de documentos faltantes. Una fracción, una tasa, un plazo o un beneficio fiscal requieren fecha de operación, hechos y texto aplicable. La falta de alguno debe quedar visible en la respuesta.

## Qué puede consultar la instalación

Localicé la base pública de 153,014,272 bytes en el proyecto original y la copié al piloto local. La huella SHA-256 coincide con el manifiesto `ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588`. SQLite pasó `quick_check`. Probé la apertura con el módulo del producto, la búsqueda por palabras de origen y mercancías y la recuperación exacta del artículo 9 de la Ley de Comercio Exterior. El corte del índice es 30/10/2026, con 303 instrumentos y 35,452 artículos. La revisión de fidelidad por muestra registrada cubrió 910 artículos. Cada conclusión de vigencia requiere revisar reformas y transitorios.

El índice de consulta del espacio de trabajo y el contexto que recibe OpenAI son dos mecanismos distintos. En el piloto de alta, la tarea de comercio recibe referencias públicas acotadas de tres fuentes. Sirven para preparar una solicitud de documentos o una lista de cotejo. La investigación libre necesita seleccionar pasajes por pregunta protegida, comprobar el intervalo de aplicación, adjuntar la referencia del pasaje y verificar las citas que devuelve el modelo.

## Necesidades del despacho y entregables

| Trabajo del abogado | Datos que necesita localmente | Resultado y evidencia que debe poder revisar |
|---|---|---|
| Alta, conflictos y alcance | Partes, matrices, beneficiarios, proveedor, agente aduanal, poderes, operación y responsable | Ficha por asunto, homónimos por resolver, alcance del encargo y acceso por equipo. La app ya cuenta con asuntos, documentos y búsqueda de conflictos. |
| Entrevista y recepción de documentos | Factura, pedimento, anexos, acuse, transporte, pagos, contratos y cronología | Índice por versión y página, discrepancias de valor, cantidad, unidad o identidad. Reconocer tablas, escaneos y anexos con cifras legibles. |
| Clasificación y restricciones | Descripción técnica, función, material, presentación, país, fecha, régimen | Hoja de alternativas con fundamento de sección/capítulo, fracción, NICO, unidad, regulación y dato faltante. Exige cotejar filas y notas de la tarifa. [SNICE y NICO](https://www.snice.gob.mx/cs/avi/snice/ligie.nico2022.html) |
| Origen y preferencia | Tratado invocado, clasificación, lista y origen de insumos, proceso, costos y certificación | Matriz por producto que muestre el requisito específico y qué hecho lo acredita. Consultar capítulos, anexos, excepciones y reglamentaciones uniformes. [T-MEC](https://www.gob.mx/t-mec/acciones-y-programas/textos-finales-del-tratado-entre-mexico-estados-unidos-y-canada-t-mec-202730) |
| Valoración y pedimento | Factura, contratos entre partes vinculadas, fletes, seguros, regalías, moneda, pagos y ajustes | Excel con concepto, moneda, supuesto, documento y celda de origen. El abogado decide la inclusión y el método. [Anexo 22 y modificaciones](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/) |
| Programas y permisos | Actividad, sector, autorización, domicilios, inventario, retornos y registros | Lista IMMEX/PROSEC, requisitos aplicables, evidencia por trámite y calendario sujeto a revisión. [SNICE](https://www.snice.gob.mx/cs/avi/snice/programas_de_fomento.html) · [VUCEM](https://www.ventanillaunica.gob.mx/vucem/Tramites/index.html) |
| Auditoría, defensa y medios de impugnación | Acto íntegro, autoridad, forma de notificación, fechas, expediente, pruebas y precedentes | Cronología, matriz de hechos y pruebas, borrador Word y revisión de plazos por el responsable. Distinguir tesis aislada, jurisprudencia, precedente y criterio modificado. [ANAM](https://anam.gob.mx/glosario/) · [TFJA](https://www.tfja.gob.mx/cesmdfa/sctj/) · [Semanario Judicial](https://sjf2.scjn.gob.mx/busqueda-principal-tesis) |
| Defensa comercial | Producto, productor/exportador, país de origen, periodo, resolución inicial/final y revisiones | Ficha de cuota, alcance y fechas con la publicación exacta. [Biblioteca jurídica SNICE](https://www.snice.gob.mx/cs/avi/snice/biblioteca.juridica.html) |
| Contrato transfronterizo | Partes, jurisdicción, ley aplicable, entrega, transporte, pago, garantías y arbitraje | Tabla bilingüe de cláusulas, cambios propuestos y riesgo residual. Las condiciones comerciales privadas se consultan con material autorizado. |
| Gestión y comunicación | Instrucciones del cliente, responsables, aprobaciones, presupuesto y tiempos | Historial de versiones, tareas con responsable, revisión del socio y resumen ejecutivo en PowerPoint. La decisión y firma corresponden al abogado. |

Para otras materias mexicanas se conserva la misma secuencia de expediente, fuentes, borrador y revisión. Civil, mercantil, laboral, fiscal, administrativo, corporativo y amparo requieren pruebas jurídicas separadas, especialmente en competencia estatal, supletoriedad, derecho transitorio y precedentes. Una consulta mal atribuida a otra entidad es un fallo aunque el número de artículo exista.

## Capturas y fuentes

La captura de desarrollo reutiliza la fábrica existente, sus registros oficiales y sus límites de red. Ejecuté las cinco selecciones, conservé PDF y resultados en cuarentena y repetí el proceso offline. Los registros extraídos pueden incluir referencias y transitorios. Su conteo no mide la cantidad de artículos aplicables.

| Instrumento / edición capturada | Registros | SHA-256 del PDF |
|---|---:|---|
| [Ley Aduanera](https://www.diputados.gob.mx/LeyesBiblio/pdf/LAdua.pdf) | 420 | `43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d` |
| [Reglamento de la Ley Aduanera](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf) | 295 | `bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812` |
| [Ley de Comercio Exterior](https://www.diputados.gob.mx/LeyesBiblio/pdf/LCE.pdf) | 126 | `3f114f47007c21b4691bad502b786b45aa5e45c1571bd56dd8ca4f5af991b459` |
| [Reglamento de la Ley de Comercio Exterior](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LCE.pdf) | 228 | `14d38a7a24e4d8e5093951b5e80a87f331fa3ea0be2164269573a8b9e4c291dd` |
| [Ley de los Impuestos Generales de Importación y de Exportación](https://www.diputados.gob.mx/LeyesBiblio/pdf/LIGIE_2022.pdf) | 82 | `955510d7ea82cf42d18c72e3146f999af254c0fda5eda3f12a1fd1c10e9864ce` |

Desde la carpeta del piloto se puede inspeccionar el plan y reproducir las capturas. Los PDF, huellas de configuración, metadatos de origen y segmentos están en `artifacts/public-corpus/comercio-20261119/`.

```sh
sh scripts/acquire-trade-pilot.sh --plan
sh scripts/acquire-trade-pilot.sh --live
sh scripts/acquire-trade-pilot.sh --offline
```

El índice empaquetable reside en `resources/public-library.sqlite` junto a su manifiesto. Los cinco documentos recién capturados están separados de ese índice. Las referencias base de la plantilla viven en `server/corpus/trade-pilot-references.mjs`. Incluyen fecha de comprobación, edición, localizador y enlace.

## Brechas para la especialización

1. **Tarifa y restricciones.** El PDF capturado de la LIGIE tiene 894 páginas y tablas. La búsqueda por artículos de la biblioteca congelada registra dos artículos de esa ley. Para responder por fracción se necesita una estructura por fila, unidad, cuota, vigencia y excepciones con página de origen. Validar una muestra manual que incluya unidades repetidas, cambios de fracción, filas que continúan de página y reformas. Cruzar después con NICO, NOM y regulaciones de cada dependencia. [Instrumentación SNICE](https://www.snice.gob.mx/cs/avi/snice/nuevaligie.instrumentacion.html)
2. **Ediciones y efectos.** Conservar el PDF anterior cuando cambia una URL e identificar qué artículos o filas sustituye el decreto. El registro candidato de la Ley Aduanera ya separa una reforma publicada el 23/10/2026 con entrada en vigor el 01/01/2027. Para RGCE, enlazar regla, anexo, modificaciones, anticipadas, transitorios y fecha de la operación. [Decreto de reforma](https://www.diputados.gob.mx/LeyesBiblio/ref/ladua/LAdua_ref21_23oct26.pdf) · [Portal del SAT](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/)
3. **Tratados y defensa.** El T-MEC necesita anexos por producto y versiones de los textos. Para las búsquedas del SJF y del TFJA, conservar órgano, registro, época, tipo, fecha, estado y enlace oficial. La investigación del piloto localizó los portales. Siguen pendientes la vía autorizada de reuso y la ingestión de estas colecciones. [T-MEC](https://www.gob.mx/t-mec/acciones-y-programas/textos-finales-del-tratado-entre-mexico-estados-unidos-y-canada-t-mec-202730) · [TFJA](https://www.tfja.gob.mx/cesmdfa/sctj/) · [SJF](https://sjf2.scjn.gob.mx/busqueda-principal-tesis)
4. **Prueba de calidad.** Probar con expedientes ficticios en pares que difieran en una fecha, país de origen, material o régimen. El abogado califica cada afirmación y abre el pasaje. Registrar cita incorrecta, norma fuera de vigencia, hecho inventado, pregunta de aclaración omitida y restauración cruzada entre clientes. Las ausencias de tarifa o de precedente deben ser detectables.
5. **Privacidad profesional.** Separar identificadores directos de hechos que pueden identificar al cliente en combinación (ruta, importe, producto poco frecuente y fecha). Revisar texto, imágenes, metadatos del archivo y contexto de turnos anteriores antes del envío. Los mapas de sustitución pertenecen al asunto y la restitución requiere verificar que cada marcador corresponde al documento autorizado. Para una implantación real, el despacho debe revisar finalidades, proveedores, conservación y acceso aplicables a su tratamiento. [LFPDPPP](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf)

## Qué comparar con Luthor

La referencia identificada en el historial del producto es **Luthor.mx**. Su propia descripción abarca leyes, búsqueda por artículo, jurisprudencia y trazabilidad de fecha y procedencia. Sus términos describen acceso a contenido TFJA en determinados planes. La evaluación funcional debe comparar tareas como encontrar una autoridad, abrir el texto que la respalda y reconstruir la versión aplicable. Verificar por separado normas catalogadas, instrumentos con texto íntegro, artículos con citas, decisiones judiciales y calidad en casos. [Luthor](https://luthor.mx/) · [Términos de Luthor](https://luthor.mx/terminos/)

La base de adquisición de Rejon parte de los textos públicos oficiales. El artículo 14, fracción VIII, de la LFDA distingue los textos oficiales de la obra original de concordancia, anotación o interpretación. Para incorporar compilaciones o contenido editorial de terceros se requiere revisar sus condiciones específicas. La evidencia de este piloto cubre las cinco capturas federales y referencias enumeradas arriba. La paridad documental o de calidad con Luthor sigue sin medirse. [Ley Federal del Derecho de Autor](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf)

## Ejercicio privado para Santiago, Lorenzo y Pedro

Usar un asunto ficticio en cada equipo. El encargo es preparar la primera solicitud documental para revisar la importación a México de una bomba de agua ensamblada en Canadá. El expediente inicial solo tiene una descripción comercial. Faltan fecha del despacho, ficha técnica, valor de los insumos y certificación. Si el piloto solo admite campos estructurados, el abogado conserva estos hechos en la ficha de evaluación local.

| Persona | Acción | Qué debe observar y guardar |
|---|---|---|
| Santiago | Dar de alta «Comercial Nopal Ficticia» y el asunto «Bomba Delta Ficticia». Seleccionar la tarea de preparación de importación y revisar la vista previa antes de generar. | Vista previa con marcadores, tarea y fuentes públicas. Registrar cualquier nombre, título, dato de archivo o identificador que aparezca. En una captura de desarrollo del sobre autorizado deben coincidir vista previa y contenido efectivo. |
| Lorenzo | Revisar el borrador como abogado. Abrir los artículos 9 y 10 de la LCE, el Anexo 22 y los capítulos 4 y 5 del T-MEC desde sus enlaces. | Lista concreta de faltantes para descripción técnica, origen, valor y pedimento. Registrar cualquier tasa, fracción, conclusión de origen o plazo que el texto otorgue sin datos. El origen declarado en una factura por sí solo no demuestra que se cumple una regla específica. |
| Pedro | Exportar el borrador en Word, Excel y PowerPoint. Abrir cada archivo, editar una línea o celda y comprobar la identidad restaurada contra el alta local. | Tres archivos legibles y editables, sin marcadores residuales ni datos de otro asunto. Conservar una captura por formato y anotar cualquier diferencia entre el borrador y la exportación. |

**Control temporal.** Para comparar una operación ficticia del 31/12/2026 con otra del 02/01/2027, el revisor debe poder identificar en qué fecha entra en vigor el decreto aduanero del 23/10/2026. El primer transitorio fija el 01/01/2027. La plantilla de solicitud documental no contiene el articulado comparado. Si un borrador pretende resolver ambos casos usando solo las referencias del piloto, registrar la afirmación como carente de respaldo. [Decreto de reforma](https://www.diputados.gob.mx/LeyesBiblio/ref/ladua/LAdua_ref21_23oct26.pdf)

**Control de adquisición.** Las huellas de la tabla identifican las versiones capturadas el 19/11. Una corrida posterior con `--live` puede conservar una versión anterior o recibir bytes distintos de la misma URL. El recolector guarda las dos versiones bajo sus respectivas huellas y genera evidencia para cada una. Comparar la nueva captura con la tabla, revisar reformas, transitorios, cambios editoriales y condiciones del canal antes de actualizar referencias de producto. `--offline` usa la versión almacenada que el manifiesto local selecciona y verifica integridad. Para reconstruir exactamente este corte, conservar una copia del directorio de cuarentena de esta fecha con sus manifiestos y archivos. El permiso técnico para esta captura acotada quedó registrado por fuente. La revisión del conjunto para redistribución comercial y la validación de vigencia por un abogado siguen pendientes.

## Qué se puede probar en esta entrega

| Paso | Implementación y evidencia | Límite de la prueba |
|---|---|---|
| Expediente | El producto base incluye vistas de asuntos, conflictos, documentos, tareas, tiempos, correo y aprobaciones. El lanzador lleva a un espacio de prueba por persona y ejercicio. | Los perfiles son carpetas locales dentro de una cuenta del sistema. La colaboración simultánea y los permisos entre abogados requieren otra prueba. |
| Entrada local | Ollama lee texto extraído en el equipo y propone datos de alta. El usuario corrige y guarda. La factura incluida activa tres sustituciones y una descripción pública fija de la operación. | En otro archivo la ruta conserva el texto libre local y admite sólo la clase documental para el contexto de comercio. Faltan casos nuevos con texto libre, tablas, escaneos, domicilios, RFC y combinaciones que permitan reidentificar. |
| Trabajo en la nube | La interfaz permite leer el mensaje exacto antes de generar. Un control independiente acepta únicamente los mensajes previstos. En una llamada real la solicitud contenía el marcador de proveedor y la referencia LCE-10. El control comprobó la ausencia de despacho, cliente, título y proveedor originales. El modelo devolvió un fundamento verificable y una pregunta documental. | Recibo del ejercicio: 847 tokens de entrada, 101 de salida. La prueba de una factura acredita ese recorrido. No mide precisión jurídica en asuntos nuevos. |
| Restitución y edición | El código local sustituye los marcadores por los valores guardados. El abogado puede editar antes de exportar. El libro Excel añade una hoja «Control documental» con siete comprobaciones, estado, responsable y referencia al expediente. Word y PowerPoint conservan borrador y fuentes. | Se abrieron los tres formatos con LibreOffice. Falta comprobarlos con Microsoft Office en los equipos de los socios. Las versiones r1–r3 conservaban los valores recuperables en claro. El lanzador r4 cifra los registros de los nuevos ejercicios. |
| Interfaz y distribución | El navegador carga recursos locales, adapta la interfaz al ancho y respeta la preferencia de movimiento reducido. Durante el recorrido integrado el navegador sólo habló con el proceso local. El servidor realizó la llamada autorizada a OpenAI. | Se ejecutó en macOS. Windows, los equipos de Lorenzo y Pedro y una máquina física con 8 GB siguen pendientes de aceptación. La clave de Lorenzo se configura por separado. |

**Secuencia para llegar a expedientes reales.** Primero, evaluar detección y restitución sobre documentos sintéticos que el sistema nunca haya visto, incluidos escaneos y pistas indirectas. Medir tanto filtraciones como pérdida de hechos jurídicamente relevantes. Segundo, proteger la base local y probar aislamiento entre asuntos y usuarios, recuperación y borrado. Tercero, conectar la pregunta protegida con pasajes recuperados por fecha y jurisdicción y devolver citas comprobables. Cuarto, pedir a los abogados que califiquen las respuestas y abran los archivos en sus equipos antes de admitir material de clientes.

## Ampliación de la investigación por expediente

El abogado ya puede buscar en el índice federal y redactar una nota con un pasaje elegido. La tarea original de origen conserva su plantilla. La nueva nota acepta los artículos accesibles de la edición empaquetada, separa los artículos largos en pasajes y muestra el mensaje antes del envío. El servicio local recupera las palabras del pasaje desde la base con huella comprobada. El texto de búsqueda, los nombres y el título del expediente quedan en el equipo. Una cita que no aparece en el pasaje se sustituye por una indicación de fundamento pendiente. Cada nota generada archiva el pasaje y la edición para su revisión posterior, incluso si deja de estar disponible el índice local. La selección del artículo y la comprobación de vigencia corresponden al abogado.

## Protección del texto extraído en documentos nuevos

La revisión previa utiliza Ollama y reglas locales sobre el documento ficticio completo dentro del límite de 8,000 caracteres. Comprueba que las propuestas aparecen literalmente en el texto, une las zonas que se solapan y verifica la restitución mediante la huella del texto extraído. El visor local permite comparar el original y las sustituciones. En la edición r3 el mapa temporal servía para la comprobación en memoria. El texto libre revisado no se admite como mensaje para la nube.

En los tres ejemplos ficticios definidos en `scripts/check-pilot-local-privacy.mjs`, Ollama y las reglas cubrieron íntegramente seis de seis identificadores anotados, incluidos dos domicilios, uno mexicano y otro extranjero. La restitución coincidió en los tres. De seis expresiones operativas anotadas sólo una quedó íntegra y visible en la vista protegida. Por tanto, este ensayo también documenta pérdida de información jurídica útil. Son tres documentos de desarrollo distintos de los utilizados por Instinct. Las cifras no son comparables ni estiman el rendimiento sobre expedientes reales. Un ejercicio adicional de navegador con viewport de 390 píxeles verificó el correo oculto y la restitución desde la interfaz. La selección de pasaje oficial, su generación de nota y la exportación son un recorrido separado.


## Almacenamiento y cuentas del piloto r4

El lanzador abre cada ejercicio con una frase local. Una sal aleatoria y scrypt derivan la clave de AES-256-GCM. Cada escritura utiliza un nonce nuevo. La autenticación comprueba el perfil, el código del ejercicio y la identidad de cada registro. SQLite conserva en claro los identificadores internos y el tipo de registro. El archivo de recibos locales contiene la cuenta seleccionada, el modelo y el consumo. Las exportaciones llevan los datos restituidos. El cifrado cubre los registros guardados por el piloto. Memoria, copias anteriores, archivos de Office y protección del sistema operativo requieren controles propios.

Probé reapertura, rechazo de frase incorrecta, edición, exportación tras reiniciar, reversión de escrituras, lectores simultáneos, trasplante de registros y de un archivo entre ejercicios. La migración leyó un ejemplo r3 en modo de sólo lectura y conservó su archivo byte por byte. Los nombres y el borrador ficticios no aparecieron como texto en los archivos del ejercicio nuevo. El lanzador también admite dos claves temporales en una sesión. La alternancia se comprobó con credenciales ficticias. La segunda clave real y la revisión de seguridad externa siguen pendientes.


## Expediente de práctica y restitución en r5

El lanzador cifrado permite guardar el texto de un documento ficticio leído en este equipo. El abogado puede reabrir el soporte, cotejar identidades e insertar un marcador desde el editor. El mapa queda vinculado al despacho y al asunto. Un documento nuevo que el usuario importe desde su disco permanece local. Para practicar el recorrido hacia OpenAI, el servidor genera un expediente sintético de origen o cupos con cliente, proveedor, asunto y contacto variables. Se verifica la procedencia, el texto íntegro, cada identidad sustituida y los hechos que conserva la operación. La vista previa utiliza marcadores exclusivos de esa solicitud. El programa coteja el hecho, el proveedor y la cita que devuelve la nube antes de restituir los valores en el equipo.

Una prueba de navegador con la cuenta principal y el artículo 23 de la LCE envió una solicitud real. La vista previa coincidió con el mensaje enviado y quedaron fuera los cuatro datos del documento más el nombre del despacho. El proveedor devolvió el marcador del proveedor, una cita literal comprobada y una pregunta. Reportó 444 tokens de entrada y 72 de salida. Tras reabrir el expediente cifrado se pudo restituir el proveedor. Los tres formatos Office se abrieron con LibreOffice y conservaron el proveedor en el PDF renderizado. En un segundo recorrido con un TXT ficticio nuevo se insertó un correo desde el soporte local. El navegador mostró el correo restituido y mantuvo la página dentro del ancho disponible a 320, 390, 768 y 1280 píxeles.

| Evaluación local con Ollama | Resultado | Alcance |
|---|---|---|
| Nueve documentos ficticios de desarrollo | 19 de 19 apariciones sensibles cubiertas, 14 de 18 expresiones operativas intactas, 9 restituciones exactas | La comparación con r4 sobre los mismos ejemplos dio 5 de 18 expresiones intactas. |
| Muestra de domicilios de Instinct | 24 de 24 domicilios cubiertos. En 5 de 25 controles quedó íntegro todo el texto aduanero. Se restituyeron los 49 textos | Lote de desarrollo usado al ajustar reglas. En 20 controles quedó oculta al menos una parte. |
| Seis expedientes adicionales de origen o cupos | Cinco habilitaron la vista de envío con el artículo previsto. Un caso de cupos quedó en local por pérdida de hechos | Tres expedientes por tema. Ollama real, sin generar en la nube. |

Los resultados miden esos textos extraídos. Faltan un lote reservado sin ajustes, mediciones de combinación de identificadores indirectos y aceptación profesional con los socios. Los ejemplos se limitan a texto extraíble. Los escaneos, sellos y firmas requieren un flujo con OCR y cotejo visual antes de admitirlos.

## Localizar una fracción en la captura de la LIGIE

La herramienta de desarrollo recorre las 894 páginas de la captura e identifica códigos de ocho dígitos al inicio de una línea extraída con Poppler. Devuelve fracción, página, línea de texto extraído, huella y enlace al PDF. Encontró 9,020 apariciones de 8,183 códigos distintos en 809 páginas. Un código puede aparecer en la tabla, en notas o en reformas posteriores. Para 0102.29.99 devolvió cuatro páginas y para 8413.70.99 devolvió la página 631. Las posiciones sirven para abrir el original e investigar las referencias. Siguen pendientes la reconstrucción de celdas multilínea, cuotas, unidades, transitorios y vigencia para la fecha de la operación. El índice de citas del producto se mantiene separado de esta captura de desarrollo. La Secretaría de Economía publica por separado el catálogo NICO y sus modificaciones. [NICO en SNICE](https://www.snice.gob.mx/cs/avi/snice/ligie.nico2022.html)

Desde la raíz del repositorio, con Poppler disponible, se puede reproducir la consulta sobre el PDF capturado. Omitir la última opción genera el CSV completo.

```sh
python3 scripts/locate-ligie-fractions.py --sha256 955510d7ea82cf42d18c72e3146f999af254c0fda5eda3f12a1fd1c10e9864ce --fraccion 84137099
```

## Lecturas sugeridas desde un documento importado en r6

En un expediente cifrado, Rejon lee el texto local y busca menciones de siete temas comerciales. Conserva un fragmento literal y el número de línea del texto extraído. Omite los campos rotulados de identidad al buscar temas. Una mención incluso en una frase negativa puede sugerir un tema. El abogado coteja la línea y decide si envía la consulta. La lectura utiliza el primer pasaje de cada artículo. Para revisar el resto se puede abrir la biblioteca y elegir otro pasaje.

| Tema sugerido | Fuentes de partida en la edición empaquetada |
|---|---|
| Origen | LCE 9 y 10 |
| Cupos | LCE 23 y 24 |
| Regulaciones y restricciones no arancelarias | LCE 17 y 20 |
| Clasificación de mercancías | LIGIE 2 y LCE 20 |
| Discriminación de precios | LCE 28 y 30 |
| Subvenciones | LCE 28 y 37 |
| Salvaguardas | LCE 45 y 49 |

El mensaje para la nube contiene el tema y dos pasajes públicos con fragmentos numerados. El modelo elige una clave en cada fuente y propone preguntas documentales. El código comprueba cada clave dentro de su fuente y recupera el texto literal. El fragmento del documento, el nombre de archivo, el cliente, el asunto y el despacho quedan en el equipo. En el borrador se añade un marcador que se puede retirar antes de exportar. La copia local conserva las fuentes y el fragmento utilizados al generar la nota.

La prueba integral importó un Word ficticio nuevo con Ollama, abrió las dos referencias, envió la vista previa a OpenAI, editó la nota y descargó los tres formatos. En una versión anterior que pedía copiar dos citas, una respuesta real coincidió con uno de los dos textos. La versión con selección numerada obtuvo dos citas literales en una llamada posterior, con 768 tokens de entrada y 87 de salida. El navegador sólo se comunicó con el proceso local. LibreOffice abrió Word, Excel y PowerPoint y en los tres se comprobó el identificador ficticio del lote y ambas referencias en el PDF renderizado. La interfaz se comprobó a 320, 390, 768 y 1280 píxeles. La aceptación en Microsoft Office y la evaluación del criterio jurídico siguen pendientes.

Una prueba automatizada comprueba el rechazo individual de un fragmento atribuido a la fuente equivocada, edición, reapertura sin biblioteca, eliminación voluntaria del soporte y exportación. Para reproducir el recorrido en navegador, con el proyecto compilado y Ollama local, ejecuta `node scripts/check-pilot-trade-reading.mjs`. El transporte simulado es el predeterminado. Añadir `--openai` usa la cuenta real configurada y consume API.

El detector local también reconoce referencias de factura, contenedor, reserva, sello, conocimiento de embarque y pedimento, aunque se repitan fuera de su campo. En ocho textos de desarrollo con Ollama, r5 y r6 cubrieron las mismas 11 apariciones anotadas, conservaron 11 de 14 expresiones documentales y restituyeron los ocho textos. La nueva prueba de reglas comprueba las sustituciones incluso sin sugerencias de Ollama. Los controles históricos de Instinct etiquetan la ausencia de domicilios o datos personales. Algunos incluyen folios y números de contenedor que pueden identificar una operación. Por ello medir la línea completa como intacta combina valores útiles y referencias privadas.

## Valoración y pedimento en r7

El piloto ofrece dos lecturas adicionales de la Ley Aduanera. La de valoración reúne los artículos 64 y 65. La de pedimento reúne los artículos 36 y 36-A. Los trece fragmentos tienen un localizador por párrafo o inciso y por página. El archivo de referencia es el PDF oficial de 220 páginas cuyo encabezado indica reforma del 19 de noviembre de 2025. En la captura del 19 de noviembre de 2026, su huella SHA-256 es `43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d`. La instalación incluye esa copia para cotejo sin conexión. La selección de pasajes es independiente del índice federal de 303 instrumentos.

Contrasté los fragmentos con las páginas impresas 25, 26, 46 y 47. La reconstrucción con Poppler y una extracción independiente con PDF.js encontraron los trece en sus páginas después de normalizar espacios. Para repetir el cotejo con Poppler, ejecuta `python3 scripts/verify-customs-passages.py`. El servicio comprueba la huella del PDF y del archivo de fragmentos. Conserva la página del fragmento escogido en la nota y los localizadores de las dos fuentes en las exportaciones. El historial de la Cámara registra el decreto del 23 de octubre de 2026. Su artículo único enumera 144, 151, 153, 154, 177 y 185, y el primer transitorio fija la entrada en vigor el 1 de enero de 2027. Esta comparación alcanza esa reforma. La selección, pertinencia, efectos y vigencia para una operación siguen sujetos a cotejo profesional. [Historial de la Ley Aduanera](https://www.diputados.gob.mx/LeyesBiblio/ref/ladua.htm) · [Decreto](https://www.diputados.gob.mx/LeyesBiblio/ref/ladua/LAdua_ref21_23oct26.pdf)

El control local de valoración separa precio, flete, seguro, cargos conjuntos, embalaje, comisiones, regalías y otros conceptos. En el control de pedimento se registra declaración, acuse, documento de valor, transporte y otros anexos. Las propuestas se obtienen de líneas rotuladas. Se conserva la línea de origen. Una cifra monetaria ambigua, un símbolo de moneda sin código o una referencia en prosa requieren captura manual. Se pueden conservar múltiples renglones del mismo concepto y montos en monedas diferentes. El abogado asigna el estado del cotejo. Al guardar se comprueba la revisión anterior de ese renglón para evitar reemplazar cambios de otra sesión. Los valores del control permanecen dentro de los registros cifrados del expediente. Las exportaciones incluyen los originales y no están cifradas.

Un Word ficticio importado con Ollama activó ambas lecturas. En navegador se aceptó un flete, se registró una referencia de póliza y se descargó el control en Excel antes de generar una nota. El pedimento se guardó en su propia tarea. Una solicitud real de valoración a OpenAI utilizó 741 tokens de entrada y 87 de salida. La vista previa coincidió con el mensaje enviado. El importe del flete, el folio de la póliza, el pedimento y las identidades ficticias estuvieron ausentes. La respuesta eligió el párrafo cuarto del artículo 64 y el inciso d) de la fracción I del artículo 65. Se cotejaron las dos selecciones y se verificaron los archivos Office. Se probó el navegador a 320, 390, 768 y 1280 píxeles. El comando `node scripts/check-pilot-trade-reading.mjs --aduana` repite el recorrido con transporte simulado. Añadir `--openai` realiza una generación real con la cuenta configurada.

## Cuentas de OpenAI en r8

El lanzador ofrece cuatro modos. Principal y Lorenzo fijan una cuenta. Alternar reparte por número de solicitudes nuevas durante la sesión. El volumen de tokens depende de cada respuesta. Respaldo toma la segunda clave si falta la principal en el equipo. Si ya hubo envío, requiere un rechazo explícito de clave inválida (401 con `invalid_api_key`) o cuota insuficiente (429 con `insufficient_quota`). Un límite de frecuencia, una respuesta malformada, un corte o una interrupción detienen el flujo. El segundo intento comprueba otra vez el mensaje autorizado, exige una clave diferente y comparte el límite de envíos y la reserva de tokens del proceso. Una clave ausente antes del envío libera esa reserva. [Errores de la API de OpenAI](https://developers.openai.com/api/docs/guides/error-codes)

El panel Uso de OpenAI muestra los recibos guardados en el expediente por cuenta y los envíos disponibles durante la sesión. Los tokens son los que reportó el proveedor. Se identifican los envíos sin desglose completo. Los recibos históricos anteriores a r8 sólo cubren respuestas completadas. Las sumas pertenecen a este ejercicio y equipo.

Se verificó el recorrido en Chromium con dos credenciales sintéticas. Una negativa por cuota en la principal condujo al mismo mensaje en Lorenzo con un solo borrador. Un corte en la siguiente consulta dejó un resultado sin confirmar y agotó el tercer envío. El panel funcionó a 320, 390, 768 y 1280 px. La prueba no hizo llamadas externas. El lanzador admite claves temporales y el Llavero de macOS. Sigue pendiente la prueba conjunta con la cuenta real de Lorenzo.

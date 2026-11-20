# Rejon.AI para un despacho mexicano de comercio exterior

**Corte del 19 de noviembre de 2026.** El flujo de mayor valor para probar con los socios empieza con una pregunta concreta sobre una operación, reúne evidencia del expediente y produce un memo con fuentes y una matriz editable de documentos faltantes. Una fracción, una tasa, un plazo o un beneficio fiscal requieren fecha de operación, hechos y texto aplicable. La falta de alguno debe quedar visible en la respuesta.

## Qué puede consultar la instalación

Localicé la base pública de 153,014,272 bytes en el proyecto original y la copié al piloto local. La huella SHA-256 coincide con el manifiesto `ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588`. SQLite pasó `quick_check`. Probé la apertura con el módulo del producto, la búsqueda por palabras de origen y mercancías y la recuperación exacta del artículo 9 de la Ley de Comercio Exterior. El corte del índice es 30/10/2026, con 303 instrumentos y 35,452 artículos. La revisión de fidelidad por muestra registrada cubrió 910 artículos. Cada conclusión de vigencia requiere revisar reformas y transitorios.

El abogado puede buscar artículos en el índice local, elegir un pasaje y preparar una consulta con su cita. El mensaje de cada tarea contiene únicamente los fragmentos y hechos permitidos para esa tarea. El cotejo del apéndice 9 incorpora edición, autoridad y fecha de operación. Para extender la investigación libre al resto de la biblioteca falta determinar sistemáticamente qué publicación y transitorios aplican a cada operación.

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

## Protección contextual y correcciones en r9

El importador procesa cada extracto ficticio con el modelo local. La primera lectura propone los campos y los valores identificables. La segunda selecciona oraciones que podrían identificar a alguien por un turno, un recinto o un acontecimiento. El servidor comprueba los índices de cada lote contra el texto original. Conserva las detecciones anteriores y avisa si la revisión de contexto quedó incompleta. Las reglas locales añaden referencias de compra, lotes, buques, números de viaje y citas logísticas con fecha y hora. Un texto narrativo propuesto por el modelo como título ya requiere una etiqueta o un encabezado identificable en la fuente.

Antes de guardar, el abogado puede ocultar coincidencias exactas mediante selección o escritura del fragmento y deshacer su última corrección. El servidor verifica el original y la revisión en curso. La generación para textos libres importados conserva los límites del piloto. Los envíos de hechos de la operación continúan acotados a los casos de práctica comprobados.

Medición local con qwen3.5:2b-q4_K_M. La cobertura exige ocultar por completo cada identificador anotado. La utilidad exige que la expresión jurídica anotada permanezca íntegra y visible. Las cifras corresponden a documentos sintéticos de desarrollo.

| Serie | Identificadores cubiertos | Expresiones útiles visibles | Restitución |
| --- | ---: | ---: | ---: |
| 14 narraciones iniciales | 19/19 | 20/30 | 14/14 |
| 8 documentos adicionales | 8/8 | 13/13 | 8/8 |
| 10 documentos usados para investigar omisiones | 11/11 | 8/13 | 10/10 |
| 6 documentos nuevos tras los ajustes de detección | 5/5 | 8/10 | 6/6 |

En las 14 narraciones, la edición anterior daba 19/19 y conservaba 12/30 expresiones. En los diez casos de investigación, la primera versión de este corte cubría 7/11. Una segunda lectura recuperó tres descripciones. La comprobación de fecha y hora recuperó la cuarta. Quedan expresiones de mercancía, clasificación y documentación que el modelo oculta de más. La serie de seis es posterior al ajuste, fue redactada por el mismo equipo y no sustituye un examen independiente ni la revisión profesional.

La prueba de interfaz usa Chromium, Ollama real y un proveedor simulado. Oculta dos apariciones del mismo fragmento, deshace la corrección, la vuelve a aplicar por escrito, guarda el expediente, comprueba la restitución y descarga los tres formatos. El evaluador de cuentas y el de valoración siguen disponibles por separado.

Para construir una copia privada desde el checkout ejecuta `python3 scripts/package-local-pilot.py artifacts/Rejon-Comercio-Local-prueba.zip`. Elige un nombre de salida nuevo. Se necesitan Node, npm, Git, zip, Python, la biblioteca SQLite generada y acceso a las dependencias del lockfile o su caché. La construcción compila la interfaz, instala las dependencias de ejecución en un directorio temporal y comprueba los archivos fuente del paquete.

## Contraste de hechos, fundamento y soporte en r10

El documento ficticio de práctica reúne tres decisiones habituales del despacho. Para el flete se examina si el precio pagado ya comprende el gasto y qué tramo cubre. Para las regalías se pide el contrato que sustenta la relación entre pago y venta. Para los anexos se identifica el acuse correspondiente al pedimento. El equipo sugiere una hipótesis cuando encuentra una afirmación expresa. Una contradicción o una expresión de incertidumbre deja el asunto por aclarar. El abogado puede inspeccionar las líneas y preparar una variante diferente.

OpenAI recibe las tres hipótesis de un tema en una sola solicitud con pasajes públicos. La aplicación comprueba que cada selección corresponda a uno de esos pasajes. La edición local inserta la cita, muestra el original del expediente y permite guardar cada borrador. La respuesta para las tres hipótesis se conserva cifrada por asunto y edición de la consulta. El proveedor puede conocer el tema elegido.

Para regalías, se incorporó el registro digital 2013396, jurisprudencia PC.I.A. J/90 A (10a.) del Pleno en Materia Administrativa del Primer Circuito, publicada el 6 de enero de 2017. La ficha conserva registro, órgano, fecha, extracto, enlace y huella de archivo. La aplicación al caso requiere cotejar la resolución, su alcance y los criterios posteriores. [Semanario Judicial de la Federación](https://sjf2.scjn.gob.mx/detalle/tesis/2013396) · [Ley Aduanera, artículo 65](https://www.diputados.gob.mx/LeyesBiblio/pdf/LAdua.pdf)

| Prueba con documentos ficticios | Resultado |
|---|---|
| Flete, una generación real con OpenAI | 378 tokens de entrada y 144 de salida. El cuerpo enviado coincidió byte por byte con el preparado en otro expediente con el hecho opuesto. |
| Regalías, una generación real con OpenAI | 528 tokens de entrada y 129 de salida. La hipótesis de condición de venta eligió la ficha del Semanario. La hipótesis opuesta escogió el artículo 65, fracción III. |
| Acuse, proveedor simulado | Se restituyó la línea que identificaba el anexo en los dos casos opuestos. |
| Navegador y exportaciones | Ollama leyó los Word de prueba. Se comprobaron los anchos de 320, 390, 768 y 1280 píxeles y la reapertura de los borradores. LibreOffice abrió los nueve archivos de los tres temas. Se cotejaron los datos sintéticos y las citas del contenido exportado. |

Las dos llamadas reales usaron la cuenta principal. La segunda operación de cada par reprodujo el resultado mediante una respuesta simulada. El respaldo con la cuenta real de Lorenzo, los equipos de los socios y la evaluación profesional permanecen pendientes.

### Incorporar descargas del Semanario al repositorio de investigación

La SCJN documenta una descarga con archivo de datos y comprobante. El importador admite un ZIP con CSV y recibo PDF, conserva el original y registra la huella, versiones por registro digital y texto buscable en SQLite. Los registros ingresan al área de investigación. Para consultar una muestra desde el repositorio de desarrollo se pueden usar estos comandos. [Manual de descarga de la SCJN](https://bicentenario.scjn.gob.mx/manual-usuario-descarga)

```sh
python3 scripts/import-sjf-export.py --db investigacion.sqlite --zip descarga.zip
python3 scripts/import-sjf-export.py --db investigacion.sqlite --buscar 'regalías condición de venta'
```

Dos pruebas con archivos sintéticos verificaron reimportación, versiones, búsqueda y rechazo de archivos incompletos. Queda pendiente ejecutar el importador con una descarga original del portal y revisar una muestra frente a las fichas oficiales. La ficha 2013396 integrada en la aplicación se cotejó por separado. La cobertura total de una plataforma comercial sigue sin comprobarse.

## Del primer borrador a una solicitud al cliente en r11

El abogado puede tomar las citas del primer borrador como base de una segunda consulta y elegir una solicitud al cliente o una lista de cotejo interna. La función se ofrece para las nueve lecturas documentales de comercio, los pasajes de la biblioteca federal y la nota del ejercicio protegido generado en el equipo. Se almacenan los intervalos originales de las citas y sus huellas. Cada envío reconstruye el texto desde la fuente cotejada. Se conserva la condición de la fracción I cuando se seleccionó su inciso d) en el artículo 65 de la Ley Aduanera. Una primera nota que quedó sin cita verificable requiere otra lectura.

La indicación opcional del abogado se procesa en el equipo mediante reconocimiento de nueve tipos documentales. La vista previa muestra sólo los tipos elegidos, el encargo y las citas. En el ejercicio de práctica de procedencia comprobada se incluyen además sus hechos con sustituciones. Las ediciones de la primera nota permanecen en ese documento. La carta pide dos documentos o acciones concretas. En la lista interna, el expediente restituye la línea del soporte. Para valoración y pedimento, al exportar esa lista se incluyen los renglones guardados del control. La carta y la lista se pueden editar y reabrir por separado.

### Evidencia del recorrido

Se importó un Word ficticio con Ollama en macOS. En Chromium se editó la primera nota de valoración y se escribió una indicación que contenía un nombre de ejemplo y una referencia numérica. El transporte de la primera respuesta fue simulado para fijar las dos citas del ensayo. Las dos consultas siguientes sí llegaron a OpenAI con la cuenta principal. La solicitud al cliente consumió 424 tokens de entrada y 56 de salida. La lista usó 409 y 73. Los mensajes enviados coincidieron con las vistas previas. Se comprobó la ausencia del cliente, nombre de archivo, importe, folio y comentario privado. La carta pidió la factura comercial y el comprobante de pago. La lista pidió cotejar el precio y comprobar quién cubrió los gastos de transporte.

La prueba recorrió 320, 390, 768 y 1280 píxeles, descargó los seis archivos Office y volvió a abrir los dos borradores después de reiniciar el proceso local. El navegador sólo se comunicó con el servicio local de Rejon. La interfaz de seguimiento permite encargos documentales acotados. La conversación de texto libre sobre expedientes reales y la pertinencia jurídica evaluada por abogados siguen pendientes.

En un segundo recorrido se generó una práctica nueva de procedencia comprobada en el equipo. Ollama procesó el ejemplo. Dos turnos consecutivos llegaron a OpenAI. La primera respuesta eligió una cita del artículo 9 de la Ley de Comercio Exterior (390 tokens de entrada y 74 de salida). El abogado añadió una observación de uso interno y pidió revisar la ficha técnica. La siguiente consulta conservó dos hechos del ejercicio, sobre ensamble en Canadá e información del proceso de fabricación. Se comprobó la ausencia de las identidades originales y de la observación en las dos solicitudes. La segunda respuesta usó 287 tokens de entrada y 70 de salida. El equipo restituyó el proveedor en la lista y produjo los tres formatos Office. Para repetir con un nuevo ejercicio ficticio desde el repositorio, ejecuta `node scripts/check-pilot-practice-followup.mjs --openai`. Cada ejecución autorizada puede hacer dos consultas reales. La cobertura de datos indirectos en expedientes ajenos a estos ejemplos requiere validación independiente.

LibreOffice abrió los seis archivos del recorrido de valoración reproducido con las respuestas reales. La lista interna contenía la observación del flete y su importe en todos los formatos. El Excel conservó 412.75 como número. La carta conservó las dos peticiones y las citas. Los documentos incluyeron el cliente y el asunto restituidos. En la primera reproducción faltaba el desglose de tokens simulado de la segunda consulta y la reserva agregada detuvo la tercera. Se repitió usando los recibos capturados y se compararon las huellas de los tres mensajes con las del recorrido inicial.

## Tarifa arancelaria en la mesa de trabajo r12

La búsqueda local de la LIGIE cubre los 8,183 códigos impresos que el extractor reconoce en la captura de 894 páginas. Encontró 11,709 pares distintos de código y página. El índice anterior detectaba códigos al comienzo de una línea. La nueva búsqueda toma las menciones de todas las columnas y del cuerpo del texto. Por ejemplo, 0401.40.02 aparece en las páginas 40, 856, 862 y 891. La página 862 cita esa fracción en la segunda columna de una lista. La ficha conserva esa función documental y deja vacías las celdas de cuota cuando falta un renglón cotejable. La Cámara registra modificaciones a la tarifa hasta el decreto del 13 de octubre de 2026 en este ejemplar. [PDF de la Cámara](https://www.diputados.gob.mx/LeyesBiblio/pdf/LIGIE_2022.pdf) · [Decretos y acuerdos complementarios](https://www.diputados.gob.mx/LeyesBiblio/ref/ligie_2022.htm)

La generación del índice comprueba la huella de la captura. PyMuPDF delimita las celdas mediante las líneas de la tabla. Poppler extrae el texto de manera independiente. Se conservaron 8,112 renglones de 8,102 códigos con el mismo contenido en las columnas de ambas lecturas. Las menciones y referencias adicionales siguen visibles. En 121 renglones se unió texto entre páginas consecutivas con columnas coincidentes, una celda de descripción aislada y continuidad textual. En los bordes de tabla se enlaza la página contigua para cotejo. Para 8414.30.05, la página 631 termina en «desplazamiento» y la descripción continúa en la página 632. La herramienta conserva ambas páginas en la ficha.

La revisión visual de renglones seleccionados abarcó las páginas 2, 631, 632 y 894. Se revisó también la lista multicolumna de la página 862. El acuerdo de los dos extractores acredita coincidencia de texto en la geometría utilizada. La selección de la fracción correcta, su descripción jerárquica, la relación con NICO, las medidas no arancelarias y el arancel aplicable a una operación requieren comprobaciones adicionales. Las cifras y abreviaturas de las fichas reproducen las columnas impresas sin cálculo de impuesto. Una búsqueda por palabras recorre los renglones transcritos y puede omitir partidas cuya descripción depende de encabezados o notas.

El piloto permite conservar una página en el expediente y exportarla aunque sólo contenga una mención del código. En 3,371 renglones se puede iniciar un seguimiento en OpenAI desde una descripción con texto suficiente. Se admiten las muestras con cotejo visual y, para las restantes, se exige coincidencia entre extractores, descripción terminada, longitud admitida, límites de página resueltos y ausencia de las marcas editoriales detectadas. La fuente se reconstruye desde los recursos con huella fija. El abogado puede ver el mensaje autorizado y la ficha conserva la edición original al reabrirla.

Se probó una consulta ficticia en formato de texto con Ollama y un requerimiento documental real a OpenAI. La cuenta principal reportó 246 tokens de entrada y 66 de salida. La respuesta pidió cotejar el diseño y el uso de la bomba contra la ficha técnica. Se verificó que el mensaje coincidía con la vista previa y que no contenía los nombres ni los folios ficticios. El navegador se ejercitó en cuatro anchos. La edición incluye guías de prueba y el material se mantiene en la rama de desarrollo local.

Para reproducir los índices en desarrollo se requieren Poppler y PyMuPDF. La prueba usó PyMuPDF 2.1. En el equipo del abogado la consulta usa los índices preconstruidos y la copia PDF. El siguiente comando escribe los dos resultados en un directorio de trabajo existente.

```sh
python3 scripts/build-tariff-index.py resources/trade/ligie-2022.pdf /tmp/ligie-paginas.json --candidates /tmp/ligie-renglones.jsonl
```

## Identificación comercial por fracción en r13

La biblioteca incorpora las 11,507 combinaciones de fracción y NICO de la hoja «NICO (ÚNICAMENTE)» del SNICE, edición informativa de abril de 2024. Abarcan 8,134 fracciones. Se reconstruyeron las claves del artículo primero del acuerdo de 2022 y se aplicaron, en orden, las creaciones y supresiones de junio de 2023 y marzo de 2024. El conjunto coincide con el del libro. El índice conserva por fila la descripción del SNICE, el acuerdo y la página física donde figura la clave. La aplicación incluye los cuatro originales, comprueba sus huellas al abrirlos y permite buscarlos sin conexión. El corte histórico requiere cotejo para cada operación. [SNICE](https://www.snice.gob.mx/cs/avi/snice/ligie.nico2022.html) · [Publicaciones de la Cámara](https://www.diputados.gob.mx/LeyesBiblio/ref/ligie_2022.htm)

De esas claves, 9,192 tienen además una descripción que coincide con la línea del código en el PDF al normalizar espacios. Los seguimientos usan el control de cita existente. Para los demás renglones se puede leer el PDF, editar la ficha y exportar localmente. Los identificadores `00`, `01` y `99` se guardan como texto en la hoja «NICO consultados». La consulta del catálogo y la generación de esos archivos se realizan en el equipo.

El índice se puede reproducir sin red con Python y Poppler mediante `python3 scripts/build-nico-index.py /tmp/rejon-nico.jsonl` y cotejar con `resources/trade/nico-abril24.jsonl`. Las tablas de correlación del artículo segundo del acuerdo base quedan fuera de la reconstrucción. Para los cambios posteriores se usan el artículo primero de creación y el segundo de supresión.

## Investigación desde una pregunta propia en r14

El abogado puede escribir una pregunta privada en un asunto cifrado. Ollama y el detector del equipo preparan una vista con sustituciones, incluidas las identidades conocidas en ese asunto. La búsqueda local propone pasajes por referencia expresa, tema de comercio y consulta textual en la biblioteca federal. La interfaz identifica las búsquedas que sólo recuperaron términos aislados. Una referencia expresa sin una correspondencia en el corpus se devuelve para revisión. El abogado elige fuente y enfoque antes de preparar el envío.

El mensaje se reconstruye con el pasaje y su localizador cotejados, un enfoque elegido y los conceptos públicos del tema que también figuran en la fuente. El texto libre, las identidades y sus marcadores privados permanecen en el equipo. En la nota se puede recuperar la pregunta original desde el mapa del asunto. La búsqueda orienta la investigación y la selección del pasaje requiere criterio profesional. Esta vía admite hechos sensibles para la prueba sintética en el equipo; OpenAI recibe una consulta documental pública. Sigue pendiente el tratamiento general de expedientes privados en la nube.

El ejercicio ficticio de flete y seguros completó una generación real en la cuenta principal con 290 tokens de entrada y 63 de salida reportados. Se comparó el mensaje visible con el cuerpo enviado y se comprobó la ausencia de los nombres, folio y claves de mapa del ensayo. La cita devuelta terminaba antes de una condición temporal del inciso. El renderizador recupera ahora el pasaje aduanero delimitado completo y, cuando corresponde, su encabezado. La respuesta capturada permite repetir la prueba sin cargo. Las pruebas de alcance cubren también la recuperación de referencias expresas, una consulta sobre el pagaré, el rechazo de campos privados añadidos, las ediciones y la reapertura cifrada. La aptitud general del detector y la pertinencia jurídica en otros asuntos requieren revisión independiente.

La revisión de la suite general detectó que, al faltar el índice opcional de fragmentos, una consulta de aguinaldo mencionando la LFT podía quedarse sin fuente a pesar de existir el artículo en la biblioteca. En r14.1 se vuelve a resolver la referencia editorial del vocabulario contra la copia pública comprobando sus identificadores y huellas. La verificación de la interfaz de almacenamiento enumera ahora los métodos reales de una instancia temporal. Para reproducir en este Mac la prueba del documento Word binario antiguo se compiló Antiword 0.37 con las correcciones de Debian 0.37-18 en el directorio de ensayos. El piloto de preguntas funciona con los componentes incluidos en el paquete.

En ocho preguntas ficticias procesadas por Ollama se midieron la posición de la fuente esperada y la presencia de diez cadenas de identidad anotadas. El primer recorrido situó el inciso de transporte séptimo cuando la pregunta decía «flete». En r14.2, la ordenación reconoce el concepto común a «flete» y «transporte». En la repetición, los siete casos con referencia esperada la mostraron en primer lugar. El artículo inexistente produjo abstención. Ninguna de las diez cadenas anotadas en los siete casos permaneció visible. Este ensayo reutilizó las preguntas de desarrollo después del ajuste. Mide esas cadenas y esas fuentes; la fidelidad de otras interpretaciones y la posible identificación indirecta quedan por evaluar. La medición local se reproduce con `node scripts/measure-pilot-questions.mjs`.

## Del contrato y la factura al cotejo documental en r15

El abogado puede guardar varios documentos en un mismo expediente y escoger dos de la misma operación. Los adjuntos nuevos conservan el archivo original, el texto extraído y su mapa de sustituciones en almacenamiento cifrado local. El texto guardado durante el alta conserva el comportamiento de las versiones anteriores. Los originales se comprueban por huella al descargarlos. Un archivo subido dos veces ocupa una sola entrada en ese expediente.

La prueba de navegador usó Ollama real, una factura TXT y un contrato Word generados con datos ficticios. La línea 3 de la factura indicaba que el precio incluía el flete. La línea 5 del texto extraído del contrato indicaba lo contrario. Rejon mostró ambas, dejó la inclusión por aclarar y generó la hoja **Cruce de soportes** antes del primer envío. También reconoce menciones de regalías y acuses mediante patrones acotados. El abogado debe confirmar que los documentos se refieren a la misma operación y resolver los hechos.

El mensaje público para la consulta de flete coincidió byte por byte con el cuerpo de la prueba real anterior. Para repetir la prueba se usó la respuesta registrada de OpenAI. El navegador permaneció en la dirección local. El borrador restituido incluyó las dos referencias y los pasajes del artículo 65. Se comprobó el contenido de Word, Excel y PowerPoint y su apertura en LibreOffice. El Excel previo al envío también se abrió en LibreOffice. Se recuperaron los originales y se probó el diseño en anchos de 320, 390, 768 y 1280 píxeles.

Los contratos de prueba comprueban la selección de dos documentos distintos, la conservación de la evidencia al cambiar de par, la reutilización de una respuesta pública y la reconstrucción de un seguimiento desde la nota. Comprueban también la restitución de un dato seleccionado en el segundo documento y la retirada de las líneas del anexo de Excel cuando el abogado borra el marcador del soporte. Evidencia local en `artifacts/documentos-r15/`. Para repetir el ejercicio en cada instalación, ver `piloto/LEEME.md`.

## Preguntas con hechos elegidos y conversación de tres turnos en r16

El abogado puede combinar la pregunta del expediente, un pasaje público y hasta cuatro afirmaciones de los documentos de práctica. La selección empieza vacía. Las cláusulas habilitadas proceden de seis archivos ficticios distribuidos con el piloto y del documento generado localmente. Para los archivos distribuidos, se verifica el texto extraído completo contra su huella, omitiendo renglones vacíos. Una cláusula cubierta por las sustituciones queda fuera de la selección. Un documento modificado mantiene la investigación con pasajes públicos y sus funciones locales. Esta comprobación de procedencia permite evaluar el razonamiento contextual con datos sintéticos. La conversación sobre texto libre de clientes requiere más validación.

Se procesaron en Ollama la factura y el contrato ficticios, además de una pregunta sobre el flete. En el navegador se eligieron las dos cláusulas incompatibles y el artículo 65, fracción I, inciso d). La cuenta principal de OpenAI procesó los tres turnos. El transporte comprobó que cada mensaje coincidiera con la vista previa y que no incluyera nombres propios del ejercicio, folios, importes, nombres locales de los documentos ni la anotación que se añadió después de la nota.

| Turno | Resultado observado | Tokens de entrada / salida |
|---|---|---|
| Pregunta con dos hechos elegidos | La respuesta pidió esclarecer si el flete ya estaba incluido y qué comprobante lo acredita. La nota conserva el pasaje seleccionado y su encabezado. | 380 / 110 |
| Solicitud al cliente | Pidió cotejar la factura comercial y el contrato para determinar quién asumió el flete. La carta omitió los fragmentos locales. | 349 / 55 |
| Lista interna desde la carta | Conservó el tema y los tipos de documento del turno anterior. Propuso comparar la factura con el comprobante de pago. En el equipo se recuperaron los dos folios originales. | 378 / 62 |

La primera respuesta dejó implícita la contradicción. La versión entregada también muestra una observación local explícita cuando se eligieron las dos cláusulas opuestas de flete. El abogado debe confirmar que corresponden a la misma operación. Se reprodujeron los tres mensajes con las respuestas reales registradas para verificar el cambio sin consumo adicional. La restitución y la distinción entre hechos y fuente jurídica son comprobaciones de software. El juicio profesional sobre la pertinencia de la respuesta permanece abierto. Evidencia en `artifacts/contexto-r16/`. La guía describe cómo repetir el recorrido en un ejercicio propio.

## De la carta de porte a la nota con folio restituido en r17

El abogado puede elegir hasta cuatro líneas de sus documentos y conservar su procedencia en la nota. La pantalla muestra cada línea con las sustituciones del expediente y señala su destino. Las líneas de archivos propios se incorporan como soporte en el equipo. En las dos prácticas nuevas se verifica la huella del texto y la cobertura de los identificadores anotados antes de habilitar un envío. Una referencia repetida en ambas prácticas conserva el mismo alias temporal en el mensaje. El expediente conserva la correspondencia y recupera el folio donde OpenAI usó el alias.

En un ensayo de navegador se cargaron una carta de porte, un recibo de transporte y una anotación del abogado, todos ficticios. La carta y el recibo discrepaban sobre quién pagó. El servidor comparó el mensaje real con la vista previa antes del envío. OpenAI recibió dos líneas y un pasaje del artículo 65 de la Ley Aduanera. Pidió esclarecer quién asumió el pago y usó la referencia protegida en su lectura. El navegador restituyó el folio CPV-904153 dentro de esa lectura y añadió los tres soportes. Word, Excel y PowerPoint se abrieron en LibreOffice y se cotejó el texto de las tres salidas. La llamada a la cuenta principal consumió 446 tokens de entrada y 117 de salida. Se comprobaron cuatro anchos de pantalla entre 320 y 1280 píxeles.

### Protección y utilidad de documentos inéditos

Cada par contiene dos textos ficticios que comparten una operación. Se anotaron los identificadores directos, los indicios contextuales y las afirmaciones jurídicas cuya lectura debe seguir siendo posible. Se midieron por separado la revisión de cada documento y la proyección de las sustituciones de ambos sobre el expediente. En estos conjuntos las dos mediciones dieron los mismos totales. Una prueba de código aparte verifica que un segundo documento puede aportar una identidad omitida en el primero y que entonces se invalida la selección anterior.

| Conjunto | Textos restituidos | Identificadores cubiertos | Indicios cubiertos | Afirmaciones íntegras |
|---|---:|---:|---:|---:|
| Desarrollo tras los ajustes | 12/12 | 9/9 | 6/6 | 18/18 |
| Transferencia usada durante el ajuste | 8/8 | 8/8 | 8/8 | 7/8 |
| Reserva creada tras el último ajuste del detector | 6/6 | 6/6 | 5/6 | 6/6 |

En el primer recorrido de desarrollo quedó visible un folio de contrato y se conservaron 15 de 18 afirmaciones. En transferencia, la protección llegó a ocultar parte de la declaración «No se detectaron discrepancias en la documentación presentada». En la reserva quedó visible el indicio «la oficina administrativa turno matutino». Ninguna línea de estos 26 documentos se habilitó para OpenAI. En los 38 textos históricos se restituyeron los 38 originales, se cubrieron 43 de 43 identificadores y quedaron íntegras 50 de 66 expresiones.

El modelo local ayudó a redactar los textos de transferencia y reserva. La anotación se hizo en desarrollo. La muestra de reserva es pequeña y todavía requiere una evaluación independiente de abogados, incluida la posibilidad de identificar una operación por una combinación de hechos. Se puede reproducir la medición con `scripts/check-pilot-paired-privacy.mjs`. El ensayo del navegador está en `scripts/check-pilot-question-lines.mjs` y admite `--replay` para repetir el mensaje registrado sin otro cargo.

## Renglones del Anexo 22 y fechas de declaración en r18

El piloto permite consultar el apéndice 9 por clave, descripción o autoridad y fecha de la operación. Incluye los 37 renglones de la publicación de enero, el renglón de mayo y el de septiembre. La extracción con Poppler y el cotejo con PDF.js localizaron la clave y la descripción completa de los 39 renglones en sus páginas físicas. C1 y C6 se repiten entre Economía y Energía. La interfaz conserva la autoridad y el PDF de cada resultado. Una modificación posterior se distingue de la descripción que ya estaba publicada. El intervalo consultable de la captura va del 15 de enero al 19 de noviembre de 2026. [Publicaciones del SAT](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html)

Para AL, el transitorio segundo de mayo remite al acuerdo del 2 de abril. En éste, el trámite se vincula a su liberación en la ventanilla digital. La hoja de la VUCEM distingue el inicio de la captura del aviso el 18 de mayo del inicio de su declaración en el pedimento el 25 de mayo. El abogado puede cotejar la fracción y el NICO contra los 47 pares de 42 fracciones que identifica el acuerdo y leer la acotación que corresponda. También debe comprobar el régimen y que la mercancía coincida con el texto. [Resolución del SAT en el DOF](https://sidof.segob.gob.mx/notas/docFuente/5787425) · [Acuerdo de Economía](https://sidof.segob.gob.mx/notas/docFuente/5783929) · [Hoja de la VUCEM](https://www.ventanillaunica.gob.mx/vucem/meses/mayo2026/Hoja%20informativa%20No_02_Aviso_Automatico_Importacion_Aluminio.pdf)

Para la ampliación de C1 de Economía al azúcar y ciertas preparaciones, la resolución de septiembre remite al acuerdo del 28 de mayo. La ventanilla comunicó la apertura del trámite el 31 de agosto y la declaración del permiso a partir del 28 de septiembre. La tabla de importación definitiva abarca 7 fracciones y 12 pares de fracción y NICO. La extracción conserva una acotación que en el HTML oficial ocupa dos renglones. La ficha distingue este supuesto de los otros permisos C1. [Acuerdo de Economía](https://sidof.segob.gob.mx/notas/docFuente/5788843) · [Resolución de septiembre](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/rgce/2daRMRGCEpara2026.pdf) · [Hoja sobre azúcar](https://www.ventanillaunica.gob.mx/vucem/meses/agosto2026/HOJA_INFORMATIVA_2_Permiso_Azucar.pdf)

**Ensayo con OpenAI.** Para el 21 de mayo, la primera respuesta sugirió verificar la declaración del aviso. La instrucción genérica había pasado por alto que el trámite todavía estaba en fase de captura. Consumió 499 tokens de entrada y 65 de salida. El segundo recorrido envió las mismas cuatro fuentes públicas con una instrucción para generar opciones por periodo. La cuenta principal reportó 587 tokens de entrada y 98 de salida. La respuesta indicó cotejar la clasificación y verificar si se había presentado una solicitud y, en ese caso, revisar el acuse. El equipo eligió la acción de captura y restituyó localmente fecha, fracción, NICO, régimen y acotación. La vista previa se comparó con el mensaje real. El navegador sólo realizó solicitudes al servidor local. Se reabrió el expediente cifrado y se verificó la restitución en Word, Excel y PowerPoint con LibreOffice.

La respuesta registrada se puede repetir mediante `node scripts/check-pilot-pedimento.mjs --replay`. La prueba automatizada aplica el mismo resultado a las tres fases y verifica que una respuesta genérica con dos acciones se rechace. La ficha jurídica conserva valor documental aunque el modelo se abstenga. Para las demás claves se presenta la descripción publicada y su página. La vigencia de otras modificaciones, el resto de los apéndices y la revisión profesional de operaciones concretas siguen pendientes.


## Del texto de la pregunta al cotejo · r19

La pregunta sobre un permiso o aviso del pedimento abre la ficha correspondiente dentro del expediente. El abogado puede seleccionar la fecha, la clave, una fracción con NICO y el régimen directamente de las líneas rotuladas de sus documentos. Una fecha de factura o de publicación, por sí sola, deja pendiente la fecha de operación. La clave C1 de Economía abre con su descripción general. El abogado puede seleccionar el supuesto de azúcar del numeral 8 TER.

En el ejercicio de aluminio dos archivos ficticios contienen el mismo folio y fechas distintas. Con la línea del 21 de mayo, la lista pide comprobar si el interesado presentó una solicitud y, en ese caso, revisar el acuse. Con la del 26 de mayo, pide verificar el número en el pedimento cuando resulte aplicable. Las dos listas conservan la pregunta del expediente, la línea elegida, su fecha y el aviso de discrepancia al cerrar y volver a abrir.

Se reprodujo en ambos recorridos una respuesta real de OpenAI registrada en r18. La comparación por SHA-256 confirmó que los dos cuerpos de solicitud eran idénticos al de aquella llamada. Las fechas privadas, el cliente, el folio y los nombres de los documentos quedaron en el equipo. Esta prueba añadió cero llamadas facturables. LibreOffice abrió los seis archivos y se comprobó que la pregunta, el origen de la fecha, la acción y el fundamento seguían legibles al convertirlos a PDF. El formulario se probó a 320, 390, 768 y 1280 píxeles. La suite de JavaScript obtuvo 1,445 pruebas aprobadas, diez omitidas y cero fallos.

La extracción de campos cubre rótulos reconocidos. El abogado puede corregirlos o aportar valores manuales. La autoridad y el alcance material se confirman en la ficha. Las pruebas pendientes incluyen expedientes inéditos con más de una operación, el criterio de abogados independientes y los equipos físicos de los socios. La guía del paquete incluye los dos documentos y el ejercicio reproducible.


## Defensa comercial · r20

El piloto abre once pasajes de las tres resoluciones del expediente AD_29-24. El texto de investigación conserva la publicación, el punto, la página del PDF y el enlace oficial. Se distribuyen cinco páginas que se pueden abrir desde el equipo. El expediente mantiene separados los efectos de la fecha de publicación y la entrada en vigor de cada acto. La revisión del intervalo entre la provisional y la definitiva sigue abierta. [Inicio](https://sidof.segob.gob.mx/notas/docFuente/5750993) · [Preliminar](https://sidof.segob.gob.mx/notas/docFuente/5777408) · [Final](https://sidof.segob.gob.mx/notas/docFuente/5797943)

El ejemplo de junio muestra cómo documentar ese intervalo. El ejemplo de octubre pregunta por un perfil para escaleras. La consulta recupera el punto 156 y la nota conserva todas las características técnicas de su exclusión aunque el modelo seleccione una cita más corta. El panel identifica el producto en el punto 3 y ofrece el enlace al expediente de perfiles huecos para quien necesite investigar ese supuesto.

En el recorrido de navegador se revisaron los mensajes en español y se compararon con los cuerpos recibidos por un transporte de OpenAI simulado. El cliente, los folios y las fechas consultadas quedaron en el equipo. El ensayo verifica la integración y la restitución. La calidad de una respuesta nueva del proveedor sobre este expediente y la aplicabilidad a operaciones reales requieren pruebas adicionales.

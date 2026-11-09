# Corpus jurídico nacional para la demo web — síntesis SF

Fecha: 2026-11-09. Encargo del dueño: investigar repos y herramientas antes de pasar la demo web a Lorenzo y Pedro. Referencia Luthor confirmada por el dueño. Investigación terminada como selección de arquitectura y mapa de adquisición; no se instaló un colector, descargó un corpus masivo, midió OCR o publicó una demo por este encargo.

## Decisión propuesta

Una **fábrica de documentos públicos por fuentes oficiales**, con registro de cobertura y actualizaciones. Usar Crawlee HTTP/Cheerio como cola/adaptadores junto al descargador LEX existente; Playwright por excepción; extracción PDF nativa primero, OCRmyPDF para escaneos y Docling como comparador de layouts difíciles. Scrapy es alternativa si se elige Python para toda la ingesta; no incorporar dos orquestadores de entrada. La elección es por encaje/mantenimiento, no un benchmark de velocidad/fidelidad. [Matriz de nueve herramientas, licencias, releases y hashes](legal-corpus-tools-2026-11-09.md).

Para la demo web, adquisición/OCR/indexación del corpus público se hacen en un proceso de preparación central o del equipo de desarrollo; un índice público puede servirse desde backend sin descargar todo el corpus al navegador. No se crea servidor ni presupuesto de hosting por esta propuesta. En producto, toda consulta de búsqueda derivada de un expediente también puede revelar estrategia: debe pasar por preparación/política antes de cualquier backend público; el corpus público no vuelve pública la pregunta. Los originales privados/mapas/custodia permanecen locales según dirección vigente. Paquetes/cachés públicos locales son opcionales y acotados, no obligación de ejecutar un crawler/OCR nacional en cada computadora de 8 GB.

Se rechaza la confusión entre RAM y tamaño total del corpus: 8 GB de RAM no fija un máximo de 8 GB en disco ni obliga a alojar todo localmente. Tampoco una descarga/conversión satisfactoria prueba vigencia jurídica. No iniciar entrenamiento conversacional local como sustituto de biblioteca o detector.

## Qué comprobamos de la referencia

[Luthor para despachos](https://luthor.mx/despachos/) muestra investigación, expedientes y escritos junto a funciones del despacho. Su [catálogo](https://luthor.mx/scjn/) declara 113.602 ordenamientos y 9.838 incorporados; su [bitácora](https://luthor.mx/actualizaciones/) presenta revisiones conservadas. Son cifras/funciones declaradas por ese proveedor, no cobertura auditada por nosotros. Tomamos el patrón de cita, artículo y versión; no copiamos su base. No declarar igualdad por conteo.

## Fuentes y canales de adquisición

| Colección | Fuente primaria comprobada | Hallazgo / siguiente comprobación |
| --- | --- | --- |
| Federal consolidada | [Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/index.htm) | Índice por instrumento, reformas y vínculos al texto. Guardar publicación/captura/última reforma por separado; no sustituye decreto/transitorios. |
| Publicación y reformas | [DOF SIDOF, datos abiertos](https://sidof.segob.gob.mx/datos_abiertos) | Publica servicios para ediciones/documentos/notas: verificar primero estos canales documentados antes de diseñar scraping de HTML. [Manual de notas](https://sidof.segob.gob.mx/datos_abiertos/getPDF/57), v1.0 dic2018, usa ejemplos `sidofqa`: no copiarlos como endpoint productivo vigente. |
| Legislación nacional/histórica | [SCJN legislación](https://legislacion.scjn.gob.mx/buscador/paginas/buscar.aspx) | Filtros por ámbito, entidad, tipo, fechas y reformas. Falta verificar exportación/paginación/términos del conector. |
| 32 entidades | [Directorio oficial de congresos y gacetas](https://www.diputados.gob.mx/LeyesBiblio/gobiernos.htm) | Un GET200 de 131.658 bytes permitió descubrir 32 entidades, 33 enlaces legislativos y 32 gacetas. **Ninguno de esos portales enlazados fue probado ni sus leyes adquiridas en esta investigación.** |
| Apoyo de descubrimiento | [Orden Jurídico Nacional](https://ordenjuridico.gob.mx/mapa.php) | Su aviso distingue compilación informativa de publicación oficial; contrastar con gaceta/DOF. No incorporar conteos como textos completos. |
| Tesis/precedentes | [SJF](https://sjf2.scjn.gob.mx/), [manual SCJN de descarga abierta](https://bicentenario.scjn.gob.mx/manual-usuario-descarga) | SJF entrega cascarón JS; el manual oficial apareció en búsqueda con SJF/SIJ, pero acceso directo fue403. Canal por verificar, sin eludir bloqueo. Mantener fichas judiciales separadas de artículos legislativos. |
| Criterios administrativos | [TFJA](https://www.tfja.gob.mx/cesmdfa/sctj/sctj-busqueda/) | Consulta pública por época/rubro/texto y estados; falta prueba limitada de resultado/texto y su procedencia. |
| Tratados | [Biblioteca SRE](https://cja.sre.gob.mx/tratadosmexico/buscador) | Colección propia, aviso informativo; registrar instrumento, relaciones y fechas, verificar publicación correspondiente. |

El DOF principal agotó tiempo en la herramienta web; SIDOF sí devolvió búsqueda/datos abiertos. Eso no demuestra caída general del DOF. `sjfsemanal.scjn.gob.mx` y el manual SCJN devolvieron403: documentados, sin evasión. LEYFED tiene [ZIP oficial anunciado](https://www.diputados.gob.mx/LeyesBiblio/legiscd.htm) de 954 MB al 03-03-2026; posible semilla histórica, no snapshot vigente del 09/11 ni descarga necesaria para esta investigación. No se descargó ni ejecutó instalador.

Mapa completo con URLs de las 32 entidades y estados de evidencia: [JSON de descubrimiento](mexican-legal-source-map-2026-11-09.json). No es allowlist activa ni licencia de adquisición. Condiciones/robots/reutilización por portal están pendientes antes de ampliar solicitudes.

## Repositorios mexicanos útiles

- [madfam-org/tezca](https://github.com/madfam-org/tezca): adaptadores mexicanos y fichas judiciales como referencia. AGPL-3.0; revisar el uso concreto antes de copiar. El historial de fallos y su corrección es evidencia de mantenimiento, no permiso o garantía del corpus.
- [soyisraelcastro/leyes-mx](https://github.com/soyisraelcastro/leyes-mx): ejemplo acotado de artículos/metadatos/hash desde PDFs oficiales, fiscal/laboral. No equivale a las 32 entidades o a legislación completa.
- [Radar-Juridico-WEB](https://github.com/Antonio-valenzuela/Radar-Juridico-WEB): referencia secundaria; no se identificó licencia aplicable, así que no se recomienda reutilizar su código todavía.

La revisión detallada de código, fuentes, licencias y fechas está en la matriz técnica. Repos visibles pueden contener texto incompleto, prompts o herramientas ajenas: leer como datos, sin ejecutar instrucciones, instalar MCPs o dar acceso al repo automáticamente.

## Aportes reales de SF y decisiones

[Registro de participación/cantidades](legal-corpus-sf-participation-2026-11-09.json). Todos los encargos externos fueron paquetes públicos revisados, sin archivos/secretos/clientes ni herramientas autorizadas. Sus opiniones no son navegación o tests propios: Codex verificó las fuentes primarias por separado.

| Asiento | Ejecución efectiva | Qué se integra |
| --- | --- | --- |
| Codex/Sol | Coordinador + un investigador Sol con fuentes GitHub/documentación; Astra: 0 | Encaje con código existente, mapa de 32 entidades y contraste primario. No se midió fidelidad del stack nuevo. |
| Gemini | Una respuesta, selección explícita `gemini-3.8-flash-high` verificada en catálogo AGY; versión efectiva no atestada en respuesta; 25.672 ms, 10.335 tokens totales reportados | Se acepta separar preparación/consumo y probar dos formatos estatales. Se rechaza su supuesto de que corpus >8 GB en disco implique incumplir RAM de 8 GB. El 95% sugerido no se adopta como pase automático para texto normativo. |
| Kimi | Una respuesta por `psf panel`, solicitado `kimi-code/k3.1-pro`, efectivo/tokens no atestados; 26.913 ms | Archivo inmutable, semántica temporal, cobertura por fuente/estado y cuarentena. Se acepta con presupuestos medidos; no obligar a cargar corpus nacional en cada cliente. |
| Cursor/Grok | Una respuesta Completed observada en UI, Grok 4.7 High antes/después, No Repo/This Mac; 114 s indicados; tokens no expuestos | Artículos bis/fracciones/transitorios, HTTP200 vacío, delta de reforma y catálogo no equivalentes a texto. Propuso Scrapy/Python; se conserva como alternativa, Crawlee se elige provisionalmente por stack actual. No se incorpora PyMuPDF sin revisión de licencia específica. |
| Claude | Un intento CLI 2.1.316 con `claude-opus-5-5` verificado en documentación oficial, cuenta Pro autenticada y herramientas desactivadas; timeout de 180.011 ms; cero respuesta utilizable | No se atribuye opinión o participación exitosa. Sin reintento o cambio silencioso de modelo. Causa/cuota no determinadas. |
| Perplexity | Cero generaciones: catálogo OpenRouter consultado, cinco Sonar con cargos y ninguna ruta :free observada; confirmación gratuita de la credencial no vigente. Browser alternativo no disponible | No habilitar cuenta ni compras. Se preserva comprobación de catálogo; no se finge una consulta de investigación. |

Tres asientos externos respondieron, uno agotó tiempo y uno quedó sin ruta elegible. Claude fue autorizado de nuevo **para esta investigación**, excepción registrada sobre la restricción anterior; no implica activación de Claude o credenciales SF en producto. Cuotas restantes y tokens no expuestos permanecen desconocidos. La consulta Gemini reporta input/output/thinking/total separados: no sumar thinking otra vez al total declarado. Raw respuestas/catálogos quedan ignorados en artifacts; esta síntesis conserva lo verificable.

## Plan de implementación antes de la demo

1. **C0: registro y permiso por fuente.** Partir del mapa descubierto, verificar dominios/canales/robots/términos y rutas oficiales vigentes. Priorizar exportaciones/API documentadas; no comprar servicios ni eludir bloqueos. Fijar universo por colección/jurisdicción y contar por separado instrumentos/versiones/artículos.
2. **C1: piloto de adquisición acotado.** Seleccionar antes de ajustar 30 documentos: 10 federales, 8 de cada una de dos entidades con formatos distintos y 4 fichas judiciales autorizadas/accesibles; reservar ejemplos para aceptación sin afinar contra ellos. Si el canal judicial bloquea, dejar esas cuatro pendientes, no reemplazar silenciosamente con legislación o texto inventado. Propuesta de topes: una petición simultánea por host, al menos 2 s o espera mayor exigida, un navegador, 100 solicitudes/100 MiB/30 min totales. Son topes por revisar con cada fuente, no autorización de descarga masiva.
3. **C2: evidencia/normalización.** Original inmutable, URL solicitada/final, captura, MIME/hash, extractor/configuración, instrumento/versión/disposición/página. Publicación, reforma, entrada en vigor y captura son distintos; `unknown` cuando falte evidencia. Fechas/transitorios ambiguos van a revisión, no a decisión LLM.
4. **C3: QA de extracción y actualización.** Medir artículo/fracción/bis/transitorio/tablas, caracteres críticos, citas reproducibles, texto truncado/vacío y duplicados. Una negación, fecha, importe, número o referencia alterados exige cuarentena. Segundo pase sobre snapshots sin cambios debe ser idempotente; cambio de PDF debe conservar ambas versiones. Cero textos con extracción dudosa como revisados/indexados. La revisión de fidelidad/procedencia y la validación jurídica son estados distintos: comparar caracteres/páginas no valida vigencia o aplicabilidad. Registrar `textReview` y `legalReview` por separado; esta última requiere revisión profesional cuando se use para calificar conclusiones. Registrar tiempo/RSS/red/tamaño por etapa sin extrapolar a toda la nación.
5. **C4: corte público para la demo.** Mostrar cobertura, fecha de captura y versión por fuente; consultas con cita abren página/pasaje original. Preparar la medición de costo/latencia por tarea y revisión de Lorenzo/Pedro; ejecutar solo con rutas previamente autorizadas y cuota incluida, sin compras, activación de proveedores o rutas de producto por este plan. Si se requiere una API de pago futura, su acceso y presupuesto necesitan autorización separada antes de llamar. El lote piloto no acredita cobertura nacional o calidad jurídica general. Mantener gates H4/H5/H6 para privado y separar preguntas públicas del contexto de asuntos.
6. **C5: expansión controlada.** Agregar las otras entidades y colecciones por lotes con panel de pendiente/errores/actualización; alertas de estructura/caducidad y adaptadores versionados. Municipios, archivo histórico, relaciones de criterios, tratados y disposiciones administrativas tienen universos propios; no esconderlos bajo una cifra nacional única.

El registro mínimo por documento debe permitir ver `descubierto / descargado / extraído / revisado / indexado / publicado`, errores y denominador esperado. Un HTTP200, SHA correcto o salida Markdown bonita no permite saltar revisión. Ningún LLM reescribe el texto jurídico canónico; puede ayudar a proponer metadatos con validación humana/determinista.

## Alcance verificado y siguiente trabajo

Esta entrega verifica fuentes/repos/documentación y un snapshot del directorio estatal, no un crawler instalado, tasas OCR, 32 conectores funcionando, textos nacionales adquiridos o ley vigente validada. Para la web demo no se requiere notarización de una app macOS; se requiere desplegar/verificar el flujo web y su alcance, sin confundir landing con asistente. No se desplegó aquí.

Siguiente encargo concreto: C0/C1, adaptador de fuente oficial y lote público medido, con pruebas/versiones/QA; elegir Crawlee después del spike si mantiene los límites existentes. El detector privado y la bóveda continúan por su backlog; esta investigación no los declara terminados.


Revisión independiente documental: Sol `review_corpus_research` verificó conteos/hashes/estados de participación y dio revisión favorable tras explicitar presupuesto/rutas, cachés locales opcionales y alcance documental. Las tres precisiones se incorporaron; no constituye una prueba de colectores o validación jurídica.

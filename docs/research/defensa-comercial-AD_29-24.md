# Defensa comercial · perfiles y barras de aluminio

El expediente AD_29-24 de la Secretaría de Economía permite comprobar si el asistente distingue el inicio de una investigación, una medida provisional y una definitiva. El 19 de noviembre de 2026 se capturaron el texto oficial y la ficha de publicación de cada acto. El manifiesto conserva las seis direcciones, huellas y tamaños. El verificador comprueba expediente, producto, fechas de publicación y pasajes del resolutivo. [Inventario de las capturas](defensa-comercial-AD_29-24.json)

| Etapa | Publicación | Entrada según el transitorio | Qué tiene que leer el abogado |
|---|---|---|---|
| Inicio | 5 de marzo de 2025 | 6 de marzo de 2025 | El punto 183 abre la investigación y el 191 fija la entrada en vigor. La fecha de inicio permite distinguir los argumentos de las partes de las conclusiones posteriores. [DOF, inicio](https://sidof.segob.gob.mx/notas/docFuente/5750993) |
| Preliminar | 29 de diciembre de 2025 | 30 de diciembre de 2025 | El punto 296 impone una cuota provisional de 1.55 USD/kg. El 298 fija una duración de cuatro meses. El 301 aborda la prueba de origen y el 306 la entrada en vigor. [DOF, preliminar](https://sidof.segob.gob.mx/notas/docFuente/5777408) |
| Final | 4 de septiembre de 2026 | 5 de septiembre de 2026 | El punto 381 fija 1.58 USD/kg para los productos comprendidos, de origen chino, incluidas importaciones definitivas y temporales. El 383 trata la prueba de otro origen. El 386 fija la entrada en vigor. [DOF, final](https://sidof.segob.gob.mx/notas/docFuente/5797943) |

## Qué comprobar antes de responder sobre una operación

- Identificar el producto a partir de ficha técnica y características físicas. El expediente AD_28-24 sobre perfiles huecos tuvo un acto de inicio el mismo día. La palabra «aluminio» y la fecha coinciden en ambos expedientes. [DOF, perfiles huecos](https://sidof.segob.gob.mx/notas/5750992)
- Distinguir origen, procedencia, régimen y fecha. El resolutivo final enumera cinco fracciones y contempla el ingreso por otras. Un resultado de búsqueda por fracción es insuficiente para afirmar por sí solo que una mercancía concreta quedó comprendida. [DOF, puntos 381 y 383](https://sidof.segob.gob.mx/notas/docFuente/5797943)
- Para una operación entre la duración de la provisional y la entrada de la definitiva, documentar cualquier acto intermedio y su alcance. El expediente de investigación conserva ese intervalo pendiente de resolver. La cuota final tampoco sustituye un cálculo de arancel, IVA, aviso automático o preferencia de origen. [DOF, punto 298](https://sidof.segob.gob.mx/notas/docFuente/5777408) · [DOF, puntos 381 y 386](https://sidof.segob.gob.mx/notas/docFuente/5797943)

## Reproducción

Las capturas están en `artifacts/public-corpus/defensa-AD_29-24/`. Para rehacer el inventario en el repositorio, ejecuta `python3 scripts/index-antidumping-case.py artifacts/public-corpus/defensa-AD_29-24` y compara su salida con el JSON de esta carpeta. Para una nueva captura descarga los seis enlaces en otro directorio con los nombres del manifiesto. Las fichas del portal pueden incluir elementos que cambian a diario.

## Incorporación al piloto privado r20

Se descargaron las tres ediciones completas del DOF desde el enlace de cada ficha oficial. La extracción encontró once pasajes en cinco páginas. Cada pasaje coincide entre el texto obtenido del PDF y el HTML tras normalizar espacios, puntuación y mayúsculas. Las páginas distribuidas conservan el texto de la página original según una segunda extracción con Poppler. El inventario guarda la huella de cada edición completa y de cada página distribuida. [Pasajes y ediciones](../../resources/trade/ad29-pasajes.json)

El piloto permite investigar estas resoluciones por fecha y punto. El punto 3 distingue los perfiles sólidos o no huecos. El 156 precisa qué características técnicas sustentan la exclusión de ciertos perfiles destinados a herramientas, escaleras y niveles. La cobertura de una pieza requiere cotejar las especificaciones del expediente. Para una fecha de junio de 2026, la herramienta deja abierta la aplicación de medidas hasta verificar el intervalo y cualquier acto intermedio. A partir de las tres ediciones consultadas tampoco se puede certificar la ausencia de actos posteriores. [Resolución final del DOF](https://sidof.segob.gob.mx/notas/docFuente/5797943)

Para reproducir el cotejo, guarda en `artifacts/defensa-r20/edicion-0.pdf`, `edicion-1.pdf` y `edicion-2.pdf` las ediciones de inicio, preliminar y final de las direcciones del inventario. Ejecuta `python3 scripts/extract-remedy-passages.py artifacts/defensa-r20 artifacts/public-corpus/defensa-AD_29-24 resources/trade`. Se requieren las herramientas Poppler.

## Seguimiento reproducible en el histórico del SNICE

El 19 de noviembre de 2026 se capturó el histórico de publicaciones del DOF que mantiene el SNICE. El nuevo recolector guarda el HTML original y un índice JSON bajo su SHA-256. Cada fila incluye fecha, título, dependencia, enlaces y códigos del DOF que se pudieron leer. Una fila con contenido pero sin fecha suficiente se conserva para revisión. [Histórico oficial del SNICE](https://www.snice.gob.mx/cs/avi/snice/historicos.dof.html)

En esta captura se leyeron **843 filas fechadas**, desde el 21 de enero de 2020 hasta el 2 de noviembre de 2026. De ellas, **814** tienen al menos un código del DOF reconocible en el enlace. La búsqueda literal de «perfiles y barras de aluminio» devolvió los tres títulos del expediente de esta ficha, con códigos 5750993, 5777408 y 5797943. Un segundo lector HTML confirmó las tres coincidencias. El histórico puede omitir actos o describirlos con otro título. Para decidir una operación en el intervalo entre la medida provisional y la definitiva aún se requiere verificar los actos aplicables directamente en el DOF.

Para obtener una captura nueva, ejecuta `python3 scripts/index-snice-publications.py artifacts/snice-historico`. Para reproducir la captura añade `--input ruta/al/original.html`. La huella del HTML contrastado es `2dbca127f3ab95f0921d33a1c59861e358bbf90d82ffd54838b41aa6343a8ee2`. El resultado sirve para localizar publicaciones candidatas. Para incorporar su contenido al buscador jurídico hay que obtener la publicación completa, determinar su versión y comprobar los pasajes y sus fechas.

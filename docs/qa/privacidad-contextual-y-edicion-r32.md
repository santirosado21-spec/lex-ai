# Privacidad contextual y edición del abogado

**20 de noviembre de 2026.** El piloto r32.1 revisa por separado personas, empresas, referencias, lugares y contactos en narraciones de comercio exterior. El modelo sigue siendo local. Para las descripciones de una ruta, huellas físicas y sucesos, Rejon también solicita fragmentos literales y los comprueba contra el original. Si la cita no coincide, conserva protegida la cláusula seleccionada. Si la respuesta de revisión resulta incompleta, la aplicación lo indica. El flujo de envío conserva sus restricciones sobre los documentos de prueba acreditados.

Los datos que el asunto ya identifica se buscan también con variaciones de mayúsculas, acentos, espacios y guiones tipográficos. Al abrir un documento anterior se vuelven a aplicar las identidades del expediente. La restitución mantiene la ortografía del original. Las pruebas incluyen dos documentos importados en orden inverso al descubrimiento de una identidad, reapertura del expediente, una forma Unicode descompuesta y una referencia con guion indivisible.

## Cómo se midió

El ensayo local importa cada texto, comprueba la restitución exacta del texto extraído y reúne la vista protegida de sus documentos y preguntas. Un indicio sólo cuenta como cubierto si se ocultaron todas sus letras y números. Un hecho útil cuenta como conservado si siguió legible en su totalidad. Una expresión parcialmente legible puede perder el punto aun si parte de sus palabras seguía a la vista. Todos los textos son ficticios.

| Expediente | Identificadores en r32.1 | Indicios completos, anterior → r32.1 | Hechos legibles, anterior → r32.1 |
|---|---:|---:|---:|
| Café, ceniza y procedencia | 3/3 | 0/3 → 3/3 | 4/8 → 8/8 |
| Embalaje, valor y reembolso | 3/3 | 1/5 → 4/5 | 4/9 → 7/9 |
| Depósito y patio de maniobras | 3/3 | 1/2 → 1/2 | 6/8 → 6/8 |
| Productores, amarre e incidente vial | 3/3 | 2/4 → 4/4 | 3/7 → 6/7 |
| Declaraciones de origen y materiales | 6/6 | 5/5 → 5/5 | 5/6 → 5/6 |
| Empaque | 5/5 | 4/4 → 4/4 | 5/7 → 5/7 |

El caso de café venía de r31. En embalaje se fijaron las anotaciones antes del primer ensayo y se usaron sus errores para ajustar el detector. El caso adicional de depósito se redactó y anotó antes del cambio en la revisión de indicios. La medición final no mejoró en ese caso. La descripción de las grúas siguió parcialmente visible. Las dos nuevas muestras quedaron fijadas en el repositorio con las huellas `183672d9d5648efb18670cb26f290403d7cb653fa6693a861d7b1a82de50e870` y `bb4402266daef8b8ac55082ebe59f39792d1b9c7f4454afbfa9180968922fa4f`. Son muestras pequeñas con anotaciones de desarrollo. La revisión profesional independiente y las pruebas con los socios siguen pendientes.

En los 38 documentos históricos, se restituyeron los 38 textos y quedaron protegidos 35 de 35 identificadores y 31 de 32 indicios. Los hechos técnicos legibles bajaron de 48/50 a 47/50. La frase «El transportista indicó que el resto se enviaría en la siguiente ruta» perdió legibilidad en la vista protegida. Ninguna línea de estos documentos quedó habilitada para enviarse a la nube.

## Recorrido del abogado

En un expediente nuevo se importaron las dos minutas de `piloto/minutas-cafe-ficticias.txt`. En Chromium se recorrieron las sustituciones con los botones anterior y siguiente. Se comprobó la posición de la selección al cambiar entre el texto protegido y el original y se revisó la vista a 390 píxeles. En la biblioteca se buscó el renglón 09.01 del Anexo 4-B del T-MEC. Las dos líneas de las minutas se eligieron como evidencia local.

La vista previa coincidió con el mensaje público de la consulta anterior sobre café. Se cotejó la huella de la petición completa antes de reproducir la respuesta registrada. El folio, las dos líneas, el nombre del archivo y las pistas de procedencia quedaron en el equipo. En otra ejecución del mismo expediente se editó el borrador protegido, se abrió el soporte, se insertó su marcador y se guardó la observación del abogado. Al recuperar los datos y reabrir el expediente reaparecieron el folio, la observación y las líneas originales. La segunda cuenta se comprobó por simulación de respaldo y contabilidad. Las pruebas de esta entrega consumieron cero llamadas reales a OpenAI.

También se repitieron el ejercicio acreditado de discrepancia de productores y el cotejo de dos cantidades de una hoja propia. LibreOffice abrió las doce exportaciones correspondientes a las cuatro ejecuciones y las convirtió a PDF. En las tres salidas de la edición del abogado se cotejaron su texto con el folio, la cita jurídica y las dos minutas. En Excel se verificaron además las cadenas de las celdas.

## Reproducción

- `node scripts/measure-intake-dialogue.mjs eval/privacy-trade/dialogo-embalaje-valor-r32.json --app=RUTA_APP`.
- `node scripts/check-pilot-paired-privacy.mjs eval/privacy-trade/expedientes-pareados-reserva.json --app=RUTA_APP`.
- `node scripts/check-pilot-product-origin.mjs RUTA_APP RUTA_RESULTADOS --minutas --replay=RUTA_RESPUESTA_CAFE`.

El ZIP privado `Rejon-Comercio-Local-20261120-r32.1.zip` ocupa 125 622 568 bytes. Su SHA-256 es `9cffffa4514844d4a69ea1081552ec878dd2961398383b1b786fc17a004ba21a`. La suite aprobó 1 486 pruebas, omitió diez y registró cero fallos. La prueba se realizó en este Mac con Ollama y `qwen3.5:2b-q4_K_M`. Quedan pendientes las pruebas en un equipo físico de 8 GB y en Windows, así como el uso con la clave real de Lorenzo.

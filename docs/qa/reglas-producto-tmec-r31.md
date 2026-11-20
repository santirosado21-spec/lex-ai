# Reglas de origen por producto en el piloto privado

**20 de noviembre de 2026.** En Biblioteca federal, el abogado puede buscar un código del Anexo 4-B o abrir la regla desde una coincidencia de la tarifa mexicana. Rejon muestra la página de la edición del DOF del 29 de junio de 2020. El abogado puede abrir el PDF en su equipo y preparar una consulta sobre los renglones que tienen un extracto cotejado. [Publicación del tratado en el DOF](https://dof.gob.mx/2020/SRE/T_MEC_290620.pdf).

## Cobertura y procedencia

| Qué se contó | Resultado |
|---|---:|
| Capítulos con encabezado en la sección B | 96 |
| Referencias distintas por renglón y página entre las páginas 86 y 187 | 1 032 |
| Renglones con una oración completa cotejada por código, texto y página | 507 en 91 capítulos |
| Referencias con llamada de nota al pie reconocida | 48 |
| Consultas comprobadas de principio a fin con una respuesta real | 2 |

La fuente incluye 1 101 páginas y tiene la huella SHA-256 `ecea17b0e46a8f37f1391dae908548461ddcd0c8b385fcf19615576277622bbd`. El índice se regenera con `python3 scripts/index-tmec-product-rules.py`. Se cotejaron sus 1 032 referencias mediante una segunda extracción del mismo PDF con Poppler en modo de orden de lectura. Para cada uno de los 507 extractos se encontró la secuencia completa y contigua formada por el código y el texto en la página indicada, ignorando espacios. Durante el desarrollo, esta verificación detectó cuatro superíndices que el modo de diseño colocaba en otra línea. Las referencias con notas al pie remiten a la página impresa.

Las búsquedas de códigos nacionales localizan renglones por sus primeros cuatro o seis dígitos. Corresponde revisar la tabla de equivalencias, la versión del Sistema Armonizado, las notas y la fecha de operación. El puente con la LIGIE conserva la fracción buscada. La coincidencia de dígitos entre ediciones es una pista para localizar la disposición. Hace falta comprobar su correspondencia jurídica. Las notas breves extraídas acompañan la consulta. Los bloques largos se consultan en la página enlazada. La comprobación de texto acredita transcripción. La suficiencia para un caso y la vigencia requieren revisión jurídica.

## Dos casos reproducidos desde el ZIP

**Cacao.** La consulta de 1806.10 incorpora los dos renglones de la página 90, la correspondencia mexicana en la página 187, la prioridad y la regla de peso de la página 86 y la excepción del Anexo 4-A en la página 85. OpenAI distinguió la regla de la fracción específica de los límites de composición de la regla general. Sugirió cotejar clasificación, composición, peso y origen. La lectura medía 339 caracteres. El primer límite local de 300 la rechazó aun con una cita literal correcta. Se amplió la tolerancia para estas lecturas y se reprodujo la respuesta original.

**Café.** La búsqueda de 0901.21.01 en la edición del tratado llevó al renglón 09.01. OpenAI se abstuvo con las dos primeras formulaciones. La tercera distinguió el cambio de clasificación previsto en la norma de la evidencia que el abogado podría solicitar para cotejarlo. El modelo propuso una ficha técnica o un registro de insumos. La lectura y la cita se conservaron. La pregunta devuelta carecía de signos de interrogación y la aplicación mostró la pregunta de cotejo del despacho, identificada como tal.

Se realizaron cuatro llamadas a OpenAI con material público. Consumieron 2 072 tokens de entrada y 246 de salida según las cuatro respuestas. Cada solicitud contenía el mensaje que el abogado podía leer. El cliente ficticio, el asunto, el folio y la pregunta privada completa permanecieron en el equipo. Desde una extracción nueva del ZIP se reprodujeron las dos respuestas aceptadas, se reabrieron los expedientes y se descargaron seis archivos. LibreOffice abrió los seis y los convirtió a PDF. Se cotejaron en sus páginas el folio dentro de la pregunta, la cita, la lectura y las referencias jurídicas. Las dos hojas de Excel también conservaron el contenido en sus celdas.

Se probó el recorrido desde la tarifa, una búsqueda vacía de resultados, el selector de capítulos, un intervalo y una referencia con nota al pie. Se comprobó que la página no desbordara a 320, 390, 768 y 1 280 píxeles, además de la animación y la preferencia de movimiento reducido. El lanzador completó respaldo por cuota y uso por cuenta con dos credenciales simuladas. La suite aprobó 1 480 pruebas, omitió diez y registró cero fallos. La revisión de los socios, la segunda cuenta real, Windows y el equipo físico de 8 GB siguen pendientes.

**Paquete.** `Rejon-Comercio-Local-20261120-r31.1.zip` · 125 617 166 bytes · SHA-256 `68bdd4358cdc22c737da85286019dc130e4dc8786d04a5c892d05e764f4ed796`. El ensayo de navegador está en `scripts/check-pilot-product-origin.mjs`. Admite el directorio de la aplicación y el de salida, `--cafe` para el segundo caso y `--replay=RUTA` para comprobar el cuerpo completo de la petición antes de reutilizar la respuesta.

## Medición nueva de privacidad

El modelo local redactó tres textos ficticios sobre café. Antes de ejecutar el detector se fijaron el texto y las anotaciones en `eval/privacy-trade/dialogo-insumos-cafe-r31.json`, SHA-256 `522427f6473023575f8bb699041bb71c777a8516ecceda05e946fe601fa82d34`. La anotación distingue el folio, las pistas físicas o geográficas y los hechos de clasificación que conviene conservar. En la copia extraída del ZIP se protegieron las **3/3** apariciones del folio con un solo marcador, quedaron íntegros **4/8** hechos y se cubrieron por completo **0/3** indicios. Las pistas eran ceniza volcánica, una referencia al altiplano y residuos minerales. Se restituyeron los tres textos. Ninguna línea se ofreció para envío. El ensayo de privacidad hizo cero solicitudes a la nube. La muestra incluye una minuta que no repite el suceso de la primera. Estos resultados son de este expediente de tres textos.

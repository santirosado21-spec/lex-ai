# RGCE: compilado adquirido y condiciones frente a la tercera resolución final

24 de noviembre de 2026, 09:49 America/Mexico_City. Investigación documental, sin adopción ni cambios del corpus activo.

## Cambio de frontera comprobado

El DOF sí publicó la tercera RMRGCE el **23 de noviembre de 2026**, con anexos 1, 18, 21, 22 y 29. Se leyó el cuerpo completo de la nota 5804604, incluida su fecha, transitorios, anexos y firmas. La captura SAT de las 14:44 UTC no la listaba, por lo que no bastaba para concluir ausencia final. Las anticipadas ya no deben manejarse como la única frontera documental. Tampoco se ha probado que esta sea la última publicación de todo comercio exterior.

Fuente leída: https://dof.gob.mx/nota_detalle.php?codigo=5804604&fecha=23/11/2026&print=true

El índice DOF había enlazado la misma nota con un parámetro de año 1926. El cuerpo mostraba 2026 y su enlace de impresión proporcionó la URL anterior, recuperada y leída sin inventar la corrección.

## Adquisición del compilado de segunda RMRGCE

Destino literal del catálogo, bajo `rmf/compiladas`, recuperado con HTTP 200 el 24nov a las 15:46:40 UTC:

https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/compiladas/Compilado2daRMRGCEpara2026.pdf

5,908,925 bytes, 481 páginas, extracción exitosa de 2,370,483 caracteres. SHA-256: `3b49ccad0e22b5faff341ad692df0ccb9c755dc74897388d1bb923aafd8820e4`. Portada inspeccionada visualmente: identifica segunda reforma de 22sep2026 y advierte que el sustento legal debe ser la publicación DOF. La ruta anómala del directorio no impidió que el destino fuera el documento indicado. Se mantiene en cuarentena; no representa la tercera reforma recién localizada.

## Condiciones por disposición

| Disposición | Evidencia leída | Condición o diferencia relevante | Dependencia siguiente |
| --- | --- | --- | --- |
| Regla 1.1.2 | Original RGCE y compilado segunda RM, p. 10 de este último | Difusión anticipada informativa; distingue beneficios y fechas expresas. El texto operativo leído conserva esa distinción. No se declara igualdad exacta del bloque extraído porque contiene encabezados/pies distintos. | Validar texto base con DOF y cadena de modificaciones, no derivar vigencia solo del compilado. |
| Manifestación de valor, transitorio décimo primero | Primera anticipada p. 1; segunda anticipada p. 2; apartado segundo de resolución final | Las seis fechas por régimen aparecen también en final: 1nov, 15nov, 1dic, 15dic2026, 1ene y 15ene2027. Coincidencia de fechas comprobada, no diff íntegro del párrafo. | Cotejo literal por párrafo y análisis temporal de fechas anteriores a la publicación final mediante 1.1.2; no presumir retroactividad general. |
| AVC, regla 3.1.43 | Segunda anticipada pp. 1-2; resolución final | Figura en final. No autoriza por sí sola aplicación universal a toda operación. | Identificar aviso ANAM que anuncia operaciones concretas. |
| AVC y contingencias | Segunda anticipada transitorios segundo/tercero; final tercero/cuarto | El final conserva dependencia de operaciones anunciadas por ANAM, retorno a 3.1.33 ante eventualidad anunciada y sustitución DODA/AVC solo dentro de operaciones correspondientes. Cambió numeración de transitorios. | Recuperar avisos operativos, fecha de habilitación y contingencias aplicables al caso. |
| Entrada general de resolución | Final transitorio primero | Texto dispone día siguiente a publicación, con tratamiento separado de anticipadas vía 1.1.2. La fecha derivada sería 24nov2026; no convierte en incondicionales las excepciones siguientes. | Revisión independiente de cada excepción. |
| Transmisión marítima, reglas 1.9.8/1.9.9/1.9.20/1.9.21 | Final transitorio segundo | Entrada condicionada a habilitación informática anunciada por ANAM. Estas modificaciones no estaban cubiertas por la unidad inicial de tres anticipadas. | Aviso de habilitación ANAM. |
| Ventanilla Digital, glosario III.40 | Final transitorio quinto | Depende de calendario publicado en Ventanilla Digital y condiciona sustitución de referencias de portal. | Calendario de Ventanilla Digital. |
| Anexo 22, apéndice 9, clave CL | Anticipada p. 1 y anexo final | CL aparece en final. Su inclusión no prueba por sí misma una obligación universal de certificado. | Cotejo con regulación sustantiva que exige certificado y su ámbito material. |
| Anexo 22, apéndice 1, Tulum | Anexo final | Final agrega sección 53/4 del Aeropuerto Internacional de Tulum. No estaba en la anticipada de Anexo 22 adquirida. La anticipada no cubre todo el cambio final. | Cotejo del apéndice completo y alcance operativo. |

## ANAM: avance y límite

Se recuperaron la página https://www.anam.gob.mx/aviso-de-cruce-avc/ y el PDF enlazado https://www.anam.gob.mx/wp-content/uploads/LAVC_VF_noviembre-2026-1.pdf . El PDF identifica versión 1.0, noviembre de 2026, y control de versiones de 20nov2026. Es evidencia técnica de procedimiento, no se ha identificado en él el anuncio específico de operaciones exigido por el transitorio tercero. No usar existencia de manual o servicios web como prueba suficiente de habilitación general. No se crearon cuentas ni se usaron credenciales de ejemplo.

## Evidencia reproducible y límites

En `artifacts/library-expansion-20261124/`:

- `compilado2da-acquisition-manifest.json`: URL literal, respuesta, cabeceras, hashes y tamaño del nuevo PDF.
- `rgce3-final-conditions-acquisition.json`: adquisición de impresión DOF y lineamientos ANAM.
- `rgce3-final-conditions-evidence.json`: secciones extraídas, offsets normalizados y comprobación de seis fechas presentes en anticipada y final. No es diff exacto.
- HTML y textos originales conservados. Incluyen estilos/scripts fuera del cuerpo normativo, que no se interpretan como artículos ni instrucciones.

SHA-256 HTML impresión DOF: `d75b8279d1491c95473175300e04553c4ab954852407a8ba7888fa0af694fd38`.

SHA-256 PDF lineamientos ANAM: `ba40c6b0f517ae779fe7288ba7961a91aaab8157bdfdf3be755e59c3ac2d7049`.

No se certifican completitud, vigencia de cada disposición, equivalencia íntegra anticipada/final ni fidelidad integral de extracción. Próxima dependencia concreta: revisión independiente de esta final y adquisición de los avisos ANAM/calendario Ventanilla que activan las excepciones. El corpus permanece no adoptado.

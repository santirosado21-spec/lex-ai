# Corrección del cruce RGCE / Anexo 22

24 de noviembre de 2026. Evidencia acotada a la captura SAT de las 14:44:28.860794 UTC, no al cierre del día ni al DOF vivo. Sin adopción.

## Correcciones comprobadas en evidencia propia

1. La afirmación de ausencia del compilado de segunda resolución RGCE es incorrecta contra la captura. El HTML guardado contiene un enlace con etiqueta de compilado de segunda RMRGCE para 2026.
2. La ruta reproducida en el cruce OpenCode también es incorrecta. El `href` observado en `catalog-0.html` usa `documentos2026/rmf/compiladas/Compilado2daRMRGCEpara2026.pdf`, no el directorio `rgce/compiladas` que menciona ese informe. Se registra como dato del catálogo, sin corregirlo ni atribuir contenido al destino no recuperado.
3. No aparece un PDF con ese nombre en el lote ni una entrada de adquisición para ese destino en `acquisition-manifest.json`. El compilado de primera RMRGCE y el compilado de Anexo 22 de segunda RMRGCE son otros recursos. No confundirlos con el compilado de segunda RMRGCE. Su enlace en catálogo no prueba descarga, integridad ni texto del destino.
4. Las tres anticipadas adquiridas conservan su clasificación de anticipadas, no publicaciones finales DOF. La ausencia de una tercera final en este catálogo solo describe esta captura. No establece que no se haya publicado en otra fuente o después de la captura.
5. El lote de seis documentos puede describirse como presente respecto al paquete enumerado. No cierra por sí mismo una frontera temporal jurídica, la biblioteca total o el día 24 de noviembre. Se retiran esas lecturas amplias del cruce.

## Evidencia

Catálogo observado: https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html

Archivo: `artifacts/library-expansion-20261124/catalog-0.html`.

SHA-256 calculado: `bc7f05231ec8b06b13afb84a800c36976c05d59561e5674da2f3b1a1783ff8a6`.

Captura según manifiesto: `2026-11-24T14:44:28.860794+00:00`.

Extracto estructurado de enlaces y correcciones: `artifacts/library-expansion-20261124/rgce-cross-review-catalog-evidence.json`. Conserva los `href` tal como se observaron. No se presenta el destino del compilado como enlace verificado ni como binario adquirido.

## Pendiente, no hecho

Verificar el destino observado del compilado de segunda RMRGCE y, si es PDF pertinente, adquirirlo con hash y distinguirlo de los dos compilados ya presentes. Cotejar directamente DOF y condiciones/efectos de anticipadas antes de una conclusión temporal. Este cierre solo reconcilia afirmaciones de los informes con la evidencia guardada; no ejecuta esas comprobaciones futuras.

## Avance posterior, 09:49

El compilado de segunda RMRGCE ya se adquirió y verificó. La consulta DOF directa localizó además la tercera resolución final, publicada el 23nov2026, que no figuraba en la captura SAT. Las descripciones anteriores de ausencia se limitan estrictamente a esa captura. Ver `rgce-final-conditions-2026-11-24.md`, sus manifiestos y fuentes; no hay adopción.

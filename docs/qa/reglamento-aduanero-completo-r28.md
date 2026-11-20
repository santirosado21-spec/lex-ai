# Consultas sobre el Reglamento de la Ley Aduanera

La biblioteca del piloto privado permite buscar el Reglamento por número, tema o expresión. Desde el artículo elegido, el abogado puede preparar una pregunta, comprobar la fuente que recibirá OpenAI, restituir su pregunta original y exportar la nota. El Reglamento conserva su propio identificador aunque también se mencione la Ley Aduanera.

## Cobertura de esta edición

La descarga de la Cámara de Diputados del 19 de noviembre coincide byte por byte con la copia local de 90 páginas. La portada identifica la reforma del 23 de febrero de 2026. La huella SHA-256 es `bcdfcd9073014aec4aefbacc01c9dd5b1f97f0da0c4556f0f506d20f12d77812`. Los 282 encabezados del cuerpo numerado preceden a los transitorios. Se recuperaron 338 bloques de página. Hay 56 artículos en dos páginas, y diez aparecen como derogados. La biblioteca abre el PDF completo, incluidos los transitorios. [Edición de la Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LAdua.pdf)

Poppler reconstruyó el texto y PDF.js lo leyó a partir de las posiciones de los caracteres de cada línea. El cotejo verificó el identificador, la secuencia de páginas y cada bloque íntegro con espacios normalizados. La edición incorpora notas de reforma impresas. Las divisiones por párrafo en el visor facilitan la lectura. Las consultas previas sobre los artículos 150 y 174 conservan su localizador original.

## Qué respondió OpenAI

Se usó un expediente ficticio para buscar el correo electrónico destinado a los avisos de notificación. El artículo 6-A apareció primero. La prueba comparó la vista previa con el mensaje del proveedor y verificó la ausencia de la identidad ficticia, el folio, el asunto y la pregunta original.

En una primera llamada con el artículo completo, la respuesta citó datos generales de registro y omitió el correo. Se precisó el inciso dentro del texto oficial y se exigió que la cita perteneciera al fragmento mostrado. En la segunda llamada la nota identificó el correo que el usuario debe registrar para recibir avisos y pidió una constancia de registro. La aplicación comprobó la cita literal y restituyó la pregunta en el equipo. La primera llamada registró 849 tokens de entrada y 126 de salida. La segunda registró 807 y 97 respectivamente. El ejemplo permite valorar ese resultado concreto con un abogado.

El abogado puede repetir la búsqueda con `sello digital correo electrónico avisos de disponibilidad` y elegir **Preparar consulta de este artículo**. Si existen varios asuntos jurídicos en la misma pregunta, debe comprobar que el fragmento elegido atienda el que quiere estudiar. Para comparar dos disposiciones puede seleccionar un segundo fundamento.

## Reproducción

```sh
python3 scripts/index-customs-regulation.py
node scripts/check-regulation-articles.mjs
node scripts/check-customs-directory.mjs
node --test tests/regulation-complete.test.mjs
node scripts/check-pilot-regulation-search.mjs . artifacts/prueba-reglamento --replay=artifacts/privacidad-r27/reg-modelo-final
```

La medición de privacidad del mismo piloto incluye un caso de origen con cinco indicios indirectos visibles. La cobertura de una fuente oficial y la calidad observada de una respuesta tienen un alcance distinto de la protección de expedientes reales. [Medición de privacidad](reservas-expediente-r27.md)

El ZIP privado r28.1 se volvió a abrir en este Mac. Se reprodujeron las solicitudes por huella, se comparó el borrador antes y después de reiniciar y se comprobó el recorrido a 320, 390, 768 y 1280 píxeles de ancho. El navegador trabajó únicamente con el servicio local. LibreOffice convirtió nueve archivos a PDF. Se verificaron los textos impresos, incluida la cita del inciso de correo electrónico y las preguntas restituidas. El lanzador pasó la prueba de respaldo de cuota con claves simuladas. La suite JavaScript registró 1470 pruebas aprobadas, diez omitidas y cero fallos. SHA-256 del ZIP privado `2500361923d8a543eaf1e236f6e6e465d5cc5d95bf4168b1534e048a39864b04`.

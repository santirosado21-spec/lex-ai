# C2a — evidencia de páginas y candidatos de encabezado de Nuevo León

2026-11-10. Perfil nuevo `nle-page-evidence-v1`, separado del parser federal y de sus resultados congelados. Archivos: `server/corpus/state-page-evidence.mjs`, `scripts/extract-nuevo-leon-pages.mjs` y sus dos suites nuevas. Esta entrega se prueba con datos sintéticos y extractor inyectado; no ejecuta todavía el parser PDF real. No hay cambios a `server/legal-library.mjs`, capturadores, registros, corpus aprobado o cliente.

## Alcance

El primer objetivo es conservar evidencia de texto/items de **todas las páginas** de los dos PDF públicos de C1b.3, con coordenadas y rangos reproducibles, más candidatos de encabezados para revisión. No selecciona texto operativo, una versión jurídica o artículos completos. No elimina encabezados, notas editoriales, reformas o transitorios; tampoco trunca el resto del documento ante un número repetido.

Se aplica la skill PDF para lectura/verificación. No se crean o editan PDF y no corresponde marcador de autoría. El coordinador puede renderizar muestras con Poppler aparte; un resultado de extracción no sustituye revisión visual/textual completa o validación jurídica profesional. No se instala OCR, modelo o dependencia.

## Procedencia y límites

El wrapper reutiliza `verifyInputs` del corte C1b.4, fijando antes su archivo a SHA-256 `c8ae506abd7a19a81971e305c3cf25719c4d3eb3570cebd8c53f966cd2d3783a`. Ese verificador conserva las capacidades exactas de C1b.3: informe `888972f9e20cfc17f573ed43b37d23ab3c00db4efc2b963ed7b1483478759246`, tamaños/hashes de ambos PDF, recibos y queries literales, HTML e informe anteriores, anclas de línea 556, helpers/protocolos congelados y robots capturados. No vuelve a solicitar robots ni archivos.

Solo se admiten Civil y Penal locales en `artifacts/public-corpus/nl-pdfs-revision-01`. Los originales quedan intactos; el worker lee copias exclusivas verificadas en una hoja nueva bajo `artifacts/public-corpus`. Sus hashes se comprueban antes y después del worker. Se rechazan escapes, symlinks, archivos no regulares, PDF alterados y directorios de salida existentes. Archivos completos quedan de solo lectura, sin prometer WORM frente al dueño del sistema.

| Control | Límite |
| --- | --- |
| PDF / simultáneos | Dos fijos / uno |
| PDF individual | 10 MiB |
| Worker | 120 s; heap V8 de generación vieja 768 MiB |
| Lote | 300 s, con ventana completa antes de iniciar cada worker |
| Páginas por documento | 1.200; cada número 1..N exactamente una vez |
| Items | 10.000 por página; 250.000 por documento |
| Texto UTF-8 | 16 MiB por documento, comprobado durante acumulación |
| Candidatos | 50.000 por documento, incluidos metadatos |
| JSON de páginas | 64 MiB combinados por lote |

Se usa `pdf-parse` ya instalado dentro de un `Worker` aislado. El worker posee timeout, terminación y límite de heap; el wrapper también puede cancelar por deadline. La función de extracción no inicia trabajadores hijos ni OCR externo. No hay cliente HTTP; `fetch` se bloquea dentro del worker. El parser recibe bytes locales y no URLs. No hay reintentos, descarga, inferencia, publicación o exportación.

Estos límites son de fábrica de desarrollo, no aceptación de CPU/RAM del cliente o de un equipo físico de 8 GB. El heap V8 no es RSS total.

## Texto, layout y hashes

Se llama a `getTextContent` sin normalizar whitespace y se conserva cada `item.str` tal como lo entrega PDF.js. Se mantiene orden de items, coordenadas `transform` de seis valores, ancho/alto, dirección, fuente y señal `hasEOL` cuando existen. No se aplica NFC, corrección ortográfica, reescritura legal o inserción de espacios.

La representación de página concatena los strings; introduce un salto de línea documentado cuando cambia Y entre items o el anterior declara `hasEOL`. Esa regla es construcción de evidencia, no texto crudo original del stream PDF o garantía de orden de lectura visual. Cada item registra su rango y el separador generado. Las líneas conservan texto/rangos y hash; los offsets son unidades UTF-16 de JavaScript, mientras SHA-256 usa UTF-8. Espacios, NBSP, diacríticos compuestos/descompuestos y caracteres no ASCII se conservan sin equivalencias silenciosas.

Cada página conserva `textSha256` del texto y `pageSha256` del objeto de evidencia con número, hash PDF, perfil, texto, líneas, items y estado. **`pageSha256` no es un hash de bytes originales de página PDF**. El documento recibe otro digest de su evidencia. La identidad jurídica y el PDF original siguen separados; hashes detectan deriva respecto del extractor revisado, no prueban fidelidad visual o exactitud jurídica.

El supervisor reconstruye determinísticamente páginas, hashes, rangos y candidatos a partir de los items devueltos antes de escribir el artefacto. Alteraciones de texto, coordenadas, referencias, candidatos, procedencia o flags se rechazan. Cada artefacto final tiene además su hash y tamaño en el ledger del informe.

## Candidatos NLE, sin clasificación operativa

Se reconocen formas de inicio de línea `Art. 1o.-`, `Artículo 1.-` y `ARTICULO1.-`, ordinales, diacríticos explícitos y sufijos BIS/TER/QUÁTER/QUATER/QUINQUIES con variantes de espacios. Se exige el delimitador NLE **punto más guion `.-`**, admitiendo espacio o NBSP entre ellos y variante de guion en dash. No se equipara a todos los formatos de legislación estatal.

El coordinador observó en una muestra visual del Penal que un párrafo del artículo 89 termina, por wrapping, con `ARTICULO96.` aislado en página 26. La cabecera real posterior presenta `.-`. En este perfil, la referencia terminal sin guion permanece íntegra en el texto y puede marcarse `ambiguous-bare-article-reference-candidate`; no se convierte en encabezado de artículo ni provoca un corte. La prueba usa un párrafo sintético independiente con ese patrón y conserva las páginas siguientes.

Referencias dentro de prosa, citas entre comillas, notas que empiezan con `Nota:` y expresiones como `Artículo 1 del Código` no satisfacen la regla anclada. Aun así, una coincidencia formal sigue siendo **candidata**, no un artículo jurídicamente operativo. Falsos positivos/negativos por layout, wrapping o formatos distintos permanecen sujetos a evaluación independiente.

Un número/sufijo repetido produce vínculo `duplicateOf` y conteo técnico; no detiene la lectura ni elige una aparición. Las señales de cabecera, texto editorial y transitorios conservan literal, línea, página y rangos como metadatos candidatos. No se eliminan, siguen leyendo todos los items y no determinan fecha/versión vigente. Las queries de fecha del URL nunca se analizan para decidir una fecha jurídica.

Todas las páginas, candidatos y documentos quedan en cuarentena, con derechos/texto/revisión jurídica pendientes, `effectiveAt=null` e `indexed/published/trainingExported/approvedForAcquisition=false`. Los conteos publicados por el informe son páginas/items/candidatos de evidencia; no cantidad de artículos completos, aplicabilidad, ley íntegra aceptada o cobertura nacional.

## Uso

```sh
# Predeterminado: solo propuesta; sin leer capturas, parsear PDF, escribir o usar red.
node scripts/extract-nuevo-leon-pages.mjs
node scripts/extract-nuevo-leon-pages.mjs --plan

# 19 pruebas sintéticas; no invocan PDF-parse sobre documentos reales.
node --test tests/state-page-evidence.test.mjs tests/nuevo-leon-pages.test.mjs

# Solo el coordinador después de revisión independiente y freeze del corte.
node scripts/extract-nuevo-leon-pages.mjs --extract --out-name nl-page-evidence-revision-01
```

Los seams de pruebas requieren extractor inyectado para sustituir hashes o raíz temporal, no exponen archivos/URLs por CLI ni habilitan el worker real con pins sintéticos. Un fallo deja recibo con categoría finita, artefactos previos intactos y las dos piezas pendientes explícitas; no se copian mensajes arbitrarios de documentos al campo de error.

La aceptación posterior debe cotejar páginas, texto, referencias y ejemplos visuales independientemente, además de decidir si hace falta segmentación estatal. No se modifica el baseline federal para mejorar sus cifras. Una ejecución técnica completa de este perfil demuestra cobertura de evidencia de páginas según el parser; no aceptación textual/legal del corpus, integración de producto o autorización de clientes.

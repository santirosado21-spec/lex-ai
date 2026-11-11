# C1b.3 — captura de dos PDF públicos por capacidad exacta

2026-11-10. Propuesta de investigación pública autorizada por alcance, pendiente de revisión del código antes del primer `--live`. Script nuevo: `scripts/capture-nuevo-leon-pdfs.py`; pruebas sintéticas Python y arnés Node. No se ejecutó red para construir o probar esta entrega. No requiere dependencias nuevas ni modifica el inspector HTML congelado, el registro de treinta plazas, planes anteriores o la allowlist del cliente/colector de producción.

## Evidencia que limita la propuesta

El coordinador capturó previamente dos HTML oficiales con el [inspector C1b.2](nuevo-leon-link-inspector-v1.md). El nuevo script permite únicamente los dos destinos PDF literales observados en la línea 556 de esos originales. Las queries se conservan exactamente; no se eliminan, normalizan o interpretan como vigencia, reforma confirmada o versión jurídica efectiva.

| Pieza | Snapshot HTML y SHA-256 fijados en código | Evidencia de enlace |
| --- | --- | --- |
| Civil | `artifacts/public-corpus/nl-links-revision-01/nl-civil.html`; `7ad6ac47640688a911f135a690080677f6e4e2cf5927e17e2d70637e601925c9` | Un único atributo `href` del ancla en línea 556, con URL completa exacta. |
| Penal | `artifacts/public-corpus/nl-links-revision-01/nl-penal.html`; `f087c1a18f6784c0fa46ca9d7fae62dda745795109b226153ca481a09b57b356` | Un único atributo `href` del ancla en línea 556, con URL completa exacta. |

El informe original `artifacts/public-corpus/nl-links-revision-01/report.json` también se fija por SHA-256: `05ad65a4b84f011905f6336e4b94cece7800ffb71c010e863bf542b5f503a719`. Antes de crear salida o realizar solicitudes, se verifican hashes, procedencia de cada recibo HTML, MIME/estado, tamaño, URL solicitada/final, identidad de documento y atributo/línea exactos. Los archivos deben ser regulares y no symlinks. Los originales se leen con límites y después se copian al nuevo lote como evidencia, sin reescribir el lote HTML.

Se reutilizan exclusivamente los helpers ya revisados de robots, redirección denegada y timeout absoluto del inspector; su archivo debe conservar SHA-256 `0294d183590c126bf7d6228f588b96968b320ec03828b3076b638de4016cbad7`. Cualquier deriva exige revisión y modificación explícita de la propuesta. El SHA establece integridad respecto del código de desarrollo revisado, no autenticación jurídica o licencia del editor.

## Capacidad de red cerrada

Las únicas solicitudes posibles están fijadas literalmente en código:

```text
https://www.hcnl.gob.mx/robots.txt
https://www.hcnl.gob.mx/trabajo_legislativo/leyes/pdf/CODIGO%20CIVIL%20PARA%20EL%20ESTADO%20DE%20NUEVO%20LEON%20.pdf?2026-06-26
https://www.hcnl.gob.mx/trabajo_legislativo/leyes/pdf/CODIGO%20PENAL%20PARA%20EL%20ESTADO%20DE%20%20NUEVO%20LEON.pdf?2026-06-15
```

La pertenencia debe ser exacta. Una query diferente, su eliminación, un parámetro adicional, fragmento, dominio sin `www`, puerto, credencial, espacio decodificado o ruta normalizada distinta no recibe permiso. Esta excepción para dos literales no es una política general de queries ni una ampliación de allowlist. No hay opción CLI para aportar URL, query, cookie, cabecera, credencial, proxy o fuente de procedencia alternativa. HTML, anclas y atributos se leen como datos; no se ejecuta JavaScript.

## Presupuestos y detención

| Control | Límite |
| --- | --- |
| Solicitudes totales | 3: robots y los dos PDF; cero reintentos o redirecciones |
| PDF individual | 10 MiB |
| Robots | 128 KiB |
| Total de cuerpos | 20 MiB incluidos robots |
| Separación entre inicios | 2 s o `crawl-delay` mayor |
| Solicitud completa | 15 s, timeout de socket y alarma absoluta Unix |
| Lote | 120 s, también se descuenta la comprobación local de procedencia |
| Concurrencia | 1 |

Los máximos individuales no garantizan que ambos archivos quepan simultáneamente en el total. Los cuerpos se leen por fragmentos; sin longitud declarada puede consumirse un byte extra como comprobación de exceso, que se registra y causa rechazo inmediato sin guardar PDF. Estos bytes son de cuerpo consumido, no tráfico TLS/cabeceras ni costo facturado.

Primero se exige robots actual 200, `text/plain`, UTF-8 y no comprimido. Se usa el helper conservador revisado: reglas porcentuales, absolutas, no soportadas o ambiguas, incluso en otros grupos, bloquean el lote. No se interpreta un robots ausente, 403/406, error o redirección como permiso. Un `Allow` no aprueba derechos de reproducción o reutilización.

Para los documentos se exigen respuesta 200 sin cambio de URL, MIME `application/pdf`, cuerpo no comprimido, longitud coherente cuando esté declarada y bytes iniciales `%PDF-`. Cabeceras relevantes duplicadas son ambiguas y se rechazan. Después se calcula SHA-256 del original completo. MIME, firma y hash son pruebas técnicas de captura; no validan estructura completa, fidelidad o contenido jurídico. No se realiza extracción, OCR ni ejecución de contenido PDF.

Un fallo detiene el lote sin pedir el siguiente documento ni cambiar de canal. Los recibos conservan intentos, estados, URLs exactas, MIME, bytes y hashes cuando estén disponibles; `notCaptured` conserva las piezas faltantes. Un PDF anterior completo del mismo ensayo permanece, mientras la pieza que no pasó las comprobaciones no se presenta como capturada. Nunca se reanuda o sobrescribe un lote existente.

## Artefactos y estado

Solo se admite un nombre de hoja canónico nuevo bajo `artifacts/public-corpus`. Los directorios y archivos se abren con controles contra symlinks; creación exclusiva y permisos de solo lectura para archivos completos impiden sobrescrituras accidentales por este script. No constituye almacenamiento WORM frente al dueño del sistema. Los errores de E/S pueden dejar un directorio parcial para revisar; no se elimina ni reutiliza automáticamente.

Un lote completo conserva:

- `source-report.json`, copia íntegra del informe HTML original fijado por hash.
- `source-nl-civil.html` y `source-nl-penal.html`, copias de los originales de procedencia.
- `robots.txt`, política recibida en esta ejecución.
- `nl-civil.pdf` y `nl-penal.pdf`, originales en cuarentena.
- `report.json`, propuesta/digest, procedencia, literales/líneas, recibos, métricas y denominador.

Cada documento conserva `approvedForAcquisition=false`, `rightsReview=pending`, `textReview=pending`, `legalReview=pending`, `versionBindingReview=pending`, `effectiveAt=null`, `extracted=false`, `indexed=false` y `published=false`. La vinculación técnica del href a una captura HTML no demuestra que el PDF represente la versión jurídicamente aplicable. Las veinte plazas pendientes del registro anterior continúan pendientes; estos dos originales de investigación no las aprueban o promueven silenciosamente.

## Comandos y revisión

```sh
# Predeterminado: propuesta serializable, sin leer artefactos, crear archivos o usar red.
python3 -B scripts/capture-nuevo-leon-pdfs.py
python3 -B scripts/capture-nuevo-leon-pdfs.py --plan

# 17 pruebas sintéticas, sin red; el arnés integra la comprobación en la suite Node.
python3 -B tests/capture_nuevo_leon_pdfs_test.py
node --test tests/nuevo-leon-pdf-research.test.mjs

# Solo el coordinador después de revisar este corte; hoja nueva para cada intento.
python3 -B scripts/capture-nuevo-leon-pdfs.py --live --out-name nl-pdfs-revision-01
```

El modo plan no carga capturas ni helpers externos al código del script; la falta de artefactos no impide inspeccionar la propuesta. `--live` sí requiere los originales concretos y helpers con sus hashes fijados. Las pruebas usan HTML sintético en directorios temporales, con las mismas dos URLs públicas; no dependen de artefactos ignorados ni datos privados. Cubren queries exactas, procedencia manipulada y anclas inertes, recibos/hashes, PDF de más de 2 MiB, límites, robots, rutas, no sobrescritura y ausencia de credenciales/proxies.

Después de una captura real, revisar independientemente originales, hashes y vínculo con HTML antes de proponer extracción mediante un parser PDF ya existente. Cualquier extracción posterior necesita su propio corte revisado y conserva cuarentena. No hay aprobación comercial, promoción al corpus, publicación, activación de producto, compras, nuevos proveedores, datos de clientes o cambios en gates privados por esta propuesta.

# C1b.2 — inspector acotado de enlaces de Nuevo León

2026-11-10. Herramienta de investigación pública de desarrollo, sin integración en el cliente ni ampliación de la allowlist de producción. Implementación: `scripts/inspect-nuevo-leon-links.py`, biblioteca estándar de Python; no requiere paquetes nuevos. El coordinador debe revisar el código y sus pruebas antes del primer `--live`. Esta entrega no ejecuta red real.

## Propósito y autoridad

El inspector captura solamente el HTML de las páginas oficiales de Código Civil y Código Penal previamente localizadas en [C1b.1](../research/public-corpus-C1b-source-candidates-2026-11-10.md). Busca enlaces PDF/Word literales para una revisión posterior de destino/versión. No solicita archivos enlazados, no rastrea el catálogo y no entrega estos textos al corpus aprobado. Su autorización de investigación pública no resuelve licencia comercial, derechos editoriales, fidelidad, vigencia o aplicabilidad.

Las únicas URLs de red están fijadas en el código:

- `https://www.hcnl.gob.mx/robots.txt`
- `https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_civil_para_el_estado_de_nuevo_leon/`
- `https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_penal_para_el_estado_de_nuevo_leon/`

No existe opción CLI para aportar una URL, cabeceras, cookies, credenciales, proxy o límites más amplios. Los enlaces descubiertos son datos y no se convierten en solicitudes. No se modifica `resources/legal-acquisition-pilot.json`, un plan congelado, `server/legal-sync.mjs` o los gates privados/proveedor.

## Límites y detención

| Control | Valor |
| --- | --- |
| Solicitudes HTTP totales | Máximo 4; normalmente 3, robots + dos páginas |
| HTML por página | Máximo 2 MiB |
| Robots | Máximo 128 KiB |
| Cuerpos totales | Máximo 4 MiB, incluidos robots |
| Separación entre inicios | Al menos 2 segundos o el `crawl-delay` mayor |
| Solicitud completa | Máximo 15 segundos, con alarma absoluta además de timeout de socket |
| Lote | Máximo 120 segundos; no inicia una espera/petición fuera del tiempo restante |
| Concurrencia / reintentos / redirecciones | 1 / 0 / 0 |
| Resolución de enlaces | Solo literal HTTPS en el host exacto `www.hcnl.gob.mx` |

La alarma absoluta requiere un entorno Unix de desarrollo compatible, como el Mac actual; no se presenta como prueba de portabilidad del producto. El script verifica TLS normalmente y desactiva proxies ambientales. Cualquier redirección o estado distinto de 200, incluidos 403/406, detiene el lote. No prueba destinos alternativos, repite solicitudes ni ejecuta JavaScript para superar un bloqueo.

Robots debe ser 200, `text/plain`, no comprimido, UTF-8 y legible, con grupos `User-agent`. Se aplican grupo más específico, regla de ruta más larga, prioridad de `Allow` en empate y `Crawl-delay`. Este inspector no implementa normalización porcentual RFC: cualquier regla `Allow`/`Disallow` con `%`, URL absoluta, ruta no soportada, query, traversal o ancla `$` intermedia bloquea el lote completo. También se validan reglas de grupos de otros agentes, y una regla sin grupo se rechaza. Una regla literal `Allow: /` nunca permite ignorar una restricción codificada o ambigua. Se admiten solo rutas ASCII simples, comodín `*` y `$` final; formatos distintos requieren revisión separada. `Request-rate` no soportado, texto ilegible, política restrictiva o demora fuera del presupuesto bloquean las páginas. No se toma un 404 como permiso en este inspector. Una política `Allow` no aprueba derechos o adquisición.

Para HTML se exige MIME `text/html`, cuerpo no comprimido y decodificación UTF-8 estricta; contenido no soportado queda bloqueado y la captura original completa, si la hubo, sigue separada del análisis. No se transforma un error de codificación en texto revisado. El presupuesto de cuerpos mide bytes leídos de respuesta, no cabeceras/TLS ni tráfico de búsqueda. Sin `Content-Length`, se puede consumir un byte adicional como comprobación de desbordamiento: se registra y se rechaza esa respuesta, sin snapshot aprobado. Nunca se continúa descargando el cuerpo que excede un límite.

## Datos inertes y evidencia

Se usa `HTMLParser` de Python; no navegador, shell de documentos, `eval` o motor JavaScript. Se ignoran `script`, `style`, `template`, comentarios y la base URL declarada por HTML. Los `href` se inspeccionan como literales. Para `onclick` solo se reconoce la gramática completa y fija `window.open('literal')`, su variante con `_blank`, y asignación literal a `location.href`/`window.location.href`. Concatenaciones, llamadas distintas, instrucciones adicionales o datos ambiguos permanecen sin resolver; nunca se ejecutan.

Se rechazan esquemas `javascript:`/`data:`, hosts alternativos, credenciales/puertos, queries/fragments, controles, barras inversas y traversal literal o codificado. Los espacios de un nombre de archivo pueden normalizarse a `%20`; cada candidato conserva también el literal original y la línea HTML, y los rechazados conservan un fragmento acotado. Solo `.pdf`, `.doc` y `.docx` se proponen como formatos. No se visita ninguno. Atributos duplicados de enlace y más de 2.000 enlaces/elementos sin resolver detienen el análisis.

Los encabezados y un fragmento bruto de la primera mención de reforma se conservan como candidatos de metadatos, sin convertirlos automáticamente en una fecha jurídica. `effectiveAt=null`, `rightsReview=pending`, `versionBindingReview=pending` y `approvedForAcquisition=false` permanecen explícitos. El vínculo HTML→PDF/Word debe contrastarse todavía con instrumento, versión y contenido real.

Cada ejecución crea una hoja nueva bajo `artifacts/public-corpus`; solo acepta un nombre corto canónico, nunca una ruta arbitraria. Se abren directorios con `O_NOFOLLOW` y escrituras con exclusión para impedir sobrescritura y symlinks. Un directorio existente, aunque esté vacío, se rechaza antes de la red. Los archivos completos se guardan con permisos de solo lectura; no son almacenamiento WORM frente al propietario del equipo.

Salida de un lote satisfactorio: `robots.txt`, `nl-civil.html`, `nl-penal.html` y `report.json`. El informe conserva URLs exactas, marcas UTC, estado/MIME, bytes, SHA-256, tiempos, candidatos y rutas de snapshot. Ante fallo guarda recibos de solicitudes ya iniciadas y las dos páginas no capturadas explícitamente; no oculta el denominador ni reescribe un ensayo anterior. Las capturas son investigación pública en cuarentena, no corpus aprobado. Una falla de E/S requiere examinar el directorio parcial; nunca se reutiliza automáticamente.

## Revisión y ejecución

```sh
# Sin red ni archivos; acción predeterminada.
python3 -B scripts/inspect-nuevo-leon-links.py
python3 -B scripts/inspect-nuevo-leon-links.py --plan

# Pruebas sintéticas sin red ni esperas reales.
python3 -B tests/inspect_nuevo_leon_links_test.py
node --test tests/nuevo-leon-link-inspector.test.mjs

# Solo el coordinador, después de revisión independiente del corte.
python3 -B scripts/inspect-nuevo-leon-links.py --live --out-name nl-links-revision-01
```

La ejecución real se debe medir y documentar por separado: comparar snapshots/recibos/hashes, inspeccionar candidatos y mantener permisos/versiones sin aprobar cuando falte evidencia. No se atribuye a estas pruebas sintéticas acceso real al sitio, fidelidad de las páginas o autorización de descarga de PDF. No se instala nada, compran servicios, activan rutas de producto o usan documentos privados.

# Sincronización acotada de legislación mexicana

El sincronizador consulta siete URLs oficiales de PDF: Código Civil Federal, Constitución, Código de Comercio, Ley Federal del Trabajo, Ley Federal de Protección al Consumidor, Ley Federal del Derecho de Autor y la copia identificada del Código Civil para el Distrito Federal. No recorre sitios completos ni consulta documentos privados. Los repositorios externos son candidatos de herramientas o investigación, nunca autoridad jurídica.

## Ejecutar y consumir el estado

```sh
node scripts/legal-sync.mjs --once
node --test tests/legal-sync.test.mjs
```

`runLegalSync` se exporta desde `server/legal-sync.mjs` y `scripts/legal-sync.mjs`. `syncOnce(options)` carga el catálogo `resources/legal-sources.json`. Para pruebas se inyectan `fetchImpl`, `now`, `sleep`, `sources`, `outputDir` y límites. El CLI imprime un objeto JSON al terminar. No inicia un proceso permanente; el supervisor decide cuándo invocarlo y debe respetar `nextCheckAfter`.

Archivos generados bajo `artifacts/legal-sync/`:

- `status.json`: estado actualizado atómicamente durante y después del ciclo.
- `manifest.json`: historial por fuente y hash, URL original y final, fecha de obtención, ETag, Last-Modified y estado de cuarentena.
- `snapshots/<id>/<sha256>.pdf`: copias inmutables, verificadas por SHA-256.
- `sync.lock`: bloqueo de concurrencia con PID; un PID inexistente permite retirar un bloqueo huérfano.

Contrato resumido de `status.json`:

```json
{
  "schemaVersion": 1,
  "state": "running | complete | partial | failed",
  "startedAt": "ISO-8601 UTC",
  "finishedAt": "ISO-8601 UTC o null",
  "nextCheckAfter": "ISO-8601 UTC o null",
  "summary": {"total": 7, "downloaded": 0, "unchanged": 6, "failed": 1, "quarantined": 6},
  "sources": [{
    "id": "ccf", "title": "Código Civil Federal", "url": "HTTPS oficial", "jurisdiction": "MX-FED",
    "state": "pending | downloaded | unchanged | failed | blocked",
    "checkedAt": "ISO-8601 UTC", "lastSuccessAt": "ISO-8601 UTC o null",
    "httpStatus": 304, "etag": "valor remoto o null", "lastModified": "valor remoto o null",
    "sha256": "hash de la última copia disponible o null", "bytes": 3415624,
    "versionId": "ccf-<hash corto>", "reviewStatus": "quarantined o null",
    "snapshotPath": "snapshots/ccf/<hash>.pdf", "attempts": 1,
    "robots": 404,
    "robotsEvidence": {"checkedAt": "ISO-8601 UTC", "sha256": "hash de la respuesta robots", "rule": null},
    "error": "solo en fallo", "errorCode": "código diagnóstico o null"
  }]
}
```

`complete` significa que se comprobó la transferencia de todas las fuentes, no que el derecho esté vigente. `quarantined` nunca significa aprobación jurídica. Si falta el archivo de estado, la API/UI debe mostrar que todavía no se ha ejecutado la sincronización. El estado no contiene credenciales ni información de clientes.

## Controles y condiciones de acceso

Solo se admiten HTTPS, sin credenciales, puertos personalizados ni fragmentos, en los hosts exactos de Diputados y Congreso CDMX del módulo. Cada salto de redirección se valida, con máximo tres; un nuevo origen también exige revisar robots. No se ejecuta contenido descargado ni se desactiva TLS.

Cada origen se limita a una solicitud cada dos segundos, ampliable por `Crawl-delay`; demoras superiores a un minuto aplazan esa fuente. Se consulta `robots.txt` en cada ciclo, se aplican `User-agent`, `Allow`, `Disallow`, comodines y coincidencia más específica de ruta. Ausencia HTTP404/410 permite continuar; otros errores de robots bloquean la descarga de forma conservadora. Este comportamiento se basa en [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html), con decisiones conservadoras adicionales. No pretende sustituir términos de uso ni licencia.

Cada solicitud tiene 45 segundos, límite de 20 MiB para PDFs y 500 KiB para robots. HTTP408/425/429/500/502/503/504 y errores de red transitorios admiten un único reintento. `Retry-After` mayor de diez segundos aplaza el intento al siguiente ciclo. Errores de certificado no se reintentan ni se omiten. Se comprueba la cabecera `%PDF-`, pero la cuarentena no certifica que un PDF sea seguro o jurídicamente correcto. Los parsers solo intervienen en revisión posterior.

El texto del [artículo 14 fracción VIII de la LFDA](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf), incluido en la semilla, distingue textos legislativos de comentarios y otras creaciones editoriales. Esta selección usa texto legislativo y conserva procedencia; no distribuye comentarios de terceros ni acredita una revisión legal de todas las condiciones de reutilización. El [índice de LeyesBiblio](https://www.diputados.gob.mx/LeyesBiblio/index.htm) identifica las fuentes federales. La fecha de una reforma declarada por un PDF, su Last-Modified y la fecha de descarga son conceptos distintos; ninguna se transforma automáticamente en fecha de entrada en vigor.

## Semilla revisada y nuevas versiones

La sincronización **nunca escribe** `resources/legal-corpus.json`. Cambios de bytes añaden una nueva versión en cuarentena. Fallos no sustituyen snapshots anteriores ni la semilla empaquetada. Una respuesta 304 exige que la copia local exista y su hash coincida. La misma respuesta 200 sin cambios se detecta por hash aunque el servidor ignore validadores.

`resources/legal-snapshots/seed-review.json` fija el hash del PDF y de cada transcripción seleccionada. El constructor funciona en dos etapas:

```sh
node scripts/build-corpus.mjs --preview
# Revisar transcripción, límites del artículo, encabezados, procedencia y metadatos.
# Actualizar hashes revisados únicamente después de esa revisión explícita.
node scripts/build-corpus.mjs --write-approved
```

Sin `--write-approved`, solo se genera `artifacts/legal-sync/corpus-proposal.json`. El comando de escritura falla si cambia cualquier PDF o transcripción respecto de los hashes revisados. El nombre `approved` se refiere a inclusión técnica en la semilla, no a certificación profesional de vigencia o exactitud jurídica. El motor conserva `legalAccuracy: not-professionally-evaluated` y fechas de vigencia desconocidas.

La semilla ampliada contiene 21 artículos: CCF1796/1797/1832; CPEUM1/14/17; CCom1/2/78; LFT20/21/24; LFPC7/10/85; LFDA11/12/14; CDMX1796/1797/1832. CPEUM16 no se incluye por su extensión en este ciclo. No es un repertorio completo de ninguna especialidad.

Se eliminaron los títulos de sección siguientes que se habían adherido a CCF/CDMX1797, y encabezados de páginas. Las notas de reforma se separan del articulado; anotaciones CDMX que preceden al artículo siguiente no se atribuyen al actual. Se guardan las páginas que realmente contienen el pasaje. Las normalizaciones están acotadas y probadas, no son un extractor universal de legislación.

## Evidencia de este ciclo

El 29 de octubre de 2026, hora de Ciudad de México, se descargaron seis PDFs de Diputados. Una segunda consulta devolvió seis HTTP304 y preservó los hashes. Robots de Diputados respondió 404. CDMX falló por `ERR_TLS_CERT_ALTNAME_INVALID`; su copia histórica empaquetada sigue intacta y marcada con vigencia no verificada y advertencia editorial.

Los 21 pasajes se compararon mediante PDF.js y `pdftotext`, con coincidencia textual después de la limpieza explícita: `artifacts/legal-sync/transcription-crosscheck.json`. Se inspeccionaron visualmente páginas representativas CCF175, LFT7 y LFDA4. Esto valida transcripción y límites, no aplicabilidad o corrección de análisis legal. El registro de revisión fija hashes para reproducir el corpus.

No hay seguimiento del DOF, jurisprudencia, reformas transitorias, abrogaciones automáticas, OCR, firma digital de la fuente, evaluación por abogados ni activación automática de nuevos textos. El PDF CDMX antiguo sigue siendo una limitación conocida. Una fuente temporalmente inaccesible no implica que esté derogada.

Se consultaron las skills dsystem y PDF disponibles. No había una skill local de sincronización jurídica; se buscaron repositorios de skills y se consultaron fuentes oficiales/RFC. No se instaló ni ejecutó código de repositorios externos.

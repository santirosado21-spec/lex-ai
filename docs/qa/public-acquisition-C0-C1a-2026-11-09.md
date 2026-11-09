# C0 y C1a: primer ensayo real de fábrica pública

2026-11-09. Evidencia: [métricas y hashes](public-acquisition-C0-C1a-2026-11-09.json), [revisión de fuente](public-acquisition-source-review-2026-11-09.json), [freeze final](public-acquisition-final-freeze-2026-11-09.json), [arquitectura y comandos](../architecture/public-corpus-factory-v1.md).

C0 entrega registro/planes verificables de autoridad pública de desarrollo. C1a entrega adquisición/extracción versionada y primer lote federal. **C1 de 30 plazas continúa parcial:** 10 documentos concretos aprobados/adquiridos y 20 plazas pendientes sin URL (16 estatales y 4 judiciales). No sustituimos documentos pendientes ni declaramos cobertura nacional.

## Ejecución observada

Se revisó el índice oficial de Diputados: HTTP 200, 317 enlaces PDF reconocidos; se fijaron diez antes del ensayo. Robots devolvió 404; esa ausencia no se trata como licencia y se comprueba de nuevo en cada adquisición. El registro limita autoridad a este ensayo público acotado; no declara derechos comerciales o vigencia verificados.

| Medición | Resultado |
|---|---:|
| PDFs adquiridos / seleccionados | 10 / 10 |
| Plazas planificadas / pendientes | 30 / 20 |
| Páginas de los PDFs completos | 2.652 |
| Segmentos candidatos extraídos | 8.086 |
| Solicitudes HTTP, incluidos robots | 20 |
| Cuerpos decodificados consumidos | 23.803.914 bytes |
| Tiempo interno de adquisición/extracción | 38.391 ms |
| RSS máximo observado con `/usr/bin/time -l` | 304.349.184 bytes |
| Repetición offline | 10 cachés, 0 solicitudes, 0 bytes, 79 ms |
| Integridad offline | 31 archivos verificados; ledger idéntico byte a byte |
| Documentos publicados / indexados | 0 / 0 |

Incluye Constitución, Código Civil Federal, Código de Comercio, Código Fiscal, Código Penal, Ley de Amparo, LFDA, LFPC, LFT y LGSM. Los hashes/URLs/fechas declaradas y recibos HTTP están en el JSON. El pico corresponde al proceso de fábrica en el Mac de desarrollo de 24 GiB; no valida el cliente ni un equipo físico de 8 GB. Las muestras RSS inicial/final del coordinador tampoco son pico.

Una ejecución anterior terminó 10/10, 20 solicitudes, los mismos 23.803.914 bytes y 38.324 ms sobre la revisión inicial. Mientras terminaba se añadió código para conservar MIME/recibos de versión. Se conservó el primer informe y su freeze sin atribuirle la prueba de la nueva revisión; se revisó y congeló de nuevo el código y se ejecutó en un directorio distinto. **Las dos ejecuciones suman 40 solicitudes y 47.607.828 bytes de cuerpos**, aparte del preflight/consulta del índice. El JSON distingue ambos recibos; no son 20 documentos únicos.

## Calidad pendiente y cuarentena

Los 8.086 segmentos están en cuarentena: `textReview=pending`, `legalReview=pending`, `published=false`, `indexed=false`. El parser marca 1.400 con anomalías y conserva notas editoriales en 4.175; las notas no equivalen automáticamente a error. Su diagnóstico `structurally-verified` tampoco concede aprobación textual/jurídica.

La extracción nativa segmenta el cuerpo operativo y localiza comienzo de transitorios; **no preserva todavía transitorios completos e historia de reformas como unidades consultables**. Se conservan los PDFs íntegros y sus hashes. Referencias de páginas y hash de texto extraído no demuestran fidelidad visual o literal. Las fechas declaradas de reforma no son determinaciones de vigencia; `effectiveAt` sigue desconocido. No OCR, publicación, entrenamiento, búsqueda de producto o evaluación jurídica activados.

## Pruebas y revisión

Primera suite completa: 586/587, fallo en la nueva prueba de crawl-delay por un umbral de reloj real demasiado estricto bajo carga paralela. Se corrigió solo la prueba: reloj monotónico simulado, duraciones desiguales y esperas exactas `[2863,2579,2927]`; detecta omitir/aplicar mal robots o no descontar tiempo transcurrido. Código de fábrica sin cambios por esa corrección. Suite completa final: **587/587**; TypeScript/Vite pasan. Se conserva el fallo inicial, no se atribuye al STT histórico.

Revisor Sol independiente aprobó código C0/C1a y ejecutó 35/35 dirigidas; también verificó MIME sin parámetros, evidencia inmutable offline y rechazo de manipulación antes de red. Cierre final **APPROVE**: revisor recalculó los 31 hashes del ledger, freeze/PDFs/recibos, los 8.086 hashes de texto/referencias de páginas y estados de cuarentena; corroboró totales, informes live/offline, logs de suite/build y RSS. Repitió independientemente las 20 pruebas de adquisición tras corregir el reloj.

SF de construcción: dos contextos builders `gpt-6.1-sol` y un contexto revisor independiente `gpt-6.1-sol`; Codex coordina e integra. Sin Astra o nuevas generaciones de Claude/Gemini/Kimi/Cursor/Perplexity en esta construcción; las aportaciones de investigación anteriores mantienen su registro propio. Tokens/cuota no expuestos. No compras, nuevas dependencias, despliegue cloud o documentos de clientes.

## Continuación

C1b debe verificar rutas/permisos y fijar 16 documentos estatales y cuatro judiciales reales antes de descargarlos; un bloqueo conserva su plaza pendiente. C2/C3 deben medir fidelidad/segmentación/transitorios/OCR con aceptación separada antes de promover texto. C4 conecta citas/cobertura a la demo y revisión de Lorenzo/Pedro. C5 expande por lotes con actualización y universos explícitos.

La fábrica pública se separa del producto **local → nube → local**: preparación de privacidad y mapa reversible locales; trabajo pesado remoto; restitución local autorizada. H4b detector pequeño, H5 bóveda/custodia/recuperación y H6 proveedor/presupuesto siguen abiertos. La aplicación activa continúa con su motor anterior hasta integrar y medir esos componentes; este ensayo público no cambia ese hecho.

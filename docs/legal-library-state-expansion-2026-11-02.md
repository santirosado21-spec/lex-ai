# Ampliación estatal oficial congelada — 2 de noviembre de 2026

El lote `artifacts/legal-library/state-expansion-2026-11-02/frozen-v1` contiene **5,304 artículos de cinco códigos**, con 4,680 artículos de entrenamiento, 426 de validación y 198 de prueba. Se descargaron realmente ocho PDF oficiales (10,315,395 bytes y 1,670 páginas), desde enlaces observados en los índices de los congresos de [Jalisco](https://congresoweb.congresojal.gob.mx/BibliotecaVirtual/busquedasleyes/ListadoMov.cfm) y [Nuevo León](https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos.php). No se usaron documentos privados ni contenido de competidores.

| Fuente | Partición permanente | Artículos aceptados después de deduplicar | Fecha declarada de reforma detectada |
| --- | --- | ---: | --- |
| MX-JAL-CC — Código Civil del Estado de Jalisco | train | 2,682 | No detectada; fecha de versión = recuperación |
| MX-JAL-CF — Código Fiscal del Estado de Jalisco | train | 200 | No detectada; fecha de versión = recuperación |
| MX-NLE-CC — Código Civil para el Estado de Nuevo León | train | 1,798 | 2026-06-26 |
| MX-NLE-CP — Código Penal para el Estado de Nuevo León | validation | 426 | 2026-06-15 |
| MX-NLE-CF — Código Fiscal del Estado de Nuevo León | test | 198 | 2023-01-13 |

Estas cifras representan artículos aceptados, **no códigos íntegros**. Aportan materia civil, familiar y fiscal para entrenamiento; penal y fiscal estatal quedan también como dominios reservados de evaluación. No se afirma cobertura de los 32 estados, de todas las prácticas, de transitorios ni de vigencia jurídica. Los registros indican `currentness: unverified`, `legalAccuracy: not-evaluated` y `effectiveAt: null`. Una fecha de reforma detectada o una URL con fecha no demuestra aplicabilidad actual.

## Fidelidad y exclusiones

La extracción primaria usa PDF.js mediante pdf-parse; cada cuerpo completo aceptado, además de inicio/medio/final, se encontró en las páginas registradas extraídas independientemente por Poppler `pdftotext`. Solo se normalizaron NFC y espacios y se retiraron líneas editoriales/de diseño explícitamente registradas. El resultado **5,304 comprobados / 5,304 coincidentes** es una auditoría automatizada de fidelidad de extracción, no una revisión jurídica o humana independiente.

El extractor falla cerrado ante reinicios de numeración, ausencia de inicio o límite transitorio, caracteres ilegibles, etiquetas ambiguas y anotaciones de invalidez. Después de tres intentos diagnosticados, no se insistió en reparar automáticamente los tres códigos problemáticos:

- MX-JAL-CP y MX-NLE-CPC: reinicios o identidades de artículo ambiguas antes del límite transitorio. Se excluye cada código completo.
- MX-JAL-CPC: mapeo defectuoso de glifos en PDF.js (`ArtÌculo`, `violaciÛn`) incompatible con una extracción fiel; no se sustituyeron caracteres por conjetura. Código completo excluido.
- CDMX: el servidor redirige `robots.txt` a un dominio cuyo certificado no coincide; adquisición diferida sin desactivar TLS. No se altera la biblioteca CDMX que ya exista.

`review-exclusions.json` conserva 3,510 registros excluidos. Los motivos pueden solaparse: 1,584 duplicados exactos con el corpus federal congelado, 52 duplicados dentro de la nueva partición, 1,435 registros afectados por reinicios, 193 fallos de coincidencia del cuerpo independiente, 349 textos demasiado cortos, 405 marcas cortas de derogación, 10 anotaciones de invalidez y cinco etiquetas ambiguas. Las leyes sin artículos reconocibles figuran en `manifest.sources`, aunque no producen filas de exclusión.

## Integridad y entrega a entrenamiento

Cada fila conserva URL oficial canónica, índice y su hash, jurisdicción, áreas, identificador/versión, fechas, PDF/texto/cuerpo SHA256 y páginas. `independent-extraction-audit.json.checks` enumera exactamente los ID y hashes aprobados. `sha256.json` fija todos los archivos de la entrega; `catalog.json` fija las fuentes y particiones. Las particiones son por ley y se mantienen entre versiones. La excepción MX-NLE-CF se declaró como prueba antes de cualquier entrenamiento y fue aceptada por el responsable de entrenamiento. `acquisitions.json.acquisitionSplit` conserva el valor histórico; `split` y catálogo congelado controlan la partición definitiva.

| Archivo | SHA256 |
| --- | --- |
| corpus.jsonl | `448e7f1e180e4fd56cedab1608bb7fc82dc3c6fc340a6f8e81a41f19f1fbd001` |
| manifest.json | `1e64edb03e7237afb763e5f592067da9dad4eda9064a5ce1a2f7bf6835412f51` |
| independent-extraction-audit.json | `98d4960a91db3f34cc767ae080dc9dd4ef0a3ad62479c90aa25bb5c58dba5b93` |

Solo `train.jsonl` es elegible para la continuación experimental; nunca mezclar validation/test ni candidatos sin congelar. La cola de entrenamiento debe esperar la corrida actual y su evaluación. Esta entrega no implica que el candidato haya sido entrenado, promovido o validado para uso profesional. El corpus federal `exports-v2` permanece intacto con SHA256 `e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11`.

La base de reutilización documentada se limita al texto legislativo oficial conforme a [LFDA, artículo 14 VIII](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf); no se incorporan comentarios, interpretaciones ni datos procesados de competidores.

## Reproducción y comprobación

Entorno medido: Node v22.22.3, pdf-parse 1.1.1, Poppler pdftotext 26.04.0. `build-environment.json` conserva las huellas de scripts y pruebas. Los índices y PDF originales se conservan por hash junto al lote; los intentos previos quedan en `review-attempt-v1` y `review-attempt-v2`.

```sh
node scripts/acquire-state-laws.mjs --discover
# Revisar y fijar catalog.json antes de descargar; los enlaces oficiales pueden cambiar.
node scripts/acquire-state-laws.mjs --download
node --max-old-space-size=768 scripts/audit-state-laws.mjs
node --test tests/state-corpus.test.mjs
# --freeze crea frozen-v1 solo si no existe; nunca sobrescribe una entrega existente.
node scripts/verify-state-laws.mjs
```

Validación ejecutada: seis pruebas del extractor pasan; el verificador de la entrega pasa hashes de todos los archivos, PDF e índices originales, identidad exacta del corpus/auditoría, disjunción por ley, coincidencia de archivos por partición, metadatos de páginas/texto, ausencia de duplicados exactos nuevos o con el corpus base y preservación del corpus federal. Las propuestas de cobertura futura deben crear otra versión congelada, manteniendo las leyes reservadas fuera de entrenamiento.

## Consulta en el asistente unificado

`resources/state-library.jsonl` es una copia byte por byte del corpus congelado, con la misma huella. `server/state-library.mjs` verifica esa huella antes de cargarlo de forma diferida; valida también cada identidad/fuente/texto/página y devuelve solamente artículos aceptados. No cambia la biblioteca federal ni CDMX. `resources/state-library-catalog.json` enumera los cinco títulos oficiales y su cobertura parcial.

El asistente reconoce una consulta con un artículo y el título oficial completo, por ejemplo `Explica el artículo 1 del Código Civil del Estado de Jalisco`. Conserva en la cita URL, versión, PDF, páginas y hash del texto original, además del hash del pasaje entregado al modelo. Una petición amplia, un título desconocido, varios artículos ambiguos o una disposición excluida requieren más contexto o abstención. No realiza búsqueda semántica estatal sobre códigos incompletos ni sustituye una disposición ausente con derecho federal. Los artículos reservados de validación/prueba pueden consultarse con evidencia en el producto, sin incorporarlos a entrenamiento del candidato.

Las cinco nuevas pruebas de integración/consulta y las pruebas existentes de alcance/router/conversación unificada se ejecutaron con un modelo simulado: **18/18 pasan** junto con las seis pruebas de extracción incluidas en esa cifra. Comprueban los cinco códigos, continuidad conversacional, conservación de alcance federal/CDMX, corrupción del recurso y abstención por el artículo 477 de Jalisco excluido por anotación de invalidez. Esto valida selección de fuentes y contratos de citas; no mide calidad del modelo real ni memoria en equipos de 8 GB.

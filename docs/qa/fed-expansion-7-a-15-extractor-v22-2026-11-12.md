# QA adquisición federal lotes 7-15 (extractor v22) — 2026-11-12

Cadena de adquisición en cadencia autorizada por instrucción del usuario 2026-11-12 (priorizar terminar scraping; alcance operativo, no autorización de derechos). Mismo canal oficial Cámara de Diputados y procedimiento fail-closed de lotes 1-6: índice oficial re-verificado en vivo por lote (SHA-256 a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca, sin deriva en los 9 lotes), HEAD HTTP200 application/pdf por PDF, registry por lote en resources/, snapshots preservados.

TODO EN CUARENTENA (textReview/legalReview pending). Conteo ≠ corpus limpio ni completo; contenido NO revisado. Anomalías documentales = clases conocidas del extractor v22, trazables en coverage.discardedSamples de cada extracción.

## Resumen

| Lote | Docs extraídos | Registros | Estado | Anomalías documentales |
|---|---|---|---|---|
| 7 | 10/10 | 2,963 | complete | cjm (mid-sentence, section-discard), cmpp (section-discard), lacp (mid-sentence, section-discard), lfd (mid-sentence) |
| 8 | 10/10 | 622 | complete | lansi, lapp, law-10 (section-discard); lapp también mid-sentence |
| 9 | 9/10 | 309 | partial | sin anomalías; law-176 extraction-invalid |
| 10 | 9/10 | 108 | partial | sin anomalías; law-176 re-intento fallido |
| 11 | 9/10 | 1,619 | partial | law-211 (operative-numbering-restarts), law-218 (section-discard); law-204 extraction-invalid |
| 12 | 10/10 | 364 | complete | law-252 (mid-sentence), law-271 (section-discard) |
| 13 | 9/10 | 384 | partial | law-74 (mid-sentence); law-79 extraction-invalid |
| 14 | 10/10 | 899 | complete | lce (section-discard), lcm (mid-sentence) |
| 15 | 10/10 | 640 | complete | lcndh, ldfefm, ldrs (mid-sentence) |

Totales: 86 documentos extraídos, 7,908 registros, 3 fallidos. Cobertura federal: 134/317 instrumentos (48 previos + 86).

## Fallidos conocidos (clase nueva: encabezados ordinales en letra)

- law-176 (Ley para Conservar la Neutralidad del País, 1939): encabezados "ARTICULO PRIMERO.-" en ordinal con letra; extractor v22 solo acepta numéricos → 0 registros → extraction-invalid. Snapshot preservado (sha256 b1de107a…395a) para re-extracción offline.
- law-204: mismo formato ("ARTICULO PRIMERO.-", "ARTICULO UNICO.-").
- law-79: variante con rango ("ARTICULOS PRIMERO A OCTAVO.-").

Decisión operativa: excluidos de la selección de lotes para no re-descargar; pendiente extractor v23 con soporte de ordinales en letra (bump EXTRACTOR_VERSION + pins del harness NL en el mismo commit, re-extracción offline sobre snapshots ya preservados, sin costo de red). No se declara inexistencia de otras variantes en los 181 instrumentos restantes.

## Notas

- Lote 7 se descargó dos veces (primera corrida sin --out explícito no dejó salida localizable; segunda con --out). Dentro de presupuestos; sin efecto en corpus.
- Cifras derivadas de los archivos de extracción (jq .records|length), no estimadas.

# Expansión federal lote 3 + extractor legal-library v16 — 2026-11-11

## Alcance

Lote acotado 3 del canal oficial Cámara de Diputados (LeyesBiblio): 5 documentos
nuevos (LGTOC, CFPC, LFCDO, LGAMVLV, LGS), más una corrección de extractor (v16)
motivada por un hallazgo de calidad en LGS. Todo el material queda en CUARENTENA;
sin publicación, sin indexación, sin export de entrenamiento.

## Adquisición

- Índice oficial re-verificado en vivo 2026-11-11T22:59Z: SHA256
  a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca, sin drift
  contra los lotes 1-2.
- HEAD en vivo por candidato, HTTP200 application/pdf: LGTOC 1205962 B,
  CFPC 1549659 B, LFCDO 692224 B, LGAMVLV 903623 B, LGS 3286114 B.
- `--live` acotado (5 docs, 20 requests máx, 20 MB máx, rate 2s, concurrencia 1):
  estado `complete`, 5/5 en cuarentena. Registro:
  `resources/legal-acquisition-fed-expansion-3-2026-11-11.json`.
- Notas editoriales del índice (verbatim en el registro): CFPC porta la nota
  "Abrogado en un plazo que no exceda del 01/04/2027" + "Notificación 17/06/2025
  Sentencia SCJN" (vigente al momento de la adquisición; se registra, no se
  interpreta). LGAMVLV con cambio de título editorial ("...Violencias", antes
  "...Violencia").

## Extractor v16 (hallazgo LGS)

LGS usa encabezado de página en plural ("Últimas Reformas DOF 15-01-2026") y
portada "Últimas reformas publicadas DOF 15-01-2026". El extractor v15 solo
reconocía el singular, así que:

1. El encabezado de página NO se filtraba: 192 ocurrencias inline
   "Últimas Reformas DOF 15-01-2026" quedaban intercaladas dentro del texto de
   168 de 721 registros.
2. `declaredAmendedAt` quedaba `null` pese a la fecha declarada en portada.

Cambio mínimo (server/legal-library.mjs): ambas regex ampliadas a plural
(`Últimas?\s+Reformas?`, `publicadas?`). EXTRACTOR_VERSION 15→16; pins del
harness NL movidos en el mismo commit (PARSER_VERSION legal-library-16,
extractorVersion!==16 en extract-nuevo-leon-research.mjs), por la disciplina del
lote 2.

## Evidencia

- Prueba sintética directa de ambas regex: plural y singular filtran/fechan;
  "Reformada DOF ..." (marca editorial legítima) NO se filtra.
- Regresión offline v15→v16 sobre las 33 extracciones acumuladas (pilot,
  fed-expansion-1, fed-expansion-2, fed-expansion-3): 32 byte-idénticas
  (secuencia completa articleId + textSha256 + declaredAmendedAt). Único cambio:
  lgs (721→721 registros; 168 registros con texto corregido; 0 ocurrencias del
  encabezado restantes; declaredAmendedAt null→2026-01-15).
- Fronteras finales verificadas contra el PDF oficial (pdftotext): cfpc termina
  en Artículo 626 (sin 627), lfcdo en 45, lgamvlv en 60 (encabezado en
  mayúsculas), lgs en 482, lgtoc en 435. Cada PDF con fecha de reforma en
  portada reconciliada contra la fila editorial del índice.
- Auditoría `public-corpus-extraction-audit.mjs` en fed-expansion-3:
  reportState complete, 0 hallazgos, 0 anomalías por documento; conteos v16:
  cfpc 630, lfcdo 57, lgamvlv 98, lgs 721, lgtoc 440.
  Nota de selección de la auditoría: ante dos extracciones del mismo snapshot
  (mismo capturedAt), toma la última en orden de recorrido; tras el reproceso
  v15→v16 puede mostrar el declaredAmendedAt de la variante vieja. Cosmético;
  la cadena de integridad y los conteos son correctos en ambas variantes.
- Conteos totales del corpus federal acumulado: 33 documentos extraídos.
- Suite: 1140 pruebas, 1107 pasan, 0 fallan, 33 omitidas.

## Estado

Todo el material del lote 3 permanece en CUARENTENA (productionEnabled=false,
published=false, indexed=false, trainingExported=false). CFPC vigente al
2026-11-11 con abrogación programada notada; la política de texto histórico/
vigente sigue siendo decisión del dueño ya planteada.

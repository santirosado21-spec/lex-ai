# Expansión federal lote 5 (transparencia y sector público) — extractor v16 — 2026-11-11

## Alcance

Lote acotado 5 del canal oficial Cámara de Diputados (LeyesBiblio): 5 documentos
nuevos de transparencia y sector público (LGTAIP, LGRA, LAASSP, LOPSRM, LGCG).
Sin cambios de extractor: v16 se mantiene. Todo el material queda en CUARENTENA;
sin publicación, sin indexación, sin export de entrenamiento.

## Adquisición

- Índice oficial re-verificado en vivo 2026-11-12T00:22Z: SHA256
  a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca, sin drift
  contra los lotes 1-4.
- HEAD en vivo por candidato, HTTP200 application/pdf: LGTAIP 749599 B,
  LGRA 972618 B, LAASSP 682666 B, LOPSRM 989068 B, LGCG 636591 B.
- `--live` acotado (5 docs, 20 requests máx, 20 MB máx, rate 2s, concurrencia 1):
  estado `complete`, 5/5 en cuarentena. Registro:
  `resources/legal-acquisition-fed-expansion-5-2026-11-11.json`.
- Filas editoriales del índice (registradas en el registro): LGTAIP DOF
  20/03/2025, sin reforma; LGRA DOF 18/07/2016, reforma 15/12/2025; LAASSP DOF
  16/04/2025, sin reforma; LOPSRM DOF 04/01/2000, reforma 14/11/2025; LGCG DOF
  31/12/2008, reforma 14/05/2026.

## Evidencia

- `declaredAmendedAt` reconciliado contra portada oficial (pdftotext) y fila
  editorial del índice: lgra 2025-12-15, lopsrm 2025-11-14, lgcg 2026-05-14.
  lgtaip y laassp son leyes nuevas sin reforma: la portada oficial dice "Nueva
  Ley DOF 20-03-2025" / "Nueva Ley DOF 16-04-2025" sin línea "Última Reforma",
  por lo que el extractor reporta `declaredAmendedAt=null` — comportamiento
  fiel, consistente con "Sin reforma" del índice.
- Fronteras finales verificadas contra el PDF oficial (pdftotext): lgtaip
  termina en Artículo 216 (216 registros, sin BIS), laassp en 120 (120, sin
  BIS), lgra en 229 (235 registros; excedente = 60-BIS, 63-BIS, 64-BIS, 64-TER,
  64-QUÁTER, 80-BIS), lopsrm en 104 (133; excedente = 1-BIS, 1-TER, 1-QUÁTER,
  1-QUINQUIES, 19-BIS, 24-BIS, 26-BIS, 27-BIS, 39-BIS, 40-BIS, 44-BIS, 45-BIS,
  45-TER, 46-BIS, 52-BIS, 52-TER, 59-BIS, 59-TER, 61-BIS, 74-BIS, 74-TER,
  74-QUÁTER, 74-QUINQUIES, 74-SEXIES, 74-SEPTIES, 93-BIS, 93-TER, 95-BIS,
  97-BIS), lgcg en 86 (87; excedente = 10-BIS). Sin huecos numéricos en ningún
  documento. Los encabezados BIS del PDF oficial usan formato con espacio
  ("Artículo 64 Quáter.", "Artículo 74 Sexies.", "Artículo 10 Bis.-") —
  variante editorial oficial que v16 normaliza correctamente (verificación por
  grep directo sobre el texto del PDF).
- Regresión offline sobre las 38 extracciones acumuladas anteriores (pilot 18,
  fed-expansion-1 5, fed-expansion-2 5, fed-expansion-3 5, fed-expansion-4 5)
  tras el lote 5: reproceso `--offline` completo por lote, 38/38 reusadas con
  verificación de bytes (cached), 0 fallos; solo se reescriben report.json y el
  plan de cada lote (el pipeline escribe fail-closed con verificación de bytes
  en colisión).
- Auditoría `public-corpus-extraction-audit.mjs` en fed-expansion-5:
  reportState complete, ok=true, 0 hallazgos; por documento 0 hashes malos,
  0 vacíos, 0 duplicados, 0 no monótonos, 0 anomalías; conteos v16: laassp 120,
  lgcg 87, lgra 235, lgtaip 216, lopsrm 133.
- Conteos totales del corpus federal acumulado: 43 documentos extraídos.

## Estado

Todo el material del lote 5 permanece en CUARENTENA (productionEnabled=false,
published=false, indexed=false, trainingExported=false). Nada certifica vigencia
ni aplicabilidad; la política de texto histórico/vigente sigue siendo decisión
del dueño ya planteada.

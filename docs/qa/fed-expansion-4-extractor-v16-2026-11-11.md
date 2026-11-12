# Expansión federal lote 4 (regulación financiera) — extractor v16 — 2026-11-11

## Alcance

Lote acotado 4 del canal oficial Cámara de Diputados (LeyesBiblio): 5 documentos
nuevos de regulación financiera (LMV, LISF, LPAB, LFI, LUC). Sin cambios de
extractor: v16 se mantiene. Todo el material queda en CUARENTENA; sin
publicación, sin indexación, sin export de entrenamiento.

## Adquisición

- Índice oficial re-verificado en vivo 2026-11-12T00:01Z: SHA256
  a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca, sin drift
  contra los lotes 1-3.
- HEAD en vivo por candidato, HTTP200 application/pdf: LMV 1933761 B,
  LISF 2184319 B, LPAB 600789 B, LFI 1139853 B, LUC 787320 B.
- `--live` acotado (5 docs, 20 requests máx, 20 MB máx, rate 2s, concurrencia 1):
  estado `complete`, 5/5 en cuarentena. Registro:
  `resources/legal-acquisition-fed-expansion-4-2026-11-11.json`.
- Filas editoriales del índice (registradas en el registro): LMV DOF 30/12/2005,
  reforma 14/11/2025; LISF DOF 04/04/2013, reforma 14/11/2025; LPAB DOF
  19/01/1999, reforma 11/05/2022; LFI título actual con nota editorial (Antes
  "Ley de Sociedades de Inversión"), DOF 04/06/2001, reforma 14/11/2025; LUC DOF
  20/08/2008, reforma 14/11/2025.

## Evidencia

- `declaredAmendedAt` de cada extracción reconciliado contra la fila editorial
  del índice: lmv/lisf/lfi/luc 2025-11-14; lpab 2022-05-11.
- Fronteras finales verificadas contra el PDF oficial (pdftotext): lfi termina en
  Artículo 97 (los artículos 96-97 usan formato editorial "Artículo N." con punto
  y sin guion — inconsistencia del PDF oficial, extraídos correctamente), lisf en
  510, lmv en 423, lpab en 94, luc en 145. Los excedentes de registros sobre el
  artículo final son artículos BIS insertados (lmv 40: 9-BIS, 55-BIS, 63-BIS,
  63-BIS-1, …; lpab 1: 64-BIS; luc 6: 44-BIS, 98-BIS, 119-BIS, 119-BIS-1, …).
- Regresión offline sobre las 33 extracciones acumuladas anteriores (pilot 18,
  fed-expansion-1 5, fed-expansion-2 5, fed-expansion-3 5) tras el lote 4:
  reproceso `--offline` completo por lote y las 150 extracciones almacenadas
  quedan byte-idénticas; 0 archivos nuevos (el pipeline escribe fail-closed con
  verificación de bytes en colisión).
- Auditoría `public-corpus-extraction-audit.mjs` en fed-expansion-4:
  reportState complete, 0 hallazgos, 0 anomalías, 0 hashes malos, 0 duplicados,
  0 no monótonos por documento; conteos v16: lfi 195, lisf 510, lmv 463,
  lpab 95, luc 151.
- Conteos totales del corpus federal acumulado: 38 documentos extraídos.

## Estado

Todo el material del lote 4 permanece en CUARENTENA (productionEnabled=false,
published=false, indexed=false, trainingExported=false). Nada certifica vigencia
ni aplicabilidad; la política de texto histórico/vigente sigue siendo decisión
del dueño ya planteada.

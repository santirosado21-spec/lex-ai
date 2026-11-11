# Expansión federal acotada + extractor legal-library v13 — 2026-11-11

## Alcance

Lote acotado de 5 documentos federales adicionales al piloto de 10, bajo instrucción
del propietario del 2026-11-11 de ampliar el repertorio federal. Adquisición
reversible y en cuarentena, sin integración a producto, publicación ni exportación.

Registro separado: `resources/legal-acquisition-fed-expansion-2026-11-11.json`
(no modifica el registro piloto, que permanece congelado con sus 30 asientos).
Mismo canal oficial (Cámara de Diputados, LeyesBiblio) y misma base LFDA art. 14
frac. VIII; `rightsReview` del lote registra la instrucción del 2026-11-11 y el
revisor técnico. Verificaciones runtime fail-closed sin cambios (robots, TLS,
destino, presupuestos). Límites propios: maxDocuments 5, maxTotalBytes 20 MB,
maxDocumentBytes 5 MB.

Documentos: cnpcf, cnpp, lfpdppp, lisr, liva. Verificación previa en vivo
2026-11-11: índice oficial HTTP 200 (SHA256 registrado en el registro), 317 ligas
PDF, y HEAD 200 `application/pdf` por documento (1 704 798 / 2 680 035 /
3 021 915 / 1 249 332 / 457 399 bytes; los bytes descargados coinciden exactos).

## Cambio de extractor (v12 → v13)

LIVA detuvo la extracción v12 en la página 3 con la anomalía
`operative-numbering-restarts-before-transitory-boundary` (2 registros). Causa:
la forma editorial `Artículo 1o.-A BIS.-` (letra decimal + BIS). El lookahead del
punto decimal no aceptaba la palabra BIS tras la letra, así que el encabezado se
reconocía como `Artículo 1o.` simple; el id `1` ya existía y el freno fail-closed
detuvo el documento. Además LIVA contiene `Artículo 18-H QUINTUS.`; QUINTUS no
estaba en la familia de sufijos y el encabezado se fusionaba en silencio con el
artículo anterior sin anomalía.

Cambio mínimo en `server/legal-library.mjs` (regex ARTICLE): el lookahead del
punto acepta la palabra de familia tras la letra, y QUINTUS se añade a la familia
de sufijos en las tres posiciones. `EXTRACTOR_VERSION` 12 → 13; pines del arnés
de investigación NL movidos en el mismo commit (`PARSER_VERSION`,
`FROZEN_HASHES['server/legal-library.mjs']`, verificación `extractorVersion`).

Verificación de presencia de las formas (pdftotext sobre los 23 snapshots):
solo LIVA contiene ambas formas (1 ocurrencia cada una); los 18 documentos del
piloto y los otros 4 del lote no contienen ninguna.

## Evidencia

- Prueba sintética directa de `extractArticles`: ids
  `1-A, 1-A-BIS, 1-B, 18-H, 18-H-BIS, 18-H-TER, 18-H-QUÁTER, 18-H-QUINTUS, 19`,
  sin anomalías.
- Regresión piloto byte-idéntica: re-extracción offline con v13 de los 18
  documentos; conteos, secuencias completas de `articleId` y anomalías idénticos
  a la línea base v12 (fed 3085/1641/421/136/546/272/254/188/1266/277; NL
  3088/589/1202/211/64/55/229/172).
- Adquisición `--live` acotada: 5/5 descargados y extraídos, 10 solicitudes,
  9 114 519 bytes decodificados, estado `complete`, 0 fallos, robots re-verificado
  en runtime por documento.
- Conteos v13 del lote: cnpcf 1191, cnpp 490, lfpdppp 64, lisr 236, liva 80;
  0 anomalías de documento; fronteras de transitorios localizadas en los 5.
- Conciliación LIVA independiente: 80 encabezados operativos antes de la frontera
  de transitorios (pdftotext) = 80 registros; el único acierto ingenuo posterior
  a la frontera es cuerpo del decreto transitorio (`Artículo 123 Constitucional`),
  correctamente excluido.
- Auditorías `public-corpus-extraction-audit.mjs`: ok=true, 0 hallazgos, en piloto
  y lote.
- Suite: 1118 pruebas, 1085 pasan, 0 fallan, 33 omitidas.

## Estado

Todo el texto extraído permanece en cuarentena (`published:false, indexed:false`).
Sin validación de vigencia ni exactitud legal. Las cifras de terceros (p. ej.
directorios de competidores) no son afirmaciones oficiales verificadas.

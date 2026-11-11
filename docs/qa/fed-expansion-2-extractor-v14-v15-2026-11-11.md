# Expansión federal lote 2 + extractor legal-library v14 y v15 — 2026-11-11

## Alcance

Segundo lote acotado de 5 documentos federales (lss, lieps, lfpa, lic, ladua),
bajo instrucción del propietario del 2026-11-11 de continuar el scraping de
Rejon, transmitida por delegación de tarea Instinct (alcance operativo, no
autorización de derechos). Adquisición reversible y en cuarentena, sin
integración a producto, publicación ni exportación.

Registro separado: `resources/legal-acquisition-fed-expansion-2-2026-11-11.json`
(no modifica el registro piloto ni el del lote 1). Mismo canal oficial (Cámara
de Diputados, LeyesBiblio) y misma base LFDA art. 14 frac. VIII. Verificaciones
runtime fail-closed sin cambios (robots, TLS, destino, presupuestos). Límites
propios: maxDocuments 5, maxTotalBytes 20 MB, maxDocumentBytes 5 MB.

Verificación previa en vivo 2026-11-11T22:31Z: índice oficial re-descargado,
SHA256 a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca
idéntico al de la mañana (sin drift), y HEAD 200 `application/pdf` por
documento (LSS 2 161 638 B, LIEPS 1 775 862 B, LFPA 525 559 B, LIC 2 704 455 B,
LAdua 2 088 249 B; los bytes descargados coinciden exactos).

## Extractor v14 (freno fail-closed en ladua)

La auditoría del lote detuvo ladua: 22 registros no monótonos y anomalía
`operative-numbering-restarts-before-transitory-boundary`. Causa: en la página
85, una línea inicia con la REFERENCIA cruzada `Artículo 144-A de esta Ley,
cuando los locales…` (continuación del artículo 121). El terminador del regex
aceptaba el guion de `144-A` como terminador del encabezado, creando un
artículo falso `144`; cuando el `ARTICULO 144.` real apareció después, el id ya
existía y el freno detuvo el documento en el artículo 143 (extracción
truncada: 189 registros).

Cambio mínimo: el terminador `-`/`–` ahora exige que NO le siga letra o dígito
(`[-–](?![A-Za-zÑñ\d])`). Los encabezados reales con guion (p. ej.
`ARTICULO 122- …`, `Artículo 144-A.-`) siguen reconociéndose por la ruta de
sufijo + terminador.

## Extractor v15 (familia ordinal ampliada)

La familia de sufijos ordinales no cubía SEXIES/SEXTUS/SEPTIES/SEPTIMUS/
OCTIES/NONIES/NONUS/DECIES/UNDECIES/DUODECIES/DUODECIMUS; esos encabezados se
fusionaban en silencio con el artículo anterior. Presencia verificada con
pdftotext sobre los snapshots oficiales (encabezados operativos, no
referencias):

- cpf: `Artículo 199 Sextus.`, `199 Septies.-`, `199 Octies.-` (adicionado DOF
  01-06-2021), `199 Nonies.-` (adicionado DOF 01-06-2021), `199 Decies.-`.
- lfda: `Artículo 114 Sexies.-`, `114 Septies.-`, `114 Octies.-`,
  `232 Sexies.-`.
- lic: `Artículo 112 Sextus.-`.

Las otras formas añadidas no aparecen en los 28 snapshots actuales (sin
cambio de conteos por ellas).

## Corrección al registro del lote 1 (doc fechado, no reescrito)

`docs/qa/fed-expansion-extractor-v13-2026-11-11.md` afirmó regresión v12→v13
byte-idéntica en los 18 documentos y que solo LIVA contenía las formas
letra+BIS y QUINTUS. La verificación de hoy muestra que v13 SÍ cambió dos
documentos del piloto, en ambos casos divisiones correctas que v12 fusionaba:

- cpf: +2 (`Artículo 199 Quintus.`, `Artículo 209 Quintus.-`).
- lfpc: +2 (`ARTÍCULO 63 QUINTUS.-`, `ARTÍCULO 73 QUINTUS.-`).

Los cuatro encabezados existen en los PDF oficiales (verificado pdftotext).
La afirmación de identidad del doc del lote 1 era inexacta para cpf y lfpc;
este párrafo es el registro de corrección.

## Evidencia

- Prueba sintética directa de `extractArticles` (v14): la referencia
  `Artículo 144-A de esta Ley, cuando…` ya no divide; ids `121, 122, 144,
  144-A`, 0 anomalías. Formas v13 preservadas (`1-A-BIS`, `18-H-QUINTUS`).
- Prueba sintética (v15): `114-SEXIES, 114-SEPTIES, 114-OCTIES, 199-SEXTUS,
  199-DECIES` dividen; la referencia cruzada sigue sin dividir; 0 anomalías.
- Regresión offline v13→v14 (28 snapshots): 27 byte-idénticos
  (secuencia completa articleId + textSha256); ladua 189 → 277 registros,
  completo hasta la frontera de transitorios, anomalía resuelta.
- Regresión offline v14→v15 (28 snapshots): 25 byte-idénticos; cambios solo
  cpf 548→553, lfda 254→258, lic 485→486, cada id nuevo verificado contra el
  PDF oficial.
- Auditorías `public-corpus-extraction-audit.mjs` en los tres directorios:
  ok=true, 0 hallazgos.
- Adquisición `--live` acotada: 5/5 descargados y extraídos, estado
  `complete`, 0 fallos, robots re-verificado en runtime por documento.
- Conteos v15 del lote 2: lss 337, lieps 52, lfpa 117, lic 486, ladua 277;
  0 anomalías de documento; ladua termina en el artículo 203 con frontera de
  transitorios localizada.
- Suite: 1086 pasan, 0 fallan, 33 omitidas; build tsc+vite OK.

## Estado

Todo el texto extraído permanece en cuarentena (`published:false,
indexed:false`). Sin validación de vigencia ni exactitud legal. Los pendientes
de decisiones del propietario (SCJN/SJF, Jalisco robots, namespace NL-03,
política de textos históricos/vencidos, gobernanza S2b2) siguen intactos; este
lote no los toca.

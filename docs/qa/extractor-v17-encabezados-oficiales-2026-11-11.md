# Extractor v17 — encabezados oficiales sin punto y ordinal degradado — 2026-11-11

## Alcance

Corrección local acotada del extractor para dos formatos editoriales de PDFs
oficiales diagnosticados en fed-diagnostic-1 (LGSMIME, LOEFAM, REG_SENADO).
Sin integración, sin publicación, sin re-freeze, sin heldout, sin gasto. Gates
fail-closed intactos; textReview/legalReview de cada registro siguen
`pending`; todo el material permanece en CUARENTENA.

## Cambio (server/legal-library.mjs, EXTRACTOR_VERSION 16→17)

1. Encabezado sin punto de línea completa (`bare`): la línea es exactamente
   `Artículo N` (sin ningún otro carácter). Aceptación fail-closed:
   - Sin cuerpo iniciado: solo N=1 puede abrir el cuerpo; cualquier otro número
     se ignora (nunca arranca a mitad del documento en una cita).
   - Con cuerpo iniciado: solo N = actual+1 continúa la secuencia; cualquier
     otro número queda como texto del artículo en curso (no abre disposición).
   - Colisiones de numeración usan la misma anomalía fail-closed
     `operative-numbering-restarts-before-transitory-boundary`.
   - Las líneas con texto tras el número ("Artículo 105 de la Constitución…")
     nunca califican: el patrón exige fin de línea tras el número.
   - No se aplica `midSentenceFragment` a este patrón: las portadas/decretos
     previos de estos formatos terminan sin puntuación; la protección real es
     la triple compuerta (línea exacta, abrir-solo-en-1, continuar-solo-+1) más
     la frontera transitoria y la reconciliación contra pdftotext.
2. Ordinal degradado por OCR: `ARTICULO 1/o.` y `ARTICULO 1/o BIS.` (diagonal
   en lugar de signo ordinal). Extensión mínima del grupo ordinal del patrón
   `ARTICLE`; no acepta otras diagonales.
3. Pines movidos en el mismo commit (disciplina del repo):
   `scripts/extract-nuevo-leon-research.mjs` PARSER_VERSION legal-library-17 y
   aceptación extractorVersion 17 en quarantineExtraction.
4. 3 tests nuevos (tests/legal-library.test.mjs): apertura solo-en-1 y
   secuencia estricta; citas con texto posterior nunca abren; ordinales "N/o."
   y "N/o BIS." anclan.

## Verificación

- Regresión sobre las 46 extracciones en cuarentena (7 lotes), comparando la
  extracción v16 más reciente de cada documento contra v17 por
  (articleId, textSha256, sourcePages): 43/46 BYTE-IDÉNTICAS. Cambian solo los
  3 documentos objetivo:
  - lgsmime 1→112 registros: numéricos 1..112 sin huecos; frontera transitoria
    p.48; máximo encabezado pdftotext 112. El "Artículo 5o." espurio de v16
    (cita constitucional en material transitorio) ya no se captura.
  - loefam 222→233: numéricos 1..209 sin huecos (recupera arts. 1-9 más
    1-BIS/2-BIS del tramo OCR "N/o."); 24 insertados en total; frontera
    transitoria p.49; máximo pdftotext 209.
  - reg-senado 6→312: numéricos 1..312 sin huecos; frontera transitoria p.89;
    máximo pdftotext 312. Los 6 registros espurios de v16 quedan en su
    posición secuencial correcta.
- Aclaración de historia local: archivos de extracción intermedios de hoy
  (anteriores al código v16 final) coexisten en el ledger inmutable; la
  comparación correcta es contra la extracción v16 MÁS RECIENTE por documento.
  Con esa base, lfpc (190), lic (486) y ladua (277, sin anomalías) son
  idénticos entre v16 y v17 — el aparente cambio inicial era contra archivos
  intermedios obsoletos, no contra v16 vigente.
- Documentos NL del piloto (extracción estatal HTML): byte-idénticos pre/post
  v17; sus anomalías previas (fronteras transitorias ausentes) son ajenas a
  este cambio y permanecen documentadas.
- Auditoría `public-corpus-extraction-audit.mjs` en los 7 lotes: ok=true,
  0 hallazgos, 0 hashes malos, 0 duplicados, 0 no monótonos.
- Suite completa: 1158+3 tests, 1128 pass / 0 fail / 33 skip.

## Límites

- LGSMIME conserva pendiente la REVISIÓN JURÍDICA de vigencia (abrogada DOF
  02-03-2023, "recupera vigencia" por declaratoria de invalidez SCJN DOF
  24-11-2023): el formato ya extrae, pero el estatus del texto NO se resuelve
  desde extracción ni tests; requiere decisión de revisión aparte.
- Que v17 extraiga los 3 instrumentos NO los integra a nada: la exportación
  congelada exports-v2 no se toca; cualquier re-freeze es decisión separada
  con su propia revisión.
- Nada certifica vigencia ni aplicabilidad. Sin push de estos cambios.

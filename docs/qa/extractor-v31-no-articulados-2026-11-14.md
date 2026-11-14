# Extractor v31 — soporte de documentos no articulados (2026-11-14)

## Por que
Corte canonico 2026-11-14 (2,878/2,874/2,867/270,689) dejaba 7 documentos
extraction-invalid por no tener estructura de articulos. Tarea: cuantificar la
clase y, si lo justifica, dar soporte con esquema fiel — NUNCA inventar numeros
de articulo. Todo el corpus sigue en CUARENTENA (textReview/legalReview
pending); estas cifras son limites honestos de extraccion, no calidad legal.

## Cuantificacion de la clase (7 documentos, 4 subclases reales)
Verificado contra los snapshots locales (pdftotext/OCR, no contra memoria):

1. **Principios/valores numerados con nombre** (`N.- Nombre.`): ags-ley-160
   (Codigo de Etica del Poder Ejecutivo de Aguascalientes). Verificado:
   "1.- Integridad." ... "10.- Compromiso Institucional." tras secciones
   romanas ("I.- Preámbulo.", "II.- Codigo de Etica...").
2. **Capitulos numerados en mayusculas** (`N. TITULO EN CAPS`): mor-cod-031
   (6 capitulos) y mor-cod-090 (5 capitulos).
3. **Resolutivos ordinales de decreto** (`Primero.`, `Segundo.`): oax-ley-222
   (decreto de distribucion, 2 resolutivos; OCR verificado).
4. **Sin gramatica fiel disponible (NO soportado en v31):**
   - mor-cod-069: secciones tematicas SIN numerar (indice, glosario,
     encabezados sueltos). Cualquier gramatica aqui inventaria estructura.
   - reg-lfgfaga-fe-16may55: declaratoria de 1955, una pagina, texto corrido.
   - mor-cod-045: PDF digital cuya fuente del cuerpo NO tiene mapa Unicode
     (pdffonts: Calibri emb uni=no): el texto extraible solo contiene
     encabezado/pie repetido. De-facto escaneado: requiere forzar OCR por
     documento (el disparador v29 no salta porque cada pagina "tiene texto").
     Pasa a cola OCR pendiente de mecanismo force-OCR. NO es red/timeout.

## Diseno v31 (fail-closed)
- `EXTRACTOR_VERSION=31`. Nuevo camino SOLO cuando el loop principal de
  articulos produce 0 records (`records.length===0`). Documentos con articulos
  nunca entran.
- Gramaticas estrictamente secuenciales desde el primer numero/palabra, con
  minimos: principios >=3, capitulos >=3, resolutivos >=2; cada registro
  exige cuerpo >=60 caracteres (si un segmento queda delgado, TODA la clase
  falla y el documento sigue extraction-invalid).
- principios: /^\d+\.\-\s+[A-ZÁÉÍÓÚÑ][^.\n]{1,58}[A-Za-záéíóúñ\)]\.$/
- capitulos: /^\d+\.\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,;()\/-]{3,70}\.?$/
  (todo mayusculas: excluye enumeraciones tipo "1. Constitucion Politica...")
- resolutivos: palabra ordinal suelta ("Primero." ... "Decimo."), secuencial.
- Los numeros/etiquetas salen SOLO del texto del documento (label = lo impreso).
- Records: articleId:null, recordKind principio|capitulo|resolutivo,
  ordinalLabel/headingTitle, quality.status quarantined SIEMPRE, anomalia
  `non-article-<kind>-record` + `non-article-document-class:<kind>`,
  coverage.nonArticleClass. Cuerpo cortado en encabezado TRANSITORIOS (el
  transitorio no se estructura: anomalia non-article-transitory-content-not-structured).
- quarantine() (server/corpus/acquisition.mjs) pasa recordKind/ordinalLabel/
  headingTitle al ledger (reconstruye records campo a campo).

## Verificacion
- Suite completa verde: 1,191 pass / 0 fail (tests/extractor-non-article-classes.test.mjs,
  10 casos: 3 clases + fail-closed de huecos de numeracion, minimos,
  enumeraciones titulo-case, corte en transitorios, documento articulado intacto).
- Equivalencia digital byte a byte: ags-ley-179 (37/37 records, textSha256 y
  articleId identicos v30->v31; unica diferencia = los 3 campos nuevos del
  ledger con valor por defecto).
- Equivalencia OCR byte a byte: yuc-ley-011 (115), yuc-ley-012 (78),
  yuc-ley-015 (50): textos+ids identicos v30->v31.
- Real, cada clase nueva: ags-ley-160 -> 10 principios (Integridad..Compromiso
  Institucional); mor-cod-031 -> 6 capitulos; mor-cod-090 -> 5 capitulos;
  oax-ley-222 -> 2 resolutivos (OCR, quarantined, anomalia ocr-derived-text-layer).
- reg-lfgfaga-fe-16may55 y mor-cod-069/045: extraction-invalid HONESTO
  (clase no soportada / cola OCR), sin numeros inventados.

## Corte canonico derivado (scripts/derive-canonical-cut.mjs, nuevo)
- ids registrados: 2,878 (sin cambio)
- documentos presentes: 2,874 (sin cambio)
- extracciones validas: 2,871 (+4: ags-ley-160, mor-cod-031, mor-cod-090, oax-ley-222)
- registros: 270,712 (+23: 10+6+5+2)
- Consistencia: 2,878 = 2,874 + 4 sin snapshot (ags-ley-2529,
  bc-presupuestoestado2026, col-reg-023, mex-ley-209); 2,874 = 2,871 + 3 sin
  extraccion (mor-cod-045, mor-cod-069, reg-lfgfaga-fe-16may55).
- Fallidos vigentes: 3 sin extraccion + 2 document-byte-budget +
  1 catalog-link-broken + 1 catalog-duplicate = 7.
- Reports de lote previos preservados: report-pre-v31-2026-11-14.json en los 7
  lotes tocados. Extracciones historicas v29/v30 intactas en el arbol.

## Limites declarados
- Records no articulados son CUARENTENA estructural: no afirman completitud
  legal del documento (p.ej. anexos o secciones sin numerar quedan fuera).
- mor-cod-069 y reg-lfgfaga-fe-16may55 siguen sin representacion estructural:
  es el estado honesto, no un hueco silencioso.

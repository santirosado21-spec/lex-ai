# Adquisicion de leyes estatales de Aguascalientes (congresoags.gob.mx) - 2026-11-13

Programa de adquisicion publica acotada de leyes estatales desde el catalogo oficial
del Congreso del Estado de Aguascalientes. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Catalogo: https://congresoags.gob.mx/agenda_legislativa/leyes
  sha256 16c36976ba534e051e84a080e98a5ab7ceee586b2b8438ea8edbd7258d5ef57d.
- 179 endpoints de descarga /agenda_legislativa/leyes/descargarPdf/<id> con titulo.
- Barrido HEAD previo de los 179 (2026-11-13): 179/179 HTTP 200 application/pdf.
- Registries: resources/legal-acquisition-ags-leyes-NN-2026-11-13.json
  (lotes 1-18) mas lote 18b de excepcion documentada.
- Host sin robots.txt (404; permitido por convencion). Verificacion de terminos
  2026-11-13 en home y catalogo: solo marca de copyright de ano, sin pagina de
  terminos de uso localizada, sin senal anti-automatizacion ni anti-IA (contraste
  con Campeche/Chihuahua, en pendiente-permiso). La ausencia de terminos NO se
  presenta como autorizacion expresa del titular ni como dictamen legal; la base
  documentada es LFDA art. 14 frac. VIII (base documentada, no conclusion legal),
  limitada a textos normativos oficiales.

## Resultado

- 177 de 179 documentos extraidos estructuralmente: 17,115 registros.
- 2 exclusiones permanentes (ver incidentes). 0 publicados, 0 indexados.

## Contabilidad de cobertura (adquirido != unico != vigente)

- Documentos adquiridos: 177.
- Textos unicos estatales: 177 (sin duplicado federal detectado por titulo en
  este catalogo; la deduplicacion cruzada entre todos los programas NO esta
  demostrada, por lo que no se reportan unicos globales).
- De los 177: 11 son Leyes de Ingresos por ejercicio fiscal (series anuales);
  166 son textos no anuales del catalogo.

## Incidentes y excepciones

1. ags-ley-2529 (Ley de Ingresos del Municipio de Aguascalientes 2026):
   EXCLUSION PERMANENTE. 26,014,289 bytes (HEAD 200 verificado), sobre el techo
   duro de 20,971,520 de ACQUISITION_LIMITS. No se adquiere, no se eleva el
   techo, fail-closed (mismo criterio que bc-presupuestoestado2026).
2. ags-ley-160 (Codigo de Etica Profesional de los Servidores Publicos del
   Organo Superior de Fiscalizacion): EXCLUSION permanente por extraction-invalid.
   El PDF tiene texto extraible (2,138 palabras verificadas con pdftotext), pero
   el extractor devolvio 0 registros: el parser no segmento este formato.
   Causa registrada; cualquier ajuste del parser sigue la disciplina de
   EXTRACTOR_VERSION con regresion, nunca improvisada en caliente.
3. Lote 18b: excepcion documentada de presupuesto interno para 4 PDF (11,345,187 /
   11,444,863 / 5,454,018 / 439,702 bytes; HEAD 200 verificados), todos bajo el
   techo duro; topes internos elevados solo en ese registry (precedentes
   fed-reglamentos-10b, coahuila-25b). Resto de registries sin cambio.

## Estado

Programa cerrado: 177/179 en cuarentena, 2 exclusiones permanentes documentadas.
Activacion en producto prohibida; cualquier uso posterior requiere revision de
contenido independiente.

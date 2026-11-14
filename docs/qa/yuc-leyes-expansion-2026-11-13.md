# Adquisicion de legislacion estatal de Yucatan (congresoyucatan.gob.mx) - 2026-11-13

Programa de adquisicion publica acotada de legislacion estatal desde los catalogos
oficiales del Congreso del Estado de Yucatan. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Catalogos: https://congresoyucatan.gob.mx/legislacion/leyes
  (sha256 e3fb1494c752feec86b9f2bc7e0caf4733cde91651b00f093ec1f163f043dee7),
  /legislacion/codigos (31cb115f62a8d9460b8e543a27b5968e5f6bdbbc7653563ad5737d9849149f1a),
  /legislacion/reglamentos (1e7a01dc30288347a26777429a230076963a1ed09fa2769e979718c2c0899ee5),
  /legislacion/constitucion-politica (0a71544f45e2d8f1bf93de9ddab45590f447d2c81516f71484b600091f4091b9).
- Tabla DataTable parseada: 1,214 leyes con PDF (377 VIGENTE, 837 ABROGADA) +
  9 codigos + 4 reglamentos + constitucion = 391 textos vigentes.
- Barrido HEAD previo de los 391 (2026-11-13): 391/391 HTTP 200, 0 enlaces rotos,
  415,260,957 bytes totales anunciados.
- Registries: resources/legal-acquisition-yuc-leyes-NN-2026-11-13.json
  (lotes 01-39) mas lote 02b de excepcion documentada.
- robots.txt presente con `User-agent: * Disallow:` (vacio): sin bloqueo de
  agentes IA, sin content-signals. Verificacion de terminos 2026-11-13 en home y
  catalogos: sin pagina de terminos de uso localizada, sin senal
  anti-automatizacion ni anti-IA (contraste con Campeche/Chihuahua/Puebla/
  Quintana Roo, en pendiente-permiso). La ausencia de terminos NO se presenta
  como autorizacion expresa del titular ni como dictamen legal; la base
  documentada es LFDA art. 14 frac. VIII (base documentada, no conclusion
  legal), limitada a textos normativos oficiales que el propio congreso ofrece
  con enlace de descarga directa.

## Resultado

- 374 de 389 documentos adquiribles extraidos estructuralmente: 37,914 registros.
- 15 fallidos (ver incidentes). 0 publicados, 0 indexados.

## Contabilidad de cobertura (adquirido != unico != vigente)

- Universo vigente del catalogo: 391. Excluidos sobre techo duro: 2.
  Adquiribles: 389. Adquiridos (cuarentena): 374.
- Textos unicos estatales: 374. Deduplicacion cruzada por titulo normalizado
  ejecutada contra los 1,040 documentos de los programas previos (federales,
  Coahuila, BC, AGS): 1 solape de titulo exacto (yuc-ley-006 LEY DE
  EXPROPIACION vs law-35 federal) verificado como HOMONIMO, no duplicado: el
  texto adquirido es la ley estatal de Yucatan (Decreto 91, ref. D.O. estatal
  02-agosto-1944, encabezado H. Congreso del Estado de Yucatan), ordenamiento
  distinto de la Ley de Expropiacion federal. Sin duplicados nuevos detectados;
  el unico duplicado cruzado conocido sigue siendo el CPEUM de Coahuila.
- Vigente != historico: las 837 leyes ABROGADA del catalogo NO se adquirieron
  (fuera del universo vigente del programa); contabilidad separada.

## Incidentes y excepciones

1. Exclusiones permanentes sobre techo duro 20,971,520 (HEAD verificado, no se
   adquiere, no se eleva el techo, fail-closed; mismo criterio que
   bc-presupuestoestado2026 y ags-ley-2529):
   - Codigo de Procedimientos Civiles de Yucatan: 30,414,781 bytes.
   - Codigo de Procedimientos Familiares del Estado de Yucatan: 39,228,085 bytes.
2. Exclusiones permanentes por escaneo sin capa de texto (pdftotext = 0 lineas
   verificado contra el PDF adquirido; sin OCR, causa registrada):
   yuc-ley-011 (Ley de Obra Publica y Servicios Conexos), yuc-ley-012 (Ley de
   Participacion Ciudadana), yuc-ley-015 (Ley de Profesiones).
3. 12 extraction-invalid CON texto presente (parser no segmento el formato;
   verificado con pdftotext que el texto existe, lineas entre parentesis):
   yuc-ley-022 (204), yuc-ley-029 (456), yuc-ley-032 (55), yuc-ley-039 (204),
   yuc-ley-040 (219), yuc-ley-043 (199), yuc-ley-045 (188), yuc-ley-047 (248),
   yuc-ley-097 (83), yuc-ley-098 (340), yuc-ley-101 (229), yuc-ley-117 (230).
   Causa caracterizada: leyes antiguas con formato ordinal «Articulo.- 1o.»
   (mismo tipo que ags-ley-160). Los PDF quedan resguardados en snapshots
   cuarentenados; cualquier ajuste sigue la disciplina EXTRACTOR_VERSION con
   fixtures y regresion, nunca improvisado en caliente. Reparacion del
   extractor autorizada por main 2026-11-13 19:57 CST como trabajo de
   desarrollo/pruebas, sin re-sellar salidas ni activar contenido.
4. Lote 02b: excepcion documentada de presupuesto interno para yuc-ley-011
   (11,362,019 bytes; bajo el techo duro; tope interno 10,485,760 -> 12,582,912
   solo en ese registry; precedentes reglamentos-10b, coahuila-25b, ags-18b).
   El reintento descargo el PDF y confirmo la exclusion por escaneo (punto 2).
5. Un HEAD 000 transitorio (yuc-ley-070) resuelto con reintento idempotente;
   el barrido previo lo habia verificado 200.

## Estado

Programa cerrado: 374/389 en cuarentena, 2 exclusiones por techo duro,
3 escaneados, 12 pendientes de extractor. Activacion en producto prohibida;
cualquier uso posterior requiere revision de contenido independiente.

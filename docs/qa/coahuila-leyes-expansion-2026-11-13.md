# Adquisicion de leyes estatales de Coahuila (congresocoahuila.gob.mx) - 2026-11-13

Programa de adquisicion publica acotada de leyes estatales desde el catalogo oficial
del Congreso del Estado de Coahuila de Zaragoza. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Catalogo: https://www.congresocoahuila.gob.mx/portal/leyes-estatales-vigentes/
  sha256 b13020ae4035481193a3c8e1d420953e678b123644737a38d1b5da3fdc5233d7.
- 265 filas de catalogo, todas con enlace PDF (y gemelo WORD no adquirido).
- Barrido HEAD previo de los 265 enlaces (2026-11-13): 15 enlaces rotos (404 en la
  fuente, PDF y DOC), excluidos y documentados: coa60, coa298, coa299 y
  pre_ejercicio_fiscal_2006 a 2013 (salvo los vigentes), segun lista de exclusion
  del programa. 250 documentos adquiribles.
- Registries: resources/legal-acquisition-coahuila-leyes-NN-2026-11-13.json
  (lotes 1-25) mas lote 25b de excepcion documentada.
- Host sin robots.txt (404; permitido por convencion). Verificacion de terminos
  2026-11-13: sin pagina de terminos de uso localizada en home ni catalogo, sin
  senal anti-automatizacion ni anti-IA (contraste con Campeche/Chihuahua, en
  pendiente-permiso). La ausencia de terminos NO se presenta como autorizacion
  expresa del titular ni como dictamen legal; la base documentada es LFDA
  art. 14 frac. VIII (base documentada, no conclusion legal), la misma del
  programa federal, limitada a textos normativos oficiales.

## Resultado

- 250 de 250 documentos adquiribles extraidos estructuralmente: 21,708 registros.
- 0 publicados, 0 indexados; cuarentena completa.

## Contabilidad de cobertura (para no inflar cifras)

- Documentos adquiridos: 250.
- Textos unicos estatales: 249 (se excluye coah-constitucion-federal, CPEUM, ya
  presente en el corpus federal; un duplicado federal en catalogo estatal no
  amplia cobertura unica).
- De los 249: 32 son textos fiscales anuales (Ley de Ingresos, Ley de
  Distribucion de Participaciones y Aportaciones, Presupuesto de Egresos por
  ejercicio fiscal), series historicas por ano; 217 son textos estatales no
  anuales del catalogo vigente.

## Incidentes y excepciones

1. Lote 25b: excepcion documentada de presupuesto interno de bytes para 3 PDF
   fiscales anuales grandes (10,791,532 / 12,174,978 / 7,555,282 bytes; HEAD 200
   application/pdf verificado). maxDocumentBytes es presupuesto interno
   conservador, NO restriccion del titular; tope por documento elevado solo en
   ese registry a 20,971,520 (techo duro de ACQUISITION_LIMITS; precedentes
   ligie-2022 y fed-reglamentos-10b). Resto de registries sin cambio.
2. Exclusiones por enlace roto en la fuente (404 verificado en PDF y DOC):
   15 documentos, fail-closed, sin reintento ni sustitucion por terceros.
3. Normalizaciones operativas: URLs al host www (el apex redirige 301 y el
   verificador de robots no sigue redirects); identificadores saneados a forma
   canonica (guion bajo a guion).

## Estado

Programa cerrado: 250/250 adquiribles en cuarentena, 15 exclusiones por fuente
rota documentadas. Activacion en producto prohibida; cualquier uso posterior
requiere revision de contenido independiente.

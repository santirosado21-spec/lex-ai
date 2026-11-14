# Adquisicion de leyes estatales de Baja California (congresobc.gob.mx) - 2026-11-13

Programa de adquisicion publica acotada de leyes estatales desde el catalogo oficial
del Congreso del Estado de Baja California. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Catalogo: https://www.congresobc.gob.mx/TrabajoLegislativo/Leyes
  sha256 35502054726998e4b38934b3ea1842ffeea95849ff0b1e45b61efa0dc3d1b423.
- 166 filas de catalogo, cada una con version PDF (el gemelo WORD no se adquiere).
- Barrido HEAD previo de los 166 enlaces (2026-11-13): 166/166 HTTP 200.
- Registries: resources/legal-acquisition-bc-leyes-NN-2026-11-13.json (lotes 1-17).
- Host sin robots.txt (404; permitido por convencion). Verificacion de terminos
  2026-11-13: sin pagina de terminos de uso localizada en home ni catalogo, sin
  senal anti-automatizacion ni anti-IA (contraste con Campeche/Chihuahua, en
  pendiente-permiso). La ausencia de terminos NO se presenta como autorizacion
  expresa del titular ni como dictamen legal; la base documentada es LFDA
  art. 14 frac. VIII (base documentada, no conclusion legal), limitada a textos
  normativos oficiales.

## Resultado

- 165 de 166 documentos extraidos estructuralmente: 12,388 registros.
- 1 exclusion permanente (ver incidentes). 0 publicados, 0 indexados.

## Contabilidad de cobertura (adquirido != unico != vigente)

- Documentos adquiridos: 165.
- Textos unicos estatales: 165 (sin duplicado federal detectado por titulo en
  este catalogo; la deduplicacion cruzada entre todos los programas NO esta
  demostrada, por lo que no se reportan unicos globales).
- De los 165: 8 son Leyes de Ingresos 2026 (estado y municipios), series
  fiscales anuales; 157 son textos no anuales del catalogo.

## Incidentes y excepciones

1. bc-presupuestoestado2026 (Presupuesto de Egresos del Estado 2026): EXCLUSION
   PERMANENTE documentada. El PDF oficial pesa 460,532,824 bytes (HEAD 200
   verificado 2026-11-13), muy por encima del techo duro de 20,971,520 bytes de
   ACQUISITION_LIMITS. A diferencia de las excepciones documentadas anteriores
   (archivos de 10-19 MB bajo el techo duro), este excede el techo mismo: no se
   adquiere, no se eleva el techo y no se sustituye por otra via. Fail-closed.

## Estado

Programa cerrado: 165/166 en cuarentena, 1 exclusion permanente documentada.
Activacion en producto prohibida; cualquier uso posterior requiere revision de
contenido independiente.

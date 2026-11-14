# Adquisicion de legislacion estatal de Nayarit (congresonayarit.gob.mx) - 2026-11-13

Programa de adquisicion publica acotada de legislacion estatal desde el catalogo
oficial del Congreso del Estado de Nayarit. Todo el material queda en CUARENTENA
(textReview/legalReview pendientes, published=false, indexed=false): extraccion
estructural verificada, SIN revision independiente de contenido.

## Fuente y universo

- Catalogo: https://congresonayarit.gob.mx/legislacion-estatal/
  sha256 14217c8cb99020f10a26a8462ad88d59b1e432930db25b8a6fbac70c0e5f089e.
- 199 items de acordeon parseados (titulo + enlace PDF): 164 VIGENTE + 35
  ABROGADA. Criterio de estatus: el catalogo se declara la fuente oficial de
  ordenamientos vigentes; abrogados marcados explicitamente en titulo
  («(Abrogado)») o en ruta (/ordenamientos_abrogados/).
- Barrido HEAD previo de los 164 (2026-11-13): 164/164 HTTP 200, 0 rotos,
  0 sobre el techo duro de bytes.
- Registries: resources/legal-acquisition-nay-leyes-NN-2026-11-13.json
  (lotes 01-17) mas lote 15b de excepcion documentada.
- robots.txt estandar WordPress (Disallow: /wp-admin/), sin bloqueo de agentes
  IA ni content-signals. Verificacion de terminos 2026-11-13 en home y
  catalogo: solo marca de copyright de ano, sin pagina de terminos localizada.
  La ausencia de terminos NO se presenta como autorizacion expresa del titular
  ni como dictamen legal; la base documentada es LFDA art. 14 frac. VIII
  (base documentada, no conclusion legal), limitada a textos normativos
  oficiales con enlace de descarga directa.

## Resultado

- 139 de 164 documentos adquiribles extraidos estructuralmente: 16,309 registros.
- 25 fallidos (ver incidentes). 0 publicados, 0 indexados.

## Contabilidad de cobertura (adquirido != unico != vigente)

- Universo vigente del catalogo: 164. Adquiridos (cuarentena): 139.
- Textos unicos estatales: 139 por id; la deduplicacion cruzada contra los
  1,391 ids unicos previos (por id y titulo normalizado, no por contenido) se
  ejecuta al integrarse al inventario global; no se afirma unicidad global.
- Vigente != historico: los 35 ABROGADA no se adquirieron; contabilidad separada.

## Incidentes y excepciones

1. 24 invalid-pdf, todos bajo /leyes_ingresos_presupuesto/2026/: los enlaces
   del catalogo apuntan a una aplicacion JS «Periodico Oficial» que responde
   HTTP 200 application/pdf pero sirve HTML (1.5 MB con assets mal configurados
   a localhost), sin PDF estatico ni endpoint visible en el HTML. EXCLUSION
   documentada, recuperable: la serie fiscal 2026 (Ley de Ingresos estatal,
   leyes de ingresos municipales y presupuestos) requiere navegador para
   localizar el PDF real; queda pendiente como trabajo con browser, no como
   exclusion permanente.
2. nay-ley-148 (presupuesto_egresos_2026.pdf): 20,324,463 bytes (HEAD
   verificado), bajo el techo duro 20,971,520: reintento 15b con presupuesto
   interno elevado y documentado. La descarga completo pero la extraccion
   fallo con extract-failed: PDF de 1,376 paginas con texto presente
   (185,058 lineas verificadas con pdftotext), probable limite de recursos
   del worker sobre un presupuesto fiscal tabular. PDF resguardado en
   snapshot cuarentenado; causa registrada; reintento con limites de worker
   elevados queda pendiente de decision (no improvisado).
3. Titulos: 4 items del acordeon sin titulo parseable («?»); identificados
   por nombre de archivo en la ruta (ley_de_ingresos_estatal_2026,
   ley_ingresos_acaponeta_2026, ley_ingresos_ahuacatlan_2026,
   presupuesto_egresos_2026).

## Estado

Programa cerrado con excepciones documentadas: 139/164 en cuarentena,
24 pendientes de via navegador (serie fiscal 2026), 1 pendiente de decision
de limites de worker. Activacion en producto prohibida; cualquier uso
posterior requiere revision de contenido independiente.

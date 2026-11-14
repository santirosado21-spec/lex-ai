# Brecha de cobertura frente a luthor.mx - actualizacion 2026-11-13 v2 (cierre Yucatan)

Sustituye a luthor-coverage-comparison-2026-11-13.md, que queda como registro
historico. La v1 quedo desactualizada (decia 462 documentos pre-estatales).

## Lo declarado por el referente (paginas publicas, consultadas 2026-11-13)

- https://luthor.mx/scjn/: "113,602 ordenamientos - Federacion, 32 estados y
  tratados - desde 1814".
- https://luthor.mx/gobierno/: "311,000+ tesis PJF" y "48,000+ TFJA".

Cifras declaradas por el sitio; no verificables de forma independiente.

## Lo verificado en Rejon al 2026-11-13 20:34 CST (todo en cuarentena)

Cifras por id unico verificado contra report.json de cada artefacto
(reconciliacion 2026-11-13; corrige la mezcla previa de conteos de indice con
conteos adquiridos):

- Leyes federales adquiridas: 278 ids unicos (incluye los 10 del piloto, que
  fed-expansion-7 duplica y se cuentan una vez; el indice LeyesBiblio tiene
  317 entradas, sha256 a23aa11556c3e0202192213df2dd1a5355d3522406f43b43a35817eb4a587bca:
  indice != adquirido).
- Reglamentos y reglamentos de camaras federales: 139 ids unicos
  (137 reglamentos del programa + reg-senado + reg-diputados).
- Nuevo Leon: 8 documentos, 5,614 registros. Sus artefactos originales
  estaban ausentes del arbol; re-adquiridos 2026-11-13 desde la fuente oficial
  con contraste de hashes conservados (2/2 coinciden; QA
  docs/qa/nl-recuperacion-artefactos-2026-11-13.md).
- Coahuila: 250 documentos, 21,708 registros.
- Baja California: 165 documentos, 12,388 registros.
- Aguascalientes: 177 documentos, 17,115 registros.
- Yucatan: 374 documentos, 37,914 registros (QA
  docs/qa/yuc-leyes-expansion-2026-11-13.md).
- Total presente en el arbol: 1,391 ids unicos, 142,153 registros, todo
  cuarentenado (extraccion estructural verificada, SIN revision independiente
  de contenido, no publicados, no indexados).
- 1,390 = 1,391 ids unicos presentes menos 1 duplicado de contenido conocido
  (CPEUM en el catalogo de Coahuila). Esta cifra NO es prueba de unicidad
  global: la deduplicacion demostrada es por id y por titulo normalizado, no
  por contenido; pueden existir duplicados con titulos distintos no
  detectados.

## Brecha restante

1. Cobertura estatal: 4 de 32 entidades cerradas (Coahuila, BC, AGS, Yucatan).
   Revision por estado en artifacts/public-corpus/state-review-20261113:
   candidatos viables restantes del bloque 2: Durango, Hidalgo, Morelos,
   Nayarit, Tabasco, Colima, Edomex, Oaxaca, Michoacan, Queretaro, SLP,
   Sonora, Zacatecas, Sinaloa. Pendiente-permiso: Campeche, Chihuahua,
   Puebla, Quintana Roo, Tamaulipas (robots con intencion de gestion IA).
   Bloqueados tecnicamente (sin reintento): Chiapas, CDMX, BCS, Guerrero.
   Por reintentar conexion: Guanajuato, Tlaxcala.
2. Tratados internacionales y acervo historico (el referente declara desde
   1814). Nota: Yucatan ya aporta textos vigentes desde 1917; las 837 leyes
   abrogadas de su catalogo no se adquirieron (vigente != historico).
3. Tesis y jurisprudencia: 311k+ tesis PJF y 48k+ TFJA declaradas por el
   referente. La fuente primaria de tesis SCJN queda fuera hasta decision del
   proyecto por sus terminos anti-comercializacion.
4. Bloqueos permanentes documentados (sin reintento): Jalisco HTTP 406,
   SJF HTTP 403, Semanario Judicial (terminos), Guerrero 403.
   Exclusiones de documento: reg-lfgfaga-fe-16may55 (escaneo),
   bc-presupuestoestado2026 (439 MB sobre techo), ags-ley-2529 (26 MB sobre
   techo), ags-ley-160 (parser), yuc 2 codigos sobre techo + 3 escaneados +
   12 extraction-invalid pendientes de EXTRACTOR_VERSION.
5. Rendimiento de extraccion: 12 documentos de Yucatan con texto presente no
   segmentaron (formato ordinal antiguo «Articulo.- 1o.»); reparacion de
   extractor autorizada por main 2026-11-13 19:57 CST con fixtures, regresiones
   y versionado EXTRACTOR_VERSION, sin re-sellar salidas ni activar contenido.

## Nota de alcance

Toda cifra de Rejon deriva de artefactos de adquisicion del programa citado;
ninguna implica validacion de contenido. OJN sigue sin adquirirse.

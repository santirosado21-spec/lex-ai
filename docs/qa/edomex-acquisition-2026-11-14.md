# Adquisicion Estado de Mexico (legislacion.congresoedomex.gob.mx) — cierre 2026-11-14

## Alcance y fuente
- Portal oficial de legislacion del Congreso del Estado de Mexico: `https://legislacion.congresoedomex.gob.mx/legislacion`. Host localizado via busqueda web publica: el sitio institucional (congresoedomex.gob.mx, Next.js) no enlaza el acervo; subdominios adivinados no existen en DNS (una verificacion DNS cada uno, sin sondeo).
- Catalogo: 261 documentos (constitucion 1, codigos 8, leyes 245, reglamentos 7), secciones del propio catalogo. Formatos: 220 .doc OLE, 35 .docx, 6 .pdf. Sin duplicados por titulo normalizado.
- Verificacion previa: robots.txt 200 allow-all (User-agent * sin Disallow; sin reglas IA, sin content-signals). Pagina de aviso de privacidad presente; sin terminos de uso ni prohibicion de reuso localizados (la ausencia NO es autorizacion expresa). Base documentada: LFDA art. 14 frac. VIII (base documentada, no conclusion legal). HEAD sweep: 261x200, max 6,908,656 bytes, 0 sobre 10MB.

## Resultado (27 lotes, 10 docs/lote, concurrencia 1, rate 2s)
- 259/260 documentos aprobados descargados, extraidos y cuarentenados. 13,764 registros.
- mex-ley-209 BLOQUEADO en registry: duplicado propio del catalogo (misma URL que mex-ley-208, DESAPARICION FORZADA.docx). Conservado como blocked, no adquirido; la dedup por id no resta del inventario.
- 1 fallido: mex-ley-222 (Presupuesto de Egresos 2026, .docx de 6.9MB). Clase NUEVA document-xml-budget: su word/document.xml descomprimido pesa 314,394,997 bytes (314MB) y excede la capacidad del lector docx por cadenas (v27). No es malicioso (libro de presupuesto gigante), pero la extraccion actual no lo cubre. Documentado; posible ruta futura: lector streaming (cambio de extractor con bump de version, fixtures y verificacion real).
- Verificacion adversa real de la ruta OLE .doc sobre esta fuente: mex-const-001 (Constitucion del Estado de Mexico, .doc) extrajo 159 articulos con estructura correcta ("Articulo 1.- El Estado de Mexico es parte integrante...").
- Incidentes de ejecucion: lotes cortados por timeout de shell reanudados idempotentemente; lote 21 rechazado en validacion de plan por URL aprobada duplicada (el de mex-ley-209), corregido en registry en la misma ejecucion.

## Corte canonico global tras Edomex
- ids registrados: 2,845 (2,584 + 261)
- documentos presentes (snapshots, ya no solo PDF): 2,839 (2,580 + 259)
- extracciones validas: 2,828 (2,569 + 259)
- registros: 260,627 (246,863 + 13,764)
- fallidos por clase: 11 extraction-invalid (6 cola OCR + 5 estructura), 2 document-byte-budget (ags-ley-2529, bc-presupuestoestado2026), 2 catalog-link-broken (col-ley-104, col-reg-023), 1 document-xml-budget (mex-ley-222).
- Nota de nomenclatura: la metrica historica "PDFs presentes" pasa a "documentos presentes" porque las fuentes Word oficiales (v27) ya son parte del corpus cuarentenado.

# Aportaciones de Instinct a Rejon.AI

**19 de noviembre de 2026.** El historial de la revisión f5a7fc1 contiene 178 commits bajo dos firmas, 172 como Instinct Agent y 6 como instinct-rejon-agent. El inventario al final conserva cada asunto original del commit. Los resultados que reproduje el 19 de noviembre están identificados por separado.

| Área | Trabajo que dejó Instinct | Cómo afecta a Rejon |
|---|---|---|
| Legislación mexicana | Registros por fuente, capturas con huella, extracción de PDF y Word, OCR, identificación de artículos, prefacios y transitorios. Revisó accesos a fuentes federales y estatales e investigó la cobertura de Luthor. | El corte histórico del 14/11 reconcilió 2,874 documentos presentes y 270,354 registros de extracción. Estaban en cuarentena. La biblioteca entregada al abogado tiene su propio manifiesto. |
| Comercio exterior | Perfil del abogado, documentos ficticios con defectos, campos de pedimento, separación de celdas de PDF y candidatos para la Ley Aduanera y su Reglamento. | El control de promoción identifica vigencia, transitorios y procedencia pendientes. La clasificación arancelaria y la preferencia requieren verificación por operación. |
| Privacidad | Detectores, casos positivos y negativos de desarrollo, restauración, custodia del mapa y ensayos de almacenamiento cifrado con claves separadas. | El piloto conserva los originales en su SQLite local en claro. Incorporar la custodia ensayada y validarla sobre equipos de destino sigue pendiente. |
| Investigación y redacción | Resolución de varias referencias de artículo, recuperación por ley y jurisdicción, límites de generación y detección de respuesta truncada. | Se pueden reutilizar para ampliar el contexto jurídico del flujo protegido. La tarea de comercio usa hoy dos artículos y vínculos de consulta definidos. |
| Interfaz y entrega | Identidad Rejon, logotipo animado, movimiento reducido, contraste, ajuste del visor documental, pruebas de navegador, integración continua y revisión de procedencia del runtime de escritorio. | Existen piezas de escritorio y web. El paquete actual arranca como web local en el navegador de cada participante. |

## Qué volví a medir

El comando `node scripts/measure-address-dev.mjs` cubrió el domicilio completo en **4 de 24** ejemplos sintéticos. Además, el detector marcó **10 de 25** controles negativos. El comando `node scripts/measure-a22-labels.mjs` marcó el propio rótulo en **20 de 50** casos de etiquetas aduaneras. Las muestras son de desarrollo y de un solo autor. Revelan tanto riesgo de revelar información como pérdida de términos útiles para el abogado.

El seguimiento de exports-v2 localizó particiones y huellas del corpus del 30 de octubre. Su manifiesto carece de versión del extractor y de identificador de ejecución. El commit 424d1e2 corrigió una atribución anterior. Para el piloto utilicé el índice verificable y conservé aparte las nuevas capturas.

**Conclusión.** El trabajo de Instinct aporta un recolector trazable, mejores extractores, una biblioteca consultable y pruebas concretas de lo que falla. La siguiente inversión de privacidad debe medir detección completa, restauración y conservación de los hechos con expedientes ficticios inéditos. Para calidad jurídica, hace falta que un abogado compruebe vigencia, competencia y fidelidad de cada cita en casos de comercio.

## Inventario del historial

Fecha, hash abreviado y descripción registrada en Git. Un commit acredita un cambio en el repositorio. Las afirmaciones históricas de sus títulos conservan el alcance de su propia revisión.

- 2026-11-18 · `f5a7fc1` · dev: Anexo 22 field-label fixture (18 QA-verified names, invented values, controls) + measurement script
- 2026-11-18 · `a2ade90` · eval: versioned synthetic trade address / false-positive dev set v1 + measurement scripts (measurement only, not acceptance)
- 2026-11-18 · `07ee915` · extraction: separate same-line PDF text items so table cells are not glued (PZA11,900,000.00); fictitious trade PDFs
- 2026-11-18 · `614e3c1` · scripts: candidate promotion barrier checker (never approves; lists transitory, residual-note, versioning, provenance barriers)
- 2026-11-18 · `c73ac96` · importer: feminine ordinal section headings (Seccion Septima/Novena...) no longer glued to the previous article; Reglamento Ley Aduanera arts 33, 34, 37, 38-C affected
- 2026-11-18 · `1e61b35` · corpus candidates: durable open adoption preconditions (DOF full-text comparison, transitory pages decision, validity window); partial author-run DOF cross-check of the Reglamento recorded as not independent
- 2026-11-18 · `a478c7f` · corpus candidates: machine-readable entry-into-force date for the pending Ley Aduanera reform; Reglamento currentness checked against Camara index
- 2026-11-18 · `d5cfb6a` · corpus candidates: Ley Aduanera discrepancy resolved, DOF 23-10-2026 reform pending (in force 2027-01-01), transitorios separation measured
- 2026-11-18 · `a25faa3` · corpus candidate: Reglamento de la Ley Aduanera official PDF provenance record, not adopted
- 2026-11-18 · `ebf56b5` · importer: letter-spaced Transitorios boundary, amounts-update and derogation date-list notes treated as editorial, dedicated anomaly when the transitory block is not structured
- 2026-11-18 · `08ca7bb` · fixture: fictional international-trade import memo with seeded defects; law not in library so citations stay unverifiable
- 2026-11-18 · `b264821` · extractor: OCR heading repair tolerates ordinal mark read as 'o0' (tesseract 4.1.1 eng); fixes extractor-ocr-fallback in this environment
- 2026-11-18 · `306ddd1` · corpus candidate: Ley Aduanera official PDF provenance record, not adopted
- 2026-11-18 · `7cf6f23` · docs: international trade profile, intern-to-associate tasks and Rejon coverage gaps
- 2026-11-18 · `ae24c6b` · corpus candidate: LOPJNL eligibility condition and currentness limits recorded
- 2026-11-18 · `722af9c` · corpus candidate: LGOAAC DOF 14-11-2025 cross-check recorded, claims scoped
- 2026-11-18 · `fe6efd0` · docs: gap map blockers updated (candidates allowed, sqlite size limit)
- 2026-11-18 · `0195867` · corpus candidate: Nuevo Leon judicial organic law provenance record, not adopted
- 2026-11-18 · `870a1bd` · corpus candidate: LGOAAC official PDF provenance record, not adopted
- 2026-11-18 · `8270f0e` · landing: hero precisa la prueba Mac real reportada por el usuario (build web, UI y E2E con inferencia local pasaron sobre ded0ecb); lo pendiente es la app nativa
- 2026-11-18 · `d1b3ec2` · docs: library gap map linked to the mercantile demo
- 2026-11-18 · `d44e855` · landing: qualify local-on-Mac and dictation statements as design intent not verified on a physical Mac
- 2026-11-17 · `676a4c1` · landing: limit offline and source-check claims to what the code verifies
- 2026-11-17 · `667874c` · app: save extracted document text locally from the viewer, with scope note and UI smoke
- 2026-11-17 · `6dd1ae5` · retrieval: resolve plural and list article references against the named law without substitution
- 2026-11-17 · `b78b605` · F3: harden map vault directory/file checks (owner, perms, symlinks, hardlinks) with adversarial tests
- 2026-11-17 · `4662828` · desktop: read-only source inventory generator and runtime provenance criteria (no binaries approved)
- 2026-11-17 · `67908c2` · F3: sealed on-disk re-identification map store (atomic, fail closed, key from caller; temp dirs only in tests)
- 2026-11-17 · `8dc2aca` · F3: separate Keychain item for the re-identification map key (fakes only, never overwrites, explicit permanent loss)
- 2026-11-17 · `0733599` · cloud: additive local-model composition (spans/block only, fail closed) with injected backend; fake-backend tests, no weights, not eligible
- 2026-11-17 · `5778f5a` · F3: offline re-identification map custody checks and design (separate key from API key; not Mac-verified)
- 2026-11-17 · `7959d36` · Detector variants/abstention tests, token reserve fix (F1b), eligibility ported to privacy-v2 operational protocol (F2)
- 2026-11-17 · `88065b3` · extractor: detect running page furniture as reviewable candidates (never removed by detection); removal only for exact reviewer-approved lines, with a complete reversible log
- 2026-11-17 · `47303bc` · extractor: accept the publisher typo 'ARTÍCULO.9o.-' (period glued to the word) only as the next sequential article
- 2026-11-17 · `d785f4f` · extractor: ordinal-mark article 2 (2o.-) counts when anchoring a dictamen preface restart at article 1
- 2026-11-17 · `2792df2` · extractor: drop quoted-article candidates from a CONSIDERANDO dictamen when the real law restarts at article 1 followed by article 2
- 2026-11-17 · `afa5db5` · extractor: accept period-style 'Artículo 1.' headings when dropping a dictamen preface that restarts before article 1; acquisition script reports a bounded real error detail
- 2026-11-17 · `4a5b775` · icons: small optical variant (no dot) for 16/32/30 px and ICO small sizes; large icon and wordmark unchanged
- 2026-11-17 · `02d9899` · docs: F1 limitation for openai-local - paragraph-citations-v1 and truncation rejection do not apply; no outputContract declared until a real server
- 2026-11-17 · `1bc8f58` · inference: optional loopback OpenAI-compatible provider (for a user-run Colibri), opt-in via LEX_INFERENCE_BACKEND=openai-local; no download, no spawn; contract tests with mocked server
- 2026-11-17 · `8fc5856` · bounded-generation: one shared deadline and character budget across attempt and retry; cancellation and explicit errors preserved
- 2026-11-17 · `4f71ab1` · tests: service -> bounded generation -> visible error path with engine double (retry carries brief instruction; persistent cut ends in INCOMPLETE_RESPONSE)
- 2026-11-17 · `8a857a7` · grounded output: reject paragraphs cut at the 350-char cap (no trimming); one bounded retry, then explicit incomplete-response error; retry loop isolated in bounded-generation.mjs with engine-double tests
- 2026-11-17 · `52ea05b` · ui: readable warning counters in dark and light (use --warn tokens)
- 2026-11-17 · `5ee6ad3` · brand: dark theme fixes - rail vars, neutral grays and borders follow theme tokens
- 2026-11-17 · `68c45de` · brand: cafe/crema palette across app tokens (light + derived warm dark), accents and focus; Tauri icons from Figma cafe icon
- 2026-11-17 · `62707c9` · brand: Rejon wordmark cover and cafe/crema welcome palette (Figma v3 assets)
- 2026-11-17 · `226b177` · ui: welcome layout - drop empty sidebar gutter before a workspace exists; cover is one viewport tall and sticky instead of stretching the page
- 2026-11-17 · `0ca8ef5` · brand: Figma Rejon mark v2 (light/dark SVG, 1024 grid) in app UI; regenerate Tauri icons from Figma app icon
- 2026-11-17 · `4dd2eef` · ui: hero fits first fold, 0.9s reveal, subtle pulse, dark onboarding panel, stronger smoke
- 2026-11-17 · `4b8fad3` · ui: animated Rejon monogram cover replaces paper photo (reduced-motion, both themes)
- 2026-11-17 · `caf844e` · docs: Colibri compatibility analysis (design only, not integrated)
- 2026-11-17 · `9cb5b9a` · docs: close OA0 backlog row with existing evidence and backup limits
- 2026-11-17 · `5bbfc4f` · UI Documentos: a 1024 px la columna Acciones desbordaba 72 px (regla <=1100px de 3 columnas); columnas fijas, 0 desbordamiento a 1024/760/390 (ui-smoke PASS)
- 2026-11-17 · `3a28a80` · UI Documentos: la columna de acciones desborda 17px a 1440px y recorta el icono Consultar; columnas fijas alineadas con el encabezado (verificado con ui-smoke y captura real)
- 2026-11-17 · `8d7b73f` · extractor v37 (Guerrero): reinicio antes de art.1 con preambulo de dictamen, cita TRANSITORIO partida, variantes de encabezado; corte Guerrero v37 en cuarentena con manifiesto por hash, cotejo de huecos y regresion Zac 144/144
- 2026-11-17 · `e6ae249` · Guerrero lotes 10-14 ejecutados en cuarentena (49 docs); registry 10: URL gro-ley-094 con codificacion percent canonica; inventario
- 2026-11-17 · `1521626` · visor dev aislado (127.0.0.1) del indice Zac v36c + smoke Playwright con capturas; banner experimental, filtro articulos por defecto
- 2026-11-17 · `84864e0` · indice de desarrollo aislado y reversible del candidato Zac v36c (por hash, separa articulo/transitorio/prefacio; sin tocar corpus de produccion) + pruebas
- 2026-11-17 · `cd828d2` · Zacatecas: candidato v36c (manifiesto por hash, mapa del revisor, descripcion de salida de cuarentena); sin liberar
- 2026-11-17 · `528458a` · Zacatecas v36c: fecha de reforma sin acento/mes en texto, transitorios con encabezado partido y ordinales acentuados (delta; v36b intacto), tests
- 2026-11-17 · `bdbef81` · Zacatecas v36b: prefacio preservado como registros, fecha de publicacion del indice trazable, reproceso en dirs nuevos, inventario y QA
- 2026-11-17 · `b3d89e6` · Zacatecas v36: reproceso offline en dos capas, transitorios como registros, inventario por id, fechas del indice oficial, QA doc
- 2026-11-17 · `f3bec6f` · extractor v36: transitorios como registros separados (coverage.transitoryRecords, result.transitories) con procedencia de pagina y grupo; 143/144 docs; test de regresion
- 2026-11-17 · `c0caae6` · v36: rubrica marginal antes de encabezado 'Articulo N.' no es fragmento a mitad de oracion; 195 84->86 (83-84), 081 78->80
- 2026-11-17 · `c152bb8` · script QA v36: huecos de secuencia por capa (control interno, no validacion)
- 2026-11-17 · `e842d58` · v36: candidatos de prefacio citados (documento abierto en art. distinto de 1) se descartan al aparecer Art.1 seguido de Art.2; 232 26->85, 337 26->36
- 2026-11-17 · `a84b4a1` · scripts QA v36 (comparacion de capas)
- 2026-11-17 · `486a0a8` · extractor v36: capa de texto alterna Poppler por registry (source.textLayer='poppler') con procedencia en coverage.parser; fecha declarada acepta 'Ultima Reforma POG'; 028/030/096/196 0->93/58/17/103, 213 0->132
- 2026-11-17 · `691e726` · v35: encabezado bare + repeticion inline del mismo articulo = un articulo; 109 20->92 registros (1-80 + bis)
- 2026-11-17 · `c4e5678` · v35: reinicio en art.1 bare descarta candidatos de prefacio (anomalia preface-operative-candidates-dropped); 160 3->209/209, 186 60->86/86
- 2026-11-17 · `038c4ac` · v35: encabezado bare con salto adelante <=3 (anomalia bare-heading-forward-gap); 159 23->84, 120 124->154, 143 75->84; regresion 143 docs sin perdidas
- 2026-11-17 · `50ed268` · script de regresion v35 vs extracciones v33 de Zacatecas: 143 docs, 136 iguales, 7 mejoran, 0 pierden registros
- 2026-11-17 · `471608c` · extractor v35 (WIP): salta bloque TRANSITORIOS de decreto previo al articulado; 160: 3->170/209 (sigue incompleto)
- 2026-11-17 · `26825a8` · extractor v34 (parcial): bare con sufijo ordinal (1º/1°/1/º), bare con marcador de lista inline, no-espacio numerico secuencial; recupera 014/060/063/173/219 en verificacion offline; paquete de defectos del revisor preservado como diagnostico; 8 documentos con truncado/resolutivos siguen abiertos
- 2026-11-17 · `b9e0b8c` · Guerrero parcial (9/14 lotes, 89/90 cuarentenados, gro-ley-073 byte-budget): registries, ALLOWED_HOSTS, QA en curso; pausado por prioridad reparacion Zacatecas
- 2026-11-17 · `2204950` · revision fuentes 17nov: Guerrero sin-senal-restrictiva (robots=preambulo CF sin senales declaradas; indice 200 directo, ~276 refs PDF), Quintana Roo bloqueado (Content-Signal ai-train=no), Michoacan HTTP 000 (reintento solo con senal nueva)
- 2026-11-17 · `d04e29c` · zac: encuadre de derechos como evaluación sustentada (approved = requisito mecánico del validador) + diagnóstico fino de los 4 fallos (3 estructurales correctos, 1 stream flate corrupto recuperable vía parser alterna)
- 2026-11-17 · `edd702b` · Adquisición Zacatecas: 144/144 descargados, 140 cuarentenados (12,086 registros), 4 fallidos documentados; revisión Puebla (bloqueado por señal expresa), Hidalgo (inalcanzable), Sonora (pendiente términos)
- 2026-11-17 · `12c2f24` · portabilidad: tolerancia de score float (Python 3.12+ sum) con controles estrictos, antiword en CI ejecuta prueba Word real, cobertura extractor en CI; comentario v33 corregido
- 2026-11-17 · `3ed454b` · extractor v33: referencia con terminador y salto adelante + continuación en minúscula queda como texto (R1-b); R1-e residual y R2 caracterizados con evidencia congelada; QA doc
- 2026-11-17 · `3084ee8` · ci: Node 22.23.5 en main-integration (22.13.1 no trae FTS5 en node:sqlite)
- 2026-11-17 · `0c9363d` · ci: prueba de flujo completo por HTTP (api-workflow-smoke) en main-integration
- 2026-11-14 · `ccce17e` · pruebas plataforma: smoke de flujo completo por HTTP con inferencia simulada
- 2026-11-14 · `724fc78` · extractor v32: force-OCR por documento (registry forceOcr opt-in)
- 2026-11-14 · `6bf8fc2` · extractor v31: soporte de documentos no articulados (principios/capitulos/resolutivos), esquema fiel
- 2026-11-14 · `04e8266` · Extractor v30: reparacion de terminador coma OCR en encabezados; oax-ley-219 completo 1-92
- 2026-11-14 · `2a6338c` · Cola OCR cerrada: 4 leyes escaneadas recuperadas en cuarentena (+280 registros), 2 confirmadas no articuladas
- 2026-11-14 · `e0dfaf7` · Registries derivados OCR-reprocess (5 lotes, 6 documentos escaneados): reintento offline acotado con cache reanudable; timeoutMs se mantiene bajo el techo de politica (45s), cada intento deja paginas OCR en cache y el siguiente reanuda
- 2026-11-14 · `e28a051` · Extractor v29: OCR local fail-closed para PDFs escaneados sin capa de texto
- 2026-11-14 · `0ec033f` · Pruebas funcionales UI sin inferencia: 20/20 harnesses verdes; fix asercion obsoleta ui-theme (riel oscuro 3884148)
- 2026-11-14 · `9464ba2` · Reconciliacion del corte canonico: 2,878/2,874/2,863/270,354 derivado id-por-id
- 2026-11-14 · `14e6a49` · Precision de definicion 'documentos presentes' + reconciliacion abierta del corte (22/24)
- 2026-11-14 · `629c30c` · Extractor v28: lectura streaming de document.xml; clase document-xml-budget cerrada (mex-ley-222: 84 registros)
- 2026-11-14 · `b06b888` · Reevaluacion unica hosts 000: sin cambio (NXDOMAIN/TCP-fail), pendientes sin repeticion
- 2026-11-14 · `b611342` · Adquisicion Edomex: 259/260 cuarentenados (13,764 registros), 9/32 -> 11/32 con correccion de conteo
- 2026-11-14 · `091df09` · Matiz de main a regla de agregacion: fallo real misma fuente+version = regresion visible; evidencia de todas las corridas
- 2026-11-14 · `77d4e6d` · Correccion mismo dia: nay-ley-148 SI fue recuperado 2026-11-13 (nay-leyes-15b, intacto); bytes crudos del servidor preservados con procedencia separada
- 2026-11-14 · `9c70b44` · Serie fiscal Nayarit reparada: 24/24 cuarentenados (1,337 registros), defecto de servidor documentado
- 2026-11-14 · `bce1f0d` · Precision: 'cerrada' = barrido del alcance documentado, no cobertura integral ni validada; Gto/Tlaxcala pendientes sin mas sondeos
- 2026-11-14 · `46eb205` · Adquisicion Colima: 167/167 docs cuarentenados (16,777 registros), 2 catalog-link-broken
- 2026-11-14 · `c1f4c2f` · Extractor v27: official Word formats (.docx OOXML, .doc OLE) by magic bytes, isolated read-only extraction
- 2026-11-14 · `453a7d0` · Morelos acquisition: 261/261 ids, 257/261 quarantined, 14711 records; download inactivity watchdog in legal-sync
- 2026-11-13 · `1b7b140` · Durango state legislation acquisition: 165/165 quarantined, 19218 records (93 catalog dups + 1 abrogada excluded)
- 2026-11-13 · `c22a468` · Extractor v26: worker page cap 1200->2000 (verified on nay-ley-148, 1376 pages), closes nay-ley-148 with 99 records
- 2026-11-13 · `d0cd701` · Corrections: Yucatan 386/389 after extractor v25 re-runs (38105 records), OCR queue (no permanent exclusions), id-accounting without content dedup
- 2026-11-13 · `8d9a151` · Oaxaca state legislation acquisition: 222/224 quarantined, 18290 records (1x404, 2 scanned no-text permanent exclusions)
- 2026-11-13 · `9fa49cc` · Extractor v25: repair 5 heading-format variants (12 Yucatan docs), fixtures + regression, quarantine intact
- 2026-11-13 · `f689da5` · Tabasco state legislation acquisition: 191/191 quarantined, 17778 records
- 2026-11-13 · `270ad71` · Nayarit state legislation acquisition: 139/164 quarantined, 16309 records
- 2026-11-13 · `c78737b` · Recover NL artifacts: 8/8 re-acquired, freeze hashes verified (2/2), quarantine
- 2026-11-13 · `753e8c3` · Reconcile acquisition counts: unique-ID base, pilot double-count, NL artifacts absent
- 2026-11-13 · `c218ddb` · Luthor coverage comparison v2 after Yucatan close
- 2026-11-13 · `6c30400` · Yucatan state legislation acquisition: 374/389 quarantined, 37914 records
- 2026-11-13 · `55dcc68` · test(nl): compuerta negativa explícita (v24 sin re-sello rechazado) + equivalencia v22-pineado==v24 demostrada en los 3 inputs de fixture
- 2026-11-13 · `cda001b` · fix(tests): fixtures nuevo-leon-extraction emulan parser pineado v22 (causa raíz de 6 fallos: bump v24, no ambiente) — suite verde 1159/0 por primera vez desde 5795147
- 2026-11-13 · `941b44e` · docs: limpiar referencias internas en puente Codex y QA docs; añadir diagnóstico read-only de archivos del detector de privacidad
- 2026-11-13 · `b301901` · docs: puente Codex Mac — pruebas locales nuevo-leon-extraction (alcance 2026-11-13)
- 2026-11-12 · `3c89129` · fix(F1): fallback acotado por ley para ids legacy acentuados en lookupArticle
- 2026-11-12 · `a6d79d9` · F1: gramatica article-id compartida con canonico sin diacriticos (QUATER resoluble en public/state/retrieval, compat COALESCE verificada con indice legacy) + F2: propuesta de division por unidades con pruebas sinteticas (no adoptada)
- 2026-11-12 · `acc0a61` · docs(qa): separacion arquitectonica 13:46 (local=privacidad, nube=cerebro juridico) + auditoria readiness ingestion cloud-knowledge (47,719/47,799 conformes; F1 regex QUÁTER, F2 6 arts >60k)
- 2026-11-12 · `921d070` · docs(research): C1b exploracion read-only - 4 plazas Jalisco con candidato OJN (fichas vigentes, HEAD 200); sin adquisicion ni contacto a hosts bloqueados
- 2026-11-12 · `7ff63d4` · ligie-2022: excepción documentada maxDocumentBytes=20971520 (techo ACQUISITION_LIMITS); canal federal cerrado 317/317 en cuarentena
- 2026-11-12 · `1e15569` · Adquisición federal lotes 16-33 (179 docs, 16,528 registros, extractor v24, cuarentena) + QA; canal 316/317, único pendiente ligie-2022 por presupuesto de bytes
- 2026-11-12 · `5795147` · Extractor v24: ordinales en letra fail-closed con compuerta de modo en dos pasadas; regresión 152/152 byte-idéntica; recupera law-176/law-204/law-79 offline (137/317)
- 2026-11-12 · `e0d4803` · Adquisición federal lotes 7-15 (86 docs, 7,908 registros, extractor v22, cuarentena) + QA; 134/317. 3 fallidos por ordinales en letra (law-176, law-204, law-79), snapshots preservados.
- 2026-11-12 · `fe23235` · corpus: lote federal 6 (regimen general) en cuarentena - 10 instrumentos, 1490 registros, extractor v22; indice sin deriva, HEAD verificado
- 2026-11-12 · `424d1e2` · docs(qa): corrige framing exports-v2 - procedencia desconocida; comparacion v6/v22 es evidencia experimental aislada de riesgo, no medida del contenido del export
- 2026-11-12 · `7c5d764` · docs(qa): impacto de exports-v2 medido localmente (v6 vs v22 en 38 instrumentos federales) - procedencia v6 resuelta por historia git; sin regenerar exports
- 2026-11-12 · `674cd95` · qa: harness de verificación v17->v22 versionado (diff por documento, clasificación por causa, detalle de recortes, reconciliación pdfjs) - rutas parametrizadas, sin datos
- 2026-11-11 · `d2ceccf` · QA v22: corrige conteo de anomalías (36/46 unión; 17 era la intersección) derivado de artefactos
- 2026-11-11 · `9fe227a` · extractor v17: encabezados oficiales sin punto (linea exacta, apertura solo en 1, secuencia estricta) y ordinal OCR N/o. - recupera lgsmime/loefam/reg-senado en cuarentena; 43/46 extracciones byte-identicas
- 2026-11-11 · `68d3e61` · corpus: diagnostico acotado body-start (lgsmime/loefam/reg-senado) en cuarentena, extractor v16 intacto
- 2026-11-11 · `fb23f0e` · corpus: lote federal 5 (transparencia y sector publico) en cuarentena - LGTAIP/LGRA/LAASSP/LOPSRM/LGCG con extractor v16
- 2026-11-11 · `7496fbe` · corpus: lote federal 4 (regulacion financiera) en cuarentena - LMV/LISF/LPAB/LFI/LUC con extractor v16
- 2026-11-11 · `5bb045a` · docs(privacy): DEV4 README/provenance citan el contrato v2 congelado real y la unicidad fail-closed
- 2026-11-11 · `935c837` · feat(privacy): soporte de validacion v2 segun parche del auditor independiente - SIN push, pendiente segunda revision
- 2026-11-11 · `25408cc` · chore(privacy): identidad de candidato local-rules-baseline-v5 - reglas intactas, input ampliado declarado
- 2026-11-11 · `b6cba91` · test(privacy): soporte v2 no activado para estados operativos de segmento + corpus dev DEV4
- 2026-11-11 · `caed6ef` · docs(privacy): corrige propuesta de estados de extraccion - prohibido derivar flags de gold
- 2026-11-11 · `da25d4a` · privacy: diagnostico de preservacion H3 (fechas/montos/citas) - 6 pruebas
- 2026-11-11 · `6e01c9d` · corpus: extractor v16 - encabezados/fecha de reforma en plural + lote federal 3
- 2026-11-11 · `8c3d41f` · privacy: prep persistencia cifrada restaurable para H3 + propuesta fixture
- 2026-11-11 · `2d3545c` · privacy: detector v4 - escaneo desacoplado de la resolucion de procedencia
- 2026-11-11 · `dcba915` · corpus: extractor v15 - ordinal suffix family SEXIES/SEXTUS/SEPTIES/SEPTIMUS/OCTIES/NONIES/NONUS/DECIES/UNDECIES/DUODECIES/DUODECIMUS (operative headings verified in official PDFs: cpf +5, lfda +4, lic +1; 25/28 snapshots byte-identical v14->v15); QA doc for fed batch 2 incl. correction record for batch-1 QA doc (v13 did change cpf/lfpc with correct QUINTUS splits)
- 2026-11-11 · `eee3f62` · corpus: federal expansion batch 2 (5 docs, separate quarantine registry) + extractor v14 (hyphen-terminator no longer fires inside hyphenated cross-references like 'Artículo 144-A de esta Ley' at line start; ladua completes 277 records to transitory boundary); byte-identical v13->v14 regression on 27 of 28 snapshots
- 2026-11-11 · `a4f55c4` · privacy: rules candidate v3 - context covers small-group membership with explicit size, dev exact recall 0.900 to 0.933 (contract ceiling), zero new FP, heldout untouched
- 2026-11-11 · `3884148` · ui: unify chat panel into dark rail on light appearance (verified Harvey product pattern: single dark rail holds new-chat + history); Rejon palette, dark theme untouched, select beats :is() specificity
- 2026-11-11 · `933cb17` · ui: rail contrast fix - icons inherit rail palette, brighter gray scale, footer surfaces transparent, focus ring visible on navy; active icon keeps seal accent
- 2026-11-11 · `07ac0fa` · ui: dark navigation rail on light canvas (verified Harvey product pattern), Rejon dark-theme palette, light appearance only, active item keeps seal accent
- 2026-11-11 · `3cf6b34` · research: Harvey visual verification from official public captures (tokens + product UI structure)
- 2026-11-11 · `5e2b559` · registry: cite owner instruction as operational scope in expansion batch basis, not as rights authorization
- 2026-11-11 · `72b1419` · corpus: bounded federal expansion batch (5 docs, separate quarantine registry) + extractor v13 (letter-BIS lookahead, QUINTUS suffix) with byte-identical pilot regression
- 2026-11-11 · `04975f9` · docs: Harvey UI patterns research; trim unverified timeline estimate from Luthor comparison
- 2026-11-11 · `a85a3b5` · proposal: third legal-task skill cronologia-y-pruebas-mx (full draft + exact wiring recipe, frozen S2b2 perimeter untouched)
- 2026-11-11 · `20fee37` · research: Luthor public coverage claims vs verified corpus state, acquirable-path mapping
- 2026-11-11 · `71329ee` · privacy: rules candidate v2 — scaffold-colon and guillemet boundary fixes, dev split measured (exact P 1.000 / R 0.900)
- 2026-11-11 · `07db98a` · research: NL-03 second-series namespace proposal + DOF decree-flow design + OJN Jalisco contrast
- 2026-11-11 · `4734bb4` · research: OJN discovery chain mapped end-to-end (GET-only, no browser)
- 2026-11-11 · `eb0fb68` · research: OJN/SEGOB and DOF as verified additional public channels (no acquisition)
- 2026-11-11 · `d4d52eb` · extractor v12: derogated paren-marker headings, guarded no-terminator sequential headings
- 2026-11-11 · `0aed214` · legal-library extractor v11: abbreviated Art. headings, roman bis suffixes, mid-sentence fragment guard
- 2026-11-11 · `fe32fbe` · docs(corpus): SJF pending reduced to terms-only decision; gaceta channel verified
- 2026-11-11 · `8b19348` · docs(corpus): official alternative channel research for Jalisco (none pipeline-compatible) and SJF (Gaceta PDFs on www.scjn.gob.mx, robots-clean); terms decision isolated
- 2026-11-11 · `a48ef2a` · corpus: per-source rights/channel review; execute NL pilot (8/8); extend egress allowlist to hcnl/congresojal; Jalisco channel fail-closed documented
- 2026-11-11 · `f1e1370` · corpus: bind remaining 11 pending slots to verified official URLs; all 20 pending slots now bound
- 2026-11-11 · `73b806b` · docs(corpus): scope draft manifest to product decisions and public-source evidence
- 2026-11-11 · `eb6a761` · corpus: bind 9 pending slots to verified official URLs; draft acquisition manifest with LFDA Art. 14 VIII rights research
- 2026-11-11 · `3015821` · docs(qa): bounded access/version verification of pending pilot slots
- 2026-11-11 · `f6c06a7` · fix(corpus): fail closed when coverage evidence is missing
- 2026-11-11 · `1bb327b` · docs(qa): coverage map distinguishing cataloged/ingested/verified/vigencia
- 2026-11-11 · `46a2631` · docs(qa): record independent fresh-clone verification of the patch
- 2026-11-11 · `2d75700` · docs(qa): clean-clone verification of d1518eb reconstruction
- 2026-11-11 · `e8f43f2` · test(vault): guard drift between README matrix counts and code parity gate
- 2026-11-11 · `7a984b9` · fix(ui): restore 44px drawer targets below 768px; repair stale brand assertions; drop stale landing smoke (reconstructed)
- 2026-11-11 · `fd8e1e1` · test(privacy): fail clearly on missing macOS platform prerequisite in required-fidelity mode (reconstructed)
- 2026-11-11 · `fac2776` · test(fidelity): decouple fidelity assets from the suite with an explicit required mode (reconstructed)
- 2026-11-11 · `7e6acf8` · test(privacy): gate 6 macOS-only parent-IPC tests on darwin (reconstructed)

# Auditoría de cobertura temporal RGCE / Anexo 22 al 24-nov-2026

- Fecha de auditoría: 2026-11-24 (America/Mexico_City)
- Alcance: `artifacts/library-expansion-20261124/` (`catalog-0.html`, `catalog-manifest.json`, `original-rgce-manifest.json`, `acquisition-manifest.json`, originales y compilados) cruzado con `resources/trade/` y `docs/research/sat-anexo22-2026-11-19.json`.
- Modo: solo lectura. Nada se promovió; todos los documentos siguen en estado `quarantined-not-promoted` / `not-legally-certified`.
- Base de comparación: `catalog-0.html` = captura local de https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html (sha256 `bc7f0523…`, adquirida 2026-11-24T14:44:28Z según `catalog-manifest.json`). La fecha de adquisición fecha la captura, no el estado del portal: una captura local no demuestra el estado vivo ni completo del sitio del SAT (ver §5).

## 1. Línea temporal RGCE 2026 / Anexo 22 según la captura del catálogo SAT

Las fechas marcadas "portal" son las etiquetas "(publicada el …)" de la página capturada; las fechas DOF provienen de los encabezados de los propios PDF/compilados, no del portal. Ninguna de las dos prueba por sí sola publicación efectiva en el DOF (ver §5).

Publicaciones finales (DOF):

| Documento | DOF | Páginas |
|---|---|---|
| RGCE 2026 + Anexo 13 | 27-dic-2025 | 414 (PDF SAT) |
| Anexo 22 base | 15-ene-2026 | 133 |
| 1ra RMRGCE 2026 | 14-may-2026 | 1 (resolución) |
| 1ra Modificación Anexo 22 | 20-may-2026 | 1 |
| 2da RMRGCE 2026 | 22-sep-2026 | 5 (resolución) |
| 2da Modificación Anexo 22 | 22-sep-2026 | 9 |
| Compilado RGCE 1ra RM | 14-may-2026 | 478 |
| Compilado RGCE 2da RM (adquirido por el autor 24-nov 15:46 UTC — ver §3.2-8) | 22-sep-2026 (etiqueta de portal) | 481 |
| Compilado Anexo 22 2da RM | 22-sep-2026 | 174 |

Frontera vigente en la captura (versiones anticipadas en Portal SAT, sin publicación DOF final listada al 24-nov-2026; surten efectos vía regla 1.1.2 según transitorios de las RMRGCE):

> **Contexto corregido (hallazgo del autor, ya con nota durable `rgce-final-conditions-2026-11-24.md`):** el DOF publicó la **Tercera RMRGCE final el 23-nov-2026** (nota 5804604), un día antes de la captura; el portal SAT capturado estaba rezagado y no la listaba. El final fue adquirido como impresión DOF HTML/texto (sha `d75b8279…`) y sus condiciones/transitorios están documentados y verificados en `docs/qa/kimi-rgce-final-conditions-review-20261124.md`. Las anticipadas de la 3ra RM quedan como versiones previas de un proceso ya finalizado; este informe no las declara vigentes ni las adopta.

| Documento | Publicada en portal |
|---|---|
| 1ra Versión Anticipada 3ra RMRGCE 2026 | 30-sep-2026 |
| 1ra Versión Anticipada 3ra Modificación Anexo 22 | 30-sep-2026 |
| 2da Versión Anticipada 3ra RMRGCE 2026 | 05-nov-2026 |
| 2da Versión Anticipada 2da Modificación Anexo 1 (3ra RM) | 05-nov-2026 |

Anticipadas ya superadas por su versión final (sin valor de cobertura): 1ra RM ×2 (30-mar, 23-abr), 2da RM ×5 (02-jun a 14-sep), 2da Mod Anexo 22 4ta/5ta (31-ago, 14-sep), y las de anexos 1, 2, 5, 29. La captura no lista Compilado Anexo 22 posterior a la 2da RM. **Corrección (cruce OpenCode, §6):** la captura sí lista el Compilado RGCE 2da RM; este informe afirmó lo contrario por error de extracción (ver §3.2-8).

## 2. Estado de tenencia (artefacto vs. repo)

| Documento | Artefacto `library-expansion-20261124` | Repo `resources/trade/` |
|---|---|---|
| RGCE 2026 base | ✔ `original-ReglasGeneralesComercioExteriorpara2026.pdf` (sha `50d2b9c0…`, 414 pág, texto íntegro) | — |
| 1ra RMRGCE | ✔ `original-1raRMRGCEpara2026.pdf` (sha `d06ed155…`, cierra con firma 23-abr-2026) | ✔ duplicado exacto `resolucion-rgce-2026-05-14.pdf` |
| 2da RMRGCE | ✔ `original-2daRMRGCEpara2026.pdf` (sha `fb2d2204…`, cierra con firma 10-sep-2026) | ✔ duplicado exacto `resolucion-rgce-2026-09-22.pdf` |
| Compilado RGCE 1ra RM | ✔ `1raRMRGCEpara2026.pdf/.txt` (478 pág, marca "Reformada en la Primera RMRGCE… 14 de mayo de 2026") | — |
| Anexo 22 base (15-ene-2026) | ✘ ausente | ✔ `anexo22-2026-01-15.pdf` (sha `f0ad60bd…`, 133 pág; inventario 19-nov) |
| 1ra Mod Anexo 22 (20-may-2026) | ✘ ausente | ✔ `anexo22-2026-05-20.pdf` (sha `4edb1bdf…`, 1 pág) |
| 2da Mod Anexo 22 (22-sep-2026) | ✘ **listado en `acquisition-manifest.json` pero el archivo no está en el directorio** | ✔ `anexo22-2026-09-22.pdf` (sha `7093c4ba…` = manifest) |
| Compilado Anexo 22 2da RM | ✔ `CompiladoAnexo22_2daRMRGCE2026.pdf/.txt` (174 pág; encabezado: base 15-ene + 1ra mod 20-may + 2da mod 22-sep) | — |
| 3ra RMRGCE anticipadas 1ª y 2ª | ✘ | ✘ |
| 3ra Mod Anexo 22 anticipada 1ª | ✘ (solo enlace registrado el 19-nov) | ✘ |
| 2da Mod Anexo 1 anticipada 2ª | ✘ | ✘ |

Presencia documental en la captura al 24-nov-2026: RGCE = Compilado 1ra RM + resolución 2da RM (ambos presentes en el artefacto). Anexo 22 = Compilado 2da RM presente en el artefacto; la cadena de publicaciones DOF individuales estaba incompleta dentro del artefacto (resuelta por el delta, ver §6). La presencia de estos documentos acredita solo disponibilidad local de los archivos listados: **no establece vigencia, fuerza normativa ni completitud jurídica**, que requieren cotejo con el DOF, lectura de transitorios/condiciones y revisión independiente.

## 3. Brechas

### 3.1 Brecha de frontera temporal (lo más reciente listado en la captura, sin capturar en ningún lado)

> Contexto corregido: existe final DOF de la 3ra RMRGCE del 23-nov-2026 (nota 5804604; nota durable `rgce-final-conditions-2026-11-24.md`, adquirida como impresión HTML/texto). Los ítems 1–2 ya no son "frontera en espera de final": son versiones anticipadas de una resolución ya publicada. No dupliqué descarga ni cotejo del final.

Catálogo: `catalog-0.html`, secciones "RGCE 2026 > Anticipadas" y "RGCE > Anexos > Anexo 22".

1. 1ra Versión Anticipada 3ra RMRGCE 2026 (30-sep-2026)
   https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anticipadas/3aRMRGCE_2026_PrimeraAnticipada.pdf
2. 2da Versión Anticipada 3ra RMRGCE 2026 (05-nov-2026) — la actividad RGCE más reciente listada en la captura
   https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anticipadas/3aRMRGCEpara2026Segundaversion_anticipada.pdf
3. 1ra Versión Anticipada de la 3ra Modificación al Anexo 22 (30-sep-2026)
   https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anticipadas/3raModificacionAnexo22_3raRMRGCE_2026_PrimeraVersionAnticipada.pdf
4. (RGCE amplio, fuera de Anexo 22) 2da Versión Anticipada de la 2da Modificación al Anexo 1 (05-nov-2026)
   https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anticipadas/2daModificacionAnexo1_3raRMRGCEpara2026Segundaversion_anticipada.pdf

Nota: los transitorios de la 1ra y 2da RM dan efectos a lo anticipado vía regla 1.1.2; para una biblioteca de comercio exterior la frontera anticipada no es ruido, es parte de la cobertura temporal. Debe etiquetarse como `anticipada-sin-DOF` y nunca citarse como texto DOF.

### 3.2 Brecha de cadena DOF individual del Anexo 22 dentro del artefacto

El texto vigente ya está en el Compilado Anexo 22 2da RM, pero faltan las publicaciones DOF individuales como evidencia citable (catálogo, sección "RGCE > Anexos > Anexo 22"):

5. Anexo 22 base (15-ene-2026): https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anexos/Anexo22delasRGCEpara2026.pdf — existe en repo (`anexo22-2026-01-15.pdf`), no en artefacto.
6. 1ra Modificación Anexo 22 (20-may-2026): https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anexos/1ra_modificacionAnexo22delasRGCEpara2026.pdf — existe en repo (`anexo22-2026-05-20.pdf`), no en artefacto.
7. 2da Modificación Anexo 22 (22-sep-2026): https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rgce/anexos/2daModificacionAnexo22delasRGCE2026.pdf — **defecto del artefacto**: el `acquisition-manifest.json` lo declara con sha `7093c4ba…` y 30 252 caracteres extraídos, pero ni el PDF ni su `.txt` están en el directorio; el binario sobrevive en `resources/trade/anexo22-2026-09-22.pdf` (hash verificado, coincide).
8. **Compilado RGCE 2da RM (22-sep-2026, etiqueta de portal) — omitido por error de extracción de este informe, detectado en el cruce OpenCode.** La captura sí lo lista en la sección "Versiones Compiladas RGCE 2026" (tras el Compilado 1ra RM), pero con href literal bajo la carpeta `rmf`: https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/compiladas/Compilado2daRMRGCEpara2026.pdf — mi extracción inicial solo cubrió enlaces `documentos2026/rgce/`, por eso se me pasó. No adquirido: no hay PDF con ese nombre en el lote ni entrada en `acquisition-manifest.json` (evidencia: `rgce-cross-review-catalog-evidence.json`, `candidateAcquisitionEntries: []`). El enlace en catálogo no prueba descarga, integridad ni texto del destino; no confundirlo con el Compilado 1ra RMRGCE ni con el Compilado Anexo 22 2da RM, que son recursos distintos ya presentes. **Resuelto por el autor (24-nov 09:49):** adquirido desde esa URL literal con HTTP 200 a las 15:46:40 UTC — `Compilado2daRMRGCEpara2026.pdf`, 5 908 925 bytes, 481 págs, sha `3b49ccad…` (recomputado y coincidente en mi revisión de condiciones), en cuarentena.

### 3.3 Sin brecha dentro de la captura (verificado contra el snapshot, no contra el portal vivo)

- La captura no lista ninguna publicación DOF final de RGCE o Anexo 22 posterior a la 2da RM (22-sep-2026): no aparece 3ra RM final ni 3ra Mod Anexo 22 final. Esto describe la página capturada; no demuestra que el portal vivo o el DOF carezcan de ellas al 24-nov-2026. **Confirmado como rezago del snapshot:** el autor encontró la Tercera RMRGCE final publicada en el DOF el 23-nov-2026 (nota 5804604), un día antes de la captura — la ausencia en el snapshot nunca probó ausencia en el DOF.
- La captura sí lista el Compilado RGCE 2da RM (22-sep-2026) — este informe afirmó lo contrario por error de extracción; corregido en §3.2-8. Es brecha de adquisición, no de listado.
- Anticipadas superadas (1ra/2da RM, 4ta/5ta de la 2da Mod Anexo 22): correctamente no retenidas.
- Cadena Ley Aduanera del mismo artefacto: los PDF (`LAdua.pdf`, `LAdua_ref21_23oct26.pdf`, `Reg_LAdua.pdf`) se descargaron el 24-nov con HTTP 200, pero la página índice de diputados que reporta "última reforma 23-oct-2026" proviene de `firecrawl-public-trial.json` con `cacheState: hit` y `cachedAt: 2026-11-23T01:08:51Z` — caché de ~1.5 días anterior a la auditoría; la vigencia al 24-nov no queda demostrada por esa captura. Sidecar `.txt` de `LAdua.pdf` y `LAdua_ref21` no conservados (menor).

## 4. Lote mínimo faltante

Lote A — cerrar cadena final Anexo 22 dentro del artefacto (3 PDF, ~1.63 MB). Sin descarga nueva: copiar desde `resources/trade/` verificando sha256 contra `docs/research/sat-anexo22-2026-11-19.json` y `acquisition-manifest.json`, y regenerar los `.txt` faltantes:
- `Anexo22delasRGCEpara2026.pdf` ← `anexo22-2026-01-15.pdf` (sha `f0ad60bd…`)
- `1ra_modificacionAnexo22delasRGCEpara2026.pdf` ← `anexo22-2026-05-20.pdf` (sha `4edb1bdf…`)
- `2daModificacionAnexo22delasRGCE2026.pdf` ← `anexo22-2026-09-22.pdf` (sha `7093c4ba…`)

Lote B — frontera anticipada (3 PDF, descarga nueva del portal SAT, URLs en §3.1 ítems 1–3), con etiqueta `anticipada-sin-DOF` y fecha de portal en el manifiesto. Opcional RGCE amplio: ítem 4 (Anexo 1).

Total mínimo: 6 documentos (3 copias internas + 3 descargas). Fuera de este lote quedan, por decisión de alcance, los demás anexos 1–21 y 23–30, sus modificaciones, compilados de anexos 1/2/5/29 y los ZIP de formatos/modelos del mismo catálogo.

**Actualización (cruce OpenCode, §6):** con el Compilado RGCE 2da RM identificado en §3.2-8, el lote mínimo pasa a **7 documentos** (6 ya resueltos por el delta + 1 descarga pendiente del Compilado 2da RM, cuyo href literal está bajo la carpeta `rmf`). La disponibilidad viva de esa URL no está verificada; proviene de la captura.

**Precisión del autor (`rgce-cross-review-correction-2026-11-24.md`):** el lote puede describirse como *presente respecto al paquete enumerado*; no cierra por sí mismo una frontera temporal jurídica, la biblioteca total ni el día 24-nov-2026. Todo cierre se limita a presencia frente a la captura de 14:44:28 UTC — no al día completo ni al DOF vivo.

**Suficiencia (hallazgo del autor, ya con nota durable):** la presencia de los documentos del lote no es suficiencia jurídica. El Compilado 2da RM (§3.2-8) ya fue adquirido por el autor, y el **final de la Tercera RMRGCE (DOF 23-nov-2026, nota 5804604)** fue adquirido como impresión DOF HTML/texto (`rgce3-final-dof-print.html/.txt`, sha `d75b8279…`), con condiciones y transitorios verificados en `docs/qa/kimi-rgce-final-conditions-review-20261124.md`. Pendientes que quedan: avisos ANAM que activen operaciones AVC, calendario de Ventanilla Digital, cotejo literal por párrafo anticipada/final y cotejo del apéndice 1 completo (autor/control).

## 5. Premisas y límites: qué prueba y qué no prueba la captura

- **Fecha de adquisición ≠ estado del origen.** `catalog-0.html` se adquirió el 24-nov-2026 14:44 UTC (`retrievedAt` del manifiesto). Eso fecha la captura local; no prueba que la página devuelta reflejara en ese instante el estado completo y vivo del minisitio del SAT (posible caché de CDN/servidor, página generada con rezago o secciones no capturadas). El manifiesto no registra metadato de caché para esta captura.
- **Caché documentado en la captura Firecrawl.** `firecrawl-public-trial.json` (índice diputados `ref/ladua.htm`) es `cacheState: hit` con `cachedAt: 2026-11-23T01:08:51Z`: su contenido es de ~1.5 días antes de la auditoría. Toda afirmación apoyada en esa página queda limitada a su fecha de caché.
- **Publicado en portal ≠ publicado en DOF.** Las etiquetas "(publicada el …)" del catálogo son fechas de publicación en el portal SAT. Las anticipadas no tienen publicación DOF; su efecto operativo deriva de la regla 1.1.2 citada en los transitorios, no de esta captura. Las fechas DOF de este informe se leyeron de los encabezados de los PDF, no del portal.
- **Completitud no demostrada.** La cobertura se midió contra el snapshot, no contra el portal en vivo ni contra el DOF. Puede haber documentos publicados entre la generación de la página capturada y el cierre de esta auditoría, o en secciones fuera de la captura (otros minisitios, VUCEM, DOF directo). Afirmaciones de la forma "no existe X" deben leerse como "la captura no lista X".
- Hashes del repo verificados localmente (`shasum -a 256`); hashes del manifiesto del artefacto no recomputados sobre los PDF presentes salvo los duplicados indicados.
- Esta auditoría no promueve ni habilita contenido; la promoción requiere su propia compuerta.

## 6. Resolución de hallazgos tras el delta (2026-11-24 09:14)

Referencia: `docs/qa/library-temporal-reconciliation-2026-11-24.md` y archivos nuevos en `artifacts/library-expansion-20261124/`. Verificación local limitada a existencia y sha256; no se reinició la auditoría ni se adoptó contenido.

| Hallazgo | Estado | Evidencia |
|---|---|---|
| §3.1-1 1ra Anticipada 3ra RMRGCE (30-sep) | Resuelto como captura | `3aRMRGCE_2026_PrimeraAnticipada.pdf/.txt`, sha `01df68a8…`, 1 pág, `anticipadas-manifest.json` (retrievedAt 24-nov 15:13 UTC, Last-Modified 20-nov, X-Cache: Miss) |
| §3.1-2 2da Anticipada 3ra RMRGCE (05-nov) | Resuelto como captura | `3aRMRGCEpara2026Segundaversion_anticipada.pdf/.txt`, sha `3d6af2d5…`, 3 pág, mismo manifiesto |
| §3.1-3 1ra Anticipada 3ra Mod Anexo 22 (30-sep) | Resuelto como captura | `3raModificacionAnexo22_3raRMRGCE_2026_PrimeraVersionAnticipada.pdf/.txt`, sha `88866771…`, 1 pág, mismo manifiesto |
| §3.1-4 2da Anticipada 2da Mod Anexo 1 (05-nov) | Pendiente, fuera de alcance Anexo 22 | No incluida en el delta; queda como brecha opcional de RGCE amplio |
| §3.2-5 Anexo 22 base (15-ene) | Resuelto | `Anexo22delasRGCEpara2026.pdf/.txt`, sha `f0ad60bd…` verificado, reutilizado desde `resources/trade` sin nueva descarga |
| §3.2-6 1ra Mod Anexo 22 (20-may) | Resuelto | `1ra_modificacionAnexo22delasRGCEpara2026.pdf/.txt`, sha `4edb1bdf…` verificado, misma vía |
| §3.2-7 2da Mod Anexo 22 (22-sep), referencia portable rota | Resuelto | `2daModificacionAnexo22delasRGCE2026.pdf/.txt` restaurados, sha `7093c4ba…` = `acquisition-manifest.json`; el coordinador aclara que el binario se omitió del paquete por duplicar exactamente `resources/trade/anexo22-2026-09-22.pdf`: no hubo pérdida de adquisición, era referencia no portable |
| §3.3 caché Firecrawl 23-nov en índice diputados | Aclarado | Existe captura directa `catalog-1.html` (ref/ladua.htm, 24-nov 14:44:29 UTC, sha `039687ee…` verificado, registrada en `catalog-manifest.json`); el scrape cacheado queda como evidencia secundaria. No es certificación de vigencia general |
| Afirmación "la captura no lista Compilado RGCE 2da RM" (§1, §3.3) | **Corregida** (cruce OpenCode, `docs/qa/opencode-kimi-cross-review-20261124.md` §3; confirmado por el autor en `docs/qa/rgce-cross-review-correction-2026-11-24.md` y `rgce-cross-review-catalog-evidence.json`) | La captura sí lo lista en "Versiones Compiladas RGCE 2026" con href literal `documentos2026/rmf/compiladas/Compilado2daRMRGCEpara2026.pdf`; error mío de extracción (grep limitado a `documentos2026/rgce/`). El path `rgce/compiladas` citado por el cruce también era incorrecto. Sin entrada de adquisición para ese destino (`candidateAcquisitionEntries: []`). Nueva brecha §3.2-8, pendiente de adquisición |
| Contexto de frontera (§1, §3.1, §3.3): "sin 3ra RM final listada" | **Corregido por hallazgo del autor** (nota durable `rgce-final-conditions-2026-11-24.md`) | El DOF publicó la Tercera RMRGCE final el 23-nov-2026 (nota 5804604), un día antes de la captura; el snapshot SAT estaba rezagado. Final adquirido como impresión HTML/texto (sha `d75b8279…`); condiciones/transitorios y diferencias anticipada/final verificados en `docs/qa/kimi-rgce-final-conditions-review-20261124.md`. Mi conclusión contra el snapshot no debe leerse como estado actual del DOF. No dupliqué descarga ni cotejo |
| §3.2-8 Compilado RGCE 2da RM pendiente de adquisición | **Resuelto por el autor** (24-nov 09:49) | Adquirido desde la URL literal `rmf/compiladas` a las 15:46:40 UTC, sha `3b49ccad…` recomputado y coincidente; 481 págs; cuarentena. El lote mínimo de §4 queda sin descargas pendientes de mi lista |

Notas de cierre:

- Las tres anticipadas capturadas llevan clasificación `anticipada-not-DOF-final`, `quarantined-not-promoted` y manifiesto separado. Son versiones de un mismo proceso de modificación, no normas nuevas aceptadas: este informe no las adopta ni declara su vigencia; su cotejo de condiciones/efectos queda como trabajo pendiente del coordinador.
- El lote mínimo de §4 quedó ejecutado en su totalidad original (6 documentos) salvo el ítem opcional §3.1-4; tras el cruce OpenCode se añade el ítem §3.2-8 (Compilado RGCE 2da RM), pendiente de adquisición. Conforme a la corrección durable del autor, la presencia de los 6 documentos describe el paquete enumerado frente a la captura de 14:44:28 UTC; no cierra frontera temporal jurídica, biblioteca total ni el día 24-nov-2026. La ausencia de una 3ra RM final solo describía esta captura — y quedó desmentida como estado del DOF por el hallazgo del autor (nota 5804604, final publicado 23-nov-2026, pendiente de nota durable): la captura estaba rezagada.
- Mismo patrón de referencia no portable observado en `catalog-2/3/4.html` (registrados en `catalog-manifest.json`, ausentes del directorio): fuera del alcance RGCE/Anexo 22; se anota para el coordinador sin ampliar la auditoría.
- Nada de lo anterior declara completitud ni vigencia jurídica; sigue pendiente el cotejo DOF y la revisión cruzada independiente.

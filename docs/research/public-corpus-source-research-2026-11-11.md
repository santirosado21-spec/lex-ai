# Investigación de canales públicos adicionales — 2026-11-11

**Alcance.** Investigación de canales oficiales nuevos para el corpus público, sin adquisición ni aprobación. Todo lo verificado en vivo se hizo el 2026-11-11 con cliente HTTP directo (sin evasión de controles). No se relajó ninguna política de robots/TLS ni se aceptaron términos ambiguos. Relación: `public-corpus-rights-review-2026-11-11.md` (base de derechos por fuente) y `public-corpus-extraction-audit-2026-11-11.md` (estado del corpus adquirido).

## 1. Orden Jurídico Nacional — SEGOB (agregador de los 32 estados)

**Orígenes verificados:**

| recurso | URL | resultado |
| --- | --- | --- |
| robots.txt | https://www.ordenjuridico.gob.mx/robots.txt | HTTP 404 — sin archivo robots; bajo la política del pipeline (404/410 = sin restricción de rastreo; cualquier otro estado = fail-closed) no hay restricción de rastreo. Esto no es licencia: la base de derechos sigue siendo LFDA Art. 14 VIII y equivalentes estatales. |
| robots.txt del subdominio de compilación | http://compilacion.ordenjuridico.gob.mx/robots.txt | HTTP 404 — mismo criterio. |
| PDF estatal de muestra | https://www.ordenjuridico.gob.mx/Documentos/Estatal/Estado%20de%20Mexico/wo31246.pdf | HTTP 200, application/pdf, 2,037,980 B, Last-Modified 2017-07-20. |
| Índice por estado | https://www.ordenjuridico.gob.mx/ambest.php → estatal.php?liberado=no&edo=N | HTTP 200; la lista de documentos carga en un frame de `compilacion.ordenjuridico.gob.mx/poderes2.php?edo=N` con buscador JS (Nuevo León: 8 códigos, 1 constitución, 15 decretos legislativos, etc.). |

**Mandato institucional:** `acerca.php` cita LOAPF Art. 27 fracción XXXI: facultad y obligación de SEGOB de "compilar y sistematizar las leyes, tratados internacionales, reglamentos, decretos, acuerdos y disposiciones federales, estatales y municipales... con objeto de proporcionar información a través de los sistemas electrónicos de datos". No se encontró página de términos con cláusula anti-comercialización (solo avisos de privacidad, que tratan datos personales, no reutilización de contenido).

**Advertencia de vigencia (material):** la muestra del Código Civil del Estado de México es la versión con reforma al 30-may-2017; el OJN se actualiza con rezago frente a las fuentes oficiales estatales (la fuente viva de NL declara reformas de 2026). Para un producto legal esto limita al OJN a canal SECUNDARIO: cada documento requeriría verificación de vigencia contra la fuente oficial estatal viva (donde exista), con `declaredAmendedAt` tomado del documento y `currentness: unverified` hasta esa comprobación.

**Descubrimiento (mapeado el 2026-11-11, solo GET, sin navegador):**

1. `ambest.php` → `estatal.php?liberado=no&edo=N` (N = id alfabético de estado; NL = 19).
2. Esa página carga el frame `http://compilacion.ordenjuridico.gob.mx/poderes2.php?edo=N` (conteos por tipo: NL muestra 8 códigos, 1 constitución, 15 decretos legislativos...).
3. `busqueda.php?frase={texto}&edo={N}` (GET, codificación latin-1; "Civil" en NL → 68 ordenamientos) lista resultados con paginación JS; cada fila abre la ficha.
4. `fichaOrdenamiento2.php?idArchivo={id}` — ficha técnica: fecha de publicación, ámbito, estatus ("Vigente"), tipo. **La ficha NO declara fecha de última reforma.**
5. `obtenerdoc.php?path=/Documentos/ESTADO/{ESTADO}/{id}.{ext}` — descarga directa verificada (HTTP 200, Content-Disposition attachment). **El formato varía: NL sirve .doc (application/msword); Estado de México sirve .pdf por la ruta `/Documentos/Estatal/{Estado}/{id}.pdf`.** El pipeline actual solo ingiere PDF; los .doc requerirían conversión (nuevo paso, nueva superficie de fidelidad) o quedar fuera.

**Dato de vigencia decisivo:** la ficha del Código Civil de NL (idArchivo=6152) declara solo "Fecha de publicación: 06 de Julio de 1935" y estatus "Vigente", sin fecha de reforma; la fuente viva del congreso estatal declara reforma al 26-jun-2026. La muestra de Edomex (wo31246.pdf) tiene Last-Modified 2017-07-20. Conclusión: el OJN no puede servir como fuente de vigencia; cada documento requeriría descarga + datación propia + contraste contra la fuente oficial estatal viva, y varios llegan con años de rezago.

**Valor:** un solo canal para los 32 estados, útil como base histórica/datada y para estados sin portal propio navegable; NO como fuente vigente. Para Jalisco podría aportar versiones base con fecha declarada visible, pero mezclar texto rezagado en un producto legal es una decisión de producto — no se da por resuelta aquí, y la decisión de política de robots del canal oficial de Jalisco sigue abierta por separado.

### Bindings OJN investigados para Jalisco (etiqueta: HISTÓRICO / VIGENCIA NO VERIFICADA — no son candidatos de incorporación)

Los 8 documentos piloto de Jalisco existen en OJN, TODOS en formato .doc (el pipeline solo ingiere PDF) y con fechas de ficha muy rezagadas frente a las versiones oficiales vivas ya vinculadas en el manifiesto:

| slot piloto | idArchivo OJN | fecha de ficha OJN | versión oficial viva (manifiesto) | formato OJN |
| --- | --- | --- | --- | --- |
| jalisco-pending-01 Código Civil | 79065 | 28-dic-2017 | sufijo 240626 (jun-2024) | .doc |
| jalisco-pending-02 Código Penal | 79061 | 25-ene-2018 | sufijo 271026 (oct-2026) | .doc |
| jalisco-pending-03 Proc. Civiles | 79066 | 19-sep-2017 | sufijo 250424 (abr-2024) | .doc |
| jalisco-pending-04 Código Fiscal | 79069 | 04-nov-2017 | sufijo 220726 (jul-2026) | .doc |
| jalisco-pending-05 Código Electoral | 81461 (nombre vigente) / 79067 (nombre anterior) | 05-ago-2008 | sufijo 300926 (sep-2026) | .doc |
| jalisco-pending-06 Constitución | 79053 | (ficha no inspeccionada) | índice 29-oct-2026 | .doc (presumido) |
| jalisco-pending-07 Código Urbano | 79063 | 11-ene-2018 | sufijo 080726 (jul-2026) | .doc |
| jalisco-pending-08 Asistencia Social | 79068 | 11-oct-2016 | sufijo 251125 (nov-2025) | .doc |

Conclusión de contraste: las copias OJN de Jalisco van de 8 a 18 años detrás de las versiones oficiales vivas. **El OJN no es una vía para el texto vigente de Jalisco**; como mucho sería base histórica con fecha visible, decisión de producto. La decisión del canal oficial de Jalisco (robots 301→error, fail-closed correcto) sigue siendo la única ruta al texto vigente y permanece abierta.

## 2. Diario Oficial de la Federación — dof.gob.mx

| recurso | URL | resultado |
| --- | --- | --- |
| robots.txt (host sin www) | https://dof.gob.mx/robots.txt | HTTP 200, válido: 136 entradas Disallow, TODAS endpoints de consulta por fecha (`nota_detalle.php`, `nota_to_doc.php`, `copias_cert.php`, `index*.php?year=...`) — no prohíben rutas estáticas de PDF. |
| robots.txt (host www) | https://www.dof.gob.mx/robots.txt | **TLS roto**: el certificado no cubre `www.dof.gob.mx` (SAN no coincide). El pipeline debe fallar cerrado ahí; no se omitió la verificación. Solo el host raíz es canal válido. |
| Edición diaria en PDF (muestra) | https://dof.gob.mx/2026/PRESREP/RCRJL_03032026_VES.pdf | HTTP 200, application/pdf, 40,744 B. |
| Constitución 1917 (texto original) | https://dof.gob.mx/Constitucion1917/constitucion_1917.pdf | enlazado desde index.php. |

**Advertencia de descubrimiento:** la navegación histórica usa las URLs de consulta por fecha que robots SÍ prohíbe (`index.php?year=...&month=...&day=...`). La ruta limpia actual es index.php (portada) → PDF estáticos del día. Adquisición de historial profundo requeriría localizar una ruta de archivo no prohibida (índice anual estático, si existe) o quedar acotada a ediciones recientes enlazadas desde portada. No se navegaron las URLs prohibidas.

**Valor:** canal oficial de historia de reformas — la brecha declarada del corpus ("ausencia total de historial de reformas"). Cada edición diaria es PDF parseable con el extractor existente (los decretos llevan "Artículo Primero/Único" ya reconocidos; los decretos de reforma requieren segmentación por decreto, no por artículo de código: flujo nuevo).

## 3. Decisiones que NO se tomaron aquí

- No se añadió ninguna fuente al registro ni se marcó aprobación: ambas rutas son investigación verificada; la incorporación sigue el flujo del manifiesto (rightsReview por fuente + bindings con evidencia + ejecución acotada).
- No se ofrece "descartar Jalisco/SJF" ni "aceptar términos": los bloqueos de Jalisco (robots) y SJF (términos anti-comercialización) siguen abiertos como decisiones del proyecto, documentadas por separado.

## 4. Siguiente paso técnico propuesto (sin autorización implícita)

1. OJN: la cadena de descubrimiento ya está mapeada (arriba). Antes de cualquier binding: decidir si el formato .doc entra al alcance (conversión) y si las versiones con rezago tienen uso declarado en el producto; sin esa decisión, los bindings de OJN se limitan a estados con PDF directo y verificación de vigencia contra fuente viva.
2. DOF: sondeo de rutas de archivo histórico permitidas por robots (sin tocar endpoints prohibidos); si no existen, acotar a ediciones recientes.
3. Ambos: si el proyecto decide avanzar, el manifiesto DRAFT obtiene una sección por fuente con bindings, evidencia y límites antes de cualquier descarga.

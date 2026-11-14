# Adquisicion Colima (Congreso del Estado de Colima) — cierre 2026-11-14

## Alcance
- Fuente: biblioteca legislativa oficial del Congreso de Colima, `https://congresocol.gob.mx/web/www/leyes/index.php` (seccion Leyes; filas server-rendered con enlace DOC y gemelo PDF por documento; listados por clase via el endpoint propio del sitio `POST /web/www/leyes/plantilla_datos.php` con comodin `lc=%`).
- Clases: Constitucion 1, Codigos 6, Leyes Estatales 154, Reglamentos 8 = 169 documentos catalogados.
- Clases excluidas: Leyes Municipales (ordenanzas fiscales anuales, fuera del alcance actual), Estatutos y Abrogados (exclusion por clase).
- Canonico: PDF gemelo preferido sobre Word (mismo documento; dedup por fila de catalogo). La ruta Word del extractor v27 queda disponible pero no fue necesaria.
- Cuarentena: todo el texto extraido permanece en cuarentena; sin publicacion, sin export de entrenamiento, sin ruta a producto.

## Verificacion previa
- robots.txt: 404 (ausente; la ausencia NO se trata como permiso por si sola).
- Sin aviso legal, terminos de uso ni prohibicion de reuso localizados en el sitio (la ausencia de terminos NO se presenta como autorizacion expresa del titular). Sin content-signals ni bloqueo a agentes observado.
- Base documentada: LFDA art. 14 frac. VIII (base documentada, no conclusion legal).
- Barrido HEAD de los 169 PDFs canonicos: 167x HTTP 200, 0 sobre 10 MB; 2x 404 (enlaces rotos del catalogo, abajo).
- Hallazgo de parseo: los gemelos PDF usan comillas simples en href; una primera pasada solo con comillas dobles subestimo el catalogo (154 vs 169). Corregido decodificando el HTML como Latin-1 y capturando ambas formas de comilla.

## Resultado (17 lotes, 10 docs/lote, concurrencia 1, rate 2s)
- 167/167 documentos descargados, extraidos y cuarentenados. 0 fallos.
- 16,777 registros extraidos en total.
- 2 entradas del catalogo con enlace roto (404 genuino del servidor, no timeout): `col-ley-104` Ley para Regular las Casas de Empeno (docx y pdf 404 en todas las codificaciones probadas: UTF-8 %C3%B1, Latin-1 %F1) y `col-reg-023` (fila de Reglamentos sin titulo cuyo unico enlace de archivo da 404). Clase: catalog-link-broken, documentada, sin mas sondeos.

## Incidentes de ejecucion
- Lote 14 rechazado en validacion de plan: un titulo del catalogo (col-ley-140) traia 549 caracteres con caracteres de control del HTML fuente. Correccion misma ejecucion: titulo saneado (sin controles, truncado a 180) en el registro del lote 14 y reintento exitoso. Ningun otro lote afectado.
- Lotes interrumpidos por timeout de shell reanudados de forma idempotente (lock removido, registry intacto); sin doble descarga.

## Corte canonico global tras Colima
- ids registrados: 2,584 (2,415 + 169)
- PDFs presentes: 2,556 (2,389 + 167)
- extracciones validas: 2,545 (2,378 + 167)
- registros: 245,526 (228,749 + 16,777)
- fallidos por clase: 24 invalid-pdf (nay fiscal 124..147, ruta browser pendiente), 11 extraction-invalid (5 OCR: yuc-011/012/015, oax-219/222, reg-lfgfaga-fe-16may55; 5 estructura: ags-ley-160, mor-cod-031/045/069/090; nota: conteo historico conservado por clase), 2 document-byte-budget (ags-ley-2529, bc-presupuestoestado2026), 2 catalog-link-broken (col-ley-104, col-reg-023).

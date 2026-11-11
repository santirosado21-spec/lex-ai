# Revisión de derechos y canal por fuente — 2026-11-11

Revisión por fuente del piloto de adquisición pública acotada (`resources/legal-acquisition-pilot.json`, política `developer-reviewed`). Base normativa común: LFDA Art. 14 fracción VIII — los textos legislativos y judiciales no son objeto de protección como derecho de autor (apego al texto oficial; sin derecho exclusivo de edición; las concordancias, interpretaciones, anotaciones y comentarios de terceros SÍ están protegidos). Fuente: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf (texto vigente DOF 14-05-2026). Robots.txt es convención de rastreo, no licencia; su ausencia no prohíbe ni autoriza por sí sola.

## diputados-fed (MX-FED) — ya aprobada en el registro
- robots.txt: 404 (sin política). Catálogo oficial público LeyesBiblio.
- Sin términos de contenido localizados que restrinjan reproducción de los textos.
- Adquisición acotada ejecutada 2026-11-11: 10/10 documentos descargados y extraídos, 0 fallos, 20 peticiones (10 robots + 10 documentos), 23,803,914 bytes, 43.6 s; estado `complete`; manifiesto e `integrity.json` en `artifacts/public-corpus/pilot/` (cuarentena local, sin publicación ni exportación de entrenamiento).

## nuevo-leon (MX-NLE) — aprobada en esta revisión
- robots.txt: `User-agent: * Allow: /` (rastreo permitido, sin crawl-delay).
- Términos del sitio: solo se localiza aviso de privacidad (tratamiento de datos personales del visitante); no hay condiciones de contenido que restrinjan reproducción (https://www.hcnl.gob.mx/privacidad/).
- Contenido objetivo: textos de leyes/códigos estatales → LFDA Art. 14 VIII. Las páginas declaran fecha de última reforma; se reproduce el texto oficial sin anotaciones de terceros.
- Canal: HTTP directo suficiente (verificado 200 hoy). Primera corrida falló cerrada (`invalid-pdf`): los bindings apuntaban a las páginas HTML, no a los PDF. Re-vinculados los 8 documentos a los href PDF exactos publicados en cada página (las fechas de la query `?aaaa-mm-dd` coinciden con la reforma declarada en página; el registro conserva la URL de página como evidenceUrl).
- Adquisición acotada ejecutada 2026-11-11: 8/8 documentos descargados y extraídos, 0 fallos, 16 peticiones, 6,596,623 bytes, 33.4 s; estado `complete` en `artifacts/public-corpus/pilot-mx-nle-2026-11-11/` (cuarentena local).
- Determinación: condiciones de derechos y canal resueltas para adquisición pública acotada.

## congreso-jalisco (MX-JAL) — aprobada en esta revisión
- robots.txt: soft-404 HTML (sin política discernible); el pipeline trata 404 como permitido y re-verifica en cada corrida.
- Términos del sitio: solo aviso de privacidad (https://www.congresojal.gob.mx/aviso_privacidad); sin condiciones de contenido restrictivas localizadas.
- Contenido objetivo: códigos y constitución estatales en PDF oficial → LFDA Art. 14 VIII.
- Canal: los PDF se sirven públicamente por HTTP directo (HEAD 200 verificado hoy en los 8 bindings); el índice HTML exige navegador real, pero solo se usa para re-vinculación, no para descarga masiva.
- Regla operativa: los sufijos de fecha caducan sin aviso (dos eventos observados en dos días: Proc. Civiles -180424→-250424; Penal -240626→-271026). Re-vinculación obligatoria desde el índice vigente antes de cada corrida.
- **Bloqueo de canal observado en la corrida del 2026-11-11**: robots.txt responde 301 → `/error/?404;…` (soft-404). El pipeline trata un robots.txt redirigido como `robots-unavailable` y falla cerrado por diseño; no se aplicó evasión ni relajación de la puerta. La fuente conserva la revisión de derechos aprobada, pero sus 8 documentos vuelven a `pending` hasta que exista canal oficial alterno o una decisión explícita del proyecto sobre la política de robots (p. ej. aceptar redirect-a-error como sin-política — decisión del proyecto).
- Determinación: derechos resueltos; **canal bloqueado para el pipeline actual** (fail-closed verificado).
- **Búsqueda de canal oficial alterno (2026-11-11)**: `www.congresojal.gob.mx` tiene robots.txt válido (Crawl-delay: 10, aceptable) pero su página de Biblioteca Virtual enlaza hacia congresoweb — no hospeda los códigos compilados. `periodicooficial.jalisco.gob.mx` responde robots con soft-404 200 (sin política; el pipeline lo aceptaría) pero publica números del Periódico Oficial (decretos), no códigos compilados. `infolej.congresojal.gob.mx` (404 en robots) sirve textos en HTML y el pipeline actual solo ingiere PDF. Conclusión: no se encontró canal oficial alterno compatible con el pipeline para los códigos compilados de Jalisco; la decisión sobre la política de robots de congresoweb sigue siendo la vía.

## sjf (MX) — sigue PENDIENTE: decisión genuina del responsable del producto
- robots.txt: indeterminado (timeout a clientes no-navegador).
- Términos localizados (https://www.scjn.gob.mx/terminos-condiciones): la información es pública pero su reproducción debe respetar derechos reservados; se prohíbe suprimir/eludir mecanismos técnicos de protección, realizar accesos no autorizados y **comercializar la información, servicios o contenido del portal**. Ambigüedad material: los términos se refieren nominalmente a `www.scjn.gob.mx`; su aplicabilidad al subdominio `sjf2.scjn.gob.mx` no está resuelta.
- Canal: el sitio exige navegador real (bloqueo a clientes programáticos); el pipeline actual no lo soporta y capturar vía navegador automatizado podría considerarse evasión de un control técnico.
- Contenido: tesis/jurisprudencia son textos judiciales (LFDA Art. 14 VIII), pero el producto es comercial y la cláusula anti-comercialización + el canal restringido quedan sin resolver.
- **Canal oficial alterno localizado (2026-11-11)**: la Gaceta del Semanario Judicial de la Federación se publica en PDF en `www.scjn.gob.mx/sites/default/files/gaceta/documentos/...` (HEAD 200, application/pdf, p. ej. 05_ENE_COMPLETO.pdf de 8,949,416 B). robots.txt de www.scjn.gob.mx es válido (Drupal estándar) y NO restringe `/sites/default/files/`; sin crawl-delay. Canal compatible con el pipeline actual (PDF directo, sin anti-bot). `egaceta.scjn.gob.mx` está tras Incapsula (403 a clientes programáticos) y no es viable. Las tesis pendientes se publican por mes en la Gaceta (P./J. 39/2026: Libro 7, marzo 2026), con proveniencia oficial equivalente.
- Decisión que sigue abierta: **exclusivamente los términos** — la cláusula anti-comercialización de scjn.gob.mx frente al uso comercial del producto, y su tensión con LFDA Art. 14 VIII (los textos judiciales no confieren derecho exclusivo de edición). El canal ya no es el bloqueo. Resolverla requiere al responsable del producto; aceptar los términos por inferencia no resuelve una prohibición comercial.

## Nota de integridad (source-drift)

La primera corrida NL/Jalisco (fallida, 0 descargas) dejó entradas de ledger con las URL antiguas en `artifacts/public-corpus/pilot/`; al corregir los bindings la puerta `source-drift` falló cerrada correctamente, por lo que la corrida NL exitosa se escribió en un directorio nuevo (`pilot-mx-nle-2026-11-11`). No se editó a mano ningún ledger ni hash.

## Límites globales preservados
Sin gasto, sin egreso de corpus privado, sin evasión de controles de acceso, sin copia de bases de competidores, sin publicación ni exportación de entrenamiento. Todo lo adquirido permanece en cuarentena local (`artifacts/`, no versionado).

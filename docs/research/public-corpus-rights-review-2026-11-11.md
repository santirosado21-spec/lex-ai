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
- **Bloqueo de canal observado en la corrida del 2026-11-11**: robots.txt responde 301 → `/error/?404;…` (soft-404). El pipeline trata un robots.txt redirigido como `robots-unavailable` y falla cerrado por diseño; no se aplicó evasión ni relajación de la puerta. La fuente conserva la revisión de derechos aprobada, pero sus 8 documentos vuelven a `pending` hasta que exista canal oficial alterno o una decisión explícita del proyecto sobre la política de robots (p. ej. aceptar redirect-a-error como sin-política — decisión del dueño/proyecto, no de este ciclo).
- Determinación: derechos resueltos; **canal bloqueado para el pipeline actual** (fail-closed verificado).

## sjf (MX) — sigue PENDIENTE: decisión genuina del dueño
- robots.txt: indeterminado (timeout a clientes no-navegador).
- Términos localizados (https://www.scjn.gob.mx/terminos-condiciones): la información es pública pero su reproducción debe respetar derechos reservados; se prohíbe suprimir/eludir mecanismos técnicos de protección, realizar accesos no autorizados y **comercializar la información, servicios o contenido del portal**. Ambigüedad material: los términos se refieren nominalmente a `www.scjn.gob.mx`; su aplicabilidad al subdominio `sjf2.scjn.gob.mx` no está resuelta.
- Canal: el sitio exige navegador real (bloqueo a clientes programáticos); el pipeline actual no lo soporta y capturar vía navegador automatizado podría considerarse evasión de un control técnico.
- Contenido: tesis/jurisprudencia son textos judiciales (LFDA Art. 14 VIII), pero el producto es comercial y la cláusula anti-comercialización + el canal restringido quedan sin resolver.
- Acción que requiere decisión del dueño: (1) aceptar o no los términos SCJN como aplicables al SJF y compatibles con el uso comercial previsto, o buscar canal oficial alterno (p. ej. Gaceta del SJF en PDF, dof.gob.mx); (2) autorizar o descartar la vía navegador. Evidencia original que la exige: términos SCJN citados y la conducta anti-bot observada.

## Nota de integridad (source-drift)

La primera corrida NL/Jalisco (fallida, 0 descargas) dejó entradas de ledger con las URL antiguas en `artifacts/public-corpus/pilot/`; al corregir los bindings la puerta `source-drift` falló cerrada correctamente, por lo que la corrida NL exitosa se escribió en un directorio nuevo (`pilot-mx-nle-2026-11-11`). No se editó a mano ningún ledger ni hash.

## Límites globales preservados
Sin gasto, sin egreso de corpus privado, sin evasión de controles de acceso, sin copia de bases de competidores, sin publicación ni exportación de entrenamiento. Todo lo adquirido permanece en cuarentena local (`artifacts/`, no versionado).

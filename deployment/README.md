# Despliegue preparado, acceso en diagnóstico

Repositorio privado: https://github.com/santirosado21-spec/lex-ai

El dueño ya autorizó la landing en Vercel y Supabase en su organización personal. No faltan instrucciones del dueño; siguen pendientes conexiones utilizables. Estado comprobado el 1 de noviembre de 2026 en [access-status-2026-11-01.md](access-status-2026-11-01.md).

Vercel: cuenta identificada y equipo `team_oTe9d80pIj0d4tSxGQaAUr6N` confirmado por la conexión, pero las lecturas del equipo responden 403. El enlace oficial revisado en el navegador aún mostraba Allow pendiente. `vercel-project-request.json` contiene la configuración revisable: raíz landing, sitio estático, sin instalación ni build, sin publicar código fuente. No se creó proyecto ni deployment. Tras completar el permiso del equipo, verificar lectura con la misma conexión, crear mediante MCP, desplegar main y comprobar la URL real con `LEX_LANDING_URL=https://URL-REAL node scripts/landing-smoke.mjs`. No cambiar el plan ni activar cómputo de pago.

Supabase: plugin habilitado, pero su conector devuelve Unknown tool. La revisión automática rechazó abrir supabase.com por un permiso guardado. No se intentaron vías alternativas para eludirlo. La organización personal está autorizada; falta identificar su ID y verificar coste cuando se restablezca el acceso. Esquema y pruebas locales en supabase/. Documentos, búsqueda e inferencia permanecen locales.

Landing y catálogo preparados con la versión 0.3.8 verificada. Los registros del seed permanecen sin publicar y con download_url NULL. Nunca sustituir una descarga pendiente por una URL inventada. La landing ofrece información y requisitos; no recopila datos ni ofrece una descarga pública todavía.

# Despliegue preparado, pendiente de acceso

Repositorio privado: https://github.com/santirosado21-spec/lex-ai

Vercel: el conector identifica el equipo `team_oTe9d80pIj0d4tSxGQaAUr6N`, pero responde 403 hasta que el dueño autorice la conexión. `vercel-project-request.json` contiene la configuración revisable: raíz landing, sitio estático, sin instalación ni build, sin publicar el código fuente. No se creó aún proyecto ni deployment. Tras autorizar, crear mediante MCP, desplegar main y verificar la URL real con `LEX_LANDING_URL=https://URL-REAL node scripts/landing-smoke.mjs`. No cambiar el plan ni activar cómputo de pago.

Supabase: herramientas del conector devolvieron Unknown tool; la apertura del sitio fue denegada por la revisión de permisos. No se intentaron vías alternativas. Esquema y pruebas locales en supabase/. Requiere habilitar acceso, elegir organización y verificar coste antes de crear un proyecto. Documentos, búsqueda e inferencia permanecen locales.

Nunca sustituir una URL de descarga pendiente por una URL inventada. La landing ofrece información y requisitos; no recopila datos ni ofrece una descarga pública todavía.

# Landing publicada en Vercel

URL pública: https://lex-ai-rust.vercel.app/

El 1 de noviembre de 2026 se completó el permiso del equipo y se desplegó la landing estática en producción. Proyecto `lex-ai`, equipo personal `team_oTe9d80pIj0d4tSxGQaAUr6N`. Repositorio privado: https://github.com/santirosado21-spec/lex-ai.

Configuración: raíz `landing`, sin instalación ni build de la app, salida `.`, sin publicar el código fuente. No se desactivó la protección de previews. El alias público responde 200; el alias de equipo continúa protegido. Manifiesto verificable en [vercel-production.json](vercel-production.json), incluyendo deployment y commit exactos.

Verificación sobre la URL pública: `LEX_LANDING_URL=https://lex-ai-rust.vercel.app node scripts/landing-smoke.mjs` PASS. Portada/fuentes locales, pestañas con teclado, diálogo de privacidad y vistas 1440/768/390 px. Sin excepciones, recursos fallidos ni solicitudes a terceros. HTTP adicional: cinco recursos coinciden byte a byte con los archivos locales, CSP coincide con la configuración y siete rutas internas de código/datos retornan 404. Evidencia local en `artifacts/vercel/` y `artifacts/landing/`.

La landing presenta 0.3.8; no ofrece una descarga pública del instalador. El repositorio y los releases siguen privados. No hay formularios de documentos o registro. Documentos, asuntos, recuperación e inferencia permanecen locales.

## Supabase pendiente

El dueño autorizó su organización personal. El plugin está habilitado, pero devuelve Unknown tool; la revisión automática bloquea abrir supabase.com por un permiso guardado. No se creó proyecto ni base remota y no se intentaron vías alternativas para eludir ese bloqueo. El seed local incorpora 0.3.8 con 15 pruebas aprobadas; sus filas siguen sin publicar y con download_url NULL. Cuando se restablezca el acceso, identificar la organización, comprobar coste y aplicar/verificar el esquema revisado.

El diagnóstico previo y su resolución parcial están en [access-status-2026-11-01.md](access-status-2026-11-01.md). No cambiar de plan ni activar servicios de pago sin autorización específica.

# Producto público y cover — 30/10/2026

## Entregado y comprobado

- Repositorio privado: https://github.com/santirosado21-spec/lex-ai. Código inicial publicado; pesos, índice SQLite generado, documentos operativos y secretos excluidos.
- Dirección visual real de Claude Opus 5.5: «Expediente foliado». Cover original generado por imagegen, integrado en onboarding de la app y en la landing. Original y procedencia conservados.
- App 0.3.1 compilada, firmada ad hoc y DMG verificado. Manifiesto sin rutas privadas: `docs/releases/0.3.1.json`. No notarizada ni probada en un segundo Mac limpio.
- Landing estática en `landing/`: demo HTML con datos ficticios, cinco pasos por teclado, diálogo de privacidad, FAQ, requisitos, modelo experimental separado y ausencia explícita de descarga pública. Tipografía e imagen propias del sitio, sin scripts externos.
- Smoke de navegador PASS a 1440/768/390 px: sin overflow, errores de consola ni recursos fallidos; cover, fuentes, fragmentos, teclado y recuperación de foco comprobados con la CSP de producción.
- Onboarding de escritorio/móvil PASS con imagen real, etiquetas y creación de despacho conservadas. Las pruebas de UI usan inferencia simulada, no son evaluación del modelo.
- 94 pruebas Node aprobadas. Catálogo público: 14 pruebas estáticas/SQL aprobadas con PGlite 0.5.13; DDL y seed ejecutados en PostgreSQL WASM local, roles anon/authenticated, RLS y denegación de escrituras comprobados. No es una prueba de Supabase hospedado ni de PostgREST.

## Pendiente de acceso del dueño

- Supabase: MCP devolvió `Unknown tool`; la revisión automática de permisos denegó abrir supabase.com. No se intentó una vía alternativa. No se creó un proyecto remoto. Esquema y datos revisables en `supabase/`, pendientes de organización y acceso habilitado.
- Vercel: cuenta reconocida, pero el equipo respondió 403 y exige autorización de la conexión. Se generó enlace de consentimiento para el dueño; no se creó proyecto ni deployment. Configuración preparada en `deployment/vercel-project-request.json`.
- La base cloud solo está diseñada para catálogo público de producto; documentos, asuntos, recuperación e inferencia continúan locales. Sin formularios de captación, cuentas de clientes o entrenamiento cloud.

Los seeds de 0.3.0 y 0.3.1 permanecen `published=false` y `download_url=NULL`. Una release dentro del repositorio privado no es una descarga pública para visitantes de la landing.

## Reproducir

```sh
npm ci
npm run build
npm test
node scripts/ui-smoke.mjs
node scripts/landing-smoke.mjs
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
python3 -m http.server 4175 --bind 127.0.0.1 --directory landing
```

Las evidencias de esta máquina están en `artifacts/landing/` y las capturas de onboarding en `artifacts/ui-app-cover*.png`. Los archivos grandes y los resultados privados de desarrollo no forman parte de Git. Los tests que necesitan snapshots locales adicionales deben omitirlos explícitamente cuando no existen.

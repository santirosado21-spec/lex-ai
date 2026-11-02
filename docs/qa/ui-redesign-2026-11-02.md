# Rediseño UI — Sello y pizarra

Fecha: 2026-11-02

La barra lateral presenta los destinos definidos en el brief en tres secciones plegables: Trabajo, Herramientas jurídicas y Sistema. `Pendientes` sólo muestra un contador cuando existen tareas no completadas del asunto activo. Las vistas de apoyo existentes conservan su acceso mediante la paleta ⌘K; no se eliminó ninguna.

Las citas de una respuesta se muestran como sello: enlace granate en línea y pasaje de fuente con borde granate y marca §. El verde queda reservado para un futuro estado explícito de fuente verificada; una fuente oficial no se presenta como vigente o verificada por defecto. La interfaz no presenta nombres de modelos o proveedores.

`document.compare` y `document.compare.export` existen sólo como API local y exportación DOCX. No se añadió una vista ficticia “Comparar versiones”; se requiere una vista existente antes de listarla como destino.

La fuente de logo continúa siendo `src/assets/lex-mark.svg`. No se editaron los candidatos de `docs/brand/logo-candidates/`. No había conector Figma disponible durante esta implementación.

## Verificación pendiente

Los scripts `ui-*-smoke.mjs` se actualizaron para comprobar los destinos visibles y el cajón ≤768 px, pero no se ejecutaron en este sandbox: sus listeners loopback producen `EPERM`. Deben correr en una shell local normal antes de registrar PASS y capturas 1440/1024/768/390.

La descarga de `@fontsource/newsreader` y `@fontsource/schibsted-grotesk` no pudo completarse en este sandbox (`ENOTFOUND registry.npmjs.org`). Por ello no se modificaron `package.json` ni `package-lock.json`, ni se añadieron sus archivos OFL: hacerlo sin los paquetes y licencias de origen sería una declaración incorrecta. Los tokens CSS ya apuntan a Newsreader y Schibsted Grotesk con fallbacks; al instalar ambos paquetes en una shell con red, se deben importar sus pesos locales y copiar sus LICENSE/OFL a `landing/assets/fonts/` antes de declarar el cambio verificado.

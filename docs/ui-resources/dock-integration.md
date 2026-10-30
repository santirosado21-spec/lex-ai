# Dock aportado por el dueño

El recurso original se conserva en `dock-supplied.md`. Se integra como navegación real de LEX AI, con dirección visual de Claude Opus 5.5 (respuesta observada y guardada en `docs/architecture/dock-design.md`). Codex adaptó el componente, integró el estado y verificó el resultado. No se afirma licencia de un repositorio externo: el material fue aportado en la conversación. No se descargaron assets de Dali ni de Unsplash; este componente solo necesita los iconos Lucide existentes.

## Ubicación y contrato

- `src/components/ui/dock.tsx`: componente React/TypeScript tipado; iconos `LucideIcon`, sin `any` ni lectura del DOM durante render.
- `src/components/ui/dock.css`: estilos aislados; sin animación permanente, con foco visible y reduced-motion.
- `src/App.tsx`: estado de sección y asunto, apertura/cierre de paleta y restauración del foco.
- `src/styles.css`: distribución que reserva espacio al dock y mantiene el compositor encima.
- `src/tailwind.css`: utilidades Tailwind para componentes importados.

`@/components/ui` resuelve a `src/components/ui`. Se utiliza esta carpeta en vez de `/components/ui` en la raíz porque la aplicación ya organiza su código bajo `src/`; la convención permite que los recursos y el CLI de shadcn apunten al mismo lugar. No se crea una carpeta en la raíz del sistema de archivos.

Props: `activePage`, `onNavigate`, `onMore`, `moreExpanded`, `inert`. Los destinos son Inicio, Asistente, Asuntos, Documentos y Biblioteca. Más abre la paleta que contiene todas las secciones. No hay contadores ficticios ni estado de negocio adicional. El detalle de expediente marca Asuntos como sección activa.

En escritorio aparece al contraer la navegación; el botón del encabezado permite volver a la barra lateral. En ventanas de hasta 780 px sustituye la barra lateral. No aparece durante onboarding. La app nativa conserva su mínimo de 1000 px; las comprobaciones de anchos menores corresponden al frontend web, no a un cambio del mínimo nativo.

## Configuración instalada

React, TypeScript y lucide-react ya existían. Se añadió Tailwind 4.3.3 y su plugin Vite, `components.json`, alias `@/*` y `src/lib/utils.ts` con clsx 2.1.1 / tailwind-merge 3.7.0. Dependencias nuevas fijadas y lockfile actualizado. No se ejecutó un init que sobrescribiera el diseño existente.

```sh
npm ci
npm run build
node scripts/ui-dock-smoke.mjs
node scripts/ui-smoke.mjs
```

Para reproducir la instalación manual en otro proyecto Vite existente:

```sh
npm install --save-dev --save-exact tailwindcss@4.3.3 @tailwindcss/vite@4.3.3
npm install --save-exact clsx@2.1.1 tailwind-merge@3.7.0
```

Copiar la configuración revisada de `vite.config.ts`, `components.json`, el alias de `tsconfig.json` y `src/tailwind.css`; importar esta última desde la entrada. El prefix es `tw:` y el escaneo se limita a `src/components/ui`. No se importa Preflight: se conserva el reset existente para no cambiar formularios y tipografía de toda la aplicación. Los futuros componentes deben utilizar ese prefix y comprobar su integración con los estilos existentes. El dock utiliza efectivamente `tw:grid` y `tw:grid-cols-6`.

Fuentes consultadas: [Vite + Tailwind](https://tailwindcss.com/docs/installation/using-vite), [integración sin Preflight](https://tailwindcss.com/docs/preflight), [shadcn en Vite](https://ui.shadcn.com/docs/installation/vite), [components.json](https://ui.shadcn.com/docs/components-json). La configuración de shadcn es manual; no se afirma haber instalado una colección de componentes ni proveedores que el dock no necesita.

## Verificación

Smoke específico: navegación única en el árbol accesible, Más y retorno de foco, destinos reales, conservación de asunto y borrador, objetivos táctiles de 44 px o más, estados activos, layout de 320/390/780 px y escritorio. La primera prueba detectó solapamiento con el compositor; se corrigió con un contenedor flex limitado al viewport y desplazamiento independiente del análisis. La repetición pasó. No se probó teclado virtual de un dispositivo físico.

Las pruebas usan documentos sintéticos y un doble de inferencia; no invocan el modelo. Capturas y resultados están en `artifacts/ui-dock/`. El cambio no altera la landing ni los bloqueos de acceso pendientes de Supabase/Vercel.

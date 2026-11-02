# Rediseño LEX AI — brief de diseño (2 nov 2026)

Dirección de diseño: sesión Claude (modelo observado `claude-sonnet-5-5`; no es Opus 5.5, la skill dsystem lo prefiere para diseño y queda anotado). Implementación y verificación: Codex. Skill consultada: `frontend-design` (`~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`). Figma: el conector no está disponible en esta sesión de Claude; Codex debe comprobar si lo tiene y, si no, el SVG es la fuente editable (registrar la limitación).

## Veredicto del dueño
El diseño y el logo actuales («crema + azul tinta», monograma L/E) «están terribles». No iterar sobre ellos: sustituir. Todas las herramientas deben verse en el menú principal.

## Dirección: «Sello y pizarra»
Un despacho serio y moderno: superficies frías y limpias, texto de tinta casi negra, **un solo acento granate de sello** usado con disciplina (cita, estado «verificado/pendiente», botón primario). Se evita a propósito la receta genérica crema+serif+terracota.

Tokens (nombres y hex; definir como variables CSS en `src/macos.css`/`src/styles.css`, con modo oscuro):
- `--bg` Pizarra clara `#EEF1F4`; `--surface` Papel `#FFFFFF`; `--surface-2` `#F7F8FA`.
- `--ink` Tinta `#0F1B2D`; `--ink-2` `#4A5568`; `--line` `#D9DEE5`.
- `--seal` Granate `#8C1D2C` (acento único; hover `#731724`); `--seal-soft` `#F6E7EA`.
- `--ok` Verdín `#2F7D6B` solo para «fuente verificada».
- Oscuro: bg `#0E141C`, surface `#151D28`, ink `#E8ECF2`, seal `#D4616F`.
- Contraste AA mínimo; objetivos ≥ 44 px; foco visible; `prefers-reduced-motion` respetado.

Tipografía (solo fuentes locales vía `@fontsource`, sin CDN; añadir licencias OFL): títulos y texto de documento en **Newsreader** (serif editorial para derecho), interfaz en **Schibsted Grotesk**. Sin ALL-CAPS en etiquetas, sin acentuar una sola palabra del título, sin numeración decorativa.

Forma: radio 10 px en controles, 14 px en paneles; sin sombras tipo «tarjeta SaaS» idénticas; la jerarquía se marca con líneas finas, espacio y una sola superficie elevada por pantalla. Un único momento memorable: la **cita del asistente como «sello»** (marca granate junto al pasaje fuente) en la respuesta.

## Navegación (todas las herramientas visibles)
Barra lateral con grupos plegables, sin «Más herramientas» como única vía (la paleta ⌘K se mantiene como atajo):
- **Trabajo:** Asistente, Asuntos, Escritos.
- **Herramientas jurídicas:** Biblioteca federal, Comparar versiones (si existe vista; si solo hay API, registrarlo y no inventar vista), Conflictos, Checklist, Pendientes, Acciones propuestas.
- **Sistema:** Panel (Dashboard), Inicio, Calidad del asistente (antes «Evaluación de LEX AI»), Configuración.
Cada ítem con icono lucide coherente y estado activo claro; contador solo donde haya datos reales (p. ej. pendientes, acciones por aprobar). En ≤ 768 px la barra pasa a cajón. No quitar ninguna vista existente.

## Logo nuevo
Concepto «cita con corchete»: una **L** cuyo trazo vertical es un corchete de cita `[` y un punto granate (el pasaje citado). Alternativas aceptables (entregar 3 candidatas en SVG, con versión monocroma y de 16 px legible): § construida con dos trazos; sello circular mínimo. **Prohibido:** balanza, mazo, columnas griegas, libro abierto, brillo/gradiente, copiar marcas de terceros (p. ej. Harvey). Fuentes SVG editables; derivar PNG/ICNS con `tauri icon`.
Wordmark «LEX AI» en Newsreader semibold, interletrado ajustado.

## Aceptación
`npm run build`, `npm test`, todos los `scripts/ui-*-smoke.mjs` actualizados a la nueva navegación (el invariante «sin cuarto destino principal» cambia: ahora la barra lleva todas las herramientas) y capturas 1440/1024/768/390 sin desbordes. Sin nombres de modelo/proveedor en la UI ordinaria.

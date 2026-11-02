# UI smoke status

Updated: 2026-11-02

The “Sello y pizarra” shell exposes all brief destinations in collapsible groups:
**Trabajo** (Asistente, Asuntos, Escritos), **Herramientas jurídicas**
(Biblioteca federal, Conflictos, Checklist, Pendientes, Acciones propuestas),
and **Sistema** (Panel, Inicio, Calidad del asistente, Configuración). The
command palette remains a keyboard shortcut for these and the retained supporting
views (Documentos, Investigación, Habilidades, Fuentes públicas and Conocimiento).
At 768 px or below the sidebar is a deliberate drawer. The retired dock and
animated orb-avatar assertions were replaced with checks of grouped navigation,
the current static LEX mark, and the existing loading lifecycle.

## Execution status

Executed by the orchestrator in a normal local shell on 2026-11-02 (the Codex sandbox forbids loopback listeners, so its own runs were BLOCKED, not PASS/FAIL). `npm run build` and `npm test` (149/149) passed.

| Smoke | Result |
| --- | --- |
| `ui-smoke`, `ui-product-identity-smoke`, `ui-bento-smoke`, `ui-dashboard-smoke`, `ui-dock-smoke`, `ui-real-library-smoke`, `ui-hig-smoke`, `landing-smoke` | PASS |
| `ui-avatar-smoke` | PASS after a regression fix: `.generation-state` had lost `role="status"` (screen readers would not announce progress); restored in `src/App.tsx`. The mark is inlined as a `data:` SVG by the bundler, so the check accepts it. |
| `ui-chat-smoke` | PASS after updating to current behavior: the default skill is now legal research (no document needed), so the "send disabled" check selects the contract reviewer; the animated canvas and `.lex-prompt-metal` layer were intentionally removed for low resource use, so the static composer is asserted instead. |

These are interface checks with synthetic data; they do not validate legal quality or performance on an 8 GB Mac.

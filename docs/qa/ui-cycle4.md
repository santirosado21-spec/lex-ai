# UI cycle 4 — alignment, identity and landing

Date: 2026-11-01

## Scope and direction

Applied the requested shared system: ink navy `#1f4a73` for product actions, warm paper surfaces, muted brass `#a26f28` only for landing highlights and active navigation indicators, neutral gray-blue text, and semantic green/red only for status. The eight-pixel spacing rhythm, ten-pixel card radius and a shared centered `1240px` content column are defined in `src/tailwind.css` and mirrored in `landing/styles.css`.

The attempted Claude design-director review could not run because the installed CLI reported `Not logged in`; no design output is attributed to it. The implementation follows the owner-provided design direction and the existing brand guidance.

## Baseline inspection

Existing screenshots were copied before source edits to `artifacts/ui-cycle4/before/`.

Observed issues:

- App/home and dashboard used different background families; dashboard was green-gray while the workspace was white/black.
- Main panes were centered differently and card borders/radii varied among bento, dashboard, library, command palette and composer.
- The active app navigation used black/gray while the app icon used a different outlined glyph; landing used a text-only wordmark and favicon used a third mark.
- Landing had one image but its product proof competed with the hero and did not state the requested local privacy, official-source, DOCX and reminder value clearly.
- On narrow views, the product shell has different navigation modes; existing baseline evidence covers bento/dashboard/dock responsive layouts, but the requested fresh-browser rerun was blocked (see verification).

Baseline paths include:

- `artifacts/ui-cycle4/before/ui-smoke/` — cover, library, workspace, dossier, command palette, public library, sources and training.
- `artifacts/ui-cycle4/before/bento/` — Inicio at 1440, 1000, 780, 390 and 320px.
- `artifacts/ui-cycle4/before/dashboard/` — Dashboard at desktop, 1000, 780, 390 and 320px.
- `artifacts/ui-cycle4/before/landing/` — landing desktop, 768 and 390px.

## Changes

- Unified app, dashboard, bento, dock, composer and command surfaces under the shared tokens and content-column spacing.
- Restored Source Serif 4 for headings/legal reading and IBM Plex Sans for controls in the native shell without changing its uncommitted CSS source.
- Unified the L/E ink-folio logo across the application, AppCover, landing wordmark and favicon; updated the brand documentation accordingly.
- Strengthened the landing hero and product proof, adding explicit local-first, cited-official-source, DOCX and manual reminder value while preserving the honest experimental/limitations sections and avoiding provider names.

## Verification

`npm run build` passed after the UI changes.

All requested smoke commands were attempted after the changes:

`ui-smoke`, `ui-avatar-smoke`, `ui-bento-smoke`, `ui-chat-smoke`, `ui-dashboard-smoke`, `ui-dock-smoke`, `ui-product-identity-smoke`, `ui-real-library-smoke`, and `landing-smoke`.

None could reach Playwright: each app/landing server failed before browser startup with `listen EPERM: operation not permitted 127.0.0.1`. A direct file-preview attempt also could not start Chromium because macOS denied its Mach rendezvous port. Therefore no fresh after screenshots or smoke PASS result is claimed; `artifacts/ui-cycle4/after/` is intentionally left without fabricated captures.

Required follow-up in a local, loopback-enabled macOS shell: rerun the listed smokes, inspect the regenerated 1440/1024/768/390 captures for every named view, and populate `artifacts/ui-cycle4/after/` before release.

# LEX AI logo candidates

This folder contains original, editable vector studies for the LEX AI mark. The active comparison is, left to right in `sheet.png`: **A2**, **C**, and **D**. Every active candidate has a transparent colour mark, a `currentColor` monochrome mark, a horizontal lockup, and 16 px / 32 px / 128 px PNG renders.

## Review history and active directions

Claude’s review of the first pass found that candidate A could read as a C because its hook and base were too symmetric; candidate B became an illegible blob at small sizes and is dropped from the active comparison; and candidate C is clear but generic. The previous contact sheet was also broken: its SVG used externally referenced `<image>` elements and ImageMagick produced empty white tiles. The prior `sheet.svg` was removed rather than retained as a misleading source.

### Candidate A2 — square citation L

`candidate-a2/` replaces A as the citation-bracket route. It is a filled, square-cornered L: the short top citation tick projects 72 units beyond the 64-unit stem (30% of the 240-unit base projection), and the base is deliberately much longer. There are no rounded caps. The `#8C1D2C` dot sits in the open inner corner above the base as a cited-passage marker. Its 64-unit structure remains visibly sturdy at 16 px.

### Candidate C — circular seal

`candidate-c/` remains a deliberately conventional minimal seal: a dark ring, a clear L, and a single red source locator. It is retained to compare the more institutional option against the newer directions, not presented as the preferred or most distinctive route.

### Candidate D — pinpoint citation

`candidate-d/` is a separate law-plus-AI alternative, not a circle-around-L and not S-like. A plain L anchors two compact citation lines; the red square is the pinpoint entry in the second line. At small sizes it remains a recognisable L with a simple indexed-reference silhouette rather than a dense monogram.

## Wordmarks

Every existing and active `lockup.svg` now spells **“LEX AI”** with a deliberate space (`LEX` and `AI` are separate text runs with a 32-unit gap). They use a local `@font-face` pointing to the installed `@fontsource/newsreader` 600 WOFF2 file, followed by Newsreader/Georgia serif fallbacks.

These wordmarks are an intentional SVG `<text>` fallback, **not converted paths**. The available dependencies were checked: neither `opentype.js` nor `fontkit` is installed, and no installed local tool could read the WOFF2 outlines. No package was installed. The SVG source therefore states the dependency honestly instead of pretending embedded path outlines were generated. The normal local browser renderer should load the packaged WOFF2; ImageMagick’s PNG review used its local serif fallback because it cannot resolve that embedded WOFF2 rule.

## Contact sheet and verification

- `sheet.html` is the browser-oriented contact-sheet source and uses real `<img>` elements for the active SVGs. This avoids the original external-`<image>` SVG failure mode.
- `sheet.png` is the checked 1800 × 900 contact sheet. It was regenerated locally by rendering the source SVG marks to PNG and compositing them over the light and dark rounded surfaces; it shows 200 px marks plus 64 px light/dark icons and 32/16 px checks. The ordering is A2, C, D from left to right.
- The requested Playwright screenshot route was attempted but Chromium cannot launch in this managed sandbox because macOS denies its Mach-port rendezvous. No package or browser setting was changed to work around that restriction.
- All candidate SVGs (`mark.svg`, `mark-mono.svg`, and `lockup.svg` for A, B, C, A2, and D) were raster-rendered locally for review. ImageMagick does not honour the embedded WOFF2 rule and misplaces SVG `<text>` in its fallback rendering, so that lockup raster is only a geometry check; the exact wordmark text, spacing attributes, and browser `@font-face` source were inspected in the SVG itself. A2 was additionally changed from a stroked line to filled geometry after that review exposed an ImageMagick stroke-rendering omission; the regenerated PNG and sheet visibly contain its dark L, not an empty tile.

## Palette and scope

- Ink: `#0F1B2D`
- Seal red: `#8C1D2C`
- Light slate: `#EEF1F4`
- Dark slate: `#0E141C`

No gradients, glow, scales, gavels, columns, open-book motifs, or third-party marks are used. The candidate SVGs are the editable artwork; no client material or external assets were used.

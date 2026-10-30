# LEX AI: UI design brief and architecture critique

**Scope.** This is design guidance for Codex to implement. I haven't seen the code. I didn't read the skill files myself; I applied the principles you summarized. Hex contrast ratios below are estimates and should be checked with a contrast tool. Items marked **[impl]** are implementation suggestions, not design requirements.

---

## 1. Design direction: "Expediente"

The concept is a well-kept case file. It uses paper-toned surfaces, ink-colored type and hairline rules instead of shadows. Color is reserved for meaning: provenance, status and risk.

- The reading surfaces (analysis and documents) should feel like a legal brief.
- The controls should feel like a precise macOS tool.
- No gradients, glassmorphism, illustrations or KPI tiles.
- Mexican legal vocabulary is used throughout: *Despacho, Asunto, Cliente, Materia, Jurisdicción, Fuente oficial, Registro digital, DOF, SCJN*.

## 2. Tokens

### Palette (light mode only for this slice; tokens are structured so dark mode can be added later)

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F8F6F1` | App background |
| `surface` | `#FFFFFF` | Document viewer, analysis entries, inputs |
| `sidebar` | `#EFECE5` | Sidebar, context column |
| `rule` | `#DEDAD0` | 1px dividers and borders |
| `rule-strong` | `#C9C3B6` | Input borders, table header rule |
| `ink` | `#1F1E1B` | Primary text (~16:1 on paper) |
| `ink-2` | `#5C5850` | Secondary text and metadata (~6.5:1) |
| `ink-3` | `#76716A` | Placeholder and disabled text (decorative/non-essential only) |
| `accent` | `#23466B` | Primary actions, focus ring, **official-source** markers (blue-black "signature ink") |
| `accent-hover` | `#1A3654` | |
| `accent-tint` | `#E6ECF3` | Selected nav item, official-source badge background |
| `matter` | `#6B4E16` | **Matter-document** markers (bronze) |
| `matter-tint` | `#F4EAD3` | Matter-document badge background |
| `highlight` | `#F6E7B8` | Cited passage highlight in excerpts and the viewer |
| `danger` / tint | `#9E2F26` / `#F7E4E1` | Errors, *Sin fuente* flags, destructive actions |
| `warning` / tint | `#8A5A00` / `#F6ECD5` | Stale snapshot, partial grounding |
| `success` / tint | `#2E6A47` / `#E3EFE7` | Ready, accepted, verified |

Color rules:
- Citation type is never shown by color alone. Always pair the color with an icon and a text label (*Fuente oficial* vs *Documento del asunto*).
- The accent is not used for decoration.

### Typography

All fonts are bundled locally (no CDN), and all are OFL-licensed.

| Role | Font | Size / line-height | Notes |
|---|---|---|---|
| View title | IBM Plex Sans 600 | 20/28 | |
| Section heading | IBM Plex Sans 600 | 15/20 | |
| UI body | IBM Plex Sans 400 | 13/18 | macOS-native density |
| UI label / button | IBM Plex Sans 500 | 13/16 | |
| Metadata | IBM Plex Sans 400 | 12/16, `ink-2` | |
| **Analysis and document reading** | **Source Serif 4** 400 | **16/26** | Measure 64–72ch, `lang="es-MX"`, `hyphens: auto` |
| Analysis subheading | Source Serif 4 600 | 18/26 | |
| Citation IDs, registro digital | IBM Plex Mono 400 | 12/16 | `tabular-nums` |

- Use `font-variant-numeric: tabular-nums` in tables and article numbers.
- Check rendering of Spanish diacritics and `§`, `º`, `ª`.

### Spacing, shape and motion

- **Spacing:** 4px grid: 4, 8, 12, 16, 24, 32, 48.
  - Panel padding 16.
  - Section gap 24.
  - List rows 32px (compact) or 40px (two-line).
  - Toolbar and context bar 44px.
- **Radius:** 4px on controls, 6px on panels and popovers. No pill buttons except status chips.
- **Elevation:** hairline borders. Shadows only on popovers and dialogs (`0 4px 16px rgba(31,30,27,.12)`).
- **Icons:** Lucide, 16px, stroke 1.5.
- **Motion:**
  - 120ms ease-out for hover and press.
  - 180ms for drawer and rail transitions.
  - No bounce, no per-token fade, no skeleton shimmer (use a static skeleton plus a text phase label).
  - Honor `prefers-reduced-motion` by making all transitions instant.
- **Hit targets:** minimum 28px, 32px for primary actions.
- **Focus:** 2px `accent` ring with a 2px `paper` offset, always visible on keyboard focus.

## 3. Layout

```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ Sidebar  │ ContextBar: Despacho › Cliente › Asunto  [Federal·Mercantil] ⌄ │
│ 232px    ├────────────┬──────────────────────────────┬──────────────────┤
│ (56 coll)│ Matter     │ Analysis center              │ Evidence rail    │
│          │ column     │ (flex, content max 760px)    │ 360px            │
│ Inicio   │ 280px      │                              │ (320–480 resize) │
│ Espacio  │ Documents  │ AnalysisEntry …              │ EvidenceCard …   │
│ Asuntos  │ Import     │                              │                  │
│ Docs     │            │                              │                  │
│ Investig.│            ├──────────────────────────────┤                  │
│ Habilid. │            │ Composer                     │                  │
│ Conocim. │            │                              │                  │
│ Config.  │            │                              │                  │
│ ● Gemma  │            │                              │                  │
└──────────┴────────────┴──────────────────────────────┴──────────────────┘
```

**Window behavior**
- Minimum window size is 1180×720. Use an overlay titlebar so the traffic lights sit inside the sidebar, which gets 28px top padding.
- Below 1360px width, the matter column collapses to a drawer opened from the ContextBar, and the evidence rail becomes an overlay sheet (`⌘\`).

**ContextBar.** This is always visible on matter-scoped views and acts as the visual form of matter isolation.
- It shows the breadcrumb and a jurisdiction/materia chip.
- Switching matter is an explicit menu action, never a hover.
- On views that are *not* matter-scoped (Investigación, Conocimiento), it reads **"Corpus público: sin documentos del asunto"**. This tells the user exactly what data a query can touch.

**Sidebar labels:** Inicio · Espacio de trabajo · Asuntos · Documentos · Investigación · Habilidades · Conocimiento · Configuración.
- `⌘1`–`⌘8` jump between them.
- A runtime status row is pinned at the bottom, e.g. `● Gemma local · Listo` or `◐ Descargando 42%` or `● Error`. Clicking it opens Configuración › Modelo.
- Habilidades shows a numeric badge for pending proposals.
- Do not show a "100% privado" claim. Show only states the app has actually checked.

## 4. Key flows and components

### First run (`OnboardingFlow`)
This is a full-window flow with a left step list and a form on the right. Each step can be revisited.

1. **Despacho**
   - Name.
   - Practice areas as a multi-select of toggle chips: Civil, Mercantil, Corporativo, Laboral, Fiscal, Administrativo, Amparo, Penal, Familiar, Propiedad intelectual, Comercio exterior, and *Otra…* (free text).
   - No default selection, so the product doesn't look trade-only.
2. **Modelo local**
   - Show model name and variant, download size, disk available vs required, a RAM check, and the Gemma license acceptance (link plus checkbox).
   - States: `No iniciado → Descargando (bytes, MB/s, ETA, Pausar) → Verificando integridad → Cargando en memoria → Listo`.
   - Errors:
     - *Espacio insuficiente*: show required vs free space and a *Reintentar* button.
     - *Descarga interrumpida*: *Reanudar*.
     - *Verificación fallida*: *Descargar de nuevo*.
     - *Memoria insuficiente*: suggest a smaller variant.
     - *El proceso del modelo no inició*: *Ver detalles técnicos*.
   - The user can continue to step 3 while the download runs.
3. **Primer asunto**
   - Fields: Cliente, nombre del asunto, referencia interna, materia, jurisdicción (Federal, or one of the 32 entidades).
4. **Listo**
   - Show the corpus snapshot summary: sources and snapshot date (e.g. *"Instantánea del corpus: 2026-09-15"*).
   - Primary action: *Abrir espacio de trabajo*.

### Matter column (`MatterPanel`)
- **`DocumentImportDropzone`**
  - Accepts .docx, text-based .pdf and .txt.
  - Each file gets an `ImportJobRow` with states *Leyendo → Indexando → Listo* and a filename, page count and timestamp.
  - Error for a scanned PDF: *"Este PDF no contiene texto seleccionable. El reconocimiento óptico (OCR) no está disponible en esta versión."* This states the limit honestly.
- **`DocumentList`:** title, type, date. Clicking a document opens a `DocumentViewer` drawer over the center pane, not a route change.

### Analysis center (`AnalysisPane`)
Answers are memo entries, not chat bubbles.

**`AnalysisEntry` structure**
- **Header:** the question in Plex 600, then timestamp · model · corpus snapshot date in `ink-2`.
- **Phase line** during work, announced via `aria-live="polite"` on phase changes only:
  *Buscando en el asunto (3) → Buscando en fuentes oficiales (5) → Redactando → Verificando citas*.
- **Body:** serif text.
  - `CitationMarker` is an inline superscript-sized chip, e.g. `[1]`, with an icon showing official vs matter source.
  - Markers render as *pendiente* (outlined) while streaming and become *verificada* (filled) only after the citation-verification pass.
- **`GroundingNotice`:** appears per paragraph when a claim has no verified source: `danger-tint` left rule plus *"Sin fuente verificada: revisar antes de usar"*. It is never hidden.
- **Fixed footer line** (not a banner): *"Análisis asistido por IA. Requiere revisión profesional. Vigencia según instantánea del corpus."*
- **`AnswerActions`:** Exportar DOCX · Aceptar · Rechazar · Corregir. Export stays disabled until streaming and verification finish.

**`Composer`**
- Multiline input.
- `⌘↵` sends; `⌘.` stops. The Stop control replaces the Send button while generating.
- Above the input, a scope line shows which data the question will use: *"Consulta: Contrato_sintético_A.docx + fuentes oficiales"*, with a toggle to include all matter documents.

**Streaming behavior**
- No blinking cursor theatrics.
- A partial answer that was stopped keeps an *"Interrumpido"* label and cannot be exported as final.

### Evidence rail (`EvidenceRail` → `EvidenceCard`)
Clicking a marker scrolls and focuses its card, then shows a 1px accent outline that fades over 600ms (instant under reduced motion). The reverse also works: hovering a card underlines its markers in the text.

**Official-source card**
- Badge: *Fuente oficial*.
- Title, e.g. *Código Civil Federal, art. 1796*.
- Excerpt with the cited span in `highlight`.
- Metadata grid:
  - Fuente (DOF / SCJN Semanario Judicial)
  - Publicación
  - Última reforma (if captured)
  - **Instantánea**
  - `Citation ID` (mono, copyable)
- Actions:
  - *Abrir fuente* opens the local snapshot in `SourceViewer`.
  - *Ver en sitio oficial* opens the external browser; this is user-initiated.
- If the snapshot is older than a threshold, show a warning line: *"Instantánea con más de N días; confirmar vigencia en la fuente oficial."*

**Matter-document card**
- Badge: *Documento del asunto*.
- Document name, cláusula/página, excerpt.
- *Ver en documento* opens `DocumentViewer` scrolled to the highlighted passage.

**Rail-level counters:** *"7 citas · 6 verificadas · 1 sin coincidencia"*.

### DOCX export
- A dialog lists what will be included, each with a checkbox:
  - Analysis
  - Citations with snapshot dates and IDs
  - Disclaimer (locked on)
  - Matter header
  - Internal notes (off by default)
- Save goes through the native save panel.
- On success, show a toast with *Mostrar en Finder*.

### Feedback and improvement proposals
- **Aceptar / Rechazar:** one click. Rechazar offers optional reason chips: *Cita incorrecta, Interpretación, Hechos del asunto, Redacción, Otro*.
- **Corregir:** inline side-by-side diff of the original vs edited paragraph, a reason field, and the same category chips. Saving shows: *"Corrección guardada. Generó una propuesta de mejora inactiva."*
- **Habilidades › Propuestas** (`ProposalList`, `ProposalDetail`):
  - Status chips: `Inactiva · Pendiente de evaluación → Evaluada → Aprobada (activa) → Revertida`.
  - Detail view has:
    - Source feedback with synthetic excerpt only.
    - Proposed change as a diff.
    - `EvaluationResult` showing baseline vs candidate on the fixed eval set, per-case pass/fail, and the date.
    - `ApprovalControls`: *Aprobar* is disabled with an explanation until an evaluation exists; approval needs a confirm dialog naming the approver.
    - `VersionHistory` timeline with *Revertir a esta versión*, behind a confirm dialog that shows what changes.
  - There is no bulk-approve action.

### Overview (Inicio)
This is a text-first worklist, with no metric tiles:
- *Continuar*: recent matters with their last question.
- Runtime and corpus status.
- *Propuestas pendientes* (count plus link).
- Recent exports.

### Other views
- **Asuntos:** table (Cliente, Asunto, Materia, Jurisdicción, Actualizado).
- **Documentos:** table scoped to the active matter.
- **Investigación:** public corpus only, as stated by the ContextBar.
- **Conocimiento:** snapshot list with source, date and record count; firm templates.
- **Configuración:** Modelo, Almacenamiento, Privacidad (what stays local, as factual statements), Acerca de.

## 5. Empty, loading and error states

| Area | Empty | Loading | Error |
|---|---|---|---|
| Workspace, no matter | "Selecciona o crea un asunto para empezar." + *Nuevo asunto* | — | — |
| Matter, no docs | Dropzone: "Importa un contrato (.docx, .pdf con texto, .txt)." | ImportJobRow phases | Per-file error with cause and *Reintentar* |
| Analysis, no question | 3 neutral example questions, e.g. "¿Qué penas convencionales prevé el contrato?" (clickable to fill, not send) | Phase line + static 3-line skeleton | "No se pudo generar el análisis: el modelo local no responde." + *Reintentar* / *Ver estado del modelo* |
| Model not ready | Composer disabled: "El modelo local aún no está listo (Descargando 42%)." | Sidebar status | Links to the onboarding model step |
| Evidence rail | "Las fuentes citadas aparecerán aquí." | Pending cards with an outline only | "Cita [3] no coincide con ninguna fuente recuperada." (danger) |
| Proposals | "Sin propuestas. Las correcciones generan propuestas inactivas." | — | Failed evaluation: show the failure, keep the proposal Inactiva |

**Error copy pattern:** *what happened · why (if known) · what to do*. Technical details go in a collapsible block that **never includes document text or prompts**.

## 6. Component tree and React notes

```
AppShell
├─ Sidebar (NavList, RuntimeStatus)
├─ ContextBar (MatterBreadcrumb, ScopeChip, MatterSwitcher)
└─ Routes  /m/:matterId/workspace | /m/:matterId/documents | /research | /skills/proposals/:id …
   ├─ WorkspaceView
   │  ├─ MatterPanel (DocumentImportDropzone, ImportJobRow[], DocumentList)
   │  ├─ AnalysisPane (AnalysisThread → AnalysisEntry[QuestionHeader, PhaseLine,
   │  │                StreamedAnswer, CitationMarker, GroundingNotice, AnswerActions,
   │  │                FeedbackPanel], Composer)
   │  ├─ EvidenceRail (RailSummary, EvidenceCard[Official|Matter])
   │  └─ DocumentViewer / SourceViewer (drawers, lazy)
   ├─ OnboardingFlow (FirmStep, ModelStep, MatterStep, ReadyStep)
   └─ ProposalsView (ProposalList, ProposalDetail[DiffView, EvaluationResult,
                     ApprovalControls, VersionHistory])
```

**Implementation notes [impl]**
- **Matter in the route.**
  - Put `matterId` in the URL, and include `firmId` and `matterId` in every query key.
  - On matter switch, abort in-flight streams (`AbortController`) and drop the previous matter's cache.
- **Streaming performance.** Accumulate tokens in a ref and flush on `requestAnimationFrame`; don't call `setState` per token.
- **Model output is untrusted.**
  - Render it as a strict markdown subset (paragraphs, lists, emphasis, citation tokens). No raw HTML, no links from model text.
  - Document text is data, so a contract saying "ignore instructions" must render inert.
- **Code splitting.** Lazy-load the DOCX export, viewers and the diff view. Avoid barrel imports.
- **Data loading.** Use `Promise.all` for independent fetches (matter, documents, runtime status) to avoid waterfalls. Virtualize document and proposal lists past ~100 rows.
- **Semantics.**
  - Use `<nav>`, `<main>`, and `<aside aria-label="Evidencia">`.
  - Citation markers are `<button>` with `aria-describedby` pointing to the card title.
  - Status chips carry text, not just a colored dot.

## 7. Architectural concerns (top 3)

1. **The loopback surfaces are the main local attack surface.**
   - **Risk:** a random bearer token stops casual access. It does not by itself stop DNS-rebinding requests from a malicious web page, and the inference process is also on loopback. If that process is unauthenticated, any local process or rebinding page can drive it.
   - **Recommendation:**
     - Bind to `127.0.0.1` only.
     - Validate the `Host` and `Origin` headers on every request.
     - Keep the token out of URLs and logs, and rotate it per launch.
     - Connect Node ↔ inference over a **Unix domain socket or stdio pipe** rather than TCP.
     - Sign and notarize both sidecars under the hardened runtime.
2. **Matter isolation in SQLite FTS depends on every query remembering a `WHERE`.**
   - **Risk:** FTS5 has no row-level security, so one missed filter in a join or snippet query leaks across matters.
   - **Recommendation:**
     - Route all retrieval through a single repository that *requires* a typed `MatterScope` argument, with no unscoped retrieval function at all.
     - Or use per-firm or per-matter database files, which is structural isolation and also simplifies deletion.
     - Add a regression test that seeds two synthetic matters and asserts zero cross-matter hits.
   - **Retrieval-quality limit:** `unicode61 remove_diacritics` helps, but FTS5 has no Spanish stemmer. Lexical-only retrieval will miss paraphrased clauses, so plan for hybrid search with local embeddings later.
3. **Citation integrity with a small local model.**
   - **Risk:** small models fabricate article numbers and IDs. The UI's "verified" state is only honest if the backend enforces it.
   - **Recommendation:**
     - Constrain generation so citations can only reference IDs from the retrieved set (JSON schema or grammar).
     - Run a post-generation check that the cited span exists in that source.
     - Store the snapshot ID with every answer and export so a stale corpus can't masquerade as current law.

## 8. Limits of this brief

- **Model runtime not specified.** I haven't specified the Gemma variant, RAM thresholds, download size or the bundled runtime (e.g. llama.cpp server vs another). Codex should check the current Gemma models and license terms from official sources.
- **Runtime abstraction.** Keep an interface so the dev-time Ollama dependency can be swapped out without changing the API.
- **No usability validation.** The layout hasn't been tested with practicing Mexican lawyers. Spanish copy and legal terms should be reviewed by one before release.
- **Unverified checks.** The contrast ratios are estimates, and I haven't tested font rendering in WKWebView.
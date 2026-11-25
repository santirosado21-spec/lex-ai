# Continue setup without enabling reasoning

Orca's UI review observed that creating a workspace landed in the unavailable assistant without a useful next action. The three-step list existed only on the workspace form with a fixed first step and documents before matters.

This cut routes workspace creation and reopening an empty workspace to Matters. A persistent first-steps region, derived from saved workspace/matter/document state, marks the workspace complete and offers Create first matter. After matter creation it advances to Import document using the existing document library and file input. After the first successful import the region disappears. Order is workspace, matter, document. No extra completion flag is written. Existing populated workspaces keep their normal initial view.

Privacy and unavailable reasoning remain explicit. No model starts, query sends, billing settings or new proposed features are added. The guidance does not claim that completing setup enables the assistant.

## Executed evidence

- New Playwright test against the real app and loopback API with temporary SQLite: failed workspace creation stays on step 1; successful retry lands in Matters at step 2; reload preserves the next action; matter creation advances to step 3; TXT import persists to the correct matter and clears the region; assistant remains disabled.
- Zero inference initializations, generations or analyze requests; no page errors. A simulated error response is used only to exercise failed workspace creation.
- New UI test plus existing reasoning-role UI: 2/2 pass. New test passes again after restoring the base mutation.
- Replacing App.tsx with c35056f makes the test fail because Matters is not reached after workspace creation. Restoring the change passes.
- Build passes with existing bundle warning. Desktop 1280x900 and narrow 390x844 screenshots inspected, with no horizontal overflow in the narrow view.
- CI includes the new UI test. No full suite repeated.

Limits: synthetic data, Chromium and HTTP; no native Mac UI test, real model, legal advice or client data. Existing sidebar breadth and unrelated navigation are unchanged. The guidance lasts until the first saved document anywhere in the workspace, not a separate onboarding flow per matter.

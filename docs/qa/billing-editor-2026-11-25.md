# Visible fee arrangement editor

Orca's product review and screenshots of Honorarios and Settings showed no control to set the arrangement or hourly rate although billing.arrangement.set already existed. The UI code confirmed read-only arrangement text.

This cut adds a matter-scoped form to the existing Honorarios section, using that API unchanged. It supports the five existing arrangement values, exact MXN hourly cents, contingency basis points and the existing 1/6/15 minute increments. Blank hourly rate omits the field, retaining the existing client-rate fallback (zero when absent). It does not change client defaults, old entries, invoice/tax behavior or legal rules. Fixed/retainer/contingency/pro-bono are described honestly: time does not automatically compute their fee, and the API has no fixed/retainer amount field.

The editor remounts on matter change, waits for scoped detail readiness and shares the existing single-operation lock and origin-scoped errors. It is disabled while a timer in the same matter is active or paused, avoiding a hidden increment change midway through that timer. Another matter's timer does not prevent editing. Backend behavior is unchanged.

## Executed

- New Chromium test routes real requests through the loopback server and temporary SQLite, with inference initialization/generation forbidden.
- Saves 1,234.56 MXN as 123456 centavos and one-minute increment, reloads exact form value. Existing entry remains zero, later 60-minute entry is 123456 centavos.
- Invalid negative, nonnumeric, excess-decimal and over-limit rates produce local errors and no writes.
- Failed save retains draft; retry succeeds. A delayed save for B while navigating externally to A persists only B and does not replace A's form.
- Contingency 12.34 maps to 1234 basis points without an hourly field. Blank hourly rate restores null fallback. Same-matter timer disables save.
- New and existing billing scope/date UI tests: 4/4 pass. Backend timer and retained HTTP lifecycle: 12/12 pass. Build passes with existing bundle warning.
- Base TimeBillingView mutation fails because editor is absent; restored test passes.
- Desktop and 390-pixel editor detail screenshots inspected, no narrow horizontal overflow. CI includes the new UI test.

No client data, model run, native Mac UI, full suite or deployment. The client default rate remains an API-only setting; this cut edits each matter's arrangement rather than silently changing all matters for a client. Existing rate rounding, billing snapshots and reports remain as implemented by the backend.

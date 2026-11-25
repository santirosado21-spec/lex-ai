# Timer precision across pause/resume

## Defect reproduced

Synthetic clock and real SQLite, hourly rate 12,000 centavos, billing increment one minute:

| Active segments | Uninterrupted duration | Before fix with pauses | After fix with pauses |
| --- | --- | --- | --- |
| Four of 29 seconds | 2 minutes | 0 minutes | 2 minutes |
| Four of 31 seconds | 2 minutes | 4 minutes | 2 minutes |

Before the fix, each pause rounded that segment before accumulation. Pausing could therefore change the recorded time and billed amount for identical active work. Both regression cases failed against the unchanged backend.

## Change

Accumulate active milliseconds durably in active_timers. Round the total only for the minute display and final entry, preserving the existing nearest-minute, half-up rule, rate snapshot and billing increment rules. Paused wall time remains excluded. Existing entries and invoices are not rewritten.

The additive SQLite migration detects the column, adds it and seeds existing timers from their known rounded minutes in one transaction. Reopening does not repeat it. The existing schema marker stays unchanged. Previously discarded fractions cannot be recovered. Null/missing exact accumulators fall back to the old minute value. Downgrading and resuming timers with an old application is not supported by this change.

The protected pilot's service database remains in memory, as before. This change does not add encrypted timer persistence and does not modify the separate future vault contract.

## Checks

- 11 time/billing tests and 9 future vault contract tests pass.
- SQLite restart preserves a paused 29-second segment; another 29 seconds after an hour-long pause closes as one minute.
- Failed entry creation rolls back timer deletion, and retry creates exactly one entry.
- A legacy paused three-minute timer migrates to 180,000 milliseconds and survives a second open unchanged.
- Existing 12-hour stale recovery, rate snapshot, billing, CSV and resolution cases pass.
- Portable source gate: 352 tests, 349 pass, 3 skipped, no failures.
- Build passes, with existing bundle-size warning.
- The time/billing test file is now included in the portable CI gate.

No client data, model execution, Mac operation, deployment or legal/tax validation. HTTP/UI timing and two independent server processes were not measured in this cut.

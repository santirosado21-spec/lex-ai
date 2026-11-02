# Local proactivity planner

Frente G stores reminders in the local SQLite database. Every reminder is bound to the active workspace and one matter; all list, read, and update paths require both scopes. Nothing is sent to a network service, and the planner does not invoke local inference.

The reminder fields are `kind` (`deadline`, `followup`, or `draft-suggestion`), `title`, optional user-entered `dueAt`, `note`, `status`, `source`, and creation metadata. User-created reminders begin as `approved`. Planner-created suggestions begin as `proposed` and remain inactive until a lawyer explicitly changes the status to `approved`. They can then be marked `done` or `dismissed`.

`planner.today` buckets active reminders as overdue, due today, or due within seven calendar days using an injected clock and explicit IANA timezone. This makes local-midnight behavior deterministic and testable.

`planner.propose` only creates local, deterministic suggestions when a matter has documents without saved analysis, analysis without a draft, a manually entered approved deadline within three days, or no activity for fourteen days. It de-duplicates active planner rules and never sends a notification.

## Legal-term boundary

Dates are organizational reminders entered by the lawyer. LEX AI does **not** compute legal terms, including business days (`días hábiles`) or when a notification takes effect (`surtimiento`). Deadline reminders preserve a visible note stating this limitation and require professional review.

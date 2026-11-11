# S2b.1 development diagnostic

Two newly invented development inputs: a fictional rule and a fictional contract/playbook. No real legal propositions, acceptance cases, gold answers or winner selection. Do not reuse retired S2a acceptance data.

`node scripts/probe-legal-task-structured.mjs --plan` is offline by default. Root must review protocol/access/freeze before using `--live --out artifacts/legal-task-structured-s2b-<run>`. `--score --out <run>` replays immutable receipts offline. Failed and partial runs are preserved; unfinished starts block scoring as delivery is unknown.

Eight jobs: two cases × explicit Groq GPT-OSS 20B/120B × prompt-only/native strict JSON Schema. S1 task skill and complete prompt are fixed within each pair. Common parameters: reasoning_effort=low, include_reasoning=false, temperature=0, max_tokens=2500, timeout=45 seconds. Only response_format varies. Full S1 schema is transmitted unchanged; a rejected schema/configuration stops the batch without dropping constraints, repair, retry or fallback. Native schema controls form, not citation spans or entailment; S1 validates mechanical rules separately.

Official sources checked 2026-11-09: [Groq structured outputs](https://console.groq.com/docs/structured-outputs) lists both explicit models for strict mode and requires required fields/closed objects. [Groq reasoning](https://console.groq.com/docs/reasoning) documents low effort for GPT-OSS and include_reasoning=false (mutually exclusive with reasoning_format). Not every S1 keyword is individually attested by the docs; provider incompatibility is a configuration failure, not permission to simplify.

Bounds: eight POSTs, 32 total HTTP requests, 15 minutes, one in flight, 65 seconds between starts for the same model. Existing helper handles effective-key Free attestation/catalog/model access; bounded transport adapter validates the original helper body then adds only reviewed wire fields. Headers pass through without persistence. No keys are read directly, no error bodies, settings or reasoning text are saved. Usage reasoning-token counts are numeric metadata only. Visible final answers are saved with recognizable credentials and think blocks redacted.

Scores cover strict JSON/S1, truncation, reported usage and descriptive latency. This changes reasoning effort relative to S2a and cannot isolate that change; it does not measure general legal quality, privacy, 8 GB performance or product readiness. The local receipt chain detects corruption against current frozen source/dataset; it is not an externally signed authenticity proof.

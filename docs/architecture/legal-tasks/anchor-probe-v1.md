# S2b.1c — bounded literal/anchor development probe v1

Offline default; no live run is authorized by this implementation. Root must independently review and freeze current source/dataset/access before live execution. The completed 3/8 S2b.1a run and S2b.1b compiler remain unchanged. The previous 20B HTTP 400 cause is unknown; this probe does not retry that model or infer why it failed.

Four planned jobs use only explicit `openai/gpt-oss-120b`: two fresh fictional development cases × literal S1 / anchors v2. The first pair is literal then anchor, the second anchor then literal. Both arms use the same input request hash, fixed task skill, substantive question, general mechanical requirements, native `response_format.type=json_schema` with `strict=true`, temperature 0, reasoning_effort low, include_reasoning false, max_tokens 2500 and 45-second helper timeout. The JSON schema name is common. Necessary differences are the output schema version/citation shape, literal text vs exact quote catalog/context, and citation representation instructions. These differences are recorded in full; they are not hidden behind a claim of byte-identical prompts or a pure offset-only causal experiment.

Literal outputs go to unchanged S1 validation. Anchor outputs go through a freshly reconstructed trusted S2b.1b closure and then unchanged S1 validation. No quotes, offsets, references or answers are repaired. Reports derive strict JSON/S1 success, finish reason/truncation, reported usage and descriptive latency from saved raw visible answers. A structurally valid exact anchor can still support an unsupported conclusion: legal accuracy, entailment and completeness are not evaluated. Two cases do not establish a legal-quality winner or statistical generalization. S2b.2 fresh acceptance remains separate and uncreated.

## Bounds and receipts

The new script adapts the frozen diagnostic's receipt patterns without importing/changing its runner: at most four generation POSTs, 16 HTTP requests, eight elapsed minutes, one in flight, and 65 seconds between starts for this model. Existing effective-key Free attestation and helper catalog checks remain required. No retries, fallback, paid route, 20B request or production wiring. Quota/access/network/model/configuration errors stop the batch. Incomplete/empty/tool-request outputs fail mechanically without execution, repair or retry.

The bounded transport adapter permits only catalog GET and the exact Groq chat endpoint. It verifies the helper's complete original body against the planned helper body and adds only the reviewed common reasoning and strict schema wire parameters. Authorization headers pass unchanged and are not persisted. The exact sent body/hash, starts, chained attempts, identity, public visible answer, finish reason and numeric usage are saved in a new confined artifacts directory with exclusive writes; existing output directories/symlinks are rejected. Recognizable credentials, effective authorization value and think blocks are redacted; separate reasoning text, settings, headers and raw error bodies/messages are excluded.

Response metadata uses finite vocabularies too: finish reasons are restricted to `stop`, `length`, `tool_calls`, `function_call`, `content_filter` or null. An unknown value is stored as null and stops with `INVALID_RESPONSE`. The observed model is stored only when it exactly equals the expected allowlisted model; any alias, credential-like text or other value is stored as null and stops with a safe identity error. Offline replay rejects metadata outside these sets, even when a receipt digest is recomputed. This correction applies to this new layer; frozen earlier probes and their historical metadata behavior remain unchanged.

For non-2xx responses, the observer may parse an ephemeral cloned JSON body and save only exact finite-whitelist `error.code`, `error.type` and `error.param` values. It never saves arbitrary strings, raw message, nested data, body or headers. Unknown or absent values remain absent (`{}`), preserving unknown cause. HTTP 400 is a configuration stop category, not an inferred detailed cause. Replay validates this safe metadata shape against the same whitelist.

`--score` verifies current source/dataset hashes, reconstructs jobs/catalogs from trusted resources, checks contiguous start/attempt receipt chains and exact wire hashes, and derives counts instead of trusting saved scoring/outcome. Partial and failed runs are preserved; unmatched starts block replay because delivery is unknown. Hashes are local integrity anchors, not external signatures or proof of reviewer identity. No permission/classification is conferred by preparing a packet.

## Commands

```sh
node scripts/probe-legal-task-anchors.mjs --plan
node --test tests/legal-task-anchor-probe.test.mjs tests/legal-task-anchors-v2.test.mjs tests/legal-task-contracts.test.mjs
# Root only after fresh review/freeze/access:
node scripts/probe-legal-task-anchors.mjs --live --out artifacts/legal-task-anchors-s2b-<new-run>
node scripts/probe-legal-task-anchors.mjs --score --out artifacts/legal-task-anchors-s2b-<existing-run>
```

Official parameter support was checked for S2b.1a in [Groq structured outputs](https://console.groq.com/docs/structured-outputs) and [Groq reasoning](https://console.groq.com/docs/reasoning). This code retains full schemas and stops on incompatibility; it makes no new provider-compatibility claim or live access observation. No provider call, model download, new dependency, client data or production activation is required by these commands except the explicitly marked live step.

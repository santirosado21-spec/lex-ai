# State expansion and corrective conversation experiment

Technical developer report. All candidates remain inactive. No private documents,
client matter data, network email, cloud training or legal professional review.

## Audited source boundary

Only `artifacts/legal-library/state-expansion-2026-11-02/frozen-v1` is eligible.
Its corpus SHA256 is
`448e7f1e180e4fd56cedab1608bb7fc82dc3c6fc340a6f8e81a41f19f1fbd001`;
the independent Poppler versus PDF.js full-body audit SHA256 is
`98d4960a91db3f34cc767ae080dc9dd4ef0a3ad62479c90aa25bb5c58dba5b93`.
All 5,304 accepted article bodies were independently located on their recorded
pages. Extraction fidelity does not establish legal validity/currentness.

The controlling law partitions remain immutable:

| Partition | Articles | Laws |
| --- | ---: | --- |
| Train | 4,680 | Jalisco civil 2,682; Jalisco fiscal 200; Nuevo León civil 1,798 |
| Validation | 426 | Nuevo León penal |
| Test | 198 | Nuevo León fiscal, explicit predeclared test override |

Jalisco penal/civil procedure and Nuevo León civil procedure were wholly excluded;
3,510 candidate records were excluded in total. CDMX acquisition was deferred for
a certificate problem. This bounded tranche does not cover all 32 states or all
practice areas. Recovery timestamps, including Jalisco's fallback `versionDate`,
are never represented as reform dates or evidence of present currentness.

`extension_curation.py` pins the corpus, manifest, audit, exclusions and partition
files. It checks each ID/body hash/pages against its successful full-body audit,
official source URL/PDF hash, controlling law partition and unchanged federal
base. Raw candidate exports are not accepted.

## Dataset and objective

`qwen-state-corrective-dataset-v1` represents every eligible article's normalized
body with untruncated token-aware fragments: 7,498 training rows, 989 validation
rows and 898 test rows; maximum 443 tokens. No exact normalized full-body overlap
with the protected federal held-out corpus was found. This is not a claim of
semantic or partial-phrase decontamination of shared statutory language.

An additional 96 deterministic Codex-authored synthetic tasks teach missing-fact
questions, source/note attribution and typed draft-only email proposals despite
injected document instructions. They are not human authored or legally reviewed.
The new source phase warms up on all 96, then alternates every new legal fragment
with one corrective rehearsal: 15,092 steps for one complete new-source phase.
Legal targets still mainly teach contextual copying and format, not demonstrated
legal reasoning or retained statutory knowledge.

Training names/templates are separated from the preregistered fresh identity,
attribution and email holdouts. Existing nine-area diagnostics remain regression
tests, not fresh tests after their failure modes informed this curriculum.

## Controlled handoff

The federal full pass was intentionally stopped at its complete checkpoint 9,500:
`qwen-curated-full-after-practice-v1/training/checkpoint-0009500`, checkpoint SHA256
`a563f3546ea78c6b9ebc395bef6eab5e6f858ccd9117a467a8fd18be7de70fb1`.
Only verified owned child PID 28455 was signalled. Shared GPU locks were released.
`intentional-handoff-9500.json` preserves the authorization, process identity and
hashes. The new-source pilot branches from a copy; it cannot replace the exact
federal continuation.

The pilot requests 400 real updates: 96 corrective warmup, 152 new-law fragment
updates and 152 corrective rehearsal updates. Counts of trained unique articles
and actual timing/memory must come from its completed report, not this request.

The frozen base, LoRA rank/scope, Adam and deterministic no-dropout RNG are preserved
at the source-phase transition. The earlier 3+2 bitwise continuation proof applies
to the same optimizer/RNG mechanism; it is not a newly measured bitwise proof of
this different source schedule. New checkpoints hash adapter/Adam/RNG payloads.

## Reproduction and resource bounds

Use `.venv-training/bin/python`. Build with
`scripts/qwen-training/extension_dataset.py --output <new-dataset-directory>`.
Run a branch with `extension_train.py --output <new-run-directory> --data
<dataset-directory> --parent-checkpoint <verified-federal-checkpoint> --steps 400
--wall-seconds 300 --run`. Omit `--steps` for the complete 15,092-step phase.
Interrupted state phases use `--resume-checkpoint <complete-state-checkpoint>`
with the same original `--parent-checkpoint`, dataset and a new output directory.

Run paired tests with `practice_evaluate.py --checkpoint <state-checkpoint>
--baseline-checkpoint <federal-parent-checkpoint> --extension-suite --output
<new-evaluation-directory>`. Reports include raw generations, fixed 144-token
generation cap, strict finished-turn checks and mock-only email transport.

The detached `extension_queue.py` waits without holding GPU locks for the specified
federal pipeline's full-pass **and** evaluation completion. It verifies the final
parent checkpoint and frozen data again, runs the complete new phase, then the
same parent-versus-candidate evaluation. A failed/interrupted federal predecessor
blocks the queue; it never silently follows a different continuation.

Training uses at most 4 GiB MLX allocation and a six-hour state-phase wall cap.
The queue has a 16-hour wait cap. Its scoped `caffeinate -i -w <own-PID>` assertion
exists only while the actual continuation runs and prevents idle system sleep;
lid/manual sleep, reboot, power loss and explicit termination still stop progress.
There is no automatic completion notification or activation.

## Actual pilot and paired results

The pilot completed 400 updates in 67.43 seconds: 152 new-law fragment updates
covering 148 distinct articles across all three training laws, plus 248 corrective
updates. This is **not** the full 4,680-article pass. Peak MLX allocation was
1,757,330,120 bytes; Adam restored and RNG reconstruction verified; base weights
unchanged. Adapter SHA256:
`bffdd370c2a97ab3186f11aa67cd96cb4c9079007753857f2617541baaffeced`.
`qwen-state-corrective-pilot-400-v1/training-report.json` and its row trace preserve
the actual sequence, source IDs, checkpoint hashes and metrics.

Paired evaluation ran **76 actual local generations** in 82.44 seconds, under the
shared lock: frozen federal checkpoint 9,500 versus the state/corrective pilot.
The 144-token cap was held constant. Results in
`qwen-state-corrective-pilot-400-evaluation-v1` preserve raw text, original scoring,
stricter posthoc scoring and a separate Codex technical semantic inspection.

| Observation | Federal parent | New pilot |
| --- | ---: | ---: |
| Requests missing facts | 0/11 | 6/11 |
| Complete practice cases | 0/11 | 0/11 |
| Finished no-evidence answers | 11/11 | 0/11 |
| Linked source citation | 11/11 | 10/11 |
| Verbatim quote | 11/11 | 10/11 |
| Strict posthoc mechanical checks | 169/194 | 121/194 |
| Original mock-email schema/approval cases | 0/2 | 2/2 |

**Measured regression; candidate rejected for activation.** All eleven candidate
no-evidence responses repeated text until the cap. The fresh fiscal-state case
lost `[S1]`; the constitutional case lost verbatim quotation. Fresh identity and
profession recall failed in both arms. Attribution structurally improved with
separate S1/N1 labels but did not pass every acceptance check. The fresh injected
email passed the draft-only JSON schema yet asked for availability instead of the
requested legible annex copies: **schema success does not establish task quality**.
No actual emails were sent.

`practice_score.py` records explicit paired release gates for newly incomplete
no-evidence answers, lost citations and lost exact quotes. The saved pilot gate
flags all three regressions, retains the parent and blocks automatic promotion.
The queued final evaluation uses the same gate. Mechanical acceptance still
requires separate semantic/professional review and explicit human approval.

## Live continuation and queued research

After evaluation the federal full pass resumed from **the original checkpoint
9,500**, not the new pilot branch. It was observed advancing past 9,560 with
supervisor PID **36043**, training PID **36045**, scoped caffeinate PID **36044**.
The resumed pipeline is `qwen-curated-full-after-state-pilot-v1`; its launch pins
checkpoint SHA256 `a563f3546ea78c6b9ebc395bef6eab5e6f858ccd9117a467a8fd18be7de70fb1`.
No further GPU interruption is planned.

The separate detached queue PID **36203** in
`qwen-state-corrective-full-queued-v1` was verified alive with status
`WAITING_FOR_FEDERAL_FULL_PASS`, owning **no GPU lock**. Only after this exact
federal pipeline finishes its complete 137,173-step pass and evaluation will the
queue start the full 15,092-step audited new-source/corrective experiment. Historical
pilot failures and their hashes remain in the queue report and training monitor;
they are not overwritten by low loss or a loading/training state.

Measured pilot throughput suggests roughly 42 minutes for the new-source phase
alone, after the multi-hour federal predecessor; this is an estimate, not a finish
promise. The currently queued full state phase is **not yet trained or completed**.
The app's default model and all earlier production choices remain unchanged.

Verification: `node --test tests/qwen-training.test.mjs` passed 11/11, and
`node scripts/verify-state-laws.mjs` passed all source/hash/partition/audit/base
checks. The earlier nine-area failure evidence remains preserved in
`qwen-practice-evaluation-7000-v1`.

# Operational privacy evaluation v2 (development only)

V1 acceptance is retired. Do not use its cases, templates or predictions to build new acceptance. This directory currently contains a draft protocol, annotation guide and synthetic development fixtures. **New gold heldout has not been created.** Independent authoring must follow protocol/guide freeze and must not inspect dev or candidate predictions. Development fixtures are not representative coverage or legal/privacy validation.

`operational` contains declarative fixture stimuli, supplied independently of gold: local processor status, MIME type, extraction status and ambiguity assessment. Document text that claims these fields remains inert text. Fixture flags do not authenticate extraction, provenance or production authority. Production import must use trusted local builders and the provenance registry capability; this module is opt-in offline preparation, with no runtime integration or egress grant.

`server/privacy/operational-v2.mjs` validates and copies JSON defensively, projects exactly `{scope,segments,operational}`, and evaluates operational failure precedence. Gold IDs, split, template groups, annotations, expected labels and hashes never enter the candidate projection. Both path and text count toward 7000 UTF-16 units; at most 256 segments and 32768 serialized UTF-8 bytes are permitted.

`scripts/eval-privacy-v2.mjs` exports offline validation and scoring APIs. It explicitly normalizes copies into the frozen v1 scorer for unchanged one-to-one matching, ranges, metrics and existing thresholds. V2 adds exact block-reason scoring; wrong reasons and all-blocked output cannot pass the relevant gates. Blocked entity cases still contribute misses. No detector/candidate invocation, model download, provider call, heldout loading or production activation is built in. Preservation and routing safety remain not evaluated.

Run `node --test tests/privacy-operational-v2.test.mjs` for contract tests. These tests use handcrafted outputs, not model performance evidence.

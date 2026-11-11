# S2b.1b — opt-in anchored citation contract v2

Development implementation only. This compiler is not connected to a provider or production route. It replaces model-generated literal citation offsets with references to locally prepared exact substrings. S1 contracts, loader, compiler and validator remain unchanged. S2b.2 remains the separate, uncreated fresh acceptance evaluation; this work does not create that evaluation or establish a winner.

## API and trust boundary

```js
import {prepareAnchoredLegalTask, prepareAnchoredPacket}
  from '../../../server/legal-tasks/anchors-v2.mjs';

const session = await prepareAnchoredLegalTask(publicOrSyntheticInput);
// Alternatively: await prepareAnchoredPacket(existingValidatedS1Packet).
const modelContext = session.prepared; // Frozen JSON-only model-facing view.
const result = session.resolve(rawV2Json); // Local synchronous resolver closure.
```

`prepareAnchoredLegalTask` loads the existing trusted skill bundle and compiles the input with `prepareLegalTask`. `prepareAnchoredPacket` additionally requires the supplied packet to equal a fresh S1 compilation, including instructions, skill identity, input, schema and hashes. The module does not accept a model-supplied catalog or trust a packet digest by itself.

The returned session is frozen. Its resolver retains the S1 packet and local anchor catalog in a closure. The `prepared` JSON view includes the request/packet hashes, unchanged skill instructions, explicit v2 adaptation guidance, input metadata/playbook/question, catalog, output schema and inactive flags. Original source/document full-text fields and their text hashes are omitted from the input metadata; their exact text is represented by the bounded anchors. No local range bookkeeping, private storage lookup, reversible identity map or hidden original is attached to this view. This does not sanitize arbitrary input: S1 permits only declared public/synthetic data, and those declarations are not proof of privacy or authorization.

## Deterministic catalog and full coverage

For every supplied source and document, in input order, the compiler divides its exact JavaScript string into consecutive chunks targeting 1,200 UTF-16 units. It never splits a surrogate pair. A final tail shorter than 12 units is rebalanced into a preceding chunk; every supplied unit appears exactly once. Each quote contains 12–1,600 units, retains original whitespace and combining characters, and must contain some non-whitespace text. Unpaired surrogates, a text too short for a citation, or a whitespace-only chunk reject the whole preparation. There is no normalization, semantic segmentation or removal of difficult tails. Combining sequences may cross chunk boundaries; code units remain exact and concatenation recovers the original text.

An opaque `a-<SHA-256>` ID binds the complete S1 packet hash and request hash, kind, input ID, version ID (null for documents), original text SHA-256, range and literal quote. Duplicate IDs are checked explicitly. The local catalog retains that binding. The model-facing catalog exposes only `anchorId`, `kind`, `id`, `versionId`, `jurisdiction` and `quote`; offsets and text-hash bookkeeping stay local. Source/document IDs may coincide because kind participates in binding. S1 still forbids duplicate IDs within one group; different source versions require different source IDs in a single request. Any request/packet change produces different anchor IDs.

Limits are exported as `ANCHOR_LIMITS`: 64 anchors, 128 KiB canonical catalog, 256 KiB output. Existing S1 input/field budgets remain in force. Exceeding a limit rejects preparation before a partial catalog is returned. No files are fetched, sources promoted, coverage upgraded or long document tails silently discarded. `providedCoverage` is carried unchanged; full chunk coverage of an excerpt does not make the underlying document complete. A request with no suitable anchors fails closed, including research without supplied sources/documents.

## V2 schema and resolution

The output schema is a copy of S1 with `schemaVersion` fixed to 2 and each `issues[].citations[]` replaced by the closed object `{anchorId}`. Its `anchorId` enum lists only IDs in this request's catalog. All other fields, bounds and declarations remain S1. Duplicate anchor use anywhere in one output is rejected explicitly, even across issues. This dynamic JSON Schema is a local contract; compatibility with any provider has not been claimed or tested.

The resolver accepts strict JSON or a JSON-only object, snapshots it, checks request/version identity, rejects extra reference fields and unknown/duplicate/stale IDs, and expands each ID through the trusted closure into its original S1 `{kind,id,versionId,quote,start,end}` citation. It changes the output version back to 1 and invokes unchanged `validateLegalTaskOutput`. This preserves source/document/commercial-preference distinctions, jurisdiction rules, exact quote integrity, document coverage, missing-fact behavior and human review requirements. Literal quotes, argument text and conclusions are never repaired or inferred.

The returned frozen result contains `schemaVersion: 2`, the preparation hash, the resolved S1 output and S1 validation declarations plus `anchorBinding: true`. Output provenance hashes detect differences relative to the locally trusted input; they do not authenticate a reviewer, confer authorization or prove that a source is official/current.

## Evidence and limits

Targeted tests exercise deterministic preparation, source/document ID collisions, multiple versions, packet/schema/source mutations, stale cross-request references, enriched references, Unicode combining/emoji boundaries, whitespace preservation, full long-tail coverage, bounds, strict parsing, inert document/template instructions, immutable snapshots and the existing S1 category/coverage/missing-fact rules. Fresh invented inputs are used; no retired privacy or legal-task acceptance material is read. A declared-public fixture demonstrates local compilation without fetching or source promotion.

A deliberate probe pairs a valid document anchor with an unsupported claim about the Moon and worldwide obligations. Mechanical validation succeeds while `legalAccuracy` and `entailment` remain `not-evaluated`, and `humanReviewRequired` remains true. Valid anchor selection proves exact textual provenance only. Semantic support, completeness, current-law quality, prompt-injection resistance of an actual model, usable anchor granularity and provider behavior require separate evaluation.

No model calls, downloads, dependencies, production imports, credentials, client data, spending or acceptance evaluation are part of this module. Firm/matter access, egress approval and data classification remain separate controls.

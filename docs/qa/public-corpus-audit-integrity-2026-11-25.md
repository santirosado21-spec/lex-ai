# Public corpus audit must check the ledger it claims to check

Reproduced: a temporary directory containing only an empty extractions directory and a manually fabricated report with state complete returned ok:true. loadPublicAcquisitionReport reads report JSON and rejects unsafe paths, but does not verify the integrity ledger. The audit's comment incorrectly claimed it used the pipeline integrity checker.

A new read-only verifier reuses verifyLedger to hash recorded files and validate manifest/snapshot linkage, requires the acquisition owner marker, report shape, nonempty quarantined selection and ledger-bound extraction/version evidence. It checks report/extraction/evidence document ID, PDF digest, source URL and quarantine flags. The audit now examines exactly the report-selected ledger-bound extraction, instead of walking and choosing files by capturedAt. No acquisition, publication, training, legal approval or indexing action is added.

25/25 targeted Linux tests and build pass. New audit tests cover the formerly green empty/fabricated report, valid synthetic pipeline output, changed snapshot, unbound report path and changed extraction. Replacing the verifier with the old report-only loader makes these tests fail. All fixture network is injected synthetic data, no public source was contacted and no real corpus was modified.

Limits: hashes establish local consistency, not signed authorship or protection from someone rewriting both files and ledger. This does not prove legal fidelity, effective dates, rights, current law, or full corpus coverage. Audit ok is never release approval. Existing structural checks still require further domain review and do not authorize moving any document out of quarantine. No model, heldout privacy set or Mac work.

## Record-kind review correction, 26 November

The first followup incorrectly treated every non-article kind as exempt from article-ID checks. A ledger-consistent extractor error could label a duplicate operative article as an unknown kind or transitory and pass. This consolidated revision supersedes both earlier patches.

The audit now uses the development indexer's KINDS contract: articulo, transitorio, prefacio-articulo-citado. Other general-extractor record kinds (principio, capitulo, resolutivo) fail closed for this audit/indexing contract. An article needs its ID and participates in ordering/uniqueness. A transitory needs null articleId, nonempty ordinal/group, page provenance at or after the parser's transitory boundary, and consistent transitory count. A quoted preface keeps its article ID, requires a known parser separation reason and consistent preface count. The operative count must match coverage.operativeArticleCandidates, NOT structuralCandidateCount: that latter field records structurally verified/exportable articles, not all quarantined candidates.

38/38 targeted Linux tests and build pass. Guard-removal mutations for unknown kind, transitory ID, operative count, transitory boundary and preface reason are each detected. Cases include real-parser transitories and valid quoted-preface structure, and ledger-consistent invalid classifications. No index is built by these checks.

The original five public acquisitions from 19 November (ladua, lce, ligie-2022, reg-ladua, reg-lce) were transferred intact and audited read-only. All five pass the corrected mechanical checks with no findings; canonical spot checks are not declared for these IDs. No PDF fidelity, effective-date or legal approval follows. Archives and acquisition files remain outside the repository/diff.

Limits: classification checks compare internal structure and counts, not independent semantic truth. A parser error that consistently changes the label, article identity, boundary, counts and text evidence may still pass. Only source-page comparison and domain review can address that. The existing indexer's whitelist is not itself a semantic validator and is unchanged. No document is adopted, published, indexed, released or used for training. No private documents or model calls were used.

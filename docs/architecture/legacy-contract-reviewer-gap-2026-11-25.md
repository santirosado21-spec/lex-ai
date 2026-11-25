# Legacy contract reviewer direction mismatch

Recorded separately from manual review-card implementation. Not an activation plan or a claim of product readiness.

server/skills.mjs still includes contract-reviewer with requiredTools local-inference. server/service.mjs analyzeGrounded uses inference.generate for that legacy analysis path. This is inconsistent with the current product direction that the local model only anonymizes data. The richer revision-contratos-mx package remains draft-offline, productionEnabled false, and public/synthetic only; its citation validators do not prove reasoning or legal accuracy. Historical S2 results do not justify promoting it.

Manual review cards do not call either path, enable either skill, change model roles or authorize remote execution. Resolve the legacy surface/routing separately before presenting automated contract review as a current capability. Any future architecture, provider and legal evaluation decision needs explicit scoped review, not automatic migration from manual cards.

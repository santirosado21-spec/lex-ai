# First-slice integration contract

Node 22 backend, `server/service.mjs` exports `createService({dataDir, corpusPath, inference})` (may be async). Default inference implemented separately by root in `server/inference.mjs`, exports `createInference({dataDir})` returning `{status(), initialize(), async *generate(messages), stop()}`. Service method `dispatch(action,payload)` returns JSON; method `analyze(payload,onToken)` streams validated text chunks via callback and returns saved answer. HTTP adapter `server/main.mjs` (root) consumes these. Frontend requests POST `/api` body `{action,payload}`, bearer token from URL fragment in browser dev or Tauri `connection` invoke. Analysis POST `/analyze` returns NDJSON `{type:'token',text}`, then `{type:'result',data}`, errors `{type:'error',message}`. The server never uses external AI.

Actions (payload keys):
- `state` {} -> `{workspace:null|{id,name,practiceAreas},matters:[],documents:[],answers:[],feedback:[],proposals:[],tasks:[],reminders:[],skills:[],sources:[]}`. Single active firm per data directory; caller cannot pick arbitrary database path.
- `workspace.create` {name,practiceAreas:string[]} -> workspace. One firm only; reject replacement.
- `matter.create` {title,client,jurisdiction:'MX-FED'|'MX-CMX'} -> matter {id,title,client,jurisdiction}
- `document.import` {matterId,name,base64} -> document {id,matterId,name,characters,createdAt}; TXT/MD/PDF/DOCX max 10 MiB. No arbitrary path import.
- `document.text` {documentId,matterId} -> {text}
- `research.search` {query,jurisdiction} -> sources/passages
- analyze {matterId,question,skillId:'contract-reviewer'|'legal-researcher'|'document-analyzer'|'legal-drafter'|'matter-assistant'} -> answer {id,matterId,text,citations:[],createdAt,validation:{...}}. Retrieve only this matter + curated legal corpus; no inference when insufficient evidence; bracket source IDs validated. Grounding failures must not be presented as validated analysis.
- `answer.export` {answerId,matterId} -> {name,base64,mime} DOCX
- `feedback.create` {answerId,matterId,rating:'accepted'|'rejected'|'corrected'|'citation-error',comment} -> feedback
- `proposal.create` {feedbackId} -> inactive proposal; manual candidate, no automatic training or activation.
- `proposal.evaluate` {proposalId} -> evidence results
- `proposal.approve` {proposalId} -> versioned activation ONLY with passing evaluation and explicit UI action
- `proposal.rollback` {proposalId} -> previous version
- `reminder.create` {matterId,kind:'deadline'|'followup'|'draft-suggestion',title,dueAt?:ISO-8601,note?:string} -> matter-scoped reminder. Lawyer-created items start `approved`; a `deadline` is entered manually and includes a notice that LEX AI does not calculate legal terms, business days, or service-of-notice effects.
- `reminder.list` {matterId,status?:'proposed'|'approved'|'done'|'dismissed'} -> reminders only for that matter in the active firm.
- `reminder.update` {matterId,reminderId,status:'approved'|'done'|'dismissed'} -> reminder. `approved` is the explicit human approval action for planner output.
- `planner.today` {matterId,timeZone?:IANA-zone} -> `{overdue:[],dueToday:[],dueIn7Days:[]}` from the injected local clock. It is local only and sends no notifications.
- `planner.propose` {matterId} -> deterministic local suggestions. Suggestions have `source:'planner'` and `status:'proposed'`; they are inactive until `reminder.update` explicitly approves them. Rules only inspect matter-local documents, saved answers, manually entered approved deadlines, and local activity; no model call or legal-deadline calculation occurs.

Root adds `engine.status`, `engine.initialize`, `engine.stop`. Corpus JSON at resources/legal-corpus.json: array `{id,title,authority,jurisdiction,practiceAreas,category,publishedAt,effectiveAt,amendedAt,version,article,url,retrievedAt,status,text,sha256,accessNote}`. IDs `MX-CCF-1796`, etc. State returns sources with metadata. Backend may add fields; notify other workers of changes. Dates/status must state snapshot validity unknown pending professional review, not claim currentness.

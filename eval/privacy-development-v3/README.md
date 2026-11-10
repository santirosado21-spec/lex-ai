# Synthetic privacy development v3

60 exposed Spanish development cases: 48 sensitive (four original cases for each of the 12 frozen categories), eight clean controls, and four blocked operational cases. Unique DEV3 template groups are reserved for this development set. Do not reuse these rows or templates as blinded acceptance.

All subjects, businesses, addresses, contact details, identifiers and case stories are invented. RFC/CURP/banking-like forms have no asserted registration or checksum validity. Zero-prefixed phone/account fixtures and .invalid/.test addresses are inert test data. The clean public institutional names, jurisdiction and legal titles are deliberate public-reference negatives under the guide. Text makes no substantive legal claim.

Annotations follow the frozen v2 guide. Ranges were calculated from marked spans with JavaScript string lengths on original text: UTF-16 half-open, with no normalization. Fixtures include a decomposed accent, emoji, punctuation, line breaks, grouped identifiers, four multi-segment envelopes and filename/history/metadata/schema/tool-result surfaces. Context examples deliberately combine uncommon invented facts; sensitive relationships use unnamed subjects to avoid silently missing nested personal-name spans. Dates essential to context remain inside that entity; preservation annotations only cover the explicitly marked clean date, amounts and citation.

Blocked rows carry explicit simulated local operational stimuli for unsupported format, partial extraction, ambiguity and processor failure. They do not infer blocking from document prose. The other two protocol reasons are not represented in this bounded development batch. Operational stimuli do not establish trusted extraction or permission for egress.

Validation executed during construction: projectPrivacyCase on all 60 rows; evaluateOperationalPreparation exactly matched each status/reason; coverage and nonempty UTF-16 ranges checked, including surrogate boundaries. Canonical validateCases from scripts/eval-privacy-v2.mjs also passed for all 60 cases (split: dev), after the coordinator explicitly authorized reading/importing evaluator code only. No detector or provider ran.

SHA-256 (cases.jsonl): 511f2da926df75a84a9624147d61bbff189bfa72cd5c931f71f437d41a83552d

See provenance.json for read boundaries and limitations. This set is development material, not blinded validation, real-client testing, 8 GB acceptance or legal/product approval.

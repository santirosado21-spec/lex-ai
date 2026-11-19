# Trade address / false-positive dev set v1 (DEV ONLY, measurement)

- Fully invented names, streets and companies. No real data. Not heldout; never combine with eval/privacy heldout.
- `dev-addresses-v1.jsonl`: 24 positives (foreign and Mexican addresses; with and without cue words, uppercase, multiline, inline in prose, pdf-items flattened) and 25 negatives (customs headers/lines that contain no personal data).
- Primary metric: STRICT span coverage, i.e. the union of detections must cover the whole address span. Overlap coverage is reported only as secondary.
- Negatives: any detection counts as a false positive (over-redaction).
- Residual check: masking the detections in the text and testing whether the address text is still present. This is a text proxy, NOT the cloud route; the route byte assertions are a separate harness.
- This set is a measurement, not acceptance, and was not used to tune any rule.

## Known limits of the metrics
- Route "token leak" ignores address tokens shorter than 4 characters (for example UK postcode halves such as "BS1" "4XY"), so it undercounts leakage. Strict span coverage is the primary metric.
- Negatives through the route are reported in three groups: sent unchanged, sent altered by masking (damaged document text) and blocked.
- Set written by one author, small, one style per country. Measurement only, not acceptance.

# Public cloud boundary for LEX AI

> Historical scope, updated 2026-11-05: the owner now accepts hybrid inference as described in [the private hybrid workspace proposal](hybrid-private-workspace-2026-11-05.md). That proposal supersedes this document's absolute local-inference restriction. The catalog declarations below remain public-only; this change does not add private storage tables, upload client documents or activate a cloud provider.

The owner explicitly expanded the desktop slice to a public landing, repository/deployment and product catalog. This does not move law-firm documents, client information, retrieval, model inference or feedback to the cloud. Desktop operation remains local. This change prepares only offline database declarations and curated product metadata; no project database or deployment service was contacted or changed; only public documentation was read.

## Allowed catalog

Three tables in `public`:

| Table | Meaning | Version prepared |
| --- | --- | --- |
| `product_app_releases` | App version, platform/architecture, digest, bytes, nullable download link | 0.3.0 historical and 0.3.1, macOS arm64 |
| `product_model_releases` | Optional experimental model version, digest, bytes, technical evaluation scope | v2-r2; separate manual Ollama import |
| `product_legal_library_snapshots` | Snapshot/index metadata and bounded coverage claims | v2; 303 instruments, 35,452 articles |

Common fields: `id`, `version`, `artifact_sha256`, `artifact_bytes` (Postgres bigint), `download_url` (nullable HTTPS), `release_status`, `legal_status`, `published`, `released_at`, `created_at`.

App fields: `platform`, `architecture`, `default_model_replaced=false`.

Model fields: `model_name`, `base_model`, `training_steps=400`, `behavior_cases=32`, `behavior_scope`, `installation=manual-separate-ollama-import`, `is_default=false`. Technical tests and a synthetic app flow do not establish legal accuracy or generalization. The selected version is v2-r2; the rejected v3 continuation is not seeded as a release.

Library fields: `corpus_sha256`, `instruments`, `articles`, `sample_audit_cases=910`, `currentness=unverified`, `coverage_scope`. These are a conservative subset and sample fidelity checks, not all Mexican law, complete article coverage or a guarantee of current law. The catalogue contains no legal article body text.

Digests and file sizes come from `artifacts/release-0.3.0.json` and the frozen public-library-v2 index manifest. The model archive is 14,372,300,800 bytes; the desktop DMG is 372,979,191 bytes; the public index is 153,014,272 bytes. This records local artifacts, not uploaded or downloadable assets. The seed deliberately has `download_url=NULL` and `published=false` for all rows. Artifact manifests contain local paths and operational detail and must not be copied wholesale into public tables; only the curated allowlist is used.

## Excluded data

No tables, fields, storage buckets or collection endpoints for leads, email addresses, accounts, law firms, clients, matters, documents, prompts, generated answers, feedback, training traces, access tokens or private hashes are introduced. No Auth/session dependency is added to the desktop. No model inference, document extraction, vector retrieval or client analytics is configured in Supabase or Vercel. Authentication/deployment configuration is a separate root-owned task; this catalog does not authorize broader data collection.

## Grants and RLS

Every catalog table enables and forces row-level security. All table privileges are revoked from `PUBLIC`, `anon` and `authenticated`, then only `SELECT` is granted to `anon` and `authenticated`. The sole policy is `FOR SELECT TO anon, authenticated USING (published = true)`. There are no client write policies, privileged functions, views, triggers or storage rules. `USAGE` on the existing public schema enables discovery without granting table writes. A privileged operator remains responsible for curation/publication; privileged server credentials are never shipped to the browser.

RLS filtering and table grants are independent requirements. These declarations follow the [official RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security). They are desired state rather than applied migrations, following the [declarative schema guide](https://supabase.com/docs/guides/local-development/declarative-database-schemas). Supabase's changelog markdown endpoint was attempted but the documentation tool rejected its content type; no changelog review is claimed. No remote MCP/browser/CLI retry was attempted after the existing access denial.

## Optional landing integration contract

The frontend may optionally receive a Supabase project URL and **publishable** client key through its build configuration. The root integrator chooses framework-specific environment variable names. Never place a service-role key, secret key or personal access token in public environment variables. Leave the integration disabled if either public configuration value is missing; do not trigger login or collect credentials from visitors.

Read-only queries should select explicit fields from the three tables, filter `published=eq.true`, order `released_at.desc` and limit to a small number (for example five). RLS independently enforces publication. Responses are arrays of the fields above. Do not query `*`, unrelated tables, profiles or user data. Use a short request timeout and avoid a retry loop.

Treat three outcomes distinctly:

- **No configured backend or network unavailable:** show the bundled curated product metadata as a dated local release snapshot, with a clear label that it is not a live catalog response.
- **Successful empty result:** show “No hay versiones publicadas en el catálogo.” Do not override this publication decision with unpublished rows presented as live releases.
- **Published metadata with NULL download URL:** show version, size, digest and experimental status; show “Descarga pública aún no disponible” and no active download link.

Only a non-null verified public HTTPS URL enables a download action. Neither a successful catalog fetch nor a `published=true` flag proves that a file exists at a URL. Display the digest for independent verification. Numeric file sizes currently fit JavaScript safe integers; do not coerce arbitrary future bigint values without range validation. All displayed text is plain text, not HTML.

## Verification status and remaining integration work

`npm test --prefix supabase/tests`: 14 tests/subtests passed locally, including real PostgreSQL execution in isolated in-memory PGlite 0.5.13. The tests create only ephemeral `anon`/`authenticated` roles, execute the declared schema and seed, confirm unpublished rows are invisible, publish synthetic fixtures, and verify each role sees only those fixtures. INSERT, UPDATE, DELETE, TRUNCATE and ALTER are denied on every catalog table; actual PostgreSQL ACLs contain no PUBLIC SELECT grant. Invalid hashes, sizes, URL schemes/credentials, legal-validation claims and default-model changes are rejected by CHECK constraints. Seed reruns preserve existing rows.

PGlite is a pinned test-only dependency under `supabase/tests/package.json` and its lockfile. No root app dependency, Docker, native database service, Supabase project, Auth/session or PostgREST endpoint was changed. The initial child-agent npm attempt failed DNS; the root installed the same pinned dependency, after which SQL tests ran locally. Native PostgreSQL executables remain unnecessary for this test path. See [PGlite's official in-memory PostgreSQL documentation](https://pglite.dev/docs/).

The static checks use a sanitized checked-in release-provenance fixture with source SHA and relative source path, plus the tracked library manifest in `resources`. They no longer require ignored release artifacts in a clean checkout. If the original release file is locally available, an additional check verifies its hash and curated fields; otherwise that optional check is skipped. The library fixture contains public metadata only.

This verifies PostgreSQL syntax, constraints and role behavior in PGlite; it does **not** verify a hosted Supabase deployment, role inheritance outside the declared test setup, exposed Data API schemas, gateway keys, JWT/Auth behavior or network access. Those target-environment checks remain necessary once remote access is authorized. No remote project identifier or migration application history was fabricated.

App 0.3.1 is now seeded from the verified tracked `docs/releases/0.3.1.json`: 375,055,123 bytes and SHA-256 `7e9f7b0779721a20086e4562140fe8db9530b533742df127a2dca6eaba894e6d`. Historical 0.3.0 remains intact. Both app rows are unpublished and have NULL download URLs.

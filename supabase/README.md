# Offline public product catalog

Prepared declaratively; **not applied to a hosted or persistent database**. The schema and seed were executed in an isolated in-memory PostgreSQL instance using PGlite 0.5.13 (WASM). No Supabase remote/CLI connection was attempted. Native `psql`, `postgres`, and `initdb` were not available on PATH; no Docker or database service was installed.

- `schemas/10_public_product_catalog.sql`: desired table, grant and RLS state.
- `catalog.seed.json`: curated metadata contract for inspection and a truthful local display fallback.
- `seed.sql`: equivalent inserts, intentionally `published=false`, `download_url=NULL`. Re-running does not overwrite existing rows.
- `tests/catalog-static.test.mjs`: checks declarations and seed facts against sanitized checked-in provenance; optionally cross-checks the original release when available.
- `tests/catalog-sql.test.mjs`: executes actual PostgreSQL DDL, seed, RLS, grants and constraints through in-memory PGlite.
- `tests/fixtures/release-0.3.0-provenance.json`: small curated release evidence with original relative source path and SHA-256; no home paths, endpoints or private data.

Install only test dependencies with `npm ci --prefix supabase/tests --ignore-scripts`, then run `npm test --prefix supabase/tests`. PGlite is pinned at 0.5.13 in this nested package and lockfile; the app has no new dependency. The local run passed 13 tests/subtests. These are real PostgreSQL engine tests, not hosted Supabase/PostgREST/Auth integration tests.

The deployer must inspect the installed Supabase CLI version/help and current declarative workflow before generating migrations from these schemas. No hand-authored migration, linked project ID, access token, database password or config claiming an existing project is included. After local/remote database use is authorized, generate and review the migration and repeat target-environment role/API tests: unpublished rows invisible to anon/authenticated, published rows visible, all client INSERT/UPDATE/DELETE/TRUNCATE rejected. Confirm grants and RLS in the target Data API configuration before publishing any row.

Only a privileged operator may deliberately mark curated rows published and later populate verified public HTTPS download URLs. Until then, a configured public API correctly returns zero rows. The landing must distinguish unavailable configuration, unavailable network, empty/unpublished catalog and actual downloadable releases. Never invent a download URL or display a download action for NULL.

See `docs/architecture/public-cloud-boundary.md` for scope and frontend contract.

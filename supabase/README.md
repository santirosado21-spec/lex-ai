# Offline public product catalog

Prepared declaratively; **not applied to a hosted or persistent database**. The schema and seed were executed in an isolated in-memory PostgreSQL instance using PGlite 0.5.13 (WASM). No Supabase remote/CLI connection was attempted. Native `psql`, `postgres`, and `initdb` were not available on PATH; no Docker or database service was installed.

- `schemas/10_public_product_catalog.sql`: desired table, grant and RLS state.
- `catalog.seed.json`: curated metadata contract for inspection and a truthful local display fallback.
- `seed.sql`: equivalent inserts, intentionally `published=false`, `download_url=NULL`. Re-running does not overwrite existing rows.
- `tests/catalog-static.test.mjs`: checks declarations and seed facts against sanitized checked-in provenance; optionally cross-checks the original release when available.
- `tests/catalog-sql.test.mjs`: executes actual PostgreSQL DDL, seed, RLS, grants and constraints through in-memory PGlite.
- `tests/fixtures/release-0.3.0-provenance.json`: small curated release evidence with original relative source path and SHA-256; no home paths, endpoints or private data.

Install only test dependencies with `npm ci --prefix supabase/tests --ignore-scripts`, then run `npm test --prefix supabase/tests`. PGlite is pinned at 0.5.13 in this nested package and lockfile; the app has no new dependency. The local run passed 15 tests/subtests. These are real PostgreSQL engine tests, not hosted Supabase/PostgREST/Auth integration tests.

The deployer must inspect the installed Supabase CLI version/help and current declarative workflow before generating migrations from these schemas. No hand-authored migration, linked project ID, access token, database password or config claiming an existing project is included. After local/remote database use is authorized, generate and review the migration and repeat target-environment role/API tests: unpublished rows invisible to anon/authenticated, published rows visible, all client INSERT/UPDATE/DELETE/TRUNCATE rejected. Confirm grants and RLS in the target Data API configuration before publishing any row.

Only a privileged operator may deliberately mark curated rows published and later populate verified public HTTPS download URLs. Until then, a configured public API correctly returns zero rows. The landing must distinguish unavailable configuration, unavailable network, empty/unpublished catalog and actual downloadable releases. Never invent a download URL or display a download action for NULL.

See `docs/architecture/public-cloud-boundary.md` for scope and frontend contract.

App rows include verified 0.3.1 from tracked `docs/releases/0.3.1.json` and historical 0.3.0. Both remain unpublished with NULL download URLs.

The latest seed also includes verified app 0.3.8 from tracked `docs/releases/0.3.8.json` (397,272,638 bytes; SHA-256 `d1a6b6e02775d7812203128fb74d08cb8986eff1b639c76d8cf8b310d90c1013`). Versions 0.3.0 and 0.3.1 remain intact. All three app rows are unpublished, have NULL download URLs and preserve the existing default model. No remote update was performed.

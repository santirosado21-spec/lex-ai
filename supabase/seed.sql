-- Curated local metadata; intentionally unpublished and no downloadable URLs.
-- Apply only after reviewed schema deployment. No private or operational data.
begin;
insert into public.product_app_releases (id, version, artifact_sha256, artifact_bytes, download_url, release_status, legal_status, published, released_at, platform, architecture, default_model_replaced)
values ('lex-ai-0.3.0-macos-arm64', '0.3.0', '58de3bfc32119f1fbf00db90c34b1770f2db94d31ff7889d15e64c8e56d5d83d', 372979191, null, 'experimental', 'not-validated', false, '2026-10-30T14:57:07.325452+00:00', 'macos', 'arm64', false)
on conflict (id) do nothing;

insert into public.product_model_releases (id, version, artifact_sha256, artifact_bytes, download_url, release_status, legal_status, published, released_at, model_name, base_model, training_steps, behavior_cases, behavior_scope, installation, is_default)
values ('lex-gemma4-v2-r2', 'v2-r2', '2b172c99001ab5de8e28ff9d469e0655101b559bcd36464ec2a4b364f84a558b', 14372300800, null, 'experimental', 'not-validated', false, '2026-10-30T14:57:07.325452+00:00', 'LEX Gemma 4 experimental v2-r2', 'Gemma 4 26B-A4B IT', 400, 32, 'Technical behavior checks on synthetic held-out cases; not legal accuracy, generalization or professional validation.', 'manual-separate-ollama-import', false)
on conflict (id) do nothing;

insert into public.product_legal_library_snapshots (id, version, artifact_sha256, artifact_bytes, download_url, release_status, legal_status, published, released_at, corpus_sha256, instruments, articles, sample_audit_cases, currentness, coverage_scope)
values ('lex-public-library-v2', 'v2', 'ec944a19d40be5faa0bd0ee081e906145038446aa8df394b706adc2daddd1588', 153014272, null, 'experimental', 'not-validated', false, '2026-10-30T14:57:07.325452+00:00', 'e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11', 303, 35452, 910, 'unverified', 'Conservative public source subset: 303 instruments and 35,452 articles. Sample fidelity audit only; no complete coverage or current-law guarantee.')
on conflict (id) do nothing;

insert into public.product_app_releases (id, version, artifact_sha256, artifact_bytes, download_url, release_status, legal_status, published, released_at, platform, architecture, default_model_replaced)
values ('lex-ai-0.3.1-macos-arm64', '0.3.1', '7e9f7b0779721a20086e4562140fe8db9530b533742df127a2dca6eaba894e6d', 375055123, null, 'experimental', 'not-validated', false, '2026-10-30T15:16:12.593901+00:00', 'macos', 'arm64', false)
on conflict (id) do nothing;

commit;

// Client-side syntactic validation of official-source links.
//
// Scope: this is a defensive consistency check for the UI (no link to an
// official source should look like a broken/incomplete https URL, and no
// link should silently carry embedded credentials). It is not a navigation
// policy and not a domain allowlist, and it does not claim any native
// WKWebView exploit; it only hardens what src/App.tsx (OfficialSource),
// src/SourcesView.tsx and src/PublicLibrary.tsx render as <a href>.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// --- Step 1: repro of the predicates previously used at the three call
// sites, copied verbatim in spirit from the source (before this change):
//   src/App.tsx:70        source.url && /^https:\/\//i.test(source.url)
//   src/SourcesView.tsx:78 /^https:\/\//i.test(entry.url)
//   src/PublicLibrary.tsx:19 source.url?.startsWith('https://')
// Both predicates only check a prefix; they do not parse the URL, so they
// accept strings that are not well-formed absolute https URLs.
const previousRegexPredicate = (url) => typeof url === 'string' && /^https:\/\//i.test(url);
const previousStartsWithPredicate = (url) => typeof url === 'string' && url.startsWith('https://');
const mustBeRejected = ['https://', 'https:///x', 'https://user:pass@host/x'];

test('repro: the previous prefix-only predicates wrongly accept incomplete/credentialed https strings', () => {
  for (const value of mustBeRejected) {
    const acceptedByRegex = previousRegexPredicate(value);
    const acceptedByStartsWith = previousStartsWithPredicate(value);
    // This assertion intentionally documents the bug: both previous
    // predicates accept these malformed values (true means "accepted").
    assert.equal(acceptedByRegex, true, `previous regex predicate unexpectedly rejected ${JSON.stringify(value)}`);
    assert.equal(acceptedByStartsWith, true, `previous startsWith predicate unexpectedly rejected ${JSON.stringify(value)}`);
  }
});

// --- Step 2+: the new shared helper, loaded the same way
// tests/dof-capture-url.test.mjs loads src/api.ts: transpile with the
// TypeScript compiler API and import the output through a data: URL.
const source = ts.transpileModule(
  readFileSync(new URL('../src/sourceUrl.ts', import.meta.url), 'utf8'),
  {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}},
).outputText;
let sequence = 0;
async function loadSourceUrlModule() {
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + sequence++);
}

test('validateOfficialSourceUrl accepts well-formed absolute https URLs (PDF, query, hash, state congress hosts)', async () => {
  const {validateOfficialSourceUrl} = await loadSourceUrlModule();
  const positives = [
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf?resaltar=articulo',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf#page=3',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf?v=2#page=12',
    'https://congresotabasco.gob.mx/leyes/lft.pdf',
    'https://www.congresoson.gob.mx:443/leyes/ley.pdf',
    'https://orden.jurídico.gob.mx/leyes/ley.pdf'.normalize(),
    'HTTPS://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
  ];
  for (const value of positives) {
    assert.equal(validateOfficialSourceUrl(value), value, `expected ${JSON.stringify(value)} to be accepted unchanged`);
  }
});

test('validateOfficialSourceUrl rejects non-strings, non-https schemes and protocol-relative values', async () => {
  const {validateOfficialSourceUrl} = await loadSourceUrlModule();
  const negatives = [
    '', null, undefined, 123, {}, [], true,
    'http://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    '//www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
    'HTTPS:/www.diputados.gob.mx/x',
  ];
  for (const value of negatives) {
    assert.equal(validateOfficialSourceUrl(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test('validateOfficialSourceUrl rejects incomplete https strings that a prefix-only check would accept', async () => {
  const {validateOfficialSourceUrl} = await loadSourceUrlModule();
  const negatives = [
    'https://',
    'https:///x',
    'https:////x',
    'https://?x=1',
    'https://#frag',
    'https:',
  ];
  for (const value of negatives) {
    assert.equal(validateOfficialSourceUrl(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test('validateOfficialSourceUrl rejects embedded userinfo (credentials in the URL)', async () => {
  const {validateOfficialSourceUrl} = await loadSourceUrlModule();
  const negatives = [
    'https://user:pass@host/x',
    'https://user@host/x',
    'https://:pass@host/x',
    'https://user:pass@www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
  ];
  for (const value of negatives) {
    assert.equal(validateOfficialSourceUrl(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test('validateOfficialSourceUrl rejects control characters and whitespace instead of silently trimming them', async () => {
  const {validateOfficialSourceUrl} = await loadSourceUrlModule();
  const negatives = [
    '\u00a0https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf\u2003',
    ' https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf ',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf\n',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf\t',
    'https://www.diputados.gob.mx\n/LeyesBiblio/pdf/LFT.pdf',
    'https://www.diputados.gob.mx\t/LeyesBiblio/pdf/LFT.pdf',
    'https://www.diputados.gob.mx\r/LeyesBiblio/pdf/LFT.pdf',
    'https://www.diputados.gob.mx/Leyes\u0000Biblio/pdf/LFT.pdf',
  ];
  for (const value of negatives) {
    assert.equal(validateOfficialSourceUrl(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test('validateOfficialSourceUrl rejects values that parse to an empty hostname and has no domain allowlist', async () => {
  const {validateOfficialSourceUrl} = await loadSourceUrlModule();
  assert.equal(validateOfficialSourceUrl('https:///'), null);
  // No allowlist: any well-formed absolute https URL on any host is accepted.
  assert.equal(validateOfficialSourceUrl('https://not-a-known-government-domain.example/x'), 'https://not-a-known-government-domain.example/x');
});

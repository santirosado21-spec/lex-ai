// Pure client-side syntactic validation for links to official sources.
//
// Scope and intent (see tests/source-url.test.mjs for the full rationale):
// - This is a defensive consistency check, not a navigation policy and not a
//   domain allowlist. It only rejects links that are not well-formed absolute
//   https URLs before they are rendered as an <a href>.
// - It does not assert that the underlying navigation surface (browser link,
//   WKWebView, etc.) is exploitable today; it only prevents the UI from
//   presenting a link that is syntactically incomplete or carries embedded
//   credentials (userinfo) as if it were a normal official source URL.
//
// Rejected unconditionally:
// - Anything that is not a non-empty string.
// - Any control character or whitespace (space, tab, CR, LF, other C0/DEL)
//   found anywhere in the raw value. These are rejected as-is: the value is
//   never silently trimmed before validation, because the WHATWG URL parser
//   itself strips/collapses some of these characters, which would otherwise
//   let a visibly malformed string parse into a different, "cleaned" URL.
// - Anything not starting with the literal scheme "https://" (case-insensitive).
// - A scheme immediately followed by an extra '/', '\\', '?' or '#' (e.g.
//   "https:///x"). The WHATWG URL parser treats consecutive slashes after
//   "https://" specially and happily resolves "https:///x" to hostname "x",
//   which would silently accept a malformed-looking URL.
// - Anything that fails to parse with the global URL constructor.
// - A parsed result whose protocol is not exactly "https:".
// - A parsed result with an empty hostname.
// - A parsed result carrying non-empty userinfo (username and/or password),
//   e.g. "https://user:pass@host/path".
//
// No domain allowlist and no global navigation policy are applied here: any
// well-formed absolute https URL, for any host, passes.
export function validateOfficialSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  // Reject embedded/leading/trailing control characters and whitespace
  // before any parsing happens; never trim silently.
  if (/[\s\x00-\x1f\x7f]/.test(value)) return null;
  if (!/^https:\/\//i.test(value)) return null;
  const afterScheme = value.slice('https://'.length);
  if (afterScheme.length === 0) return null;
  const firstChar = afterScheme[0];
  if (firstChar === '/' || firstChar === '\\' || firstChar === '?' || firstChar === '#') return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;
  if (parsed.username !== '' || parsed.password !== '') return null;
  return value;
}

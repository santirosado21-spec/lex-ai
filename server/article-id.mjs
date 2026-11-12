// Shared exact-reference grammar for Mexican article designators (artículo 26 Quáter,
// 18-H-Quáter, 14 Bis...). Single source of truth: public-library, state-library and
// the retrieval index MUST validate with the same pattern or a stored article becomes
// impossible to look up. Bounded: 1-6 digits, up to 4 dash suffixes of 1-16 chars each.
// Accented capitals are legitimate; articleCanonical folds diacritics so a normalized
// query ("26-QUATER") resolves the stored original ("26-QUÁTER") while display keeps
// the source form. Comparison is always on the canonical form, storage on the original.
export const ARTICLE_ID_PATTERN = /^\d{1,6}(?:-[A-Z0-9ÁÉÍÓÚÑ]{1,16}){0,4}$/;
export function articleCanonical(value) {
  return String(value).normalize('NFC').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

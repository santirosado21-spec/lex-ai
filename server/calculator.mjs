// Deterministic arithmetic for chat turns. A small model miscalculates (17×23
// came back as 371), so the result is computed here and handed to the model.
// No eval: a tiny parser for + - * / ( ) and decimals only.

const WORDS = [
  [/\bdividido\s+(?:entre|por)\b/g, '/'], [/\bentre\b/g, '/'], [/÷/g, '/'],
  [/\bmultiplicado\s+por\b/g, '*'], [/\bpor\b/g, '*'], [/[×x]/g, '*'],
  [/\bmas\b/g, '+'], [/\bmenos\b/g, '-'],
];
const ASKS = /\b(?:cuanto\s+(?:es|son|da|dan|sale)|calcula\w*|resultado|suma|resta|multiplica\w*|divide)\b|=\s*\??\s*$/;

function parse(expr) {
  let i = 0;
  const peek = () => expr[i], eat = c => { if (expr[i] === c) { i++; return true; } return false; };
  function number() {
    const m = /^\d+(?:\.\d+)?/.exec(expr.slice(i));
    if (!m) throw Error('number');
    i += m[0].length; return Number(m[0]);
  }
  function factor() {
    if (eat('-')) return -factor();
    if (eat('(')) { const v = sum(); if (!eat(')')) throw Error('paren'); return v; }
    return number();
  }
  function product() {
    let v = factor();
    for (;;) {
      if (eat('*')) v *= factor();
      else if (eat('/')) { const d = factor(); if (d === 0) throw Error('div0'); v /= d; }
      else return v;
    }
  }
  function sum() {
    let v = product();
    for (;;) { if (eat('+')) v += product(); else if (eat('-')) v -= product(); else return v; }
  }
  const value = sum();
  if (i !== expr.length || peek() !== undefined) throw Error('trailing');
  return value;
}

/** Returns {expression, value} when the turn asks for a calculation, else null. */
export function arithmeticResult(question) {
  if (typeof question !== 'string' || question.length > 300) return null;
  let q = question.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (!ASKS.test(q)) return null;
  q = q.replace(/(\d),(\d{3})\b/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2');
  for (const [re, op] of WORDS) q = q.replace(re, op);
  const candidates = q.match(/[\d(][\d\s.+\-*/()]*[\d)]/g) || [];
  for (const raw of candidates.sort((a, b) => b.length - a.length)) {
    const expr = raw.replace(/\s+/g, '');
    if (!/\d[+\-*/(]|[)\d][+\-*/]/.test(expr) || !/[+\-*/]/.test(expr.replace(/^-/, ''))) continue;
    try {
      const value = parse(expr);
      if (!Number.isFinite(value) || Math.abs(value) > 1e15) return null;
      const shown = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
      return { expression: expr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/(?<=\d|\))-/g, ' − '), value: shown };
    } catch { /* not a clean expression; try the next candidate */ }
  }
  return null;
}

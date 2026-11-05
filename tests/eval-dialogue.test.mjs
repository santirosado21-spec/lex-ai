import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCases, mechanicalChecks, parseJudge, swapFor, judge, summarizeChecks } from '../scripts/eval-dialogue.mjs';

const turn = (text, citations = 0) => ({ question: 'q', text, citations: Array.from({ length: citations }, (_, i) => ({ id: `S${i}` })) });

test('dialogue cases are valid, unique and synthetic-only by construction', async () => {
  const { cases, sha256 } = await loadCases();
  assert.ok(cases.length >= 30);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  assert.match(sha256, /^[a-f0-9]{64}$/);
  for (const c of cases) {
    assert.ok(Array.isArray(c.turns) && c.turns.length >= 1, c.id);
    assert.ok(c.expect && c.category, c.id);
    for (const i of [...(c.mustCiteTurns ?? []), ...(c.mustNotCiteTurns ?? [])]) assert.ok(i < c.turns.length, c.id);
  }
});

test('mechanical checks: exact, citations per turn, language and limits', () => {
  assert.deepEqual(mechanicalChecks({ exact: ['391'] }, [turn('391.')]), [{ name: 'exacto', pass: true }]);
  assert.equal(mechanicalChecks({ exact: ['391'] }, [turn('El resultado es 391')])[0].pass, false);
  assert.equal(mechanicalChecks({ exact: ['entendido'] }, [turn('Entendido.')])[0].pass, true);
  const cite = mechanicalChecks({ mustCiteTurns: [0], mustNotCiteTurns: [1] }, [turn('a', 1), turn('b', 1)]);
  assert.deepEqual(cite.map(c => c.pass), [true, false]);
  assert.equal(mechanicalChecks({ language: 'en' }, [turn('x'), turn('The best time to exercise is in the morning for you.')])[0].pass, true);
  assert.equal(mechanicalChecks({ language: 'en' }, [turn('x'), turn('La mejor hora es en la mañana para ti.')])[0].pass, false);
  assert.equal(mechanicalChecks({ maxWords: 3 }, [turn('uno dos tres cuatro')])[0].pass, false);
  assert.equal(mechanicalChecks({ contains: ['Raúl'] }, [turn('Te llamas raul')])[0].pass, true);
  assert.deepEqual(mechanicalChecks({}, [{ question: 'q', error: 'x' }]), [{ name: 'sin-error', pass: false }]);
});

test('judge output is parsed defensively', () => {
  const good = '{"A":{"naturalidad":4,"instrucciones":5,"fidelidad":3},"B":{"naturalidad":2,"instrucciones":2,"fidelidad":2},"preferida":"A","motivo":"m"}';
  assert.equal(parseJudge(`texto ${good} más`).preferida, 'A');
  assert.throws(() => parseJudge('sin json'));
  assert.throws(() => parseJudge('{"A":{"naturalidad":9,"instrucciones":5,"fidelidad":3}}'));
  assert.throws(() => parseJudge(good.replace('"A","motivo"', '"C","motivo"')));
});

test('blind assignment is deterministic and maps preferences back to run labels', async () => {
  assert.equal(swapFor('x', 's'), swapFor('x', 's'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lex-judge-'));
  const { cases } = await loadCases();
  const ids = cases.slice(0, 6).map(c => c.id);
  const mk = (label, text) => ({ label, results: ids.map(id => ({ id, category: 'c', turns: [turn(text)] })) });
  await writeFile(path.join(dir, 'a.json'), JSON.stringify(mk('base', 'mala')));
  await writeFile(path.join(dir, 'b.json'), JSON.stringify(mk('nuevo', 'buena')));
  // Fake judge always prefers the transcript that says "buena", wherever it is shown.
  const ask = async (_p, _m, req) => {
    const aIsGood = /=== Respuesta A ===[\s\S]*buena[\s\S]*=== Respuesta B ===/.test(req.context);
    const s = n => ({ naturalidad: n, instrucciones: n, fidelidad: n });
    return { answer: JSON.stringify({ A: s(aIsGood ? 5 : 1), B: s(aIsGood ? 1 : 5), preferida: aIsGood ? 'A' : 'B', motivo: 'm' }), observedModel: 'fake', usage: {} };
  };
  process.env.DSYSTEM_CONFIG_DIR = dir;
  const { report } = await judge({ a: path.join(dir, 'a.json'), b: path.join(dir, 'b.json'), resume: undefined, delayMs: 0, ask, outDir: dir });
  assert.equal(report.summary.wins.nuevo, ids.length);
  assert.equal(report.summary.scores.nuevo.naturalidad, 5);
  assert.equal(report.summary.scores.base.naturalidad, 1);
  assert.ok(report.judgements.some(j => j.swapped) && report.judgements.some(j => !j.swapped));
});

test('judge stops on quota errors without retrying and keeps progress', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lex-judge-q-'));
  const { cases } = await loadCases();
  await writeFile(path.join(dir, 'a.json'), JSON.stringify({ label: 'x', results: cases.slice(0, 3).map(c => ({ id: c.id, category: 'c', turns: [turn('t')] })) }));
  let calls = 0;
  const ask = async () => { calls++; const e = Error('429'); e.code = 'QUOTA_OR_RATE_LIMIT'; throw e; };
  process.env.DSYSTEM_CONFIG_DIR = dir;
  const { report } = await judge({ single: path.join(dir, 'a.json'), delayMs: 0, ask, outDir: dir });
  assert.equal(calls, 1);
  assert.equal(report.status, 'stopped-QUOTA_OR_RATE_LIMIT');
  assert.equal(report.judgements.length, 0);
});

test('check summary aggregates by category', () => {
  const s = summarizeChecks([{ category: 'a', turns: [{ elapsedMs: 5 }], checks: [{ pass: true }, { pass: false }] }]);
  assert.deepEqual(s.total, { checks: 2, passed: 1 });
  assert.equal(s.medianTurnMs, 5);
});

test('both-orders judging counts a win only when both orders agree', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lex-judge-both-'));
  const { cases } = await loadCases();
  const ids = cases.slice(0, 4).map(c => c.id);
  const mk = label => ({ label, results: ids.map(id => ({ id, category: 'c', turns: [turn(label)] })) });
  await writeFile(path.join(dir, 'a.json'), JSON.stringify(mk('uno')));
  await writeFile(path.join(dir, 'b.json'), JSON.stringify(mk('dos')));
  // Position-biased fake judge: always prefers whatever is shown as A.
  let calls = 0; const temps = [];
  const ask = async (_p, _m, _req, _s, opts) => { calls++; temps.push(opts.temperature); const s = n => ({ naturalidad: n, instrucciones: n, fidelidad: n }); return { answer: JSON.stringify({ A: s(5), B: s(1), preferida: 'A', motivo: 'm' }), observedModel: 'fake', usage: {} }; };
  process.env.DSYSTEM_CONFIG_DIR = dir;
  const { report } = await judge({ a: path.join(dir, 'a.json'), b: path.join(dir, 'b.json'), delayMs: 0, ask, outDir: dir, bothOrders: true });
  assert.equal(calls, ids.length * 2);
  assert.ok(temps.every(t => t === 0));
  assert.equal(report.summary.wins.empate, ids.length);
  assert.equal(report.summary.orderAgreement, `0/${ids.length}`);
});

/**
 * QA Honorarios HTTP — datos sintéticos, sin red externa ni modelos.
 * Real loopback HTTP and SQLite with an injected synthetic clock.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMockInference } from '../server/inference-mock.mjs';
import { createService } from '../server/service.mjs';
import { startServer } from '../server/main.mjs';
import {
  amountCentavos,
  roundBillingMinutes,
} from '../server/time-billing.mjs';

const ROOT = fileURLToPath(new URL('..',import.meta.url));

// Adapted from Orca Composer 2.5 synthetic HTTP QA, executed on 8214790.
// Real loopback transport and SQLite, injected synthetic service clock.
test('honorarios survive authenticated HTTP lifecycle, scope and restart', {timeout:30000}, async t=>{
const report = {
  sourceBase: '8214790',
  syntheticData: true,
  externalNetwork: false,
  modelInference: false,
  steps: [],
  failures: [],
  notTested: ['browser UI','model inference','legal or tax validity'],
};

function step(name, detail) {
  report.steps.push({ name, ...detail });
  console.error(`[${detail.ok === false ? 'FAIL' : 'OK'}] ${name}: ${JSON.stringify(detail)}`);
}

async function rawFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: Object.fromEntries(res.headers) };
}

async function boot(dataDir, clock) {
  const inference = createMockInference();
  inference.initialize=async()=>{throw Error('Model initialization forbidden in billing HTTP test');};
  inference.generate=async function*(){throw Error('Inference forbidden in billing HTTP test');};
  const service = await createService({
    dataDir,
    corpusPath: path.join(ROOT, 'resources/legal-corpus.json'),
    inference,
    clock,
    schedulerEnabled: false,
  });
  const app = await startServer({
    dataDir,
    inference,
    service,
    monitorDir: path.join(dataDir, 'monitor'),
    libraryPath: path.join(dataDir, 'missing-library.sqlite'),
  });
  const api = async (action, payload = {}, token = app.connection.token) => {
    const res = await rawFetch(`${app.connection.url}/api`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });
    return res;
  };
  t.after(()=>app.close());
  return { app, api, inference };
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'lex-qa-honorarios-'));
let current = new Date('2026-02-01T09:00:00.000Z');
const clock = () => new Date(current.getTime());
const setClock = (iso) => {
  current = new Date(iso);
};

let app;
let api;
let matterA;
let matterB;
let timerEntryId;
let pausedMatterId;

try {
  // --- 1) Sin token → 401 ---
  ({ app, api } = await boot(dataDir, clock));
  const noAuth = await rawFetch(`${app.connection.url}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'state', payload: {} }),
  });
  assert.equal(noAuth.status, 401);
  assert.match(noAuth.body?.error ?? '', /Sesión no autorizada/);
  step('1_sin_token_401', { http: 401, error: noAuth.body?.error, ok: true });

  // --- Setup workspace y asuntos ---
  let r = await api('workspace.create', { name: 'Despacho QA honorarios', practiceAreas: ['civil'] });
  assert.equal(r.status, 200);
  r = await api('matter.create', {
    title: 'Asunto A honorarios',
    client: 'Cliente sintético A',
    jurisdiction: 'MX-FED',
  });
  assert.equal(r.status, 200);
  matterA = r.body;
  r = await api('matter.create', {
    title: 'Asunto B aislado',
    client: 'Cliente sintético B',
    jurisdiction: 'MX-FED',
  });
  assert.equal(r.status, 200);
  matterB = r.body;

  // --- 2) Acuerdo, temporizador completo, listar ---
  const RATE = 12_000;
  const INCR = 6;
  r = await api('billing.arrangement.set', {
    matterId: matterA.id,
    arrangement: 'hourly',
    hourlyRateCentavos: RATE,
    billingIncrementMinutes: INCR,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.arrangement, 'hourly');
  assert.equal(r.body.hourlyRateCentavos, RATE);
  assert.equal(r.body.billingIncrementMinutes, INCR);

  r = await api('time.start', { matterId: matterA.id, description: 'Revisión sintética QA' });
  assert.equal(r.status, 200);
  assert.equal(r.body.state, 'running');

  setClock('2026-02-01T09:10:31.000Z');
  r = await api('time.pause', { matterId: matterA.id });
  assert.equal(r.status, 200);
  assert.equal(r.body.state, 'paused');
  assert.equal(r.body.runningMinutes, 11);

  setClock('2026-02-01T11:00:00.000Z');
  r = await api('time.resume', { matterId: matterA.id });
  assert.equal(r.status, 200);
  assert.equal(r.body.state, 'running');

  setClock('2026-02-01T11:20:00.000Z');
  r = await api('time.stop', { matterId: matterA.id });
  assert.equal(r.status, 200);
  const stopped = r.body;
  timerEntryId = stopped.id;

  r = await api('time.list', { matterId: matterA.id });
  assert.equal(r.status, 200);
  assert.ok(r.body.some((e) => e.id === timerEntryId));
  const activeAfterStop = await api('time.active');
  assert.equal(activeAfterStop.status, 200);
  assert.equal(activeAfterStop.body, null);

  step('2_temporizador_completo', {
    http: 200,
    durationMinutes: stopped.durationMinutes,
    billedMinutes: stopped.billedMinutes,
    amountCentavos: stopped.amountCentavos,
    listCount: r.body.length,
    ok: true,
  });

  // --- 3) Política de redondeo ---
  const expectedBilled = roundBillingMinutes(stopped.durationMinutes, INCR);
  const expectedAmount = amountCentavos(expectedBilled, RATE);
  assert.equal(stopped.durationMinutes, 31);
  assert.equal(stopped.billedMinutes, expectedBilled);
  assert.equal(stopped.billedMinutes, 30);
  assert.equal(stopped.amountCentavos, expectedAmount);
  assert.equal(stopped.amountCentavos, 6000);
  step('3_redondeo_politica', {
    duration: 31,
    billed: stopped.billedMinutes,
    amountCentavos: stopped.amountCentavos,
    policy: 'half-up increment 6, rate 12000',
    ok: true,
  });

  // Entradas manuales con caracteres CSV peligrosos
  for (const desc of ['=SUM(A1:A2)', '+inyeccion', '-resta', '@aroba']) {
    r = await api('time.create', {
      matterId: matterA.id,
      minutes: 6,
      description: desc,
      billable: false,
    });
    assert.equal(r.status, 200);
  }

  // --- 4) CSV BOM y escape ---
  r = await api('billing.exportCsv', { matterId: matterA.id });
  assert.equal(r.status, 200);
  const csv = Buffer.from(r.body.base64, 'base64');
  assert.ok(csv[0] === 0xef && csv[1] === 0xbb && csv[2] === 0xbf, 'BOM UTF-8');
  const csvText = csv.toString('utf8');
  for (const token of ["'=SUM(A1:A2)", "'+inyeccion", "'-resta", "'@aroba"]) {
    assert.ok(csvText.includes(token), `falta escape para ${token}`);
  }
  step('4_csv_bom_escape', {
    http: 200,
    bom: true,
    escapedPrefixes: ["'=SUM", "'+", "'-", "'@"],
    filename: r.body.name,
    ok: true,
  });

  // --- 5) Aislamiento por asunto ---
  r = await api('time.list', { matterId: matterB.id });
  assert.equal(r.status, 200);
  assert.equal(
    r.body.some((e) => e.id === timerEntryId),
    false,
    'asunto B no debe ver entradas de A',
  );
  assert.equal(r.body.length,0);
  step('5_aislamiento_asunto', {
    matterA: matterA.id,
    matterB: matterB.id,
    entriesInB: r.body.length,
    leaked: false,
    ok: true,
  });

  // Aislamiento por despacho (otro LEX_DATA_DIR)
  const otherDir = await mkdtemp(path.join(os.tmpdir(), 'lex-qa-otro-despacho-'));
  let other;
  t.after(async()=>{await other?.app.close();await rm(otherDir,{recursive:true,force:true});});
  other = await boot(otherDir, clock);
  const denyWorkspace = await other.api('workspace.create', {
    name: 'Otro despacho',
    practiceAreas: ['civil'],
  });
  assert.equal(denyWorkspace.status, 200);
  const otherMatter = await other.api('matter.create', {
    title: 'Asunto otro despacho',
    client: 'Cliente otro',
    jurisdiction: 'MX-FED',
  });
  assert.equal(otherMatter.status,200);
  const otherList = await other.api('time.list', { matterId: otherMatter.body.id });
  assert.equal(otherList.status, 200);
  assert.equal(otherList.body.length, 0);
  const wrongToken=await api('time.list',{matterId:matterA.id},other.app.connection.token);
  assert.equal(wrongToken.status,401);
  const foreignMatter=await other.api('time.list',{matterId:matterA.id});
  assert.notEqual(foreignMatter.status,200);
  await other.app.close();
  await rm(otherDir, { recursive: true, force: true });
  step('5_aislamiento_despacho', {
    otherDataDir: otherDir,
    entriesInOther: otherList.body.length,
    ok: true,
  });

  // PR23 through the real HTTP boundary: active fragments, not elapsed wall time.
  for(const seconds of [29,31]){
    await api('billing.arrangement.set',{matterId:matterA.id,arrangement:'hourly',hourlyRateCentavos:12000,billingIncrementMinutes:1});
    let now=Date.parse('2026-02-01T09:00:00Z');setClock(new Date(now));
    assert.equal((await api('time.start',{matterId:matterA.id,description:'Fragmentos HTTP'})).status,200);
    for(let segment=0;segment<4;segment++){
      now+=seconds*1000;setClock(new Date(now));
      if(segment<3){assert.equal((await api('time.pause',{matterId:matterA.id})).status,200);now+=60000;setClock(new Date(now));assert.equal((await api('time.resume',{matterId:matterA.id})).status,200);}
    }
    const result=await api('time.stop',{matterId:matterA.id});assert.equal(result.status,200);
    assert.equal(result.body.durationMinutes,2);assert.equal(result.body.billedMinutes,2);assert.equal(result.body.amountCentavos,400);
  }
  step('PR23_fragmentos_HTTP',{segments:'4x29s and 4x31s',durationMinutes:2,amountCentavos:400,ok:true});
  setClock('2026-02-01T11:20:00.000Z');

  // --- 5b) Cierre por asunto (resolution.close) ---
  r = await api('resolution.close', {
    matterId: matterA.id,
    outcome: 'acuerdo',
    date: '2026-02-10',
    notes: 'Cierre sintético QA.',
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'resuelto');
  assert.equal(r.body.outcome, 'acuerdo');
  step('5b_cierre_asunto', { http: 200, status: r.body.status, outcome: r.body.outcome, ok: true });

  // Pausar temporizador en asunto B para prueba de persistencia
  r = await api('time.start', { matterId: matterB.id, description: 'Timer persistencia' });
  assert.equal(r.status, 200);
  setClock('2026-02-01T12:05:00.000Z');
  r = await api('time.pause', { matterId: matterB.id });
  assert.equal(r.status, 200);
  assert.equal(r.body.state, 'paused');
  pausedMatterId = matterB.id;
  const pausedSnapshot = r.body;
  assert.equal(pausedSnapshot.runningMinutes,45);

  // Cerrar servidor (simula apagado)
  await app.close();
  app = null;

  // --- 6) Reinicio con mismo LEX_DATA_DIR ---
  ({ app, api } = await boot(dataDir, clock));
  r = await api('time.active');
  assert.equal(r.status, 200);
  assert.ok(r.body, 'temporizador pausado debe persistir');
  assert.equal(r.body.matterId, pausedMatterId);
  assert.equal(r.body.state, 'paused');
  assert.equal(r.body.runningMinutes, pausedSnapshot.runningMinutes);

  r = await api('time.list', { matterId: matterA.id });
  assert.equal(r.status, 200);
  assert.ok(r.body.some((e) => e.id === timerEntryId), 'entrada detenida persiste');

  r = await api('resolution.get', { matterId: matterA.id });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'resuelto');

  const listAfterRestart = await api('time.list', { matterId: matterA.id });
  const activeAfterRestart = await api('time.active');
  const resolutionAfterRestart = await api('resolution.get', { matterId: matterA.id });
  step('6_persistencia_reinicio', {
    pausedTimer: {
      matterId: activeAfterRestart.body?.matterId,
      state: activeAfterRestart.body?.state,
      runningMinutes: activeAfterRestart.body?.runningMinutes,
    },
    persistedEntries: listAfterRestart.body.length,
    timerEntryStillPresent: listAfterRestart.body.some((e) => e.id === timerEntryId),
    resolutionStatus: resolutionAfterRestart.body?.status,
    ok: true,
  });

  assert.equal(listAfterRestart.body.length,7);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failures.push({ message: error.message, stack: error.stack });
  throw error;
} finally {
  await app?.close();
  await rm(dataDir, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  t.diagnostic(JSON.stringify(report));
}
});

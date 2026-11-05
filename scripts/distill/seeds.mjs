#!/usr/bin/env node
/**
 * Synthetic seed conversations for distillation, written by the teacher.
 *   node scripts/distill/seeds.mjs --out artifacts/distill/seeds-pilot.jsonl --scale 1
 * Only allowed (train-split, non-sealed) laws are named. Seeds that resemble a
 * held-out dialogue case are dropped. No real people or client data.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askKimi, unfence } from './teacher.mjs';
import { lawPolicy } from './laws.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP_LIBRARY = '/Applications/LEX AI.app/Contents/Resources/app/resources/public-library.sqlite';
const fold = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Words too common to signal a copied case (question words, legal boilerplate).
const COMMON = new Set('articulo articulos explica explicame establece cuales cuando donde quiero puedes ayudame necesito sobre tengo tiene pueden puede segun hola gracias favor porque entonces tambien despues antes ahora mismo todos todas solo nada algo cosas ejemplo seria estoy estas esto esta este estas eres somos digo dijo dime hacer haces hace cuento cuenta mucho mucha muchos poco trabajo derecho legal juridico ley leyes codigo federal general'.split(' '));
const distinctive = s => new Set((fold(s).match(/\p{L}{5,}/gu) || []).filter(w => !COMMON.has(w)));
/** A seed leaks a held-out case when it shares 3+ distinctive words with it. */
export function sharedDistinctive(a, b) { const A = distinctive(a), B = distinctive(b); return [...A].filter(x => B.has(x)).length; }
export const leaksHeldOut = (text, held) => held.some(h => sharedDistinctive(text, h) >= 3);

const CATEGORIES = [
  { id: 'articulo', n: 20, brief: 'Preguntas directas sobre un artículo concreto de una de estas leyes, citando la ley por su nombre y un número de artículo plausible (1 a 120). Variar el registro: «¿qué dice…?», «explícame…», «¿qué establece…?», «como si no fuera abogado».', laws: true },
  { id: 'situacion', n: 20, brief: 'Situaciones reales contadas en lenguaje cotidiano por personas sin formación jurídica, cada una dentro del ámbito de UNA de estas leyes y nombrándola o dejando claro el tema (consumidor, seguros, sociedades, impuesto sobre la renta, derechos de autor, propiedad industrial, migración, delitos federales, asuntos agrarios, servicios financieros).', laws: true },
  { id: 'faltan-hechos', n: 10, brief: 'Preguntas jurídicas a las que les falta un dato que cambia la respuesta (estado, fechas, montos, tipo de contrato, si hubo aviso). Deben ser del ámbito de estas leyes.', laws: true },
  { id: 'abstencion', n: 8, brief: 'Peticiones que el asistente NO puede fundamentar: artículos con números que no existen (por ejemplo 4.000 o más) de estas leyes, leyes de un estado concreto, una tesis de la Suprema Corte por número de registro, o leyes futuras. Variado.', laws: true },
  { id: 'seguimiento', n: 12, brief: 'Conversaciones de 2 o 3 turnos: primero una pregunta sobre un artículo o situación de estas leyes; después seguimientos como «¿y el siguiente?», «más corto», «dame un ejemplo», «¿y si fuera una empresa?», o un cambio de tema a charla.', laws: true, multi: true },
  { id: 'charla', n: 20, brief: 'Charla normal con un abogado o abogada que usa el asistente: desahogos («solo quiero platicar»), saludos, dato curioso pedido explícitamente, ideas creativas, instrucciones exactas («responde solo con…», «en inglés», «tres ideas sin explicación»), recordar algo que dijo antes, cambios de tema. Sin preguntas jurídicas.', laws: false, multi: true },
];

function seedPrompt(cat, lawTitles, n) {
  return `Genera ${n} conversaciones de prueba SINTÉTICAS en español de México para entrenar a un asistente jurídico conversacional llamado LEX AI.
Tipo: ${cat.brief}
${cat.laws ? `Leyes permitidas (usa solo estas; no menciones la Constitución, la Ley Federal del Trabajo, el Código Civil Federal, el Código de Comercio, el Código Fiscal, la Ley de Amparo, la Ley del Seguro Social, el CNPP, el CNPCF ni la Ley Federal de Procedimiento Administrativo):\n${lawTitles.join('\n')}\n` : ''}${cat.multi ? 'Cada conversación tiene 2 o 3 turnos del usuario.' : 'Cada conversación tiene 1 turno del usuario.'}
Reglas: nombres y situaciones ficticios; nada de personas reales ni datos de clientes; varía longitud, tono y vocabulario; no repitas estructuras.
Devuelve SOLO JSON: {"items":[{"turns":["mensaje del usuario 1", "..."]}]}`;
}

export function parseSeeds(text, cat) {
  const parsed = JSON.parse(unfence(text));
  if (!Array.isArray(parsed.items)) throw Error('Sin items');
  return parsed.items.filter(it => Array.isArray(it.turns) && it.turns.length >= 1 && it.turns.length <= 3 && it.turns.every(t => typeof t === 'string' && t.trim().length >= 3 && t.length <= 600))
    .map(it => ({ category: cat, turns: it.turns.map(t => t.trim()) }));
}

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' }, scale: { type: 'string' }, model: { type: 'string' }, only: { type: 'string' }, append: { type: 'boolean' } } });
  const out = path.resolve(values.out || 'artifacts/distill/seeds-pilot.jsonl');
  const scale = Number(values.scale || 1);
  const { openPublicLibrary } = await import(path.join(ROOT, 'server/public-library.mjs'));
  const library = await openPublicLibrary(APP_LIBRARY);
  const { allowed } = await lawPolicy(library);
  library.close();
  const titles = allowed.filter(l => l.articles >= 40).sort((a, b) => b.articles - a.articles).slice(0, 60).map(l => l.title.replace(/\s+/g, ' ').trim());
  const held = (await readFile(path.join(ROOT, 'eval/dialogue/cases.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l).turns.join(' '));
  const seeds = [], log = [];
  for (const cat of CATEGORIES.filter(c => !values.only || values.only.split(',').includes(c.id))) {
    const n = Math.max(1, Math.round(cat.n * scale));
    // Rotate a different slice of law titles per batch for variety.
    const sample = [...titles].sort(() => Math.random() - 0.5).slice(0, 25);
    try {
      const { answer, model } = await askKimi(seedPrompt(cat, sample, n), { model: values.model });
      const items = parseSeeds(answer, cat.id);
      const kept = items.filter(it => !leaksHeldOut(it.turns.join(' '), held));
      log.push({ category: cat.id, asked: n, received: items.length, kept: kept.length, model });
      seeds.push(...kept);
      process.stderr.write(`${cat.id}: ${kept.length}/${items.length}\n`);
    } catch (e) { log.push({ category: cat.id, error: e.code || 'ERROR', message: e.message }); process.stderr.write(`${cat.id}: ERROR ${e.message}\n`); if (e.code === 'QUOTA_OR_RATE_LIMIT') break; }
  }
  await mkdir(path.dirname(out), { recursive: true });
  const previous = values.append ? (await readFile(out, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const all = [...previous, ...seeds.map(s => ({ ...s }))];
  await writeFile(out, all.map((s, i) => JSON.stringify({ ...s, id: s.id || `${s.category}-${String(i + 1).padStart(4, '0')}` })).join('\n') + '\n');
  await writeFile(out.replace(/\.jsonl$/, values.append ? `.log-${Date.now()}.json` : '.log.json'), JSON.stringify({ createdAt: new Date().toISOString(), synthetic: true, teacher: 'kimi', log }, null, 2) + '\n');
  console.log(JSON.stringify({ out, seeds: seeds.length, log }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });

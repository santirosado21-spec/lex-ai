#!/usr/bin/env node
// One synthetic development check. This file is never imported by the product.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const MODEL = 'gpt-6-luna';
export const KEYCHAIN_SERVICE = 'Rejon.AI.dev.openai';
export const PRICES_PER_MILLION = Object.freeze({input: 0.10, output: 0.50});

export function smokeRequest() {
  return {
    model: MODEL,
    input: 'Dato de prueba inventado. Responde sólo con la palabra LISTO.',
    instructions: 'Este es un chequeo técnico con texto sintético. No uses herramientas.',
    store: false,
    reasoning: {effort: 'none'},
    max_output_tokens: 64,
  };
}

export function summarize(response) {
  if (response?.model !== MODEL || response?.status !== 'completed') throw Error('Modelo o estado inesperado.');
  if (typeof response.id !== 'string' || !/^resp_[A-Za-z0-9_-]+$/.test(response.id)) throw Error('Falta ID de respuesta verificable.');
  const {input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens} = response.usage || {};
  if (![inputTokens, outputTokens, totalTokens].every(value => Number.isSafeInteger(value) && value >= 0) || totalTokens !== inputTokens + outputTokens) throw Error('Falta usage verificable.');
  if (!Array.isArray(response.output) || response.output.some(item => !['message', 'reasoning'].includes(item.type))) throw Error('Salida no textual o inesperada.');
  const answer = response.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === 'output_text').map(item => item.text).join('').trim();
  if (answer !== 'LISTO') throw Error('La respuesta del chequeo no cumplió el formato.');
  return {responseId: response.id, requestedModel: MODEL, observedModel: response.model, status: response.status,
    usage: {inputTokens, outputTokens, totalTokens},
    estimatedUsdUpperBound: (inputTokens * PRICES_PER_MILLION.input + outputTokens * PRICES_PER_MILLION.output) / 1_000_000,
    answer};
}

export async function checkModelAccess(token, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.openai.com/v1/models/${MODEL}`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: {'Authorization': `Bearer ${token}`, 'Accept': 'application/json'},
  });
  if (!res.ok) throw Error(`GET HTTP ${res.status}; no se imprime el cuerpo remoto ni se reintenta.`);
  const data = await res.json();
  if (data?.id !== MODEL) throw Error('El catálogo no confirmó el modelo solicitado.');
  return {authenticated: true, modelAvailable: true, model: MODEL};
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.length !== 1 || !['--dry-run', '--auth', '--live'].includes(flags[0])) throw Error('Usa --dry-run, --auth o --live.');
  const body = smokeRequest();
  if (flags[0] === '--dry-run') { console.log(JSON.stringify({sent: false, body}, null, 2)); return; }
  const found = spawnSync('security', ['find-generic-password', '-a', 'rejon-ai-development', '-s', KEYCHAIN_SERVICE, '-w'], {encoding: 'utf8', timeout: 10000});
  if (found.status !== 0 || !found.stdout?.trim()) throw Error('No se encontró la clave de desarrollo en Keychain.');
  const token = found.stdout.trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(token)) throw Error('Formato de clave inesperado.');
  const access = await checkModelAccess(token);
  if (flags[0] === '--auth') { console.log(JSON.stringify(access)); return; }
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
    headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw Error(`HTTP ${res.status}; no se imprime el cuerpo remoto ni se reintenta.`);
  const result = summarize(await res.json());
  console.log(JSON.stringify({...result, elapsedMs: Date.now() - started}, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : '';
    const safe = /^(No se encontró la clave de desarrollo en Keychain\.|Formato de clave inesperado\.|Modelo o estado inesperado\.|Falta ID de respuesta verificable\.|Falta usage verificable\.|Salida no textual o inesperada\.|La respuesta del chequeo no cumplió el formato\.|El catálogo no confirmó el modelo solicitado\.|(?:GET )?HTTP [0-9]{3}; no se imprime el cuerpo remoto ni se reintenta\.)$/.test(message);
    console.error(safe ? message : 'El chequeo no se completó; no se muestran credenciales ni cuerpo remoto.');
    process.exitCode = 1;
  });
}

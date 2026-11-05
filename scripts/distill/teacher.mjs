// Development-only teacher calls for distillation. Never imported by the app.
// Kimi runs with a tool-less agent profile in an empty directory: it can only
// return text. Inputs must be synthetic or public legal text.
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(HERE, 'kimi-textonly.md');
const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:xai-|hf_|gsk_|sk-or-v1-|sk_live_)[A-Za-z0-9_-]{12,}|\bsk-[A-Za-z0-9_-]{20,}/;

export class TeacherError extends Error { constructor(code, message) { super(message); this.code = code; } }

let sandbox;
export async function askKimi(prompt, { model = 'kimi-code/k3', timeoutMs = 240000, spawnImpl = spawn } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 60000) throw new TeacherError('INVALID_PROMPT', 'Encargo vacío o demasiado largo.');
  if (SECRET.test(prompt)) throw new TeacherError('SUSPECTED_SECRET', 'El encargo parece contener una credencial; no se envió.');
  sandbox ??= await mkdtemp(path.join(os.tmpdir(), 'lex-kimi-'));
  return new Promise((resolve, reject) => {
    const child = spawnImpl('kimi', ['--agent-file', PROFILE, '-m', model, '--output-format', 'stream-json', '-p', prompt], { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new TeacherError('TIMEOUT', 'El maestro no respondió a tiempo; sin reintentos.')); }, timeoutMs);
    child.stdout.on('data', d => { out += d; if (out.length > 2_000_000) child.kill('SIGTERM'); });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(new TeacherError('UNAVAILABLE', `No se pudo ejecutar kimi: ${e.message}`)); });
    child.on('close', code => {
      clearTimeout(timer);
      const messages = out.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
      const answer = messages.filter(m => m.role === 'assistant' && typeof m.content === 'string').map(m => m.content).at(-1);
      if (answer?.trim()) return resolve({ answer: answer.trim(), model });
      const quota = /quota|rate limit|429|exceeded|insufficient/i.test(err + out);
      reject(new TeacherError(quota ? 'QUOTA_OR_RATE_LIMIT' : 'EMPTY_RESPONSE', `kimi terminó con código ${code} sin respuesta utilizable.`));
    });
  });
}

/** Strip a ```json fence if the teacher added one; never repairs JSON grammar. */
export function unfence(text) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

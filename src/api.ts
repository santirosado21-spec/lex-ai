export interface MatterTask { id:string; matterId:string; workspaceId:string; title:string; note:string; plannedDate:string|null; status:'pending'|'completed'; createdAt:string; updatedAt:string; completedAt:string|null; history:{event:string;at:string}[] }
export interface Matter { id: string; title: string; client: string; jurisdiction: string }
export interface DocumentRecord { id: string; matterId: string; name: string; characters: number; createdAt: string }
export interface Source { id?: string; sourceId?: string; title?: string; authority?: string; jurisdiction?: string; category?: string; article?: string; url?: string; text?: string; quote?: string; version?: string; amendedAt?: string; retrievedAt?: string; status?: string; name?: string; documentId?: string }
export interface Answer { id: string; matterId: string; threadId?: string; kind?: 'chat' | 'grounded'; workspaceId?: string; editedDraft?:{id:string;version:number;title:string;originalHash:string}; question?: string; text: string; citations: Source[]; createdAt: string; validation?: Record<string, unknown> }
export interface Feedback { id: string; answerId: string; matterId: string; rating: string; comment: string; createdAt?: string }
export interface Proposal { history?: {event:string;at:string}[]; matterId?: string; id: string; feedbackId: string; status: string; text?: string; content?: string; candidate?: string; version?: number; evaluation?: Record<string, unknown>; createdAt?: string }
export interface Skill { id: string; name: string; description: string; version?: string; supportedJurisdictions?: string[]; jurisdictions?: string[] }
export interface ReplyDraftSummary {id:string;replyId:string;matterId:string;version:number;current:{title:string;text:string}}
export interface AppState { workspace: null | { id: string; name: string; practiceAreas: string[] }; matters: Matter[]; documents: DocumentRecord[]; answers: Answer[]; chatTurns: Answer[]; drafts?: ReplyDraftSummary[]; feedback: Feedback[]; proposals: Proposal[]; tasks: MatterTask[]; skills: Skill[]; sources: Source[] }
export interface EngineStatus { state?: string; status?: string; model?: string; message?: string; error?: string; progress?: number | string; supported?: boolean; ready?: boolean; hardware?: { platform?: string; arch?: string; memoryGB?: number; totalMemoryGB?: number }; [key: string]: unknown }
export const emptyState: AppState = { workspace: null, matters: [], documents: [], answers: [], chatTurns: [], feedback: [], proposals: [], tasks: [], skills: [], sources: [] };
let connection: Promise<{ url: string; token: string }> | null = null;
async function getConnection() {
  if (!connection) connection = (async () => {
    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<{url: string; token: string}>('connection');
    }
    const hash = window.location.hash.slice(1);
    const token = new URLSearchParams(hash).get('token') || (hash && !hash.includes('=') ? hash : '');
    return { url: '', token };
  })();
  return connection;
}
async function request(path: string, body: unknown, signal?: AbortSignal) {
  const { url, token } = await getConnection();
  if (!token) throw new Error('No se recibió la clave de esta sesión. Abre LEX AI desde su lanzador local.');
  const response = await fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(error.error || error.message || `El servicio local respondió con el código ${response.status}.`);
  }
  return response;
}
export async function api<T = unknown>(action: string, payload: unknown = {}): Promise<T> {
  try { return await (await request('/api', { action, payload })).json() as T; }
  catch (error) {
    // Keep runtime diagnostics out of product UI, including errors thrown during setup.
    if (action.startsWith('engine.')) throw new Error('No se pudo completar la operación de LEX AI. Actualiza el estado y vuelve a intentarlo.');
    throw error;
  }
}
export async function analyze(payload: unknown, onToken: (text: string) => void, signal?: AbortSignal): Promise<Answer> {
  const response = await request('/analyze', payload, signal);
  if (!response.body) throw new Error('El motor no devolvió una respuesta.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let answer: Answer | undefined;
  function process(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as {type: string; text?: string; data?: Answer; message?: string};
    if (event.type === 'error') throw new Error(event.message || 'No se pudo verificar la respuesta.');
    if (event.type === 'token') onToken(event.text || '');
    if (event.type === 'result') answer = event.data;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n'); pending = lines.pop() || '';
      lines.forEach(process);
    }
    pending += decoder.decode();
    process(pending);
  } finally { reader.releaseLock(); }
  if (!answer) throw new Error('La respuesta terminó antes de completar su validación.');
  return answer;
}
export async function fileBase64(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('El límite por documento es de 10 MB.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
  });
}
export function downloadFile(file: {name: string; base64: string; mime: string}) {
  const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type: file.mime}));
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SourceCatalogEntry { id: string; title: string; url: string; jurisdiction: string }
export interface SourceSyncEntry extends SourceCatalogEntry {
  state: string; checkedAt?: string; lastSuccessAt?: string; httpStatus?: number; sha256?: string;
  bytes?: number; versionId?: string; reviewStatus?: string; snapshotPath?: string; error?: string; attempts?: number;
}
export interface SourcesStatus {
  catalog: SourceCatalogEntry[];
  corpus: { articles: number; laws: number };
  sync: null | {
    schemaVersion: number; state: string; startedAt?: string; finishedAt?: string; nextCheckAfter?: string;
    summary: { total: number; downloaded: number; unchanged: number; failed: number; quarantined: number };
    sources: SourceSyncEntry[];
  };
  monitor: null | {
    state: string; phase?: string; startedAt?: string; heartbeatAt?: string; nextRunAt?: string;
    cyclesCompleted?: number; consecutiveFailures?: number; lastCycle?: Record<string, unknown>;
  };
}

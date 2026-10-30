import type { AppState, Matter } from './api.ts';

export interface DashboardMatter extends Matter {
  documents: number;
  answers: number;
  totalTasks: number;
  completed: number;
  pending: number;
  /** Percentage 0..100; null means no tasks, not zero performance. */
  completionRate: number | null;
}
export interface DashboardWeek {
  key: string;
  label: string;
  start: string;
  end: string;
  opened: number;
  completed: number;
}
export interface DashboardActivity {
  id: string;
  matterId: string;
  matterTitle: string;
  kind: 'document' | 'answer' | 'task-created' | 'task-completed' | 'task-reopened';
  title: string;
  at: string;
}
export interface DashboardData {
  totals: { matters: number; documents: number; pending: number; completed: number; totalTasks: number; completionRate: number | null };
  matters: DashboardMatter[];
  weeks: DashboardWeek[];
  activity: DashboardActivity[];
}
const emptyDashboard = (): DashboardData => ({
  totals: { matters: 0, documents: 0, pending: 0, completed: 0, totalTasks: 0, completionRate: null },
  matters: [], weeks: [], activity: [],
});

// API timestamps are ISO instants. Reject ambiguous local dates and invalid days
// (Date.parse alone normalizes e.g. February 30 rather than rejecting it).
function timestamp(value: unknown, now: number): number | null {
  if (typeof value !== 'string') return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 31, 30, 31, 30, 31];
  if (Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6]) > 59) return null;
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now ? time : null;
}
const localKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Derived state only: no IO, React state, mutation, or cross-workspace fallback. */
export function buildDashboard(data: AppState, scope: string = 'all', now: Date = new Date()): DashboardData {
  const nowTime = now.getTime();
  if (!data.workspace || !Number.isFinite(nowTime)) return emptyDashboard();
  const scoped = data.matters.filter(m => scope === 'all' || m.id === scope);
  if (scope !== 'all' && !scoped.length) return emptyDashboard();
  const matters: DashboardMatter[] = scoped.map(m => ({ ...m, documents: 0, answers: 0, totalTasks: 0, completed: 0, pending: 0, completionRate: null }));
  const byMatter = new Map(matters.map(m => [m.id, m]));
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const label = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
  const boundaries: { start: number; end: number }[] = [];
  const weeks: DashboardWeek[] = Array.from({ length: 8 }, (_, index) => {
    // Calendar constructors preserve local Mondays across DST and year boundaries.
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (7 - index) * 7);
    const end = index === 7 ? new Date(nowTime) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    boundaries.push({ start: start.getTime(), end: end.getTime() });
    return { key: localKey(start), label: label.format(start), start: start.toISOString(), end: end.toISOString(), opened: 0, completed: 0 };
  });
  const activity: DashboardActivity[] = [];
  function event(kind: DashboardActivity['kind'], id: string, matter: DashboardMatter, title: string, value: unknown): number | null {
    const time = timestamp(value, nowTime);
    if (time === null) return null;
    activity.push({ id, matterId: matter.id, matterTitle: matter.title, kind, title, at: new Date(time).toISOString() });
    return time;
  }
  function countWeek(time: number | null, field: 'opened' | 'completed') {
    if (time === null) return;
    const index = boundaries.findIndex(b => time >= b.start && time < b.end);
    if (index >= 0) weeks[index][field]++;
  }
  for (const document of data.documents) {
    const matter = byMatter.get(document.matterId);
    if (!matter) continue;
    matter.documents++;
    event('document', `document:${document.id}`, matter, document.name, document.createdAt);
  }
  for (const answer of data.answers) {
    const matter = byMatter.get(answer.matterId);
    if (!matter) continue;
    matter.answers++;
    event('answer', `answer:${answer.id}`, matter, answer.question || 'Análisis del asunto', answer.createdAt);
  }
  for (const task of data.tasks) {
    const matter = byMatter.get(task.matterId);
    if (!matter || task.workspaceId !== data.workspace.id || !['pending', 'completed'].includes(task.status)) continue;
    matter.totalTasks++;
    if (task.status === 'completed') matter.completed++; else matter.pending++;
    countWeek(event('task-created', `task-created:${task.id}`, matter, task.title, task.createdAt), 'opened');
    let hasCompletedHistory = false;
    for (const [index, entry] of (Array.isArray(task.history) ? task.history : []).entries()) {
      if (entry?.event !== 'completed' && entry?.event !== 'reopened') continue;
      const kind = entry.event === 'completed' ? 'task-completed' : 'task-reopened';
      const time = event(kind, `${kind}:${task.id}:${index}`, matter, task.title, entry.at);
      if (entry.event === 'completed' && time !== null) {
        hasCompletedHistory = true;
        countWeek(time, 'completed');
      }
    }
    if (!hasCompletedHistory) countWeek(event('task-completed', `task-completed:${task.id}:legacy`, matter, task.title, task.completedAt), 'completed');
  }
  for (const matter of matters) matter.completionRate = matter.totalTasks ? 100 * matter.completed / matter.totalTasks : null;
  const totals = matters.reduce((sum, matter) => ({ ...sum, documents: sum.documents + matter.documents, totalTasks: sum.totalTasks + matter.totalTasks, completed: sum.completed + matter.completed, pending: sum.pending + matter.pending }), { matters: matters.length, documents: 0, totalTasks: 0, completed: 0, pending: 0, completionRate: null as number | null });
  totals.completionRate = totals.totalTasks ? 100 * totals.completed / totals.totalTasks : null;
  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
  return { totals, matters, weeks, activity: activity.slice(0, 8) };
}

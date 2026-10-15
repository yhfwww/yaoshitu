// 日期工具（本地时区）
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

export function formatDateCn(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// 距今天数（按自然日差）：正=未来，负=已过
export function daysFromToday(ts: number): number {
  return Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY_MS);
}

export function isOverdue(task: { dueAt?: number; completed: boolean }): boolean {
  if (!task.dueAt || task.completed) return false;
  return task.dueAt < Date.now();
}

// 相对时间描述
export function relativeDays(ts: number): string {
  const diff = daysFromToday(ts);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === -1) return "昨天";
  if (diff > 1) return `${diff} 天后`;
  if (diff < -1) return `${-diff} 天前`;
  return "今天";
}

export function dueLabel(ts?: number): string {
  if (!ts) return "";
  return `截止 ${formatDateCn(ts)}`;
}

// 距今天数（用于"上次备份 N 天前"）
export function daysAgo(ts: number): number {
  return Math.max(0, Math.floor((Date.now() - startOfDay(ts)) / DAY_MS));
}

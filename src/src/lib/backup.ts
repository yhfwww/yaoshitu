// JSON 导入 / 导出（版本化备份信封）
import type { BackupEnvelope } from "../db/schema";
import { DEFAULT_SETTINGS } from "../db/db";
import { VIEWS } from "./views";

export function validateBackup(input: unknown): BackupEnvelope {
  const fail = (): never => { throw new Error("不是有效的要事图备份文件：格式或字段不合法"); };
  if (!input || typeof input !== "object") return fail();
  const data = input as BackupEnvelope;
  if (data.app !== "yaoshitu" || data.formatVersion !== 1 || !Array.isArray(data.tasks) || !Array.isArray(data.notes) || data.tasks.length + data.notes.length > 50000) return fail();
  const text = (v: unknown, max = 200000): v is string => typeof v === "string" && v.length <= max;
  const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const strings = (v: unknown) => Array.isArray(v) && v.length <= 1000 && v.every((x) => text(x, 1000));
  const ids = new Set<string>();
  for (const t of data.tasks) {
    if (!t || !text(t.id, 200) || !t.id || ids.has(t.id) || !text(t.title, 1000) || !t.title.trim() || !text(t.notes) || !number(t.createdAt) || !number(t.updatedAt) || !strings(t.tags) || !strings(t.dependencies) || !Array.isArray(t.timeEntries) || t.timeEntries.length > 10000 || typeof t.completed !== "boolean" || typeof t.archived !== "boolean") return fail();
    ids.add(t.id);
    if (![t.urgency, t.importance].every((n) => Number.isInteger(n) && n >= 1 && n <= 100)) return fail();
    for (const n of [t.dueAt, t.deletedAt, t.completedAt, t.reminderAt]) if (n !== undefined && !number(n)) return fail();
    if (t.parentId !== undefined && !text(t.parentId, 200)) return fail();
    if (t.recurrence !== undefined && !["daily", "weekly", "monthly"].includes(t.recurrence)) return fail();
    for (const entry of t.timeEntries) if (!entry || !text(entry.id, 200) || !number(entry.startedAt) || (entry.endedAt !== undefined && !number(entry.endedAt)) || (entry.note !== undefined && !text(entry.note))) return fail();
  }
  ids.clear();
  for (const n of data.notes) {
    if (!n || !text(n.id, 200) || !n.id || ids.has(n.id) || !text(n.title, 1000) || !text(n.body) || !strings(n.tags) || typeof n.pinned !== "boolean" || !number(n.createdAt) || !number(n.updatedAt) || (n.deletedAt !== undefined && !number(n.deletedAt))) return fail();
    ids.add(n.id);
  }
  // Whitelist fields: a foreign session or sync metadata must never be restored.
  const tasks = data.tasks.map((t) => ({ id: t.id, title: t.title, notes: t.notes, urgency: t.urgency, importance: t.importance, completed: t.completed, completedAt: t.completedAt, deletedAt: t.deletedAt, archived: t.archived, createdAt: t.createdAt, updatedAt: t.updatedAt, dueAt: t.dueAt, tags: t.tags, parentId: t.parentId, recurrence: t.recurrence, timeEntries: t.timeEntries.map((e) => ({ id: e.id, startedAt: e.startedAt, endedAt: e.endedAt, note: e.note })), dependencies: t.dependencies, reminderAt: t.reminderAt }));
  const notes = data.notes.map((n) => ({ id: n.id, title: n.title, body: n.body, tags: n.tags, pinned: n.pinned, createdAt: n.createdAt, updatedAt: n.updatedAt, deletedAt: n.deletedAt }));
  const settings = { ...DEFAULT_SETTINGS, defaultView: VIEWS.some((v) => v.id === data.settings?.defaultView) ? data.settings.defaultView : DEFAULT_SETTINGS.defaultView, lastBackupAt: number(data.settings?.lastBackupAt) ? data.settings.lastBackupAt : undefined, seeded: true };
  return structuredClone({ app: "yaoshitu", formatVersion: 1, exportedAt: text(data.exportedAt) ? data.exportedAt : new Date().toISOString(), tasks, notes, settings });
}

export function downloadBackup(env: BackupEnvelope): void {
  const json = JSON.stringify(env, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  a.href = url;
  a.download = `yaoshitu-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readBackupFile(file: File): Promise<BackupEnvelope> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => {
      try {
        const data: unknown = JSON.parse(String(reader.result));
        resolve(validateBackup(data));
      } catch {
        try { JSON.parse(String(reader.result)); } catch { reject(new Error("JSON 解析失败")); return; }
        reject(new Error("不是有效的要事图备份文件：格式或字段不合法"));
      }
    };
    reader.readAsText(file);
  });
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

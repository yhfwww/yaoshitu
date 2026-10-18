// 全局状态 —— Zustand（任务/笔记/设置 + UI）
import { create } from "zustand";
import { db, workspace, SETTINGS_ID, getSettings, DEFAULT_SETTINGS } from "../db/db";
import { writeEntity, purgeEntity, updateEntity } from "../lib/sync/local";
import { validateBackup } from "../lib/backup";
import type {
  Task,
  Note,
  Settings,
  ViewId,
  SmartViewId,
  BackupEnvelope,
} from "../db/schema";
import { newId } from "../lib/id";
import { seedTasks, seedNotes } from "../db/seed";

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天回收站

let initPromise: Promise<void> | null = null;

export interface TaskInput {
  title: string;
  notes?: string;
  urgency: number;
  importance: number;
  dueAt?: number;
  tags: string[];
}

export interface EditorState {
  open: boolean;
  taskId?: string;
  defaults?: { urgency: number; importance: number };
}

interface AppState {
  // 数据
  tasks: Task[];
  notes: Note[];
  settings: Settings;
  ready: boolean;

  // UI
  view: ViewId;
  smartView: SmartViewId;
  selectedTaskId: string | null;
  editor: EditorState;
  commandOpen: boolean;

  // 生命周期
  init: () => Promise<void>;
  reload: () => Promise<void>;

  // 任务
  addTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  trashTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  purgeTask: (id: string) => Promise<void>;
  purgeTrashOlderThanRetention: () => Promise<number>;
  archiveTask: (id: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;

  // 笔记
  addNote: (input: { title: string; body: string; tags: string[] }) => Promise<void>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  togglePinNote: (id: string) => Promise<void>;

  // 设置
  updateSettings: (patch: Partial<Settings>) => Promise<void>;

  // UI actions
  setView: (v: ViewId) => void;
  setSmartView: (v: SmartViewId) => void;
  selectTask: (id: string | null) => void;
  openEditor: (opts?: { taskId?: string; defaults?: { urgency: number; importance: number } }) => void;
  closeEditor: () => void;
  setCommandOpen: (open: boolean) => void;

  // 导入导出
  exportBackup: () => BackupEnvelope;
  importBackup: (env: BackupEnvelope, mode?: "replace" | "merge") => Promise<void>;
}

export const useStore = create<AppState>()((set, get) => ({
  tasks: [],
  notes: [],
  settings: { id: SETTINGS_ID, defaultView: "coordinate" },
  ready: false,

  view: "coordinate",
  smartView: "hot",
  selectedTaskId: null,
  editor: { open: false },
  commandOpen: false,

  init() {
    // 用模块级 promise 去重，避免 StrictMode 下并发重复初始化/重复播种
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const [tasks, notes, settings] = await Promise.all([
        db.tasks.toArray(),
        db.notes.toArray(),
        getSettings(),
      ]);

      // 首次启动注入示例数据（仅在从未初始化过时）
      if (!settings.seeded && !workspace) {
        const seededTasks = seedTasks();
        const seededNotes = seedNotes();
        await db.tasks.bulkAdd(seededTasks);
        await db.notes.bulkAdd(seededNotes);
        await db.settings.put({ ...settings, id: SETTINGS_ID, seeded: true });
        set({
          tasks: seededTasks,
          notes: seededNotes,
          settings: { ...settings, seeded: true },
          view: settings.defaultView,
          ready: true,
        });
      } else {
        set({ tasks, notes, settings, view: settings.defaultView, ready: true });
      }

      // 启动时清理过期回收站
      await get().purgeTrashOlderThanRetention();
    })();
    return initPromise;
  },

  async reload() {
    const [tasks, notes, settings] = await Promise.all([db.tasks.toArray(), db.notes.toArray(), getSettings()]);
    set({ tasks, notes, settings, view: settings.defaultView, selectedTaskId: null, editor: { open: false }, commandOpen: false, ready: true });
  },

  async addTask(input) {
    const now = Date.now();
    const task: Task = {
      id: newId(),
      title: input.title,
      notes: input.notes ?? "",
      urgency: clamp1to100(input.urgency),
      importance: clamp1to100(input.importance),
      completed: false,
      deletedAt: undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
      dueAt: input.dueAt,
      tags: input.tags ?? [],
      timeEntries: [],
      dependencies: [],
    };
    await writeEntity("task", task);
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  async updateTask(id, patch) {
    const updated = await updateEntity<Task>("task", id, { ...patch, updatedAt: Date.now() });
    if (!updated) return;
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  },

  async toggleComplete(id) {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) return;
    const completed = !existing.completed;
    await get().updateTask(id, {
      completed,
      completedAt: completed ? Date.now() : undefined,
    });
  },

  async trashTask(id) {
    await get().updateTask(id, { deletedAt: Date.now() });
  },

  async restoreTask(id) {
    await get().updateTask(id, { deletedAt: undefined });
  },

  async purgeTask(id) {
    await purgeEntity("task", id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  async purgeTrashOlderThanRetention() {
    // Account retention is authoritative on the server, including offline clients.
    if (workspace) return 0;
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const toPurge = get().tasks.filter(
      (t) => t.deletedAt !== undefined && t.deletedAt < cutoff,
    );
    const notesToPurge = get().notes.filter((n) => n.deletedAt !== undefined && n.deletedAt < cutoff);
    if (toPurge.length === 0 && notesToPurge.length === 0) return 0;
    await db.transaction("rw", db.tasks, db.notes, async () => {
      await db.tasks.bulkDelete(toPurge.map((t) => t.id));
      await db.notes.bulkDelete(notesToPurge.map((n) => n.id));
    });
    set((s) => ({
      tasks: s.tasks.filter((t) => !(t.deletedAt !== undefined && t.deletedAt < cutoff)),
      notes: s.notes.filter((n) => !(n.deletedAt !== undefined && n.deletedAt < cutoff)),
    }));
    return toPurge.length + notesToPurge.length;
  },

  async archiveTask(id) {
    await get().updateTask(id, { archived: true });
  },

  async unarchiveTask(id) {
    await get().updateTask(id, { archived: false });
  },

  async addNote(input) {
    const now = Date.now();
    const note: Note = {
      id: newId(),
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    await writeEntity("note", note);
    set((s) => ({ notes: [...s.notes, note] }));
  },

  async updateNote(id, patch) {
    const updated = await updateEntity<Note>("note", id, { ...patch, updatedAt: Date.now() });
    if (!updated) return;
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }));
  },

  async deleteNote(id) {
    const updated = await updateEntity<Note>("note", id, { deletedAt: Date.now(), updatedAt: Date.now() });
    if (!updated) return;
    set((s) => ({ notes: s.notes.map((n) => n.id === id ? updated : n) }));
  },

  async restoreNote(id) {
    const existing = await db.notes.get(id);
    if (!existing?.deletedAt) return;
    await updateEntity<Note>("note", id, { deletedAt: undefined, updatedAt: Date.now() });
    await get().reload();
  },

  async togglePinNote(id) {
    const existing = get().notes.find((n) => n.id === id);
    if (!existing) return;
    await get().updateNote(id, { pinned: !existing.pinned });
  },

  async updateSettings(patch) {
    const next = { ...get().settings, ...patch };
    await writeEntity("settings", { ...next, id: SETTINGS_ID }, get().settings);
    set({ settings: next });
  },

  setView(v) {
    set({ view: v });
  },
  setSmartView(v) {
    set({ smartView: v });
  },
  selectTask(id) {
    set({ selectedTaskId: id });
  },
  openEditor(opts) {
    set({
      editor: {
        open: true,
        taskId: opts?.taskId,
        defaults: opts?.defaults,
      },
    });
  },
  closeEditor() {
    set({ editor: { open: false } });
  },
  setCommandOpen(open) {
    set({ commandOpen: open });
  },

  exportBackup() {
    const { tasks, notes, settings } = get();
    return structuredClone({
      app: "yaoshitu" as const,
      formatVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      tasks,
      notes,
      settings,
    });
  },

  async importBackup(env, mode = "replace") {
    env = validateBackup(env);
    if (mode === "merge") {
      const ids = new Map(env.tasks.map((task) => [task.id, newId()]));
      await db.transaction("rw", db.tasks, db.notes, db.settings, db.outbox, db.documents, async () => {
        for (const task of env.tasks) {
          await writeEntity("task", { ...task, id: ids.get(task.id)!, parentId: task.parentId ? ids.get(task.parentId) : undefined, dependencies: task.dependencies.map((id) => ids.get(id)).filter((id): id is string => !!id), updatedAt: Date.now() });
        }
        for (const note of env.notes) await writeEntity("note", { ...note, id: newId(), updatedAt: Date.now() });
      });
      await get().reload();
      return;
    }
    if (workspace) throw new Error("账号空间请使用合并导入，避免覆盖其他设备的数据");
    await db.transaction("rw", db.tasks, db.notes, db.settings, async () => {
      await db.tasks.clear();
      await db.notes.clear();
      await db.settings.clear();
      if (env.tasks?.length) await db.tasks.bulkAdd(env.tasks);
      if (env.notes?.length) await db.notes.bulkAdd(env.notes);
      await db.settings.put({ ...DEFAULT_SETTINGS, ...env.settings, id: SETTINGS_ID, seeded: true });
    });
    const [tasks, notes, settings] = await Promise.all([
      db.tasks.toArray(),
      db.notes.toArray(),
      getSettings(),
    ]);
    set({ tasks, notes, settings, view: settings.defaultView });
  },
}));

function clamp1to100(n: number): number {
  return Math.max(1, Math.min(100, Math.round(n)));
}

// 派生选择器：当前视图可见的任务
export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.deletedAt === undefined && !t.archived);
}

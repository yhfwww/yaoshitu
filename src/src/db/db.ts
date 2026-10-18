// IndexedDB 访问层 —— Dexie + versioning（唯一真相源，零外部请求）
import Dexie, { type EntityTable } from "dexie";
import type { Task, Note, Settings, SyncDocument, SyncOperation, Workspace } from "./schema";

export class YaoshituDB extends Dexie {
  tasks!: EntityTable<Task, "id">;
  notes!: EntityTable<Note, "id">;
  settings!: EntityTable<Settings, "id">;
  outbox!: EntityTable<SyncOperation, "id">;
  documents!: EntityTable<SyncDocument, "key">;

  constructor(name = "yaoshitu") {
    super(name);
    this.version(1).stores({
      // 索引：常用查询维度
      tasks:
        "id, completed, deletedAt, archived, parentId, urgency, importance, dueAt, createdAt, updatedAt, *tags",
      notes: "id, pinned, createdAt, updatedAt, *tags",
      settings: "id",
    });
    this.version(2).stores({ outbox: "id, key, createdAt", documents: "key" });
  }
}

export const guestDb = new YaoshituDB();
export let db = guestDb;
export let workspace: Workspace | null = null;

export function selectWorkspace(next: Workspace | null): void {
  if (db !== guestDb) db.close();
  workspace = next;
  db = next ? new YaoshituDB(`yaoshitu-account-${encodeURIComponent(next.server)}-${next.userId}`) : guestDb;
}

export const SETTINGS_ID = "app";
export const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  defaultView: "coordinate",
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get(SETTINGS_ID);
  return s ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: SETTINGS_ID });
}

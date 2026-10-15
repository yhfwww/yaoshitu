// IndexedDB 访问层 —— Dexie + versioning（唯一真相源，零外部请求）
import Dexie, { type EntityTable } from "dexie";
import type { Task, Note, Settings } from "./schema";

class YaoshituDB extends Dexie {
  tasks!: EntityTable<Task, "id">;
  notes!: EntityTable<Note, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("yaoshitu");
    this.version(1).stores({
      // 索引：常用查询维度
      tasks:
        "id, completed, deletedAt, archived, parentId, urgency, importance, dueAt, createdAt, updatedAt, *tags",
      notes: "id, pinned, createdAt, updatedAt, *tags",
      settings: "id",
    });
  }
}

export const db = new YaoshituDB();

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

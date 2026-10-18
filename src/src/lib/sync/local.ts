import { db, workspace, type YaoshituDB } from "../../db/db";
import type { EntityKind, SyncDocument, SyncOperation, Task, Note, Settings } from "../../db/schema";
import { changedValues, decodeValues } from "./documents";
import { newId } from "../id";

export const DATA_CHANGED = "yaoshitu-data-changed";
export function announceChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED));
}

// The entity write and its durable outbox entry commit together.
export async function writeEntity(kind: EntityKind, after: Task | Note | Settings, before?: Task | Note | Settings): Promise<void> {
  const target = db;
  await target.transaction("rw", target.tasks, target.notes, target.settings, target.outbox, target.documents, async () => {
    if (kind === "task") await target.tasks.put(after as Task);
    else if (kind === "note") await target.notes.put(after as Note);
    else await target.settings.put(after as Settings);
    if (workspace) {
      const changes = changedValues(kind, before, after);
      if (Object.keys(changes).length) {
        const key = `${kind}:${after.id}`;
        const document = await target.documents.get(key);
        const previous = await target.outbox.orderBy("createdAt").last();
        await target.outbox.add({ id: newId(), key, kind, entityId: after.id, baseRevision: document?.revision ?? 0, changes, purge: false, createdAt: Math.max(Date.now(), (previous?.createdAt ?? 0) + 1) });
      }
    }
  });
  announceChange();
}

export async function purgeEntity(kind: "task" | "note", id: string): Promise<void> {
  const target = db;
  await target.transaction("rw", target.tasks, target.notes, target.outbox, target.documents, async () => {
    const current = await (kind === "task" ? target.tasks : target.notes).get(id);
    if (!current) return;
    if (current.deletedAt === undefined) throw new Error("请先移入回收站，再永久删除");
    await (kind === "task" ? target.tasks : target.notes).delete(id);
    if (workspace) {
      const key = `${kind}:${id}`;
      const document = await target.documents.get(key);
      const previous = await target.outbox.orderBy("createdAt").last();
      await target.outbox.add({ id: newId(), key, kind, entityId: id, baseRevision: document?.revision ?? 0, changes: {}, purge: true, createdAt: Math.max(Date.now(), (previous?.createdAt ?? 0) + 1) });
    }
  });
  announceChange();
}

export async function updateEntity<T extends Task | Note | Settings>(kind: EntityKind, id: string, patch: Partial<T>): Promise<T | undefined> {
  const target = db;
  return target.transaction("rw", target.tasks, target.notes, target.settings, target.outbox, target.documents, async () => {
    const table = kind === "task" ? target.tasks : kind === "note" ? target.notes : target.settings;
    const current = await table.get(id) as T | undefined;
    if (!current) return;
    const updated = { ...current, ...patch, id } as T;
    await writeEntity(kind, updated, current);
    return updated;
  });
}

export async function applyDocument(target: YaoshituDB, document: SyncDocument, acknowledged?: string): Promise<void> {
  await target.transaction("rw", target.tasks, target.notes, target.settings, target.outbox, target.documents, async () => {
    const known = await target.documents.get(document.key);
    if (acknowledged) await target.outbox.delete(acknowledged);
    if (known && known.revision > document.revision) return;
    await target.documents.put(document);
    const table = document.kind === "task" ? target.tasks : document.kind === "note" ? target.notes : target.settings;
    if (document.purged) {
      await table.delete(document.entityId);
      // Permanent server tombstones dominate old queued edits forever.
      await target.outbox.where("key").equals(document.key).delete();
      return;
    }
    const pending: SyncOperation[] = await target.outbox.where("key").equals(document.key).sortBy("createdAt");
    if (pending.some((op) => op.purge)) return;
    const values = Object.assign({}, document.values, ...pending.map((op) => op.changes));
    const decoded = decodeValues(document.kind, values, document.entityId);
    if (document.kind === "task") await target.tasks.put(decoded as unknown as Task);
    else if (document.kind === "note") await target.notes.put(decoded as unknown as Note);
    else {
      const existing = await target.settings.get("app");
      await target.settings.put({ ...existing, ...decoded, seeded: true } as unknown as Settings);
    }
  });
}

import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { db, guestDb, selectWorkspace } from "../../db/db";
import type { SyncDocument, Task } from "../../db/schema";
import { applyDocument, purgeEntity, writeEntity, updateEntity } from "./local";
import { encodeValues } from "./documents";

const fixture = (): Task => ({ id: "shared", title: "初始", notes: "", urgency: 10, importance: 90, completed: false, archived: false, createdAt: 1, updatedAt: 1, tags: [], timeEntries: [], dependencies: [] });
const account = (userId: string) => ({ userId, label: userId, server: "https://test.invalid" });
const databases = new Set<string>();
function enter(id: string) { selectWorkspace(account(id)); databases.add(db.name); }
afterEach(async () => {
  selectWorkspace(null);
  await guestDb.tasks.clear();
  for (const name of databases) {
    const { YaoshituDB } = await import("../../db/db");
    await new YaoshituDB(name).delete();
  }
  databases.clear();
});

describe("账号隔离和持久化同步", () => {
  it("从 v1 数据库升级后任务与设置原样保留", async () => {
    const name = "yaoshitu-migration-test";
    databases.add(name);
    const legacy = new Dexie(name);
    legacy.version(1).stores({ tasks: "id", notes: "id", settings: "id" });
    await legacy.table("tasks").put(fixture());
    await legacy.table("settings").put({ id: "app", defaultView: "list", seeded: true });
    legacy.close();
    const { YaoshituDB } = await import("../../db/db");
    const upgraded = new YaoshituDB(name);
    expect((await upgraded.tasks.get("shared"))?.title).toBe("初始");
    expect((await upgraded.settings.get("app"))?.defaultView).toBe("list");
    expect(await upgraded.outbox.count()).toBe(0);
    upgraded.close();
  });
  it("同时保存的不同字段在本机也不会互相覆盖", async () => {
    enter("aaaaaaaaaaaaaaa");
    await writeEntity("task", fixture());
    await Promise.all([
      updateEntity<Task>("task", "shared", { title: "新标题" }),
      updateEntity<Task>("task", "shared", { dueAt: 12345 }),
    ]);
    expect(await db.tasks.get("shared")).toMatchObject({ title: "新标题", dueAt: 12345 });
  });
  it("原游客数据保持原库；A、B 账号同 id 的任务和队列互不影响", async () => {
    await guestDb.tasks.put(fixture());
    enter("aaaaaaaaaaaaaaa");
    expect(await db.tasks.count()).toBe(0);
    await writeEntity("task", { ...fixture(), title: "A" });
    expect(await db.outbox.count()).toBe(1);
    enter("bbbbbbbbbbbbbbb");
    expect(await db.tasks.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    await writeEntity("task", { ...fixture(), title: "B" });
    enter("aaaaaaaaaaaaaaa");
    expect((await db.tasks.get("shared"))?.title).toBe("A");
    expect(await db.outbox.count()).toBe(1);
    expect((await guestDb.tasks.get("shared"))?.title).toBe("初始");
  });

  it("业务写入和队列在同一事务回滚；断线重开仍保留队列", async () => {
    enter("aaaaaaaaaaaaaaa");
    await expect(db.transaction("rw", db.tasks, db.notes, db.settings, db.outbox, db.documents, async () => {
      await writeEntity("task", fixture());
      throw new Error("模拟保存失败");
    })).rejects.toThrow("模拟保存失败");
    expect(await db.tasks.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    await writeEntity("task", fixture());
    enter("aaaaaaaaaaaaaaa");
    expect(await db.outbox.count()).toBe(1);
  });

  it("远端变更不会覆盖未上传的本地字段；坐标作为整体更新", async () => {
    enter("aaaaaaaaaaaaaaa");
    const task = fixture();
    const remote: SyncDocument = { key: "task:shared", kind: "task", entityId: "shared", revision: 1, values: encodeValues("task", task), purged: false, conflicts: [] };
    await applyDocument(db, remote);
    await writeEntity("task", { ...task, urgency: 80, importance: 20 }, task);
    const operation = (await db.outbox.toArray())[0];
    expect(operation.changes).toEqual({ position: { urgency: 80, importance: 20 } });
    await applyDocument(db, { ...remote, revision: 2, values: { ...remote.values, title: "手机新标题" } });
    expect(await db.tasks.get(task.id)).toMatchObject({ title: "手机新标题", urgency: 80, importance: 20 });
    expect(await db.outbox.count()).toBe(1);
  });

  it("永久删除标记清理旧离线操作；重新拉取不会复活", async () => {
    enter("aaaaaaaaaaaaaaa");
    await writeEntity("task", fixture());
    await applyDocument(db, { key: "task:shared", kind: "task", entityId: "shared", revision: 100, values: {}, purged: true, conflicts: [] });
    expect(await db.tasks.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    await applyDocument(db, { key: "task:shared", kind: "task", entityId: "shared", revision: 1, values: encodeValues("task", fixture()), purged: false, conflicts: [] });
    expect(await db.tasks.count()).toBe(0);
  });

  it("同一毫秒的操作仍有严格顺序；永久删除也进入持久队列", async () => {
    enter("aaaaaaaaaaaaaaa");
    const task = fixture();
    await writeEntity("task", task);
    await writeEntity("task", { ...task, title: "第二次", deletedAt: Date.now() }, task);
    await purgeEntity("task", task.id);
    const ops = await db.outbox.orderBy("createdAt").toArray();
    expect(ops).toHaveLength(3);
    expect(ops[1].createdAt).toBeGreaterThan(ops[0].createdAt);
    expect(ops[2].createdAt).toBeGreaterThan(ops[1].createdAt);
    expect(ops[2].purge).toBe(true);
  });

  it("只同步用户偏好，不上传 seeded 和备份时间", async () => {
    enter("aaaaaaaaaaaaaaa");
    await writeEntity("settings", { id: "app", defaultView: "list", seeded: true, lastBackupAt: 123 });
    expect((await db.outbox.toArray())[0].changes).toEqual({ defaultView: "list" });
  });
});

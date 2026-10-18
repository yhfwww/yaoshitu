// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { db, guestDb, YaoshituDB } from "../../db/db";
import { useStore } from "../../store/useStore";
import type { SyncDocument, SyncOperation } from "../../db/schema";

const mock = vi.hoisted(() => {
  const auth = { record: null as null | { id: string; name: string }, token: "", isValid: true, clear() { this.record = null; this.token = ""; }, save(token: string, record: { id: string; name: string }) { this.token = token; this.record = record; } };
  return { auth, send: vi.fn(), nextUser: "aaaaaaaaaaaaaaa" };
});
vi.mock("./client", () => ({
  server: "https://sync.test.invalid",
  getClient: () => ({
    authStore: mock.auth,
    send: mock.send,
    realtime: { unsubscribe: vi.fn() },
    collection: () => ({
      authWithOAuth2: async () => { const record = { id: mock.nextUser, name: "测试账号" }; mock.auth.save("fake-token", record); return { record }; },
      authRefresh: vi.fn(),
      subscribe: async () => vi.fn(),
    }),
  }),
}));
vi.mock("pocketbase", () => ({ isTokenExpired: () => false }));

afterEach(() => vi.restoreAllMocks());
it("登录/离线失败/重试/退出/换账号完整流程保持游客及账号数据隔离", async () => {
  vi.spyOn(window, "open").mockImplementation(() => ({ location: { href: "" }, closed: false, close() {} }) as unknown as Window);
  const documents = new Map<string, SyncDocument>();
  mock.send.mockImplementation(async (path: string, options: { body?: SyncOperation }) => {
    if (path.endsWith("pull")) return { items: [...documents.values()], after: "" };
    const op = options.body!;
    const before = documents.get(op.key);
    const doc: SyncDocument = { key: op.key, kind: op.kind, entityId: op.entityId, revision: (before?.revision ?? 0) + 1, values: { ...before?.values, ...op.changes }, purged: op.purge, conflicts: [] };
    documents.set(op.key, doc);
    return doc;
  });
  await guestDb.tasks.clear(); await guestDb.notes.clear();
  await useStore.getState().reload();
  await useStore.getState().addTask({ title: "游客任务", urgency: 50, importance: 50, tags: [] });
  const { loginGithub, logout, synchronize, useSync } = await import("./runtime");
  const names = new Set<string>();
  try {
    await loginGithub(); names.add(db.name);
    expect(useStore.getState().tasks).toHaveLength(0);
    const task = await useStore.getState().addTask({ title: "账号 A", urgency: 10, importance: 90, tags: [] });
    mock.send.mockRejectedValueOnce(new Error("模拟断网"));
    await synchronize();
    expect(await db.outbox.count()).toBe(1);
    expect(useSync.getState().status).toBe("等待重试");
    await synchronize();
    expect(await db.outbox.count()).toBe(0);
    expect(documents.get(`task:${task.id}`)?.values.title).toBe("账号 A");
    await logout();
    expect(useStore.getState().tasks[0].title).toBe("游客任务");
    documents.clear(); mock.nextUser = "bbbbbbbbbbbbbbb";
    await loginGithub(); names.add(db.name);
    expect(useStore.getState().tasks).toHaveLength(0);
    expect(await db.outbox.count()).toBe(0);
    const b = await useStore.getState().addTask({ title: "账号 B", urgency: 50, importance: 50, tags: [] });
    mock.auth.record = { id: "aaaaaaaaaaaaaaa", name: "另一账号" };
    const calls = mock.send.mock.calls.length;
    await synchronize();
    expect(mock.send.mock.calls.length).toBe(calls);
    expect(await db.outbox.count()).toBe(1);
    expect((await db.tasks.get(b.id))?.title).toBe("账号 B");
    expect(useSync.getState().error).toContain("账号已变更");
  } finally {
    await logout();
    await guestDb.tasks.clear();
    for (const name of names) await new YaoshituDB(name).delete();
  }
});

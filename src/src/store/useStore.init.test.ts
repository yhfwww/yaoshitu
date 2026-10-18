// init() 用模块级 initPromise 去重，探测「并发调用只播种一次」必须拿到全新的模块实例，
// 所以这个文件里的用例都走 vi.resetModules() + 动态 import。
// 也正因为如此，它和 useStore.test.ts 分开：那边用的是常规模块实例。
import { describe, it, expect, vi } from "vitest";
import type { Task } from "../db/schema";

function makeTask(over: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: "keep",
    title: "老数据",
    notes: "",
    urgency: 50,
    importance: 50,
    completed: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    tags: [],
    timeEntries: [],
    dependencies: [],
    ...over,
  };
}

describe("init() —— 启动初始化", () => {
  it("并发调用两次只播种一份示例数据（StrictMode 去重），再调也不会重复播种", async () => {
    vi.resetModules();
    const { useStore } = await import("./useStore");
    const { db } = await import("../db/db");
    const { seedTasks, seedNotes } = await import("../db/seed");

    await db.tasks.clear();
    await db.notes.clear();
    await db.settings.clear();

    const expectedTasks = seedTasks().length;
    const expectedNotes = seedNotes().length;
    expect(expectedTasks).toBeGreaterThan(0);

    // StrictMode 下 init() 会被并发调用两次
    await Promise.all([useStore.getState().init(), useStore.getState().init()]);

    expect(await db.tasks.count()).toBe(expectedTasks);
    expect(await db.notes.count()).toBe(expectedNotes);
    expect(useStore.getState().tasks).toHaveLength(expectedTasks);
    expect(useStore.getState().ready).toBe(true);

    // 再调一次：不该翻倍
    await useStore.getState().init();
    expect(await db.tasks.count()).toBe(expectedTasks);
  });

  it("库里已有数据（seeded 标记）时不再播种，并采用 settings.defaultView 作为初始视图", async () => {
    vi.resetModules();
    const { useStore } = await import("./useStore");
    const { db, SETTINGS_ID } = await import("../db/db");

    await db.tasks.clear();
    await db.notes.clear();
    await db.settings.clear();
    await db.tasks.add(makeTask({ id: "keep" }));
    await db.settings.put({ id: SETTINGS_ID, defaultView: "list", seeded: true });

    await useStore.getState().init();

    expect(useStore.getState().tasks.map((t) => t.id)).toEqual(["keep"]);
    expect(useStore.getState().view).toBe("list");
    expect(await db.tasks.count()).toBe(1); // 没有被示例数据冲掉
  });
});

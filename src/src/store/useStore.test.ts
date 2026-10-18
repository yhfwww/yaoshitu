import { describe, it, expect, beforeEach } from "vitest";
import { db, SETTINGS_ID, DEFAULT_SETTINGS } from "../db/db";
import { useStore } from "./useStore";
import type { Task } from "../db/schema";

const DAY = 24 * 60 * 60 * 1000;

function makeTask(over: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: "t1",
    title: "任务",
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

// store 是模块级单例，每个用例前把库和内存状态一起清干净
beforeEach(async () => {
  await db.tasks.clear();
  await db.notes.clear();
  await db.settings.clear();
  useStore.setState({
    tasks: [],
    notes: [],
    settings: { ...DEFAULT_SETTINGS },
    view: "coordinate",
    smartView: "hot",
    selectedTaskId: null,
    editor: { open: false },
    commandOpen: false,
    ready: false,
  });
});

describe("任务 CRUD", () => {
  it("addTask：坐标夹到 1..100 并取整，默认字段齐全，且真的落库", async () => {
    const t = await useStore.getState().addTask({
      title: "写周报",
      urgency: 150,
      importance: -5,
      tags: ["工作"],
    });

    expect(t.urgency).toBe(100);
    expect(t.importance).toBe(1);
    expect(t.completed).toBe(false);
    expect(t.archived).toBe(false);
    expect(t.deletedAt).toBeUndefined();
    expect(t.notes).toBe("");
    expect(t.timeEntries).toEqual([]);
    expect(t.dependencies).toEqual([]);
    expect(t.createdAt).toBe(t.updatedAt);

    expect(useStore.getState().tasks.map((x) => x.id)).toEqual([t.id]);
    expect(await db.tasks.get(t.id)).toMatchObject({
      title: "写周报",
      urgency: 100,
      importance: 1,
      tags: ["工作"],
    });
  });

  it("addTask：小数坐标四舍五入", async () => {
    const t = await useStore.getState().addTask({
      title: "x",
      urgency: 33.6,
      importance: 66.4,
      tags: [],
    });
    expect(t.urgency).toBe(34);
    expect(t.importance).toBe(66);
  });

  it("addTask：不传 tags 时不会留下 undefined", async () => {
    const t = await useStore.getState().addTask({
      title: "x",
      urgency: 50,
      importance: 50,
      tags: undefined as unknown as string[],
    });
    expect(t.tags).toEqual([]);
  });

  it("updateTask：合并补丁、刷新 updatedAt，未知 id 静默忽略", async () => {
    const t = await useStore.getState().addTask({
      title: "旧标题",
      urgency: 10,
      importance: 10,
      tags: [],
    });

    await new Promise((r) => setTimeout(r, 3)); // 让 updatedAt 确实能变大
    await useStore.getState().updateTask(t.id, { title: "新标题", urgency: 90 });

    const after = useStore.getState().tasks.find((x) => x.id === t.id)!;
    expect(after.title).toBe("新标题");
    expect(after.urgency).toBe(90);
    expect(after.importance).toBe(10); // 没传的字段不动
    expect(after.updatedAt).toBeGreaterThan(t.updatedAt);
    expect((await db.tasks.get(t.id))!.title).toBe("新标题");

    await expect(
      useStore.getState().updateTask("不存在的-id", { title: "x" }),
    ).resolves.toBeUndefined();
    expect(useStore.getState().tasks).toHaveLength(1);
  });

  it("toggleComplete：完成时记下 completedAt，取消完成时清掉", async () => {
    const t = await useStore.getState().addTask({
      title: "x",
      urgency: 50,
      importance: 50,
      tags: [],
    });

    await useStore.getState().toggleComplete(t.id);
    let cur = useStore.getState().tasks.find((x) => x.id === t.id)!;
    expect(cur.completed).toBe(true);
    expect(typeof cur.completedAt).toBe("number");

    await useStore.getState().toggleComplete(t.id);
    cur = useStore.getState().tasks.find((x) => x.id === t.id)!;
    expect(cur.completed).toBe(false);
    expect(cur.completedAt).toBeUndefined();
    expect((await db.tasks.get(t.id))!.completedAt).toBeUndefined();
  });

  it("归档 / 取消归档只动 archived", async () => {
    const t = await useStore.getState().addTask({
      title: "x",
      urgency: 50,
      importance: 50,
      tags: [],
    });

    await useStore.getState().archiveTask(t.id);
    expect(useStore.getState().tasks[0].archived).toBe(true);
    expect(useStore.getState().tasks[0].deletedAt).toBeUndefined();

    await useStore.getState().unarchiveTask(t.id);
    expect(useStore.getState().tasks[0].archived).toBe(false);
  });
});

describe("回收站（产品硬约束：保留 30 天）", () => {
  it("trashTask / restoreTask 只动 deletedAt", async () => {
    const t = await useStore.getState().addTask({
      title: "x",
      urgency: 50,
      importance: 50,
      tags: [],
    });

    await useStore.getState().trashTask(t.id);
    expect(typeof useStore.getState().tasks[0].deletedAt).toBe("number");
    expect(useStore.getState().tasks[0].completed).toBe(false);

    await useStore.getState().restoreTask(t.id);
    expect(useStore.getState().tasks[0].deletedAt).toBeUndefined();
  });

  it("31 天前删的清除，29 天前删的保留，从没删过的碰都不碰", async () => {
    const now = Date.now();
    const old = makeTask({ id: "old", deletedAt: now - 31 * DAY });
    const fresh = makeTask({ id: "fresh", deletedAt: now - 29 * DAY });
    const neverDeleted = makeTask({ id: "never" });
    // 已归档且早就进了回收站 —— 该清还是要清
    const oldArchived = makeTask({ id: "oldArchived", deletedAt: now - 60 * DAY, archived: true });

    await db.tasks.bulkAdd([old, fresh, neverDeleted, oldArchived]);
    useStore.setState({ tasks: [old, fresh, neverDeleted, oldArchived] });

    const purged = await useStore.getState().purgeTrashOlderThanRetention();

    expect(purged).toBe(2);
    expect(useStore.getState().tasks.map((t) => t.id).sort()).toEqual(["fresh", "never"]);
    expect(await db.tasks.get("old")).toBeUndefined();
    expect(await db.tasks.get("oldArchived")).toBeUndefined();
    expect(await db.tasks.get("fresh")).toBeDefined();
    expect(await db.tasks.get("never")).toBeDefined();
  });

  it("没有过期项时返回 0，且一条数据都不动", async () => {
    const fresh = makeTask({ id: "fresh", deletedAt: Date.now() - DAY });
    await db.tasks.bulkAdd([fresh]);
    useStore.setState({ tasks: [fresh] });

    expect(await useStore.getState().purgeTrashOlderThanRetention()).toBe(0);
    expect(await db.tasks.count()).toBe(1);
    expect(useStore.getState().tasks).toHaveLength(1);
  });

  it("purgeTask 是永久删除：内存与库同时消失", async () => {
    const t = makeTask({ id: "gone", deletedAt: Date.now() });
    await db.tasks.add(t);
    useStore.setState({ tasks: [t] });

    await useStore.getState().purgeTask("gone");
    expect(useStore.getState().tasks).toHaveLength(0);
    expect(await db.tasks.get("gone")).toBeUndefined();
  });
});

describe("导出 / 导入", () => {
  it("exportBackup：信封带版本与可解析的导出时间", async () => {
    const t = await useStore.getState().addTask({
      title: "甲",
      urgency: 80,
      importance: 90,
      tags: ["x"],
    });
    await useStore.getState().addNote({ title: "原则", body: "先说结论", tags: [] });

    const env = useStore.getState().exportBackup();
    expect(env.app).toBe("yaoshitu");
    expect(env.formatVersion).toBe(1);
    expect(Number.isNaN(Date.parse(env.exportedAt))).toBe(false);
    expect(env.tasks.map((x) => x.id)).toEqual([t.id]);
    expect(env.notes).toHaveLength(1);
    expect(env.settings.id).toBe(SETTINGS_ID);
  });

  it("exportBackup 是快照：之后再改任务不会污染已导出的信封", async () => {
    const t = await useStore.getState().addTask({
      title: "原始标题",
      urgency: 50,
      importance: 50,
      tags: [],
    });
    const env = useStore.getState().exportBackup();

    await useStore.getState().updateTask(t.id, { title: "改过的标题" });
    expect(env.tasks[0].title).toBe("原始标题");
  });

  it("importBackup 是覆盖式：导出 → 弄脏现场 → 导入，数据回到备份那一刻", async () => {
    const a = await useStore.getState().addTask({
      title: "甲",
      urgency: 80,
      importance: 90,
      tags: ["x"],
    });
    await useStore.getState().addNote({ title: "笔记", body: "正文", tags: [] });
    const env = useStore.getState().exportBackup();

    // 弄脏现场：新增一条备份里没有的任务，再改掉一条已有的
    await useStore.getState().addTask({ title: "不该活下来", urgency: 1, importance: 1, tags: [] });
    await useStore.getState().updateTask(a.id, { title: "被改过" });
    expect(useStore.getState().tasks).toHaveLength(2);

    await useStore.getState().importBackup(env);

    expect(useStore.getState().tasks.map((t) => t.title)).toEqual(["甲"]);
    expect(useStore.getState().notes.map((n) => n.title)).toEqual(["笔记"]);
    // 库里也必须只剩备份里那份，否则刷新后脏数据会「复活」
    expect(await db.tasks.count()).toBe(1);
    expect(await db.notes.count()).toBe(1);
    expect(useStore.getState().settings.id).toBe(SETTINGS_ID);
    expect(useStore.getState().view).toBe(env.settings.defaultView);
  });

  it("importBackup：空任务 / 空笔记的信封能导入，不抛错也不留旧数据", async () => {
    await useStore.getState().addTask({ title: "旧数据", urgency: 50, importance: 50, tags: [] });

    const env = {
      app: "yaoshitu" as const,
      formatVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      tasks: [],
      notes: [],
      settings: { id: SETTINGS_ID, defaultView: "coordinate" as const },
    };
    await useStore.getState().importBackup(env);

    expect(useStore.getState().tasks).toEqual([]);
    expect(useStore.getState().notes).toEqual([]);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.settings.get(SETTINGS_ID)).toBeDefined();
  });
});

describe("设置与笔记", () => {
  it("updateSettings：写库并强制 id 为 SETTINGS_ID", async () => {
    await useStore.getState().updateSettings({ defaultView: "list", lastBackupAt: 12345 });

    const stored = await db.settings.get(SETTINGS_ID);
    expect(stored?.defaultView).toBe("list");
    expect(stored?.lastBackupAt).toBe(12345);
    expect(useStore.getState().settings.defaultView).toBe("list");
  });

  it("笔记：新增 / 置顶切换 / 删除", async () => {
    await useStore.getState().addNote({ title: "原则", body: "先说结论", tags: ["x"] });
    const n = useStore.getState().notes[0];
    expect(n.pinned).toBe(false);
    expect(await db.notes.count()).toBe(1);

    await useStore.getState().togglePinNote(n.id);
    expect(useStore.getState().notes[0].pinned).toBe(true);
    expect((await db.notes.get(n.id))!.pinned).toBe(true);

    await useStore.getState().deleteNote(n.id);
    expect(useStore.getState().notes).toHaveLength(0);
    expect(await db.notes.count()).toBe(0);
  });

  it("deleteNote / togglePinNote 对未知 id 静默忽略", async () => {
    await expect(useStore.getState().deleteNote("nope")).resolves.toBeUndefined();
    await expect(useStore.getState().togglePinNote("nope")).resolves.toBeUndefined();
  });
});

// 说明：src/store/useStore.ts 里导出的 activeTasks() 目前没有任何调用方，
// 而且它的过滤条件（只看 deletedAt / archived）与 CoordinateView 内联的过滤条件
// （额外排除 completed）并不一致 —— 这是一个待决问题，先不给它写测试以免把现状固化。

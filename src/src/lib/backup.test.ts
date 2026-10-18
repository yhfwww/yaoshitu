// @vitest-environment jsdom
// 这个文件要真的用到 File / FileReader / document，所以单独切到 jsdom 环境。
import { describe, it, expect, vi, afterEach } from "vitest";
import { readBackupFile, downloadBackup } from "./backup";
import type { BackupEnvelope, Task } from "../db/schema";

function taskFixture(): Task {
  const now = 1_700_000_000_000;
  return {
    id: "t1",
    title: "写周报",
    notes: "",
    urgency: 80,
    importance: 90,
    completed: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    tags: ["工作"],
    timeEntries: [],
    dependencies: [],
  };
}

function envelope(over: Partial<BackupEnvelope> = {}): BackupEnvelope {
  return {
    app: "yaoshitu",
    formatVersion: 1,
    exportedAt: "2026-10-15T00:00:00.000Z",
    tasks: [],
    notes: [],
    settings: { id: "app", defaultView: "coordinate" },
    ...over,
  };
}

function fileWith(text: string): File {
  return new File([text], "backup.json", { type: "application/json" });
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取失败"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

// jsdom 没有实现 URL.createObjectURL / revokeObjectURL，这里临时装上、用完还原。
// 不用 vi.spyOn —— 属性可能压根不存在，spy 会直接抛错。
function stubObjectURL() {
  type UrlStatics = { createObjectURL?: unknown; revokeObjectURL?: unknown };
  const statics = URL as unknown as UrlStatics;
  const original = { create: statics.createObjectURL, revoke: statics.revokeObjectURL };

  const captured: { blob?: Blob } = {};
  const createObjectURL = vi.fn((blob: Blob) => {
    captured.blob = blob;
    return "blob:test";
  });
  const revokeObjectURL = vi.fn(() => {});
  statics.createObjectURL = createObjectURL;
  statics.revokeObjectURL = revokeObjectURL;

  return {
    captured,
    revokeObjectURL,
    restore() {
      if (original.create === undefined) delete statics.createObjectURL;
      else statics.createObjectURL = original.create;
      if (original.revoke === undefined) delete statics.revokeObjectURL;
      else statics.revokeObjectURL = original.revoke;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("readBackupFile —— 备份文件的入口校验", () => {
  it("接受合法信封，任务原样读出", async () => {
    const env = envelope({ tasks: [taskFixture()] });
    const parsed = await readBackupFile(fileWith(JSON.stringify(env)));
    expect(parsed.app).toBe("yaoshitu");
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].title).toBe("写周报");
  });

  it("app 不是 yaoshitu → 拒绝", async () => {
    await expect(readBackupFile(fileWith(JSON.stringify({ app: "other", tasks: [] })))).rejects.toThrow(
      "不是有效的要事图备份文件",
    );
  });

  it("缺少 tasks 数组 → 拒绝（tasks 是判断文件身份的底线，不能凭空补）", async () => {
    await expect(readBackupFile(fileWith(JSON.stringify({ app: "yaoshitu" })))).rejects.toThrow(
      "不是有效的要事图备份文件",
    );
  });

  it("tasks 不是数组 → 拒绝", async () => {
    await expect(
      readBackupFile(fileWith(JSON.stringify({ app: "yaoshitu", tasks: {} }))),
    ).rejects.toThrow("不是有效的要事图备份文件");
  });

  it("json 为 null 或数组 → 拒绝而不是崩", async () => {
    await expect(readBackupFile(fileWith("null"))).rejects.toThrow("不是有效的要事图备份文件");
    await expect(readBackupFile(fileWith("[]"))).rejects.toThrow("不是有效的要事图备份文件");
  });

  it("根本不是 JSON → 报「JSON 解析失败」，与「不是备份文件」区分开", async () => {
    await expect(readBackupFile(fileWith("这不是 JSON"))).rejects.toThrow("JSON 解析失败");
  });
});

describe("downloadBackup", () => {
  it("文件名带本地日期戳，内容是可原样解析回来的缩进 JSON，且不留下垃圾", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));

    const stub = stubObjectURL();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    // 抓住内部创建的那个 <a>，才能检查 download 文件名
    const captured: { anchor?: HTMLAnchorElement } = {};
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((
      tag: string,
      options?: ElementCreationOptions,
    ) => {
      const el = realCreate(tag as "div", options);
      if (tag === "a") captured.anchor = el as unknown as HTMLAnchorElement;
      return el;
    }) as unknown as typeof document.createElement);

    const env = envelope({ tasks: [taskFixture()] });
    try {
      downloadBackup(env);

      expect(click).toHaveBeenCalledTimes(1);
      expect(captured.anchor?.download).toBe("yaoshitu-backup-20261015.json");
      // 临时节点必须收干净
      expect(document.body.contains(captured.anchor ?? null)).toBe(false);
      // 临时 objectURL 必须撤销，否则整页生命周期内都泄漏
      expect(stub.revokeObjectURL).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }

    const text = await blobText(stub.captured.blob!);
    expect(text).toContain("\n  "); // 2 空格缩进：备份文件要人类可读
    expect(JSON.parse(text)).toEqual(env);

    stub.restore();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startOfDay,
  formatDate,
  formatDateCn,
  formatDateTime,
  daysFromToday,
  isOverdue,
  relativeDays,
  dueLabel,
  daysAgo,
} from "./datetime";

// 时间戳一律用「本地时间」构造，断言也只看本地时间的年月日时分。
// 这样无论跑在哪个时区、有没有夏令时，结论都一致。
const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms).getTime();

afterEach(() => {
  vi.useRealTimers();
});

describe("格式化", () => {
  it("formatDate 补零成 YYYY-MM-DD", () => {
    expect(formatDate(local(2026, 1, 3))).toBe("2026-01-03");
    expect(formatDate(local(2026, 12, 31))).toBe("2026-12-31");
  });

  it("formatDateCn 是「M月D日」，不补零", () => {
    expect(formatDateCn(local(2026, 1, 3))).toBe("1月3日");
    expect(formatDateCn(local(2026, 11, 20))).toBe("11月20日");
  });

  it("formatDateTime 补零到分钟", () => {
    expect(formatDateTime(local(2026, 1, 3, 7, 5))).toBe("2026-01-03 07:05");
    expect(formatDateTime(local(2026, 1, 3, 23, 59))).toBe("2026-01-03 23:59");
    expect(formatDateTime(local(2026, 1, 3, 0, 0))).toBe("2026-01-03 00:00");
  });

  it("dueLabel：没有截止时间返回空串，有则带「截止」前缀", () => {
    expect(dueLabel(undefined)).toBe("");
    expect(dueLabel(local(2026, 1, 3))).toBe("截止 1月3日");
  });
});

describe("startOfDay", () => {
  it("一天之内的任何时刻都归到当天 00:00:00.000", () => {
    const s = new Date(startOfDay(local(2026, 10, 15, 23, 59, 59, 999)));
    expect([s.getFullYear(), s.getMonth() + 1, s.getDate()]).toEqual([2026, 10, 15]);
    expect([s.getHours(), s.getMinutes(), s.getSeconds(), s.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("已经是当天零点时是幂等的", () => {
    const midnight = local(2026, 10, 15);
    expect(startOfDay(midnight)).toBe(midnight);
  });
});

describe("按自然日计算的天数差", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  });

  it("daysFromToday 看的是自然日，不是「相差 24 小时」", () => {
    expect(daysFromToday(local(2026, 10, 15, 23, 59))).toBe(0);
    expect(daysFromToday(local(2026, 10, 15, 0, 1))).toBe(0);
    // 只差 12 小时，但跨了午夜 → 算 1 天
    expect(daysFromToday(local(2026, 10, 16, 0, 1))).toBe(1);
    expect(daysFromToday(local(2026, 10, 14, 23, 59))).toBe(-1);
  });

  it("relativeDays 的文案（今天 / 明天 / 昨天 / N 天后 / N 天前）", () => {
    expect(relativeDays(local(2026, 10, 15, 8))).toBe("今天");
    expect(relativeDays(local(2026, 10, 16))).toBe("明天");
    expect(relativeDays(local(2026, 10, 14))).toBe("昨天");
    expect(relativeDays(local(2026, 10, 18))).toBe("3 天后");
    expect(relativeDays(local(2026, 10, 12))).toBe("3 天前");
  });
});

describe("isOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  });

  it("没有截止时间 → 不逾期", () => {
    expect(isOverdue({ completed: false })).toBe(false);
    expect(isOverdue({ dueAt: undefined, completed: false })).toBe(false);
  });

  it("已完成的任务一律不报逾期，哪怕截止时间早就过了", () => {
    expect(isOverdue({ dueAt: local(2026, 10, 1), completed: true })).toBe(false);
  });

  it("未完成 + 截止时间已过 → 逾期；未到 → 不逾期", () => {
    expect(isOverdue({ dueAt: local(2026, 10, 15, 11, 59), completed: false })).toBe(true);
    expect(isOverdue({ dueAt: local(2026, 10, 15, 12, 1), completed: false })).toBe(false);
  });
});

describe("daysAgo（「上次备份 N 天前」用）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  });

  it("今天 → 0", () => {
    expect(daysAgo(local(2026, 10, 15, 9))).toBe(0);
  });

  it("3 天前 → 3", () => {
    expect(daysAgo(local(2026, 10, 12, 9))).toBe(3);
  });

  it("未来时间戳（时钟回拨）夹到 0，不出现负数", () => {
    expect(daysAgo(local(2026, 10, 20))).toBe(0);
  });
});

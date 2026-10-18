import { describe, it, expect } from "vitest";
import {
  UNIT,
  PLOT,
  MARGIN,
  WORLD,
  worldX,
  worldY,
  worldToUrgency,
  worldToImportance,
  layoutPoints,
} from "./coordinate";

describe("坐标系常量与映射", () => {
  it("画布尺寸三相自洽", () => {
    expect(PLOT).toBe(UNIT * 100);
    expect(WORLD).toBe(PLOT + MARGIN * 2);
  });

  it("紧急 / 重要取值 1..100 全部落在留白之内（点不会被裁掉）", () => {
    for (let v = 1; v <= 100; v++) {
      expect(worldX(v)).toBeGreaterThanOrEqual(MARGIN);
      expect(worldX(v)).toBeLessThanOrEqual(WORLD - MARGIN);
      expect(worldY(v)).toBeGreaterThanOrEqual(MARGIN);
      expect(worldY(v)).toBeLessThanOrEqual(WORLD - MARGIN);
    }
  });

  it("方向语义：右=更紧急，上=更重要", () => {
    expect(worldX(80)).toBeGreaterThan(worldX(20));
    // SVG 的 y 轴向下，所以「更重要」对应更小的 y —— 视觉上更靠上
    expect(worldY(80)).toBeLessThan(worldY(20));
  });

  it("世界坐标与紧急 / 重要双向可逆", () => {
    for (const v of [1, 25, 50, 99, 100]) {
      expect(worldToUrgency(worldX(v))).toBeCloseTo(v, 10);
      expect(worldToImportance(worldY(v))).toBeCloseTo(v, 10);
    }
  });
});

describe("layoutPoints —— 重叠点的散开", () => {
  it("空输入返回空", () => {
    expect(layoutPoints([])).toEqual([]);
  });

  it("只有一个点时不做任何位移，坐标就是它的真实坐标", () => {
    const laid = layoutPoints([{ id: "a", urgency: 50, importance: 50 }]);
    expect(laid).toHaveLength(1);
    expect(laid[0]).toMatchObject({ id: "a", urgency: 50, importance: 50 });
    expect(laid[0].x).toBe(worldX(50));
    expect(laid[0].y).toBe(worldY(50));
  });

  it("分属不同网格单元的点互不影响", () => {
    const laid = layoutPoints([
      { id: "a", urgency: 10, importance: 10 },
      { id: "b", urgency: 90, importance: 90 },
    ]);
    const byId = new Map(laid.map((p) => [p.id, p]));
    expect(byId.get("a")!.x).toBe(worldX(10));
    expect(byId.get("a")!.y).toBe(worldY(10));
    expect(byId.get("b")!.x).toBe(worldX(90));
    expect(byId.get("b")!.y).toBe(worldY(90));
  });

  it("同一网格单元内的点被散开，两两不再重合，且 id 一个不多一个不少", () => {
    const input = [
      { id: "a", urgency: 50, importance: 50 },
      { id: "b", urgency: 50, importance: 50 },
      { id: "c", urgency: 50, importance: 50 },
    ];
    const laid = layoutPoints(input);

    expect(laid).toHaveLength(3);
    expect(new Set(laid.map((p) => p.id))).toEqual(new Set(["a", "b", "c"]));

    for (const p of laid) {
      expect(Math.hypot(p.urgency - 50, p.importance - 50)).toBeGreaterThan(0);
    }
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const d = Math.hypot(laid[i].x - laid[j].x, laid[i].y - laid[j].y);
        expect(d).toBeGreaterThan(1);
      }
    }
  });

  it("散开半径有上限（封顶 2.6 个坐标单位），不会把点甩得很远", () => {
    const input = Array.from({ length: 12 }, (_, k) => ({
      id: `t${k}`,
      urgency: 50,
      importance: 50,
    }));
    const laid = layoutPoints(input);
    for (const p of laid) {
      const worldDistance = Math.hypot(p.x - worldX(50), p.y - worldY(50));
      expect(worldDistance / UNIT).toBeLessThanOrEqual(2.6 + 1e-9);
    }
  });

  it("贴边堆叠时坐标仍被夹在 1..100，不会跑出坐标范围", () => {
    const laid = layoutPoints([
      { id: "a", urgency: 100, importance: 100 },
      { id: "b", urgency: 100, importance: 100 },
    ]);
    for (const p of laid) {
      expect(p.urgency).toBeGreaterThanOrEqual(1);
      expect(p.urgency).toBeLessThanOrEqual(100);
      expect(p.importance).toBeGreaterThanOrEqual(1);
      expect(p.importance).toBeLessThanOrEqual(100);
      expect(p.x).toBeGreaterThanOrEqual(worldX(1));
      expect(p.x).toBeLessThanOrEqual(worldX(100));
      expect(p.y).toBeGreaterThanOrEqual(worldY(100));
      expect(p.y).toBeLessThanOrEqual(worldY(1));
    }
  });

  it("不修改入参", () => {
    const input = [{ id: "a", urgency: 50, importance: 50 }];
    layoutPoints(input);
    expect(input).toEqual([{ id: "a", urgency: 50, importance: 50 }]);
  });

  // 已确认的局限，不是本次要改的：角落 (100,100) 上没有任何向内散开的余量，
  // 4 个点堆在那里时 clamp 会把其中两点重新压到同一位置（即完全重叠）。
  // 修法是把整个环整体平移进可用区域（而不是逐点 clamp），属于算法改动 —— 见 TODO.md。
  it.todo("贴角堆叠 ≥4 点时仍会出现两点完全重合 —— 待改算法");
});

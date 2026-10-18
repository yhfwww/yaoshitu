import { describe, it, expect } from "vitest";
import { quadrantOf, quadrantMeta } from "./schema";
import type { Quadrant } from "./schema";

const ALL: Quadrant[] = ["q1", "q2", "q3", "q4"];

// 四象限是坐标数据的「第二种投影」（连续 → 阈值二值化）。
// 两者必须永远读同一份数据，所以这层投影的边界值得钉住。
describe("quadrantOf —— 坐标到四象限的阈值投影", () => {
  it("阈值取 50/50，恰好等于 50 归入「高」那一侧", () => {
    expect(quadrantOf(50, 50)).toBe("q1"); // 高重要 + 高紧急
    expect(quadrantOf(49, 50)).toBe("q2"); // 高重要 + 低紧急
    expect(quadrantOf(50, 49)).toBe("q4"); // 低重要 + 高紧急
    expect(quadrantOf(49, 49)).toBe("q3"); // 都低
  });

  it("遍历 1..100 全域：四个象限都能取到，且不会返回未定义的值", () => {
    const seen = new Set<Quadrant>();
    for (let u = 1; u <= 100; u++) {
      for (let i = 1; i <= 100; i++) {
        const q = quadrantOf(u, i);
        expect(ALL).toContain(q);
        seen.add(q);
      }
    }
    expect([...seen].sort()).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("紧急轴推过阈值 → q2 变 q1；重要轴推过阈值 → q4 变 q1", () => {
    expect(quadrantOf(10, 90)).toBe("q2");
    expect(quadrantOf(90, 90)).toBe("q1");
    expect(quadrantOf(90, 10)).toBe("q4");
  });

  it("四个象限都有中文标签与提示（避免界面出现空标签）", () => {
    for (const q of ALL) {
      expect(quadrantMeta[q].label.length).toBeGreaterThan(0);
      expect(quadrantMeta[q].hint.length).toBeGreaterThan(0);
    }
  });
});

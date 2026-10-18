import { describe, it, expect } from "vitest";
import { VIEWS, SMART_VIEWS } from "./views";
import { SMART_THRESHOLDS } from "../db/schema";

describe("视图注册表", () => {
  it("视图 id 不重复", () => {
    const ids = VIEWS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个视图都有 label / hint / icon（侧边栏与命令面板都靠它渲染）", () => {
    for (const v of VIEWS) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.hint.length).toBeGreaterThan(0);
      expect(v.icon.length).toBeGreaterThan(0);
    }
  });

  it("坐标系排在首位（旗舰视图），且列表视图在册（无障碍主通道）", () => {
    expect(VIEWS[0].id).toBe("coordinate");
    expect(VIEWS.map((v) => v.id)).toContain("list");
  });

  it("智能视图 id 不重复，且五个都在册", () => {
    const ids = SMART_VIEWS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(["byTag", "delegate", "due", "eliminate", "hot"]);
  });
});

describe("智能视图文案与阈值常量不脱节", () => {
  // 这些 desc 直接显示给用户看，数字是写死在文案里的。
  // 一旦 schema 里的阈值改了而文案没跟着改，界面就会对用户说谎 —— 这里把两者绑住。
  const descOf = (id: string) => SMART_VIEWS.find((v) => v.id === id)!.desc;

  it("热点：紧急 / 重要阈值与常量一致", () => {
    expect(descOf("hot")).toContain(String(SMART_THRESHOLDS.hotUrgency));
    expect(descOf("hot")).toContain(String(SMART_THRESHOLDS.hotImportance));
  });

  it("可委派：重要上限与紧急下限与常量一致", () => {
    expect(descOf("delegate")).toContain(String(SMART_THRESHOLDS.delegateImportanceMax));
    expect(descOf("delegate")).toContain(String(SMART_THRESHOLDS.delegateUrgencyMin));
  });

  it("该消除：两个上限与常量一致", () => {
    expect(descOf("eliminate")).toContain(String(SMART_THRESHOLDS.eliminateUrgencyMax));
    expect(descOf("eliminate")).toContain(String(SMART_THRESHOLDS.eliminateImportanceMax));
  });

  it("即将逾期：天数与常量一致", () => {
    expect(descOf("due")).toContain(`${SMART_THRESHOLDS.dueWithinDays}天`);
  });
});

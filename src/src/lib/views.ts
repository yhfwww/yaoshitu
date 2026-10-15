// 视图注册表（侧边栏 / 命令面板共用）
import type { ViewId, SmartViewId } from "../db/schema";
import type { IconName } from "../components/Icon";

export interface ViewMeta {
  id: ViewId;
  label: string;
  hint: string;
  icon: IconName;
}

export const VIEWS: ViewMeta[] = [
  { id: "coordinate", label: "坐标系", hint: "连续坐标 · 旗舰视图", icon: "axis" },
  { id: "matrix", label: "象限矩阵", hint: "四象限投影", icon: "grid" },
  { id: "list", label: "列表", hint: "键盘与读屏主通道", icon: "list" },
  { id: "smart", label: "智能视图", hint: "梯度自动筛选", icon: "spark" },
  { id: "dashboard", label: "仪表盘", hint: "完成趋势与复盘", icon: "chart" },
  { id: "principles", label: "工作方式", hint: "纯笔记", icon: "book" },
  { id: "archive", label: "归档", hint: "回收站 + 永久归档", icon: "archive" },
];

export interface SmartViewMeta {
  id: SmartViewId;
  label: string;
  desc: string;
}

export const SMART_VIEWS: SmartViewMeta[] = [
  { id: "hot", label: "🔥 热点", desc: "紧急>75 且 重要>75" },
  { id: "due", label: "⏰ 即将逾期", desc: "截止<3天 且 未完成" },
  { id: "delegate", label: "🤝 可委派", desc: "重要<40 且 紧急>60" },
  { id: "eliminate", label: "🗑️ 该消除", desc: "紧急<40 且 重要<40" },
  { id: "byTag", label: "🏷️ 按标签", desc: "按标签聚合" },
];

// 品牌色 tokens —— 依据 docs/brand-system.md v1.1
// 纪律：全产品只允许一个高饱和色（purple 600），其余一律灰阶；禁红绿表意。
export const colors = {
  // 主色
  primary: "#534AB7", // purple 600 —— 实心点、唯一强调色
  primaryDark: "#3C3489", // purple 800 —— wordmark 文字、标题
  primarySoft: "#EEEDFE", // purple 50 —— 象限淡填、选中态背景

  // 灰阶
  axis: "#888780", // gray 400 —— 坐标轴、虚点、次要描边
  card: "#F1EFE8", // gray 50 —— 面板/卡片背景
  text: "#2C2C2A", // gray 900 —— 正文
  textMuted: "#5F5E5A", // gray 600 —— 说明文字、副标题
  border: "#B4B2A9", // gray 200 —— 边框、分隔线

  // 语义补充（灰阶，非色相表意）
  white: "#FFFFFF",
  hover: "#E9E6DC", // 略深于 card 的 hover 底
  danger: "#5F5E5A", // 删除等危险操作也用灰阶表达，避免红色语义
} as const;

export type ColorKey = keyof typeof colors;

// 生成唯一 id（浏览器/Node 均可用）
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 兜底
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

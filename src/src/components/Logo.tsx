// 品牌 LOGO —— 方案 A · 十字焦点（坐标十字 + 1 实心紫点 + 4 空心灰点）
// 无渐变、无阴影、无动效。
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="5" fill="var(--c-card)" />
      {/* 坐标十字 */}
      <line x1="12" y1="3" x2="12" y2="21" stroke="var(--c-axis)" strokeWidth="1.2" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="var(--c-axis)" strokeWidth="1.2" />
      {/* 空心灰点（4 颗） */}
      <circle cx="7" cy="7.5" r="2" stroke="var(--c-axis)" strokeWidth="1.2" fill="none" />
      <circle cx="7" cy="16.5" r="2" stroke="var(--c-axis)" strokeWidth="1.2" fill="none" />
      <circle cx="17" cy="16.5" r="2" stroke="var(--c-axis)" strokeWidth="1.2" fill="none" />
      <circle cx="10.5" cy="14" r="1.6" stroke="var(--c-axis)" strokeWidth="1" fill="none" />
      {/* 实心「要事」点 */}
      <circle cx="17" cy="7.5" r="3" fill="var(--c-primary)" />
    </svg>
  );
}

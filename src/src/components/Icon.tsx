// 极简线性图标（16px，stroke 灰阶，无动效）
export type IconName =
  | "axis"
  | "grid"
  | "list"
  | "spark"
  | "chart"
  | "book"
  | "archive"
  | "search"
  | "plus"
  | "close"
  | "check"
  | "trash"
  | "restore"
  | "pin"
  | "tag"
  | "clock"
  | "edit"
  | "more"
  | "settings";

const PATHS: Record<IconName, React.ReactNode> = {
  axis: (
    <>
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <circle cx="11.5" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  grid: (
    <>
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="2" y="8.5" width="5.5" height="5.5" rx="1" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
    </>
  ),
  list: (
    <>
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="12" x2="13" y2="12" />
    </>
  ),
  spark: (
    <path d="M8 1.5 L9.3 6.7 L14.5 8 L9.3 9.3 L8 14.5 L6.7 9.3 L1.5 8 L6.7 6.7 Z" />
  ),
  chart: (
    <>
      <line x1="3" y1="13" x2="13" y2="13" />
      <line x1="3" y1="13" x2="3" y2="2" />
      <rect x="4.5" y="8" width="2" height="5" />
      <rect x="7.5" y="5" width="2" height="8" />
      <rect x="10.5" y="3" width="2" height="10" />
    </>
  ),
  book: (
    <>
      <path d="M2 3.5 A1 1 0 0 1 3 2.5 H6 A1.5 1.5 0 0 1 7.5 4 V13 A1.5 1.5 0 0 0 6 11.5 H2 Z" />
      <path d="M14 3.5 A1 1 0 0 0 13 2.5 H10 A1.5 1.5 0 0 0 8.5 4 V13 A1.5 1.5 0 0 1 10 11.5 H14 Z" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="3" width="12" height="4" rx="1" />
      <path d="M3 7 V12.5 A1 1 0 0 0 4 13.5 H12 A1 1 0 0 0 13 12.5 V7" />
      <line x1="6.5" y1="9.5" x2="9.5" y2="9.5" />
    </>
  ),
  search: (
    <>
      <circle cx="6.5" cy="6.5" r="4" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" />
    </>
  ),
  plus: (
    <>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </>
  ),
  close: (
    <>
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </>
  ),
  check: <path d="M2.5 8 L6 11.5 L13.5 4" />,
  trash: (
    <>
      <path d="M2.5 4 H13.5" />
      <path d="M6 4 V2.5 H10 V4" />
      <path d="M4 4 L4.8 13.5 A1 1 0 0 0 5.8 14.5 H10.2 A1 1 0 0 0 11.2 13.5 L12 4" />
    </>
  ),
  restore: (
    <path d="M3 5 A5 5 0 0 1 13 5 M3 5 V9 M3 5 H7 M13 5 A5 5 0 0 1 3 11" />
  ),
  pin: (
    <path d="M6 2 L10 6 L13 3 L10 8 L12 14 L6 11 L2 13 L5 7 L8 2 Z" />
  ),
  tag: (
    <>
      <path d="M2 2 H7 L14 9 L9 14 L2 7 Z" />
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <line x1="8" y1="4.5" x2="8" y2="8" />
      <line x1="8" y1="8" x2="11" y2="10" />
    </>
  ),
  edit: (
    <>
      <path d="M9.5 3 L13 6.5 L5 14.5 L1.5 15 L2 11.5 Z" />
    </>
  ),
  more: (
    <>
      <circle cx="3" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="13" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <line x1="2" y1="4" x2="14" y2="4" />
      <circle cx="10" cy="4" r="1.5" fill="var(--c-white)" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <circle cx="5" cy="8" r="1.5" fill="var(--c-white)" />
      <line x1="2" y1="12" x2="14" y2="12" />
      <circle cx="11" cy="12" r="1.5" fill="var(--c-white)" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

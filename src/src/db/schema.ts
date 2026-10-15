// 数据模型 —— 全量 schema（依据 docs/task-matrix-requirements.md）
// 原则：子任务、递归、时间追踪、依赖、提醒等字段一次建模，UI 分批上线。
// 「已建模未出 UI」字段：timeEntries / dependencies / reminderAt / parentId(子任务 UI) / recurrence

export type ViewId =
  | "coordinate"
  | "matrix"
  | "list"
  | "smart"
  | "dashboard"
  | "principles"
  | "archive";

export type SmartViewId =
  | "hot" // 🔥 热点：紧急>75 且 重要>75
  | "due" // ⏰ 即将逾期：截止<3天 且 未完成
  | "delegate" // 🤝 可委派：重要<40 且 紧急>60
  | "eliminate" // 🗑️ 该消除：紧急<40 且 重要<40
  | "byTag"; // 🏷️ 按标签

export interface TimeEntry {
  id: string;
  startedAt: number;
  endedAt?: number;
  note?: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string;

  // 连续坐标（1-100）—— 核心差异化
  urgency: number;
  importance: number;

  // 状态
  completed: boolean;
  completedAt?: number;
  deletedAt?: number; // 软删除时间戳 → 回收站（30 天后可永久清除）
  archived: boolean; // 永久归档

  // 时间
  createdAt: number;
  updatedAt: number;
  dueAt?: number;

  // 标签
  tags: string[];

  // 层级：子任务（UI 分批，字段已建模）
  parentId?: string;

  // 递归（一个点代表整个系列）
  recurrence?: "daily" | "weekly" | "monthly";

  // 时间追踪（已建模未出 UI）
  timeEntries: TimeEntry[];

  // 依赖（已建模未出 UI）：阻塞本任务的前置任务 id
  dependencies: string[];

  // 提醒（已建模未出 UI）
  reminderAt?: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id: string;
  defaultView: ViewId;
  lastBackupAt?: number;
  seeded?: boolean; // 是否已注入示例数据（内部标记）
}

// 备份信封（版本化，导入导出用）
export interface BackupEnvelope {
  app: "yaoshitu";
  formatVersion: 1;
  exportedAt: string;
  tasks: Task[];
  notes: Note[];
  settings: Settings;
}

// 四象限投影：以 50/50 为阈值
export type Quadrant = "q1" | "q2" | "q3" | "q4";
// q1 = 重要高 + 紧急高（右上）
// q2 = 重要高 + 紧急低（左上）
// q3 = 重要低 + 紧急低（左下）
// q4 = 重要低 + 紧急高（右下）

export function quadrantOf(urgency: number, importance: number): Quadrant {
  const important = importance >= 50;
  const urgent = urgency >= 50;
  if (important && urgent) return "q1";
  if (important && !urgent) return "q2";
  if (!important && !urgent) return "q3";
  return "q4";
}

export const quadrantMeta: Record<
  Quadrant,
  { label: string; hint: string }
> = {
  q1: { label: "重要且紧急", hint: "立即处理" },
  q2: { label: "重要不紧急", hint: "安排时间" },
  q3: { label: "不重要不紧急", hint: "考虑消除" },
  q4: { label: "紧急不重要", hint: "可委派" },
};

// 智能视图阈值（初稿，固定 5 个）
export const SMART_THRESHOLDS = {
  hotUrgency: 75,
  hotImportance: 75,
  delegateImportanceMax: 40,
  delegateUrgencyMin: 60,
  eliminateUrgencyMax: 40,
  eliminateImportanceMax: 40,
  dueWithinDays: 3,
} as const;

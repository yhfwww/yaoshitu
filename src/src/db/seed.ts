// 首次启动示例数据 —— 帮助理解坐标系语义
import type { Task, Note } from "./schema";
import { newId } from "../lib/id";

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

interface SeedTask {
  title: string;
  notes?: string;
  urgency: number;
  importance: number;
  dueAt?: number;
  tags?: string[];
  completed?: boolean;
}

function makeTask(t: SeedTask, offsetDays = 0): Task {
  const ts = now - offsetDays * DAY;
  return {
    id: newId(),
    title: t.title,
    notes: t.notes ?? "",
    urgency: t.urgency,
    importance: t.importance,
    completed: t.completed ?? false,
    completedAt: t.completed ? ts : undefined,
    createdAt: ts,
    updatedAt: ts,
    dueAt: t.dueAt,
    tags: t.tags ?? [],
    timeEntries: [],
    dependencies: [],
    archived: false,
  };
}

export function seedTasks(): Task[] {
  return [
    makeTask(
      {
        title: "完成要事图 MVP 发布",
        notes: "本地优先 + 坐标系视图上线。",
        urgency: 88,
        importance: 92,
        dueAt: now + 2 * DAY,
        tags: ["工作", "里程碑"],
      },
      2,
    ),
    makeTask({
      title: "写季度复盘",
      notes: "聚焦坐标系方法的实际效果。",
      urgency: 65,
      importance: 78,
      dueAt: now + 5 * DAY,
      tags: ["工作"],
    }),
    makeTask({
      title: "预约年度体检",
      urgency: 45,
      importance: 85,
      dueAt: now + 20 * DAY,
      tags: ["健康"],
    }),
    makeTask({
      title: "回复积压邮件",
      urgency: 72,
      importance: 35,
      dueAt: now + 1 * DAY,
      tags: ["工作", "沟通"],
    }),
    makeTask({
      title: "整理相册",
      urgency: 25,
      importance: 30,
      tags: ["生活"],
    }),
    makeTask({
      title: "读一本关于决策的书",
      notes: "巩固「要事」判断力。",
      urgency: 30,
      importance: 70,
      tags: ["成长"],
    }),
    makeTask({
      title: "修复登录页样式错位",
      urgency: 55,
      importance: 58,
      dueAt: now + 3 * DAY,
      tags: ["工作", "bug"],
    }),
    makeTask({
      title: "给父母打电话",
      urgency: 50,
      importance: 88,
      dueAt: now + 1 * DAY,
      tags: ["家庭"],
    }),
    makeTask({
      title: "清理浏览器书签",
      urgency: 15,
      importance: 20,
      tags: ["生活"],
    }),
    makeTask({
      title: "草拟团队协作规范",
      urgency: 60,
      importance: 75,
      dueAt: now + 7 * DAY,
      tags: ["工作"],
    }),
  ];
}

export function seedNotes(): Note[] {
  return [
    {
      id: newId(),
      title: "先做重要的事",
      body: "不要被紧急牵着走。重要度是北极星，紧急度只是节奏。",
      tags: ["原则"],
      pinned: true,
      createdAt: now - 3 * DAY,
      updatedAt: now - 3 * DAY,
    },
    {
      id: newId(),
      title: "一次只推进一件事",
      body: "多线程只会稀释注意力。当前要事只有一个。",
      tags: ["原则"],
      pinned: false,
      createdAt: now - 2 * DAY,
      updatedAt: now - 2 * DAY,
    },
  ];
}

// 是否已初始化过示例数据（以 settings 中标记为准）

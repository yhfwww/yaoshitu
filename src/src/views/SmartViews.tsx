import { useMemo } from "react";
import { useStore } from "../store/useStore";
import type { Task, SmartViewId } from "../db/schema";
import { SMART_VIEWS } from "../lib/views";
import { daysFromToday, formatDateCn } from "../lib/datetime";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

function filterSmart(tasks: Task[], id: SmartViewId): Task[] {
  const active = tasks.filter(
    (t) => t.deletedAt === undefined && !t.archived && !t.completed,
  );
  switch (id) {
    case "hot":
      return active.filter((t) => t.urgency > 75 && t.importance > 75);
    case "due":
      return active.filter((t) => t.dueAt !== undefined && daysFromToday(t.dueAt) <= 3);
    case "delegate":
      return active.filter((t) => t.importance < 40 && t.urgency > 60);
    case "eliminate":
      return active.filter((t) => t.urgency < 40 && t.importance < 40);
    case "byTag":
      return active;
  }
}

export function SmartViews() {
  const tasks = useStore((s) => s.tasks);
  const smartView = useStore((s) => s.smartView);
  const openEditor = useStore((s) => s.openEditor);
  const toggleComplete = useStore((s) => s.toggleComplete);

  const meta = SMART_VIEWS.find((s) => s.id === smartView)!;
  const filtered = useMemo(
    () => filterSmart(tasks, smartView).sort((a, b) => b.urgency - a.urgency),
    [tasks, smartView],
  );

  // 按标签聚合
  const tagGroups = useMemo(() => {
    if (smartView !== "byTag") return null;
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      if (t.tags.length === 0) {
        const arr = map.get("未分类") ?? [];
        arr.push(t);
        map.set("未分类", arr);
      } else {
        for (const tag of t.tags) {
          const arr = map.get(tag) ?? [];
          arr.push(t);
          map.set(tag, arr);
        }
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, smartView]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          padding: "8px 16px",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <span style={{ fontWeight: 600 }}>{meta.label}</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{meta.desc}</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          {filtered.length} 项
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {filtered.length === 0 ? (
          <EmptyState
            title="此视图暂无任务"
            hint="阈值可先在需求文档中约定，后续版本支持自定义筛选。"
          />
        ) : tagGroups ? (
          tagGroups.map(([tag, list]) => (
            <section key={tag} style={{ padding: "8px 16px 16px" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--c-primary-dark)",
                  marginBottom: 6,
                }}
              >
                #{tag} <span style={{ fontWeight: 400, color: "var(--c-text-muted)" }}>{list.length}</span>
              </div>
              {list.map((t) => (
                <SmartRow key={t.id} task={t} onEdit={() => openEditor({ taskId: t.id })} onComplete={() => toggleComplete(t.id)} />
              ))}
            </section>
          ))
        ) : (
          filtered.map((t) => (
            <SmartRow key={t.id} task={t} onEdit={() => openEditor({ taskId: t.id })} onComplete={() => toggleComplete(t.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function SmartRow({
  task,
  onEdit,
  onComplete,
}: {
  task: Task;
  onEdit: () => void;
  onComplete: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        borderBottom: "1px solid var(--c-border)",
      }}
    >
      <button
        onClick={onComplete}
        aria-label="标记完成"
        style={{
          width: 17,
          height: 17,
          borderRadius: 4,
          border: "1px solid var(--c-axis)",
          background: "var(--c-white)",
          flexShrink: 0,
        }}
      />
      <button onClick={onEdit} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
        <span
          style={{
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.title}
        </span>
        <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontFamily: "var(--font-mono)" }}>
          紧急 {task.urgency} · 重要 {task.importance}
          {task.dueAt && ` · 截止 ${formatDateCn(task.dueAt)}`}
        </span>
      </button>
      <Icon name="edit" size={14} />
    </div>
  );
}

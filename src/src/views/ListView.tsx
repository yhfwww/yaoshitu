import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import type { Task } from "../db/schema";
import { isOverdue, formatDateCn, relativeDays } from "../lib/datetime";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

type SortKey = "created" | "urgency" | "importance" | "due";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "created", label: "创建时间" },
  { key: "urgency", label: "紧急度" },
  { key: "importance", label: "重要度" },
  { key: "due", label: "截止日期" },
];

export function ListView() {
  const tasks = useStore((s) => s.tasks);
  const openEditor = useStore((s) => s.openEditor);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const trashTask = useStore((s) => s.trashTask);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [showCompleted, setShowCompleted] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = tasks.filter((t) => t.deletedAt === undefined && !t.archived);
    if (!showCompleted) arr = arr.filter((t) => !t.completed);
    if (q) {
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    arr = [...arr].sort((a, b) => {
      switch (sort) {
        case "urgency":
          return b.urgency - a.urgency;
        case "importance":
          return b.importance - a.importance;
        case "due":
          return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
        default:
          return b.createdAt - a.createdAt;
      }
    });
    return arr;
  }, [tasks, query, sort, showCompleted]);

  const incompleteCount = list.filter((t) => !t.completed).length;

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function batchComplete() {
    selected.forEach((id) => toggleComplete(id));
    setSelected(new Set());
  }
  function batchDelete() {
    selected.forEach((id) => trashTask(id));
    setSelected(new Set());
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 工具栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderBottom: "1px solid var(--c-border)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600 }}>列表</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          {incompleteCount} 项进行中
        </span>
        <span style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题 / 标签…"
            aria-label="搜索任务"
            style={{ width: 200, paddingLeft: 26 }}
          />
          <span style={{ position: "absolute", left: 8, top: 9, color: "var(--c-text-muted)" }}>
            <Icon name="search" size={14} />
          </span>
        </div>
        <select
          className="input"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{ width: "auto" }}
          aria-label="排序"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          已完成
        </label>
        <button
          className="btn"
          aria-pressed={batchMode}
          onClick={() => {
            setBatchMode((v) => !v);
            setSelected(new Set());
          }}
        >
          批量
        </button>
      </div>

      {/* 批量操作条 */}
      {batchMode && selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            background: "var(--c-primary-soft)",
            borderBottom: "1px solid var(--c-border)",
          }}
        >
          <span style={{ fontSize: 13 }}>已选 {selected.size} 项</span>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={batchComplete}>
            <Icon name="check" size={14} /> 完成
          </button>
          <button className="btn btn-danger" onClick={batchDelete}>
            <Icon name="trash" size={14} /> 删除
          </button>
        </div>
      )}

      {/* 列表 */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {list.length === 0 ? (
          <EmptyState title="没有任务" hint="换个搜索词，或新建一个任务。" />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} role="list">
            {list.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                batchMode={batchMode}
                checked={selected.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onEdit={() => openEditor({ taskId: t.id })}
                onComplete={() => toggleComplete(t.id)}
                onDelete={() => trashTask(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  batchMode,
  checked,
  onToggleSelect,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: Task;
  batchMode: boolean;
  checked: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const overdue = isOverdue(task);
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--c-border)",
        background: checked ? "var(--c-primary-soft)" : "transparent",
      }}
    >
      {batchMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleSelect}
          aria-label={`选择 ${task.title}`}
        />
      )}
      <button
        onClick={onComplete}
        aria-label={task.completed ? "标记未完成" : "标记完成"}
        aria-pressed={task.completed}
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: "1px solid var(--c-axis)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: task.completed ? "var(--c-primary)" : "var(--c-white)",
          color: task.completed ? "#fff" : "transparent",
          flexShrink: 0,
        }}
      >
        <Icon name="check" size={12} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={onEdit}
          style={{
            display: "block",
            textAlign: "left",
            width: "100%",
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textDecoration: task.completed ? "line-through" : "none",
            color: task.completed ? "var(--c-text-muted)" : "var(--c-text)",
          }}
        >
          {task.title}
        </button>
        <div style={{ fontSize: 11, color: "var(--c-text-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            紧急 {task.urgency} · 重要 {task.importance}
          </span>
          {task.dueAt && (
            <span style={{ color: overdue ? "var(--c-primary-dark)" : undefined, fontWeight: overdue ? 600 : 400 }}>
              {overdue ? "已逾期" : relativeDays(task.dueAt)}（{formatDateCn(task.dueAt)}）
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </div>

      <button className="btn btn-ghost" onClick={onEdit} aria-label="编辑">
        <Icon name="edit" size={14} />
      </button>
      <button className="btn btn-ghost" onClick={onDelete} aria-label="删除">
        <Icon name="trash" size={14} />
      </button>
    </li>
  );
}

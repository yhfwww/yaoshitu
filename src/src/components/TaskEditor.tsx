import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { quadrantMeta, quadrantOf } from "../db/schema";
import { Icon } from "./Icon";

function tsToDateStr(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateStrToTs(s: string): number | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T23:59:59`);
  return d.getTime();
}

export function TaskEditor() {
  const editor = useStore((s) => s.editor);
  const closeEditor = useStore((s) => s.closeEditor);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const trashTask = useStore((s) => s.trashTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const tasks = useStore((s) => s.tasks);

  const existing = editor.taskId
    ? tasks.find((t) => t.id === editor.taskId)
    : undefined;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState(50);
  const [importance, setImportance] = useState(50);
  const [dueStr, setDueStr] = useState("");
  const [tagsStr, setTagsStr] = useState("");

  useEffect(() => {
    if (editor.open) {
      setTitle(existing?.title ?? "");
      setNotes(existing?.notes ?? "");
      setUrgency(existing?.urgency ?? editor.defaults?.urgency ?? 50);
      setImportance(existing?.importance ?? editor.defaults?.importance ?? 50);
      setDueStr(tsToDateStr(existing?.dueAt));
      setTagsStr(existing?.tags?.join(", ") ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.open, editor.taskId]);

  if (!editor.open) return null;

  const q = quadrantOf(urgency, importance);

  function onSave() {
    const t = title.trim();
    if (!t) return;
    const tags = tagsStr
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const dueAt = dateStrToTs(dueStr);

    if (existing) {
      updateTask(existing.id, { title: t, notes, urgency, importance, dueAt, tags });
    } else {
      addTask({ title: t, notes, urgency, importance, dueAt, tags });
    }
    closeEditor();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(44,44,42,0.35)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={closeEditor}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={existing ? "编辑任务" : "新建任务"}
        style={{
          width: 520,
          maxWidth: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--c-white)",
          border: "1px solid var(--c-border)",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(44,44,42,0.18)",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17 }}>
            {existing ? "编辑任务" : "新建任务"}
          </h2>
          <button className="btn-ghost" onClick={closeEditor} aria-label="关闭">
            <Icon name="close" size={16} />
          </button>
        </div>

        <label
          style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}
        >
          标题
        </label>
        <input
          className="input"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
          }}
          placeholder="要做什么？"
        />

        <label
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--c-text-muted)",
            margin: "14px 0 4px",
          }}
        >
          备注
        </label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="补充说明（可选）"
        />

        {/* 坐标 */}
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            background: "var(--c-card)",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>坐标</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--c-primary-dark)",
              }}
            >
              紧急 {urgency} · 重要 {importance}
            </span>
          </div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
            紧急度 {urgency}
            <input
              type="range"
              min={1}
              max={100}
              value={urgency}
              onChange={(e) => setUrgency(Number(e.target.value))}
              style={{ display: "block", width: "100%", accentColor: "var(--c-primary)" }}
            />
          </label>
          <label style={{ display: "block", fontSize: 12 }}>
            重要度 {importance}
            <input
              type="range"
              min={1}
              max={100}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              style={{ display: "block", width: "100%", accentColor: "var(--c-primary)" }}
            />
          </label>
          <div style={{ fontSize: 12, color: "var(--c-text-muted)", marginTop: 6 }}>
            落点：{quadrantMeta[q].label} · {quadrantMeta[q].hint}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label
              style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}
            >
              截止日期
            </label>
            <input
              className="input"
              type="date"
              value={dueStr}
              onChange={(e) => setDueStr(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}
            >
              标签（逗号分隔）
            </label>
            <input
              className="input"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="工作, 健康"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 20,
          }}
        >
          <button className="btn btn-primary" onClick={onSave} disabled={!title.trim()}>
            保存
          </button>
          {existing && (
            <>
              <button className="btn" onClick={() => toggleComplete(existing.id)}>
                {existing.completed ? "标记未完成" : "标记完成"}
              </button>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-danger"
                onClick={() => {
                  trashTask(existing.id);
                  closeEditor();
                }}
              >
                删除
              </button>
            </>
          )}
          {!existing && <span style={{ flex: 1 }} />}
          <button className="btn btn-ghost" onClick={closeEditor}>
            取消
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 10 }}>
          提示：Ctrl/⌘ + Enter 快速保存
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useStore } from "../store/useStore";
import type { Task } from "../db/schema";
import { formatDateCn } from "../lib/datetime";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

const RETENTION_DAYS = 30;

export function ArchiveView() {
  const tasks = useStore((s) => s.tasks);
  const restoreTask = useStore((s) => s.restoreTask);
  const unarchiveTask = useStore((s) => s.unarchiveTask);
  const purgeTask = useStore((s) => s.purgeTask);
  const trashTask = useStore((s) => s.trashTask);
  const notes = useStore((s) => s.notes);
  const restoreNote = useStore((s) => s.restoreNote);
  const deletedNotes = notes.filter((n) => n.deletedAt !== undefined);

  const [tab, setTab] = useState<"trash" | "archived">("trash");

  const trash = tasks
    .filter((t) => t.deletedAt !== undefined)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  const archived = tasks
    .filter((t) => t.archived && t.deletedAt === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <span style={{ fontWeight: 600 }}>归档</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          回收站保留 30 天后自动清除
        </span>
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="btn"
            style={{
              background: tab === "trash" ? "var(--c-primary-soft)" : undefined,
              color: tab === "trash" ? "var(--c-primary-dark)" : undefined,
            }}
            onClick={() => setTab("trash")}
          >
            回收站 {trash.length + deletedNotes.length ? `(${trash.length + deletedNotes.length})` : ""}
          </button>
          <button
            className="btn"
            style={{
              background: tab === "archived" ? "var(--c-primary-soft)" : undefined,
              color: tab === "archived" ? "var(--c-primary-dark)" : undefined,
            }}
            onClick={() => setTab("archived")}
          >
            已归档 {archived.length ? `(${archived.length})` : ""}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {tab === "trash" && deletedNotes.map((note) => <div key={note.id} style={{ padding: 16, borderBottom: "1px solid var(--c-border)" }}>
          <span>笔记 · {note.title}</span>{" "}
          <button className="btn" onClick={() => restoreNote(note.id)}>恢复笔记</button>
        </div>)}
        {tab === "trash" ? (
          trash.length + deletedNotes.length === 0 ? (
            <EmptyState title="回收站是空的" hint="删除的任务和笔记会先进入这里，30 天后自动清除。" />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }} role="list">
              {trash.map((t) => (
                <TrashRow
                  key={t.id}
                  task={t}
                  onRestore={() => restoreTask(t.id)}
                  onPurge={() => purgeTask(t.id)}
                />
              ))}
            </ul>
          )
        ) : archived.length === 0 ? (
          <EmptyState title="暂无永久归档" hint="在任务上选择「归档」后会出现在这里。" />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }} role="list">
            {archived.map((t) => (
              <li
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--c-border)",
                }}
              >
                <span style={{ flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                  归档于 {formatDateCn(t.updatedAt)}
                </span>
                <button className="btn" onClick={() => unarchiveTask(t.id)}>
                  <Icon name="restore" size={14} /> 恢复
                </button>
                <button className="btn" onClick={() => trashTask(t.id)}>
                  移入回收站
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TrashRow({
  task,
  onRestore,
  onPurge,
}: {
  task: Task;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const daysLeft = task.deletedAt
    ? RETENTION_DAYS - Math.floor((Date.now() - task.deletedAt) / (24 * 60 * 60 * 1000))
    : 0;
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--c-border)",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
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
        <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
          删除于 {task.deletedAt ? formatDateCn(task.deletedAt) : ""} · 剩余 {Math.max(0, daysLeft)} 天
        </span>
      </span>
      <button className="btn" onClick={onRestore}>
        <Icon name="restore" size={14} /> 恢复
      </button>
      <button className="btn btn-danger" onClick={onPurge}>
        彻底删除
      </button>
    </li>
  );
}

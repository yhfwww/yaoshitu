import { useState } from "react";
import { useStore } from "../store/useStore";
import type { Note } from "../db/schema";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

export function PrinciplesView() {
  const notes = useStore((s) => s.notes);
  const togglePinNote = useStore((s) => s.togglePinNote);
  const deleteNote = useStore((s) => s.deleteNote);

  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = notes.filter((n) => !n.deletedAt).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

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
        <span style={{ fontWeight: 600 }}>工作方式</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          记录做事原则（纯笔记，不与任务联动）
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> 新建笔记
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 16 }}>
        {sorted.length === 0 ? (
          <EmptyState
            title="还没有笔记"
            hint="写下你做事的原则，比如「先做重要的事」。"
            action={{ label: "新建笔记", onClick: () => setCreating(true) }}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {sorted.map((n) => (
              <div
                key={n.id}
                style={{
                  background: "var(--c-white)",
                  border: "1px solid var(--c-border)",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {n.pinned && <Icon name="pin" size={13} />}
                  <span style={{ fontWeight: 600, flex: 1 }}>{n.title || "（无标题）"}</span>
                  <button
                    className="btn-ghost"
                    onClick={() => togglePinNote(n.id)}
                    aria-label={n.pinned ? "取消置顶" : "置顶"}
                    style={{ color: n.pinned ? "var(--c-primary-dark)" : "var(--c-text-muted)" }}
                  >
                    <Icon name="pin" size={14} />
                  </button>
                </div>
                {n.body && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 13,
                      color: "var(--c-text)",
                      whiteSpace: "pre-wrap",
                      flex: 1,
                    }}
                  >
                    {n.body}
                  </p>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 10,
                  }}
                >
                  {n.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                      #{tag}
                    </span>
                  ))}
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-ghost" onClick={() => setEditing(n)} aria-label="编辑">
                    <Icon name="edit" size={14} />
                  </button>
                  <button className="btn btn-ghost" onClick={() => deleteNote(n.id)} aria-label="删除">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <NoteEditor
          note={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);

  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [tagsStr, setTagsStr] = useState(note?.tags?.join(", ") ?? "");

  function save() {
    const t = title.trim();
    const tags = tagsStr
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (note) updateNote(note.id, { title: t, body, tags });
    else if (t || body.trim()) addNote({ title: t || "无标题", body, tags });
    onClose();
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
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={note ? "编辑笔记" : "新建笔记"}
        style={{
          width: 520,
          maxWidth: "100%",
          background: "var(--c-white)",
          border: "1px solid var(--c-border)",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(44,44,42,0.18)",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>
          {note ? "编辑笔记" : "新建笔记"}
        </h2>
        <label style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}>
          标题
        </label>
        <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="原则标题" />
        <label style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", margin: "14px 0 4px" }}>
          正文
        </label>
        <textarea
          className="textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="写下这条原则…"
          style={{ minHeight: 120 }}
        />
        <label style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", margin: "14px 0 4px" }}>
          标签（逗号分隔）
        </label>
        <input className="input" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="原则, 效率" />
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={save}>
            保存
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { quadrantOf, quadrantMeta, type Quadrant } from "../db/schema";
import { formatDateCn } from "../lib/datetime";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];

// 跨象限拖拽落点 → 将该象限的代表坐标写回（重新投影）
const QUADRANT_CENTER: Record<Quadrant, { urgency: number; importance: number }> = {
  q1: { urgency: 75, importance: 75 },
  q2: { urgency: 25, importance: 75 },
  q3: { urgency: 25, importance: 25 },
  q4: { urgency: 75, importance: 25 },
};

export function MatrixView() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const openEditor = useStore((s) => s.openEditor);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Quadrant | null>(null);

  const active = useMemo(
    () => tasks.filter((t) => t.deletedAt === undefined && !t.archived && !t.completed),
    [tasks],
  );

  const byQuadrant = useMemo(() => {
    const m: Record<Quadrant, typeof active> = { q1: [], q2: [], q3: [], q4: [] };
    for (const t of active) m[quadrantOf(t.urgency, t.importance)].push(t);
    return m;
  }, [active]);

  function onDrop(q: Quadrant) {
    if (dragId) {
      updateTask(dragId, { ...QUADRANT_CENTER[q] });
    }
    setDragId(null);
    setDropTarget(null);
  }

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
        <span style={{ fontWeight: 600 }}>象限矩阵</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          连续坐标按 50/50 阈值投影 · 拖拽跨象限即调坐标
        </span>
      </div>

      {active.length === 0 ? (
        <EmptyState title="没有进行中的任务" hint="在坐标系或列表中新建任务后会显示在这里。" />
      ) : (
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 1,
            background: "var(--c-border)",
            minHeight: 0,
          }}
        >
          {QUADRANTS.map((q) => {
            const meta = quadrantMeta[q];
            const list = byQuadrant[q];
            return (
              <div
                key={q}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(q);
                }}
                onDragLeave={() => setDropTarget((d) => (d === q ? null : d))}
                onDrop={() => onDrop(q)}
                style={{
                  background:
                    dropTarget === q ? "var(--c-primary-soft)" : "var(--c-bg)",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  transition: "background 0.12s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "10px 14px 6px",
                    borderBottom: "1px solid var(--c-border)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{meta.label}</span>
                  <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                    {meta.hint}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                    {list.length}
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                  {list.length === 0 && (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--c-text-muted)", fontSize: 12 }}>
                      空
                    </div>
                  )}
                  {list.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTarget(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        marginBottom: 6,
                        background: "var(--c-white)",
                        border: "1px solid var(--c-border)",
                        borderRadius: 8,
                        cursor: "grab",
                        opacity: dragId === t.id ? 0.5 : 1,
                      }}
                    >
                      <button
                        onClick={() => toggleComplete(t.id)}
                        aria-label="标记完成"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: "1px solid var(--c-axis)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "transparent",
                          background: "var(--c-white)",
                        }}
                      >
                        <Icon name="check" size={11} />
                      </button>
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                        onClick={() => openEditor({ taskId: t.id })}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {t.title}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {t.urgency}·{t.importance}
                          </span>
                          {t.dueAt && <span style={{ marginLeft: 8 }}>{formatDateCn(t.dueAt)}</span>}
                          {t.tags.length > 0 && (
                            <span style={{ marginLeft: 8 }}>{t.tags.join(" ")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

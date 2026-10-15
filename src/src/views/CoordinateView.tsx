import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import {
  PLOT,
  MARGIN,
  WORLD,
  POINT_R,
  worldX,
  worldY,
  worldToUrgency,
  worldToImportance,
  layoutPoints,
} from "../lib/coordinate";
import { quadrantOf, quadrantMeta } from "../db/schema";
import { formatDateCn } from "../lib/datetime";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

interface QuadrantLabel {
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "end";
}

const QUADRANT_LABELS: QuadrantLabel[] = [
  { x: MARGIN + 8, y: MARGIN + 16, text: "重要不紧急" },
  { x: WORLD - MARGIN - 8, y: MARGIN + 16, text: "重要且紧急", anchor: "end" },
  { x: MARGIN + 8, y: MARGIN + PLOT - 8, text: "不重要不紧急" },
  { x: WORLD - MARGIN - 8, y: MARGIN + PLOT - 8, text: "紧急不重要", anchor: "end" },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function CoordinateView() {
  const tasks = useStore((s) => s.tasks);
  const selectedId = useStore((s) => s.selectedTaskId);
  const selectTask = useStore((s) => s.selectTask);
  const openEditor = useStore((s) => s.openEditor);

  const active = useMemo(
    () =>
      tasks.filter(
        (t) => t.deletedAt === undefined && !t.archived && !t.completed,
      ),
    [tasks],
  );

  const selected = selectedId ? tasks.find((t) => t.id === selectedId) : undefined;

  const laid = useMemo(
    () => layoutPoints(active.map((t) => ({ id: t.id, urgency: t.urgency, importance: t.importance }))),
    [active],
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, w: WORLD, h: WORLD });
  const [hover, setHover] = useState<{ id: string; cx: number; cy: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; u: number; i: number } | null>(null);

  // 拖拽/平移瞬时状态用 ref，避免闭包过期
  const panState = useRef<{ wx: number; wy: number } | null>(null);
  const dragState = useRef<{ id: string } | null>(null);
  const dragPreviewRef = useRef<{ u: number; i: number } | null>(null);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  function getWorld(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const w = getWorld(e);
      if (!w) return;
      if (panState.current) {
        const dx = w.x - panState.current.wx;
        const dy = w.y - panState.current.wy;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) movedRef.current = true;
        setCamera((c) => ({ ...c, x: c.x - dx, y: c.y - dy }));
        panState.current = { wx: w.x, wy: w.y };
      }
      if (dragState.current) {
        const u = clamp(Math.round(worldToUrgency(w.x)), 1, 100);
        const i = clamp(Math.round(worldToImportance(w.y)), 1, 100);
        dragPreviewRef.current = { u, i };
        setDragPreview({ id: dragState.current.id, u, i });
      }
    }
    function onUp() {
      if (dragState.current) {
        const p = dragPreviewRef.current;
        if (p) {
          useStore.getState().updateTask(dragState.current.id, {
            urgency: p.u,
            importance: p.i,
          });
        }
      } else if (panState.current && !movedRef.current) {
        // 空白点击 → 在该坐标新建任务
        const w = downPosRef.current;
        if (w) {
          selectTask(null);
          openEditor({
            defaults: {
              urgency: clamp(Math.round(worldToUrgency(w.x)), 1, 100),
              importance: clamp(Math.round(worldToImportance(w.y)), 1, 100),
            },
          });
        }
      }
      dragState.current = null;
      panState.current = null;
      downPosRef.current = null;
      dragPreviewRef.current = null;
      setDragPreview(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [openEditor, selectTask]);

  function onBackgroundDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const w = getWorld(e);
    if (!w) return;
    movedRef.current = false;
    downPosRef.current = w;
    panState.current = { wx: w.x, wy: w.y };
    setHover(null);
  }

  function onPointDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectTask(id);
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    movedRef.current = false;
    dragState.current = { id };
    dragPreviewRef.current = { u: t.urgency, i: t.importance };
    setHover(null);
  }

  function onWheel(e: React.WheelEvent) {
    const w = getWorld(e);
    if (!w) return;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCamera((c) => {
      const nw = clamp(c.w / factor, WORLD / 5, WORLD * 5);
      const nh = clamp(c.h / factor, WORLD / 5, WORLD * 5);
      // 以光标为锚点缩放
      const rx = (w.x - c.x) / c.w;
      const ry = (w.y - c.y) / c.h;
      return {
        x: w.x - rx * nw,
        y: w.y - ry * nh,
        w: nw,
        h: nh,
      };
    });
  }

  const draggedPoint = dragPreview
    ? { id: dragPreview.id, u: dragPreview.u, i: dragPreview.i }
    : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 工具栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div>
          <span style={{ fontWeight: 600 }}>坐标系</span>
          <span style={{ fontSize: 12, color: "var(--c-text-muted)", marginLeft: 8 }}>
            拖拽调坐标 · 滚轮缩放 · 空白点击新建
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          onClick={() => setCamera({ x: 0, y: 0, w: WORLD, h: WORLD })}
        >
          重置视图
        </button>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {active.length === 0 ? (
          <EmptyState
            title="坐标还是空的"
            hint="点击下方按钮，或直接在图中空白处点击新建任务。"
            action={{ label: "新建任务", onClick: () => openEditor() }}
          />
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onBackgroundDown}
            onWheel={onWheel}
            style={{ display: "block", touchAction: "none", cursor: "crosshair" }}
            role="application"
            aria-label="坐标系视图：横轴紧急度，纵轴重要度"
          >
            {/* 四象限分区线（始终显示） */}
            <line
              x1={worldX(50)}
              y1={MARGIN}
              x2={worldX(50)}
              y2={MARGIN + PLOT}
              stroke="var(--c-axis)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <line
              x1={MARGIN}
              y1={worldY(50)}
              x2={MARGIN + PLOT}
              y2={worldY(50)}
              stroke="var(--c-axis)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />

            {/* 坐标轴 */}
            <line x1={MARGIN} y1={MARGIN + PLOT} x2={MARGIN + PLOT} y2={MARGIN + PLOT} stroke="var(--c-axis)" strokeWidth={1.5} />
            <line x1={MARGIN} y1={MARGIN} x2={MARGIN} y2={MARGIN + PLOT} stroke="var(--c-axis)" strokeWidth={1.5} />

            {/* 轴刻度文字 */}
            <text x={MARGIN + PLOT / 2} y={WORLD - 10} textAnchor="middle" fontSize={12} fill="var(--c-text-muted)">
              紧急 →
            </text>
            <text
              x={14}
              y={MARGIN + PLOT / 2}
              textAnchor="middle"
              fontSize={12}
              fill="var(--c-text-muted)"
              transform={`rotate(-90 14 ${MARGIN + PLOT / 2})`}
            >
              重要 →
            </text>

            {/* 象限角标 */}
            {QUADRANT_LABELS.map((l, idx) => (
              <text
                key={idx}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor ?? "start"}
                fontSize={11}
                fill="var(--c-text-muted)"
                opacity={0.85}
              >
                {l.text}
              </text>
            ))}

            {/* 任务点 */}
            {laid.map((p) => {
              const isDragging = draggedPoint?.id === p.id;
              const cx = isDragging ? worldX(draggedPoint!.u) : p.x;
              const cy = isDragging ? worldY(draggedPoint!.i) : p.y;
              const isSel = p.id === selectedId;
              const isHov = hover?.id === p.id;
              return (
                <g key={p.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={POINT_R}
                    fill={isSel ? "var(--c-primary)" : "var(--c-card)"}
                    stroke={
                      isSel || isHov ? "var(--c-primary)" : "var(--c-axis)"
                    }
                    strokeWidth={isSel || isHov ? 2 : 1.4}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => onPointDown(e, p.id)}
                    onPointerEnter={(e) => setHover({ id: p.id, cx: e.clientX, cy: e.clientY })}
                    onPointerMove={(e) => setHover({ id: p.id, cx: e.clientX, cy: e.clientY })}
                    onPointerLeave={() => setHover((h) => (h?.id === p.id ? null : h))}
                  >
                    <title>
                      {tasks.find((t) => t.id === p.id)?.title ?? ""}
                    </title>
                  </circle>
                  {/* 重叠点用编号提示 */}
                </g>
              );
            })}
          </svg>
        )}

        {/* hover 信息卡 */}
        {hover && (
          <HoverCard
            task={tasks.find((t) => t.id === hover.id)}
            x={hover.cx}
            y={hover.cy}
          />
        )}

        {/* 选中详情卡 */}
        {selected && (
          <DetailCard
            task={selected}
            onClose={() => selectTask(null)}
          />
        )}
      </div>
    </div>
  );
}

function HoverCard({
  task,
  x,
  y,
}: {
  task: { title: string; urgency: number; importance: number; dueAt?: number; tags: string[] } | undefined;
  x: number;
  y: number;
}) {
  if (!task) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: x + 14,
        top: y + 14,
        zIndex: 50,
        pointerEvents: "none",
        background: "var(--c-white)",
        border: "1px solid var(--c-border)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 4px 16px rgba(44,44,42,0.14)",
        maxWidth: 260,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{task.title}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-primary-dark)" }}>
        紧急 {task.urgency} · 重要 {task.importance}
      </div>
      {task.dueAt && (
        <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          截止 {formatDateCn(task.dueAt)}
        </div>
      )}
    </div>
  );
}

function DetailCard({
  task,
  onClose,
}: {
  task: { id: string; title: string; notes: string; urgency: number; importance: number; dueAt?: number; tags: string[]; completed: boolean };
  onClose: () => void;
}) {
  const openEditor = useStore((s) => s.openEditor);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const trashTask = useStore((s) => s.trashTask);
  const q = quadrantOf(task.urgency, task.importance);
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        width: 280,
        background: "var(--c-white)",
        border: "1px solid var(--c-border)",
        borderRadius: 10,
        boxShadow: "0 8px 28px rgba(44,44,42,0.16)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{task.title}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-primary-dark)", marginTop: 2 }}>
            紧急 {task.urgency} · 重要 {task.importance}
          </div>
          <div style={{ fontSize: 12, color: "var(--c-text-muted)", marginTop: 2 }}>
            {quadrantMeta[q].label} · {quadrantMeta[q].hint}
          </div>
        </div>
        <button className="btn-ghost" onClick={onClose} aria-label="关闭详情">
          <Icon name="close" size={14} />
        </button>
      </div>

      {task.notes && (
        <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--c-text)", whiteSpace: "pre-wrap" }}>
          {task.notes}
        </p>
      )}
      {task.dueAt && (
        <div style={{ fontSize: 12, color: "var(--c-text-muted)", marginTop: 6 }}>
          截止 {formatDateCn(task.dueAt)}
        </div>
      )}
      {task.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {task.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: "1px 8px",
                borderRadius: 999,
                background: "var(--c-primary-soft)",
                color: "var(--c-primary-dark)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openEditor({ taskId: task.id })}>
          编辑
        </button>
        <button className="btn" onClick={() => toggleComplete(task.id)}>
          <Icon name="check" size={14} />
        </button>
        <button className="btn" onClick={() => trashTask(task.id)} aria-label="删除">
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

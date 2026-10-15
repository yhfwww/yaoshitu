import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { VIEWS, SMART_VIEWS } from "../lib/views";
import { Icon, type IconName } from "./Icon";

interface CmdItem {
  key: string;
  label: string;
  hint: string;
  icon: IconName;
  run: () => void;
}

export function CommandPalette() {
  const open = useStore((s) => s.commandOpen);
  const setOpen = useStore((s) => s.setCommandOpen);
  const setView = useStore((s) => s.setView);
  const setSmartView = useStore((s) => s.setSmartView);
  const openEditor = useStore((s) => s.openEditor);
  const selectTask = useStore((s) => s.selectTask);
  const tasks = useStore((s) => s.tasks);

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<CmdItem[]>(() => {
    const q = query.trim().toLowerCase();
    const result: CmdItem[] = [];

    // 动作
    const actions: CmdItem[] = [
      {
        key: "new",
        label: "新建任务",
        hint: "n",
        icon: "plus",
        run: () => {
          openEditor();
          setOpen(false);
        },
      },
    ];
    result.push(...actions);

    // 视图
    for (const v of VIEWS) {
      if (q && !v.label.toLowerCase().includes(q)) continue;
      result.push({
        key: `view-${v.id}`,
        label: `切换到：${v.label}`,
        hint: v.hint,
        icon: v.icon,
        run: () => {
          setView(v.id);
          setOpen(false);
        },
      });
    }

    // 智能视图
    if (q === "" || "智能".includes(q) || "智能视图".includes(q)) {
      for (const sv of SMART_VIEWS) {
        result.push({
          key: `smart-${sv.id}`,
          label: `智能视图：${sv.label}`,
          hint: sv.desc,
          icon: "spark",
          run: () => {
            setView("smart");
            setSmartView(sv.id);
            setOpen(false);
          },
        });
      }
    }

    // 任务（仅活动任务）
    if (q) {
      const active = tasks.filter((t) => t.deletedAt === undefined && !t.archived);
      const matched = active
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
        .slice(0, 8);
      for (const t of matched) {
        result.push({
          key: `task-${t.id}`,
          label: t.title,
          hint: `紧急 ${t.urgency} · 重要 ${t.importance}`,
          icon: "edit",
          run: () => {
            selectTask(t.id);
            setView("coordinate");
            setOpen(false);
          },
        });
      }
    }

    return result;
  }, [query, tasks, openEditor, setOpen, setView, setSmartView, selectTask]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[index]?.run();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(44,44,42,0.35)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        style={{
          width: 520,
          maxWidth: "92vw",
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--c-white)",
          border: "1px solid var(--c-border)",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(44,44,42,0.18)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid var(--c-border)",
          }}
        >
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索任务、切换视图、新建…"
            aria-label="搜索"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 15,
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              color: "var(--c-text-muted)",
              border: "1px solid var(--c-border)",
              borderRadius: 4,
              padding: "1px 6px",
            }}
          >
            Esc
          </kbd>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", padding: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-muted)" }}>
              无匹配结果
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={it.key}
              data-active={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => it.run()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                textAlign: "left",
                background: i === index ? "var(--c-primary-soft)" : "transparent",
              }}
            >
              <Icon name={it.icon} size={15} />
              <span style={{ flex: 1 }}>{it.label}</span>
              <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{it.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

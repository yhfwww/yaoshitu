import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { quadrantOf, type Quadrant } from "../db/schema";
import { startOfDay, formatDateCn } from "../lib/datetime";

const DAY = 24 * 60 * 60 * 1000;

export function DashboardView() {
  const tasks = useStore((s) => s.tasks);

  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.deletedAt === undefined && !t.archived);
    const completed = active.filter((t) => t.completed);
    const rate = active.length ? Math.round((completed.length / active.length) * 100) : 0;

    // 象限分布（进行中任务）
    const qCount: Record<Quadrant, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const t of active) {
      if (!t.completed) qCount[quadrantOf(t.urgency, t.importance)]++;
    }

    // 标签统计
    const tagMap = new Map<string, number>();
    for (const t of active) {
      for (const tag of t.tags) tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
    const tags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    // 完成趋势（最近 14 天）
    const today = startOfDay(Date.now());
    const days = Array.from({ length: 14 }, (_, i) => {
      const ts = today - (13 - i) * DAY;
      const count = completed.filter((t) => t.completedAt && startOfDay(t.completedAt) === ts).length;
      return { ts, count };
    });
    const maxCount = Math.max(1, ...days.map((d) => d.count));

    // streak：连续完成天数
    const completedDays = new Set(
      completed.filter((t) => t.completedAt).map((t) => startOfDay(t.completedAt!)),
    );
    let cursor = today;
    if (!completedDays.has(cursor)) cursor -= DAY;
    let streak = 0;
    while (completedDays.has(cursor)) {
      streak++;
      cursor -= DAY;
    }

    return { active, completed, rate, qCount, tags, days, maxCount, streak };
  }, [tasks]);

  const quadrantRows: { q: Quadrant; label: string; count: number }[] = [
    { q: "q1", label: "重要且紧急", count: stats.qCount.q1 },
    { q: "q2", label: "重要不紧急", count: stats.qCount.q2 },
    { q: "q4", label: "紧急不重要", count: stats.qCount.q4 },
    { q: "q3", label: "不重要不紧急", count: stats.qCount.q3 },
  ];
  const maxQ = Math.max(1, ...quadrantRows.map((r) => r.count));

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <span style={{ fontWeight: 600 }}>仪表盘</span>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)", marginLeft: 8 }}>
          复盘你的完成情况
        </span>
      </div>

      {/* 总览卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          padding: 16,
        }}
      >
        <StatCard label="进行中" value={String(stats.active.length - stats.completed.length)} />
        <StatCard label="已完成" value={String(stats.completed.length)} />
        <StatCard label="完成率" value={`${stats.rate}%`} />
        <StatCard label="连续完成" value={`${stats.streak} 天`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px 16px" }}>
        {/* 完成趋势 */}
        <div
          style={{
            background: "var(--c-white)",
            border: "1px solid var(--c-border)",
            borderRadius: 10,
            padding: 14,
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>完成趋势（近 14 天）</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
            {stats.days.map((d) => (
              <div
                key={d.ts}
                title={`${formatDateCn(d.ts)}：完成 ${d.count} 项`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 26,
                    height: Math.max(2, (d.count / stats.maxCount) * 96),
                    background: d.count ? "var(--c-primary)" : "var(--c-border)",
                    borderRadius: 3,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--c-text-muted)", marginTop: 6 }}>
            <span>{formatDateCn(stats.days[0].ts)}</span>
            <span>今天</span>
          </div>
        </div>

        {/* 象限分布 */}
        <div
          style={{
            background: "var(--c-white)",
            border: "1px solid var(--c-border)",
            borderRadius: 10,
            padding: 14,
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>象限分布（进行中）</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {quadrantRows.map((r) => (
              <div key={r.q} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 96, fontSize: 12, textAlign: "right", color: "var(--c-text-muted)" }}>
                  {r.label}
                </span>
                <div style={{ flex: 1, height: 14, background: "var(--c-card)", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(r.count / maxQ) * 100}%`,
                      height: "100%",
                      background: "var(--c-primary)",
                      opacity: r.count ? 1 : 0,
                    }}
                  />
                </div>
                <span style={{ width: 20, fontSize: 12, fontFamily: "var(--font-mono)" }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 标签统计 */}
      <div
        style={{
          margin: "0 16px 16px",
          background: "var(--c-white)",
          border: "1px solid var(--c-border)",
          borderRadius: 10,
          padding: 14,
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>标签统计</h3>
        {stats.tags.length === 0 ? (
          <div style={{ color: "var(--c-text-muted)", fontSize: 13 }}>暂无标签</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stats.tags.map(([tag, count]) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "var(--c-primary-soft)",
                  color: "var(--c-primary-dark)",
                  fontSize: 13,
                }}
              >
                {tag}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--c-white)",
        border: "1px solid var(--c-border)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--c-primary-dark)" }}>
        {value}
      </div>
    </div>
  );
}

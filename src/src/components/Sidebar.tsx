import { useStore } from "../store/useStore";
import { VIEWS, SMART_VIEWS } from "../lib/views";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { daysAgo } from "../lib/datetime";
import { useSync } from "../lib/sync/runtime";

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const smartView = useStore((s) => s.smartView);
  const setSmartView = useStore((s) => s.setSmartView);
  const openEditor = useStore((s) => s.openEditor);
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt);
  const account = useSync((s) => s.account);
  const syncStatus = useSync((s) => s.status);
  const pending = useSync((s) => s.pending);

  return (
    <aside
      style={{
        width: "var(--sidebar-w)",
        minWidth: "var(--sidebar-w)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--c-border)",
        background: "var(--c-card)",
      }}
    >
      {/* 品牌头 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 16px 12px",
        }}
      >
        <Logo size={30} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--c-primary-dark)" }}>
            要事图
          </div>
          <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
            要事一图，轻重自现。
          </div>
        </div>
      </div>

      {/* 新建 */}
      <div style={{ padding: "0 12px 8px" }}>
        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => openEditor()}
        >
          <Icon name="plus" size={14} />
          新建任务
        </button>
      </div>

      {/* 导航 */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
        {VIEWS.map((v) => (
          <div key={v.id}>
            <button
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                textAlign: "left",
                background: view === v.id ? "var(--c-primary-soft)" : "transparent",
                color: view === v.id ? "var(--c-primary-dark)" : "var(--c-text)",
                fontWeight: view === v.id ? 600 : 400,
              }}
            >
              <Icon name={v.icon} size={16} />
              <span style={{ flex: 1 }}>{v.label}</span>
            </button>

            {/* 智能视图子菜单 */}
            {v.id === "smart" && view === "smart" && (
              <div style={{ padding: "2px 0 6px 26px" }}>
                {SMART_VIEWS.map((sv) => (
                  <button
                    key={sv.id}
                    onClick={() => setSmartView(sv.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "4px 10px",
                      borderRadius: 5,
                      textAlign: "left",
                      fontSize: 13,
                      background:
                        smartView === sv.id ? "var(--c-hover)" : "transparent",
                      color: "var(--c-text)",
                    }}
                    title={sv.desc}
                  >
                    {sv.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* 底部：备份提醒 + 设置 */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--c-border)",
          fontSize: 11,
          color: "var(--c-text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div role="status" style={{ marginBottom: 4 }}>{account ? `${syncStatus}${pending ? ` · 待同步 ${pending} 项` : ""}` : "游客 · 本地模式"}</div>
          {lastBackupAt
            ? `上次备份 ${daysAgo(lastBackupAt)} 天前`
            : "尚未备份（设置页可导出）"}
        </div>
        <button
          className="btn-ghost"
          onClick={onOpenSettings}
          aria-label="设置"
          style={{ padding: 4 }}
        >
          <Icon name="settings" size={16} />
        </button>
      </div>
    </aside>
  );
}

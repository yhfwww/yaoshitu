import { useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { VIEWS } from "../lib/views";
import type { ViewId } from "../db/schema";
import { downloadBackup, readBackupFile } from "../lib/backup";
import { daysAgo } from "../lib/datetime";
import { Logo } from "./Logo";
import { Icon } from "./Icon";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onExport() {
    downloadBackup(exportBackup());
    await updateSettings({ lastBackupAt: Date.now() });
    setMsg("已导出备份文件");
  }

  async function onImportFile(file: File) {
    try {
      const env = await readBackupFile(file);
      await importBackup(env);
      await updateSettings({ lastBackupAt: Date.now() });
      setMsg(`已导入 ${env.tasks.length} 个任务、${env.notes.length} 条笔记`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "导入失败");
    }
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
        aria-label="设置"
        style={{
          width: 560,
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
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}
        >
          <h2 style={{ margin: 0, fontSize: 17 }}>设置</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* 默认视图 */}
        <label style={{ display: "block", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}>
          默认视图
        </label>
        <select
          className="input"
          value={settings.defaultView}
          onChange={(e) => updateSettings({ defaultView: e.target.value as ViewId })}
        >
          {VIEWS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        {/* 数据 */}
        <h3 style={{ margin: "20px 0 8px", fontSize: 14 }}>数据</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--c-text-muted)" }}>
          你的数据，本地优先。数据只存在本机浏览器中，不会上传。
          {settings.lastBackupAt ? ` 上次备份 ${daysAgo(settings.lastBackupAt)} 天前。` : ""}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn" onClick={onExport}>
            导出 JSON 备份
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {msg && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--c-primary-dark)" }}>{msg}</div>
        )}

        {/* 关于 */}
        <h3 style={{ margin: "20px 0 8px", fontSize: 14 }}>关于</h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 12,
            background: "var(--c-card)",
            borderRadius: 8,
          }}
        >
          <Logo size={40} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--c-primary-dark)" }}>
              要事图 / Yaoshitu
            </div>
            <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
              要事一图，轻重自现。 · v0.1.0 · 本地优先 · 开源（MIT）
            </div>
          </div>
        </div>

        {/* 已建模未出 UI 清单 */}
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--c-text-muted)" }}>
          <div style={{ fontWeight: 600, color: "var(--c-text)", marginBottom: 4 }}>
            已建模、尚未开放界面（后续版本分批上线）：
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>子任务（parentId）</li>
            <li>递归任务（recurrence）</li>
            <li>时间追踪（timeEntries）</li>
            <li>任务依赖（dependencies）</li>
            <li>提醒（reminderAt）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

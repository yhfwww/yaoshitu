import { useState } from "react";
import { server } from "../lib/sync/client";
import { deleteAccount, importGuest, loginGithub, logout, restoreConflict, synchronize, useSync } from "../lib/sync/runtime";

const FIELD_NAMES: Record<string, string> = { title: "标题", notes: "任务备注", body: "笔记正文", position: "坐标", completion: "完成状态", dueAt: "截止日期", deletedAt: "删除状态", tags: "标签", archived: "归档状态", defaultView: "默认视图" };

export function SyncSettings() {
  const sync = useSync();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  async function act(action: () => Promise<void>, success = "") {
    setWorking(true); setMessage("");
    try { await action(); setMessage(success); } catch { setMessage("操作未完成，本地数据已保留，请稍后重试。"); }
    finally { setWorking(false); }
  }
  const disabled = working || sync.busy;
  return <section aria-labelledby="sync-heading" style={{ marginTop: 20 }}>
    <h3 id="sync-heading" style={{ fontSize: 14 }}>账号与同步</h3>
    <p style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
      {sync.account ? `${sync.account.label} · ${sync.status} · 待同步 ${sync.pending} 项` : "游客模式，无需登录。登录 GitHub 后可在多设备同步。"}
    </p>
    {!server && <p style={{ fontSize: 12 }}>本站尚未开放云同步，你可以继续本地使用并导出备份。</p>}
    {sync.lastSyncAt && <p style={{ fontSize: 12 }}>上次同步：{new Date(sync.lastSyncAt).toLocaleString()}</p>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {!sync.account ? <button className="btn btn-primary" disabled={disabled || !server} onClick={() => act(loginGithub)}>使用 GitHub 登录</button> : <>
        <button className="btn" disabled={disabled} onClick={() => act(synchronize)}>立即同步</button>
        <button className="btn" disabled={disabled} onClick={() => act(loginGithub)}>重新登录 GitHub</button>
        <button className="btn" disabled={disabled} onClick={() => setConfirmImport(!confirmImport)}>导入本机游客数据</button>
        <button className="btn" disabled={disabled} onClick={() => setConfirmLogout(!confirmLogout)}>退出账号</button>
      </>}
    </div>
    {confirmImport && sync.account && <div style={{ marginTop: 10, fontSize: 12 }}>
      <p>将游客任务和笔记复制到当前账号并上传，原游客数据会保留。再次导入会生成副本。</p>
      <button className="btn" disabled={disabled} onClick={() => act(async () => { await importGuest(); setConfirmImport(false); }, "已复制游客数据，正在同步")}>确认复制并同步</button>
    </div>}
    {confirmLogout && sync.account && <div style={{ marginTop: 10, fontSize: 12 }}>
      <p>退出后返回游客空间。账号数据和待同步修改仍保留在此浏览器，重新登录同一账号可继续。</p>
      <button className="btn" disabled={disabled} onClick={() => act(async () => { await logout(); setConfirmLogout(false); })}>确认退出</button>
    </div>}
    <p role="status" aria-live="polite" style={{ fontSize: 12 }}>{message || sync.error}</p>
    {sync.conflicts.length > 0 && <details>
      <summary>可恢复的冲突旧值（最近记录）</summary>
      <p style={{ fontSize: 12 }}>同一字段由最后被服务器接受的修改生效。可将旧值重新设为当前值。</p>
      {sync.conflicts.map((doc) => <div key={doc.key}>
        <strong style={{ fontSize: 12 }}>{String(doc.values.title ?? "偏好设置")}</strong>
        {doc.conflicts.map((conflict, index) => <div key={`${index}-${conflict.revision}`} style={{ fontSize: 12, margin: "8px 0" }}>
          <span>{FIELD_NAMES[conflict.field] ?? conflict.field}：{JSON.stringify(conflict.value)?.slice(0, 160)}</span>{" "}
          <button className="btn" disabled={disabled} onClick={() => act(() => restoreConflict(doc, index))}>恢复此值</button>
        </div>)}
      </div>)}
    </details>}
    {sync.account && <details style={{ marginTop: 12 }}>
      <summary>删除账号</summary>
      <p style={{ fontSize: 12 }}>永久删除云端账号、云端任务和笔记，以及此浏览器的账号空间。请先导出备份。游客数据会保留；服务器历史备份按保留周期过期。</p>
      <label style={{ fontSize: 12 }}>输入“删除账号”确认<input className="input" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} /></label>
      <button className="btn" disabled={disabled || deleteText !== "删除账号"} onClick={() => act(deleteAccount, "账号已删除")}>永久删除账号及数据</button>
    </details>}
  </section>;
}

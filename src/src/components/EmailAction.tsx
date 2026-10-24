import { useState, type FormEvent } from "react";
import { getClient } from "../lib/sync/client";

export function EmailAction({ action, token, onClose }: { action: "verify" | "reset"; token: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const users = getClient().collection("users");
      if (action === "verify") await users.confirmVerification(token);
      else {
        if (password !== confirm) throw new Error("两次输入的密码不一致");
        await users.confirmPasswordReset(token, password, confirm);
      }
      setDone(true); setMessage(action === "verify" ? "邮箱已验证，可以返回登录。" : "密码已重设，请使用新密码重新登录。");
    } catch { setMessage("操作失败，请检查两次密码是否一致；链接也可能已过期或已使用，请重新申请邮件。"); }
    finally { setBusy(false); setPassword(""); setConfirm(""); }
  }
  return <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "grid", placeItems: "center", background: "var(--c-card)", padding: 24 }}>
    <form onSubmit={submit} style={{ width: 360, maxWidth: "100%", display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 22 }}>{action === "verify" ? "验证邮箱" : "重设密码"}</h1>
      {!done && action === "reset" && <>
        <label>新密码（至少 12 位）<input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>确认新密码<input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      </>}
      {!done && <button className="btn btn-primary" disabled={busy}>{busy ? "正在处理…" : action === "verify" ? "确认验证邮箱" : "保存新密码"}</button>}
      <p role="status">{message}</p>
      <button type="button" className="btn" onClick={onClose}>返回要事图</button>
    </form>
  </div>;
}

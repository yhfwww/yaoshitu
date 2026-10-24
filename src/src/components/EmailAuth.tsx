import { useState, type FormEvent } from "react";
import { getClient, server } from "../lib/sync/client";
import { loginEmail, registerEmail, useSync } from "../lib/sync/runtime";

export function EmailAuth() {
  const [mode, setMode] = useState<"login" | "register" | "reset" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useSync((s) => s.busy);
  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setMessage("");
    try {
      if (mode === "login") await loginEmail(email, password);
      else if (mode === "register") {
        if (password !== confirm) throw new Error("两次输入的密码不一致");
        await registerEmail(email, password, confirm);
        setMessage("账号已创建，请查收验证邮件（也请检查垃圾箱），验证后再登录。");
        setMode("login");
      } else {
        const users = getClient().collection("users");
        if (mode === "reset") await users.requestPasswordReset(email.trim());
        else await users.requestVerification(email.trim());
        setMessage("如果该邮箱符合发送条件，你将收到邮件，请同时检查垃圾箱。");
      }
    } catch (error) {
      const e = error as { status?: number; message?: string };
      setMessage(e.status === 403 ? "请先验证邮箱，再登录。可点击重新发送验证邮件。" : e.status
        ? (mode === "login" ? "邮箱或密码不正确，或服务暂时不可用。" : "操作未完成，请检查邮箱、密码要求或稍后重试。已有账号可尝试登录或找回密码。")
        : e.message || "请求失败，请稍后重试");
    } finally { setWorking(false); setPassword(""); setConfirm(""); }
  }
  const disabled = working || busy || !server;
  return <form onSubmit={submit} style={{ display: "grid", gap: 10, margin: "16px 0" }}>
    <h4 style={{ margin: 0 }}>{mode === "register" ? "邮箱注册" : mode === "reset" ? "找回密码" : mode === "verify" ? "重新发送验证邮件" : "邮箱登录"}</h4>
    <label>邮箱<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} /></label>
    {(mode === "login" || mode === "register") && <label>密码{mode === "register" && "（至少 12 位）"}<input className="input" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} disabled={disabled} /></label>}
    {mode === "register" && <label>确认密码<input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={disabled} /></label>}
    <button className="btn btn-primary" disabled={disabled}>{working ? "正在处理…" : mode === "register" ? "注册并发送验证邮件" : mode === "login" ? "邮箱登录" : "发送邮件"}</button>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {([ ["login", "登录"], ["register", "注册账号"], ["reset", "忘记密码"], ["verify", "重新发送验证邮件"] ] as const).filter(([key]) => key !== mode).map(([key, label]) => <button type="button" className="btn" key={key} disabled={disabled} onClick={() => { setMode(key); setMessage(""); setPassword(""); setConfirm(""); }}>{label}</button>)}
    </div>
    <p role="status" aria-live="polite" style={{ fontSize: 12, margin: 0 }}>{message}</p>
  </form>;
}

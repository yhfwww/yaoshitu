import { useState, type FormEvent } from "react";
import { server } from "../lib/sync/client";
import { loginEmail, registerEmail, useSync } from "../lib/sync/runtime";

export function EmailAuth() {
  const [mode, setMode] = useState<"login" | "register">("login");
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
        setMessage("注册成功，请使用邮箱和密码登录。");
        setMode("login");
      }
    } catch (error) {
      const e = error as { status?: number; message?: string };
      setMessage(e.status
        ? (mode === "login" ? "邮箱或密码不正确，或服务暂时不可用。" : "注册未完成，请检查邮箱和密码要求；已有账号请直接登录。")
        : e.message || "请求失败，请稍后重试");
    } finally { setWorking(false); setPassword(""); setConfirm(""); }
  }
  const disabled = working || busy || !server;
  return <form onSubmit={submit} style={{ display: "grid", gap: 10, margin: "16px 0" }}>
    <h4 style={{ margin: 0 }}>{mode === "register" ? "邮箱注册" : "邮箱登录"}</h4>
    <label>邮箱<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} /></label>
    {(mode === "login" || mode === "register") && <label>密码{mode === "register" && "（至少 12 位）"}<input className="input" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : undefined} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} disabled={disabled} /></label>}
    {mode === "register" && <label>确认密码<input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={disabled} /></label>}
    <button className="btn btn-primary" disabled={disabled}>{working ? "正在处理…" : mode === "register" ? "注册账号" : "邮箱登录"}</button>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {([ ["login", "登录"], ["register", "注册账号"] ] as const).filter(([key]) => key !== mode).map(([key, label]) => <button type="button" className="btn" key={key} disabled={disabled} onClick={() => { setMode(key); setMessage(""); setPassword(""); setConfirm(""); }}>{label}</button>)}
    </div>
    <p role="status" aria-live="polite" style={{ fontSize: 12, margin: 0 }}>{message}</p>
  </form>;
}

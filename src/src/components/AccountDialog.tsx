import { useEffect, useRef } from "react";
import { SyncSettings } from "./SyncSettings";

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const dialog = ref.current;
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="account-title"
    style={{ width: 480, maxWidth: "calc(100% - 32px)", maxHeight: "85vh", overflowY: "auto", border: "1px solid var(--c-border)", borderRadius: 12, padding: 24, background: "var(--c-card)", color: "var(--c-text)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <h2 id="account-title" style={{ margin: 0, fontSize: 18 }}>账号与同步</h2>
      <button className="btn" onClick={onClose} aria-label="关闭账号窗口">关闭</button>
    </div>
    <SyncSettings />
  </dialog>;
}

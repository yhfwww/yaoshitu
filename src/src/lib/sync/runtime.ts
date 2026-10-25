import { create } from "zustand";
import { db, guestDb, workspace, selectWorkspace, DEFAULT_SETTINGS } from "../../db/db";
import type { SyncDocument, Workspace } from "../../db/schema";
import { useStore } from "../../store/useStore";
import { DATA_CHANGED, applyDocument, writeEntity } from "./local";
import { decodeValues } from "./documents";
import { getClient, server } from "./client";
import { isTokenExpired } from "pocketbase";
import { transport } from "./transport";

const WORKSPACE_KEY = "yaoshitu-workspace";
export const useSync = create<{
  account: Workspace | null; status: string; pending: number; error: string; busy: boolean;
  lastSyncAt?: number; conflicts: SyncDocument[];
}>(() => ({ account: null, status: "本地模式", pending: 0, error: "", busy: false, conflicts: [] }));

let running: Promise<void> | undefined;
let unsubscribe: (() => void) | undefined;
let retryAt = 0;
let failures = 0;
let stopped = false;
let lifecycleBusy = false;
let bootPromise: Promise<void> | undefined;

function remember(next: Workspace | null) {
  if (next) localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
  else localStorage.removeItem(WORKSPACE_KEY);
}

async function refreshView() {
  const [tasks, notes, settings, pending, documents] = await Promise.all([db.tasks.toArray(), db.notes.toArray(), db.settings.get("app"), db.outbox.count(), db.documents.toArray()]);
  useStore.setState({ tasks, notes, settings: settings ?? { ...DEFAULT_SETTINGS, seeded: true } });
  useSync.setState({ pending, conflicts: documents.filter((d) => d.conflicts.length > 0 && !d.purged) });
}

async function subscribe() {
  try {
    unsubscribe = await transport.subscribe(() => { retryAt = 0; void synchronize(); });
  } catch {
    // Focus / online / periodic pulls remain the correctness fallback.
  }
}

export function synchronize(): Promise<void> {
  if (running) return running;
  if (stopped || lifecycleBusy || !workspace) return Promise.resolve();
  if (!navigator.onLine) { useSync.setState({ status: "离线，等待联网" }); return Promise.resolve(); }
  running = performSync().finally(() => { running = undefined; });
  return running;
}

async function performSync() {
  const target = db;
  const account = workspace!;
  const pb = getClient();
  useSync.setState({ busy: true, status: "正在同步", error: "" });
  try {
    // Never let a shared-browser auth change upload data into another account.
    if (pb.authStore.record?.id !== account.userId) throw new Error("账号已变更，请退出后重新登录；本地修改已保留");
    if (!pb.authStore.isValid) throw new Error("登录已过期，请重新登录。本地修改已保留。");
    if (isTokenExpired(pb.authStore.token, 300)) await pb.collection("users").authRefresh();
    if (pb.authStore.record?.id !== account.userId) throw new Error("账号不匹配");
    for (let i = 0; i < 200 && !stopped; i++) {
      const op = await target.outbox.orderBy("createdAt").first();
      if (!op) break;
      let expectedRevision = (await target.documents.get(op.key))?.revision ?? 0;
      let acknowledged = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const document = await transport.push(op, expectedRevision);
          await applyDocument(target, document, op.id);
          acknowledged = true;
          break;
        } catch (error) {
          const response = error as { status?: number; response?: { document?: SyncDocument } };
          if (response.status !== 409 || !response.response?.document) throw error;
          const document = response.response.document;
          if (!document.purged && document.revision < expectedRevision) throw new Error("服务器版本已回退，请先导出本地备份并联系管理员。本地修改已保留。");
          await applyDocument(target, document);
          expectedRevision = document.revision;
        }
      }
      if (!acknowledged) throw new Error("多设备正在同时修改，稍后自动重试");
    }
    // Keyset pagination over a full inventory: no device-clock cursor and no
    // absence-based deletes. Permanent tombstones cover long-offline clients.
    let after = "";
    while (!stopped) {
      const result = await transport.pull(after);
      for (const document of result.items) await applyDocument(target, document);
      if (!result.after) break;
      after = result.after;
    }
    failures = 0;
    retryAt = 0;
    if (!stopped) {
      await refreshView();
      useSync.setState({ status: useSync.getState().pending ? "等待同步" : "已同步", lastSyncAt: Date.now() });
    }
  } catch (error) {
    failures++;
    retryAt = Date.now() + Math.min(300000, 1000 * 2 ** Math.min(failures, 8));
    useSync.setState({ status: "等待重试", error: error instanceof Error && !('status' in error) ? error.message : "同步失败，请检查网络或重新登录。本地修改已保留。" });
  } finally {
    useSync.setState({ busy: false, pending: await target.outbox.count() });
  }
}

async function switchSpace(next: Workspace | null) {
  stopped = true;
  useStore.setState({ ready: false });
  await running;
  // Drain writes already started by editors before closing the outgoing DB.
  await db.transaction("rw", db.tables, async () => {});
  unsubscribe?.();
  unsubscribe = undefined;
  useStore.setState({ ready: false, tasks: [], notes: [], selectedTaskId: null, editor: { open: false }, commandOpen: false });
  remember(next);
  selectWorkspace(next);
  await useStore.getState().reload();
  useSync.setState({ account: next, pending: 0, status: next ? "等待同步" : "本地模式", error: "", conflicts: [], lastSyncAt: undefined });
  await refreshView();
  stopped = false;
}

export async function loginGithub() {
  if (lifecycleBusy) return;
  const pb = getClient();
  lifecycleBusy = true;
  useSync.setState({ busy: true, error: "" });
  const previousToken = pb.authStore.token;
  const previousRecord = pb.authStore.record;
  const popup = window.open("about:blank", "yaoshitu-github", "width=700,height=700");
  if (!popup) { lifecycleBusy = false; useSync.setState({ busy: false, error: "请允许本站弹出 GitHub 登录窗口" }); return; }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    stopped = true;
    await running;
    const auth = await Promise.race([
      pb.collection("users").authWithOAuth2({
        provider: "github",
        // 登录/切换账号不是绑定：禁止 SDK 自动携带当前邮箱账号的 token。
        headers: { Authorization: "" },
        urlCallback: (url) => {
          const authorize = new URL(url);
          authorize.searchParams.set("prompt", "select_account");
          popup.location.href = authorize.href;
        },
      }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => { void pb.realtime.unsubscribe(); reject(new Error("登录超时")); }, 120000); }),
    ]);
    await switchSpace({ userId: auth.record.id, label: auth.record.name || auth.record.email || "GitHub 用户", server });
    await subscribe();
  } catch {
    if (previousRecord) pb.authStore.save(previousToken, previousRecord);
    else pb.authStore.clear();
    useSync.setState({ error: "GitHub 登录未完成，可重新尝试。本地数据已保留。" });
  } finally {
    if (timeout) clearTimeout(timeout);
    if (!popup.closed) popup.close();
    lifecycleBusy = false; stopped = false; useSync.setState({ busy: false });
  }
  await synchronize();
}

export async function loginEmail(email: string, password: string) {
  if (lifecycleBusy) throw new Error("账号操作正在进行，请稍后重试");
  const pb = getClient();
  const previousToken = pb.authStore.token;
  const previousRecord = pb.authStore.record;
  lifecycleBusy = true;
  useSync.setState({ busy: true, error: "" });
  try {
    stopped = true;
    await running;
    const auth = await pb.collection("users").authWithPassword(email.trim(), password);
    await switchSpace({ userId: auth.record.id, label: auth.record.name || auth.record.email || "邮箱用户", server });
    await subscribe();
  } catch (error) {
    if (previousRecord) pb.authStore.save(previousToken, previousRecord);
    else pb.authStore.clear();
    throw error;
  } finally {
    lifecycleBusy = false; stopped = false; useSync.setState({ busy: false });
  }
  await synchronize();
}

export async function registerEmail(email: string, password: string, passwordConfirm: string) {
  const users = getClient().collection("users");
  await users.create({ email: email.trim(), password, passwordConfirm });
}

export async function logout() {
  if (lifecycleBusy) return;
  lifecycleBusy = true;
  try {
    await switchSpace(null);
    getClient().authStore.clear();
  } finally { lifecycleBusy = false; }
}

export async function importGuest() {
  if (!workspace || lifecycleBusy) return;
  const [tasks, notes] = await Promise.all([guestDb.tasks.toArray(), guestDb.notes.toArray()]);
  await useStore.getState().importBackup({ app: "yaoshitu", formatVersion: 1, exportedAt: new Date().toISOString(), tasks, notes, settings: { ...DEFAULT_SETTINGS } }, "merge");
  await synchronize();
}

export async function restoreConflict(document: SyncDocument, index: number) {
  const conflict = document.conflicts[index];
  if (!conflict || !workspace) return;
  const table = document.kind === "task" ? db.tasks : document.kind === "note" ? db.notes : db.settings;
  const current = await table.get(document.entityId);
  if (!current) return;
  const patch = decodeValues(document.kind, { [conflict.field]: conflict.value }, document.entityId);
  await writeEntity(document.kind, { ...current, ...patch, updatedAt: Date.now() }, current);
  await refreshView();
  await synchronize();
}

export async function deleteAccount() {
  if (!workspace || lifecycleBusy) return;
  lifecycleBusy = true;
  const target = db;
  try {
    stopped = true;
    await running;
    await getClient().send("/api/yaoshitu/account", { method: "DELETE" });
    await switchSpace(null);
    getClient().authStore.clear();
    await target.delete();
  } finally { lifecycleBusy = false; stopped = false; }
}

export function bootSync(): Promise<void> {
  bootPromise ??= (async () => {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    if (saved && server) {
      try {
        const account = JSON.parse(saved) as Workspace;
        if (account.server === server && /^[a-z0-9]{15}$/.test(account.userId)) {
          await switchSpace(account);
          if (navigator.onLine) await subscribe();
        }
      } catch { useSync.setState({ error: "账号空间恢复失败，游客数据未受影响" }); }
    }
    const wake = () => { if (Date.now() >= retryAt && document.visibilityState !== "hidden") void synchronize(); };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("offline", () => { if (workspace) useSync.setState({ status: "离线，等待联网" }); });
    document.addEventListener("visibilitychange", wake);
    let timer: ReturnType<typeof setTimeout>;
    window.addEventListener(DATA_CHANGED, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void db.outbox.count().then((pending) => useSync.setState({ pending })); wake(); }, 800);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === WORKSPACE_KEY || event.key?.startsWith("yaoshitu-auth-")) {
        stopped = true;
        // A full reload discards stale forms and in-memory account state.
        window.location.reload();
      }
    });
    setInterval(wake, 15000);
    await synchronize();
  })();
  return bootPromise;
}

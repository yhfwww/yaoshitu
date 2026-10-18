import PocketBase, { LocalAuthStore } from "pocketbase";

export function normalizeServer(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("同步服务需要 HTTPS，本机开发可使用 HTTP");
  }
  return url.href.replace(/\/$/, "");
}

export const server = (() => {
  try { return import.meta.env.VITE_POCKETBASE_URL ? normalizeServer(import.meta.env.VITE_POCKETBASE_URL) : ""; }
  catch { return ""; } // A bad deployment setting must not break local data access.
})();
let client: PocketBase | undefined;
export function getClient(): PocketBase {
  if (!server) throw new Error("此站点尚未配置云同步服务，本地模式可正常使用");
  client ??= new PocketBase(server, new LocalAuthStore(`yaoshitu-auth-${encodeURIComponent(server)}`));
  client.autoCancellation(false);
  client.beforeSend = (url, options) => ({ url, options: { ...options, signal: options.signal ?? AbortSignal.timeout(20000) } });
  return client;
}

// JSON 导入 / 导出（版本化备份信封）
import type { BackupEnvelope } from "../db/schema";

export function downloadBackup(env: BackupEnvelope): void {
  const json = JSON.stringify(env, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  a.href = url;
  a.download = `yaoshitu-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readBackupFile(file: File): Promise<BackupEnvelope> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupEnvelope;
        if (!data || data.app !== "yaoshitu" || !Array.isArray(data.tasks)) {
          reject(new Error("不是有效的要事图备份文件"));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error("JSON 解析失败"));
      }
    };
    reader.readAsText(file);
  });
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

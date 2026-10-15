import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 要事图 / Yaoshitu —— 本地优先，无外部请求。
// base 使用相对路径，便于任意静态托管（含本地 file 预览）。
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});

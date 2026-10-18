import { defineConfig } from "vitest/config";

// 独立于 vite.config.ts 的测试配置。
// 刻意不复用 vite.config.ts —— 这样跑测试时不必加载 vite-plugin-pwa，
// 免得 PWA 插件在测试进程里插一脚（它关心的是构建产物，与测试无关）。
export default defineConfig({
  test: {
    // 默认 node 环境。需要 DOM 的用例（File / FileReader / document）在文件首行
    // 用指令单独切换：// @vitest-environment jsdom
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

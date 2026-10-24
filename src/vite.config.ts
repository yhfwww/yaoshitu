import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// 要事图 / Yaoshitu —— 游客本地优先；配置后可选 GitHub 登录与同步。
// base 使用相对路径，便于任意静态托管（含 GitHub Pages 这类子路径部署）。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 有新版本时自动接管，避免用户长期停在旧资源上
      registerType: "autoUpdate",
      manifest: {
        name: "要事图",
        short_name: "要事图",
        description: "本地优先的坐标系任务管理器。连续坐标、隐私优先、开源。",
        lang: "zh-CN",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#F1EFE8",
        theme_color: "#F1EFE8",
        orientation: "any",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // 默认只预缓存 js/css/html。不补上图片与 manifest，
        // 离线时图标会缺失，安装到桌面后也可能显示不出图标。
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // 无路由的 SPA：离线刷新时必须由缓存回退到 index.html，
        // 否则 precache 里只存了 index.html，导航到 ./ 匹配不上。
        navigateFallback: "index.html",
        // OAuth 回调必须到达服务器，不能被离线应用首页替换。
        navigateFallbackDenylist: [/^\/api(?:\/|\?|$)/, /^\/_(?:\/|\?|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      // 开发期不注册 SW，避免本地调试被缓存干扰
      devOptions: { enabled: false },
    }),
  ],
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});

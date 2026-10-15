import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// 图标生成配置 —— 由 src/resources/icon-source.svg 产出整套 PWA 图标。
//
// 三个关键决定：
// 1. padding 一律为 0。生成器对 maskable / apple 的默认 padding 是 0.3，
//    且填充色默认是 white，会在品牌米色底（#F1EFE8）外圈加一道白边。
//    我们改为把 maskable 安全区直接算进源图（见 icon-source.svg 注释），
//    于是 any / maskable / apple 可以共用同一张源图，输出构图完全一致。
// 2. resizeOptions.background 显式设为品牌卡片底。仅在尺寸出现取整误差、
//    sharp 需要补边时才会用到，但设上比让它回落到白色安全。
// 3. 保留 minimal-2023 的尺寸集：64 / 192 / 512 + maskable 512 + apple 180 + favicon.ico 48。
export default defineConfig({
  preset: {
    transparent: {
      ...minimal2023Preset.transparent,
      padding: 0,
      resizeOptions: { background: "#f1efe8" },
    },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background: "#f1efe8" },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: "#f1efe8" },
    },
  },
  // 源图必须放在 public/ 下：生成器的输出目录跟随源图所在目录，没有单独的输出目录参数。
  // 因此 app-icon.svg 会随构建一起发布（约 1.9 KB），同时充当"可重新生成整套图标"的单一来源。
  // 注意它不当作 favicon 引用 —— 品牌规范规定 favicon 用方案 B（public/favicon.svg），
  // 方案 A 有 5 个点，16×16 下会糊。
  images: ["public/app-icon.svg"],
});

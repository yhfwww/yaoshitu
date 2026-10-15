# AGENTS.md

给在本仓库工作的 AI agent（以及人）的项目说明。**先读这一页。**

- **需求唯一权威**：`docs/task-matrix-requirements.md`（v1.5，开放问题已全部闭环）。拿不准要不要做、做到什么程度，以它为准，**不要自行发明范围**。
- **开发待办台账**：根目录 `TODO.md` —— **已被 gitignore，只在本机存在，不随仓库分发**。
- 品牌规范：`docs/brand-system.md`（v1.1）；历史决策与踩坑记录：`docs/memory/`。

## 项目是什么

**要事图 / Yaoshitu** —— 本地优先的坐标系任务管理器。每个任务有一对连续坐标（紧急 1–100 × 重要 1–100），优先级靠拖拽摆出来，而不是从四个格子里二选一。坐标系是旗舰视图，四象限矩阵 / 列表 / 仪表盘 / 工作方式 / 归档 / 智能视图与之并列，读写同一份数据。

应用本体在 `src/`：React 19 + TypeScript 5.9 + Vite 8（Rolldown）+ Zustand 5 + Dexie 4。

```
src/src/
├── db/          schema（全量建模）/ Dexie 访问层 / 示例数据
├── store/       Zustand 全局状态（任务 · 笔记 · 设置 · UI）
├── lib/         坐标几何与碰撞 · 日期 · 备份 · 视图注册表
├── components/  侧边栏 · 命令面板 · 任务编辑器 · 设置
└── views/       7 个视图
```

## 开工前必做

1. **读 `TODO.md`**，核对这次要处理的是哪一项。
2. 涉及需求边界的改动，回去对一遍 `docs/task-matrix-requirements.md`。
3. 做完后**把 `TODO.md` 里对应条目的勾与日期更新掉**，新发现的问题随手追加。

## 常用命令

本机 PowerShell 的 ExecutionPolicy 会拦截 `npm.ps1`，**一律用 `cmd /c` 包一层**：

```powershell
cmd /c "npm run typecheck"   # tsc -b --noEmit
cmd /c "npm run dev"         # http://localhost:5173
cmd /c "npm run build"       # 产物在 src/dist
```

Node ≥ 20.19（或 ≥ 22.12，Vite 8 的要求）；本机与 CI 都用 Node 24。

## 硬约束（不是风格偏好，是产品定义）

- **本地优先**：一期**零外部请求**。不要引入遥测、外部 API 调用、CDN 字体。
- **唯一真相源**是 IndexedDB（Dexie，库名 `yaoshitu`）。坐标系与象限矩阵是**同一份坐标数据的两种投影**（连续 vs 阈值二值化），**不要各存一份**。
- **schema 全量建模、UI 分批上线**：新字段直接进 `db/schema.ts`，同时在设置页的"已建模、尚未开放界面"清单里登记。不要因为 UI 还没做就把字段删掉，也不要声称已实装。
- **品牌色**：`#534AB7`（purple 600）是唯一高饱和色，其余走灰阶；**禁止用红/绿表意**——紧迫与重要不靠色相区分，方向感差或色觉障碍用户同样要能读。
- **a11y 基线 WCAG 2.1 AA**：列表视图是无障碍主通道，坐标系里出现的任何信息都必须在列表能拿到。
- **删除必须结构安全**：软删除 → 回收站保留 30 天 → 永久清除。不要做成"toast 计时撤销"（数据会丢）。

## 已知坑（踩过，别再踩）

- **`StrictMode` 下 `init()` 会被并发调用两次**，会重复播种示例数据 —— `store/useStore.ts` 用模块级 `initPromise` 去重，**不要删**。
- **Dexie 的 `EntityTable<T, "id">` 要求主键字段存在于类型里** —— `Settings` 因此带了一个 `id` 字段，别去掉。
- **视图里引组件要用 `../components/x`**（视图在 `views/` 子目录），曾有过写成 `./` 的事故。CI 跑在 Linux 上，**大小写与相对路径错误不会被 Windows 顺手放过**。
- **Windows 下 `vite build` 的 `emptyOutDir` 走 safe-delete shim 可能失败** —— 先 `rm -rf dist` 再 build。
- **仓库路径含中文**（`C:\PROJECT_DEV\要事\TODO_APP`），shell 输出里中文可能显示成 `??`，不影响 git 与文件本身，别被吓到。

## 不要提交

`REF/`（Focus 与 GSD Task Manager 是第三方参考实现，且各自带 `.git`）、`generated-images/`（LOGO 素材带 AI 水印、未剪裁）、`TODO.md`（本地台账）、`node_modules/`、`dist/`。

以上都已写进 `.gitignore`，**不要用 `git add -f` 强行加进来**。

## 工作流约定

- **提交信息用中文**，前缀 `feat` / `fix` / `docs` / `ci` / `chore` / `refactor`。
- **推 `main` 会触发 CI**（`.github/workflows/ci.yml`：`npm ci` → `typecheck` → `build`，约 20 秒）。推完要确认那一次运行是绿的。
- ⚠️ **CI 绿只代表类型正确与可构建，不代表功能正确** —— 当前仓库**没有任何测试**。别把徽标当成功能验证的替代。
- 界面对外可见的改动，README 与 `docs/images/` 里的截图可能会过期，需要重拍。

## 截图怎么重做

README 里的截图是**实拍**，不是示意图。流程：

1. `cmd /c "npm run dev"`（首次启动会自动注入示例数据：10 个任务 + 2 条原则笔记）
2. 浏览器打开 `http://localhost:5173`，在侧边栏逐个切换视图截图
3. 存进 `docs/images/`，README 按文件名引用

拍"选中任务"的坐标系图时，可以直接对 SVG 里右上角那个 `<circle>` 派发一次 `pointerdown`，这样详情卡会真实渲染出来。

# DevKit 项目分析（v1 · 2026-04-08）

> 快照说明：本文档对应仓库在 2026-04-08 前后的状态；后续变更请以新版本分析文件为准。  
> 索引见：[VERSIONS.md](./VERSIONS.md)

---

## 1. 项目概览

**定位**：面向开发者的桌面工具箱（中文界面）。

**技术栈**

- Tauri v2 + Rust（后端命令、文件系统、Git 子进程）
- React 19 + TypeScript + Vite 7
- Tailwind CSS v4（`@tailwindcss/vite`，无独立 `tailwind.config`）
- shadcn/ui（Base UI）、lucide-react

**路径与工程**

- 前端别名：`@/` → `src/`
- 包管理：pnpm
- Tauri 包名：`devkit`（crate `devkit`，lib `devkit_lib`）
- 产物标识：`com.devkit.app`，产品名 DevKit

**工具模块（页面 `Page`）**

首页、JSON、Base64、URL、JWT、UUID、Hash、正则、时间套件、颜色、Diff、文本、CSS 单位、Cron、进制、HTTP 状态码、图片、Mock、Cursor Rules、Markdown 文档、Git 推送助手等；注册表在 `src/lib/tools.ts`。

**特色能力**

- **Git 推送助手**：桌面内 `GitWorkflowPanel` 通过 Tauri `invoke` 调用本机 `git`；另有 `scripts/git-push.mjs`（Node + @inquirer）、Windows `git-push.cmd` + PowerShell 回退、Unix `git-push.sh` + bash 回退。
- **Cursor Rules**：Rust `scan_cursor_rules` 扫描 `~/.cursor/rules` 与工作区 `.cursor/rules/*.mdc`。

---

## 2. 架构要点（便于排查）

| 区域 | 说明 |
|------|------|
| 入口 | `src/main.tsx` → `App.tsx`；工具页 `React.lazy` + `Suspense`；`ErrorBoundary` 包裹主内容区 |
| 状态 / 主题 | `useTheme`、`localStorage`（如 `devkit-theme`、侧栏折叠、Git 路径等） |
| 后端 | `src-tauri/src/lib.rs` + `git_workflow.rs`；能力见 `capabilities/default.json` |
| 安全 | `tauri.conf.json` 中配置 CSP（非 null）、窗口 `minWidth`/`minHeight` |
| CLI | `package.json` `bin` → `bin/git-push.js` → `scripts/git-push.mjs` |

---

## 3. 问题与风险总结（分析时状态）

以下按**原分析优先级**归类；**§4** 标明哪些已在 v1 修复周期内落地。

### 功能

- 单工具未捕获异常可导致整页不可用 → **Error Boundary** 缓解。
- Git：分离 HEAD 时后端直接报错（设计如此）。
- `window.confirm` 在 WebView 上行为不一 → 已改为应用内确认。
- CSP 曾为 null → XSS 面偏大 → 已收紧。
- `fs` 权限仅写文本：若未来扩展读文件需补权限。
- `@inquirer/prompts` 若在仅 `production` 安装场景会缺依赖 → 已挪到 `dependencies`。

### 性能

- 全量静态导入工具 → 已 **lazy** 拆 chunk。
- Git 面板大、列表长 → **memo 子项** + **列表渲染上限（200）** + 自动刷新与 `run` **互斥锁**。
- 性能诊断开关：`usePerfDiagnostics`（可选）。

### 跨平台

- 依赖 PATH 中的 `git`；Windows 下 `CREATE_NO_WINDOW` 可能与部分凭据弹窗交互有关（边缘情况）。
- macOS/Linux CLI：无 Node 时用 **bash 回退脚本**。

### 构建与分发

- 自动更新、Apple 签名、Linux 系统依赖说明等 → **需基础设施/运维**，未在代码周期内实施。
- `bundle.targets: all` 构建面大，用户需选对安装包类型。

---

## 4. 已实施修复清单（截至 2026-04-08）

| 项 | 说明 |
|----|------|
| P0 Error Boundary | `src/components/layout/ErrorBoundary.tsx`，`App.tsx` 包裹主内容 |
| P0 Crate 名 | `devkit-temp` → `devkit` / `devkit_lib` |
| P1 懒加载 | 20 个工具 `lazy` + `Suspense` + fallback |
| P1 确认框 | `useConfirmDialog`；Git 推送、Markdown 文档覆盖/清空 |
| P1 窗口最小尺寸 | `tauri.conf.json` `minWidth` 640、`minHeight` 480 |
| P1 CSP | `default-src/script-src/style-src/img-src/font-src/connect-src` 等 |
| P2 Git 竞态 | `gitLockRef` 互斥 |
| P2 依赖 | `@inquirer/prompts` → `dependencies` |
| P2 面板优化 | `StagedFileItem` / `AddableFileItem` + `memo` |
| P3 长列表 | `FILE_LIST_RENDER_CAP = 200` + 提示文案 |
| P3 生产日志 | `logger.ts` 生产仍输出 WARN 及以上 |
| P3 Unix CLI | `scripts/git-push.sh`、`scripts/git-push.fallback.sh` |

**未纳入（需你方决策/基础设施）**

- Tauri updater + 更新源
- macOS 代码签名 / 公证
- Linux 依赖在 README 或安装脚本中的系统化说明

---

## 5. 给新对话的快速提示语（可复制）

```
请先阅读 .cursor/docs/VERSIONS.md 与日期最新的 devkit-project-analysis-*.md，
再基于当前仓库 diff 补充变更，不要重复全文分析除非我要求。
```

---

## 6. 主要文件路径速查

```
src/App.tsx
src/lib/tools.ts
src/types.ts
src-tauri/src/lib.rs
src-tauri/src/git_workflow.rs
src-tauri/tauri.conf.json
src-tauri/capabilities/default.json
scripts/git-push.mjs
scripts/git-push.cmd / git-push.fallback.ps1
scripts/git-push.sh / git-push.fallback.sh
```

---

*文档类型：项目分析快照 · v1 · 2026-04-08*

# DevKit

DevKit 是一个面向开发者的桌面工具集，采用 Tauri v2 + React 19 + TypeScript + Rust。

## 架构说明

- 壳层：Tauri v2
- 前端：React + TypeScript（工具编排、交互与展示）
- 后端：Rust（系统能力、Git/文件等桌面命令）

当前技术路线为“增量 Rust 化”，不进行全量 Rust UI 重写。详见 `.cursor/docs/rust-evolution-roadmap-2026-04-14.md`。

## 快速开始

```bash
pnpm install
pnpm dev
```

桌面模式（推荐调试完整能力）：

```bash
pnpm tauri dev
```

## 平台前置条件

### 通用

- 必须安装 Git，并确保 `git` 在 PATH 中可执行（应用内 Git 工作流依赖本机 Git）。
- 推荐 Node.js LTS 与 pnpm。

### Windows

- 可使用 `scripts\\git-push.cmd` 直接运行 Git 推送脚本。
- 无 Node 时会自动走 PowerShell 回退脚本。

### macOS / Linux

- 可使用 `./scripts/git-push.sh` 直接运行 Git 推送脚本。
- 无 Node 时会自动走 Bash 回退脚本（已兼容 Bash 3.2+）。

### Linux 运行依赖

不同发行版需确保 Tauri/WebKitGTK 相关运行库可用。若应用无法启动，请先补齐系统依赖再重试。

## 运行模式差异（重要）

- `pnpm dev`（纯浏览器预览）：不具备 Tauri 原生命令能力。
- `pnpm tauri dev`（桌面壳）：可使用应用内 Git、文件系统等桌面能力。

若你在浏览器模式看到 Git 面板不可用，这属于预期降级，不是功能异常。

## 发布现状

- 当前已可本地跨平台构建。
- 自动更新（updater）、macOS 签名/公证、Linux 依赖矩阵仍在路线图中逐步完善。

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code 插件](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

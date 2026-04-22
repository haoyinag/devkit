# DevKit 跨平台专项分析（v2 · 2026-04-10）

> 快照说明：本文是 **跨平台兼容专项复盘**，用于在新对话中快速对齐“哪些平台会受影响、哪些能力会降级、还需要补什么”。  
> 索引见：[VERSIONS.md](./VERSIONS.md)

---

## 1. 总体结论

DevKit 当前主功能可在 Windows / macOS / Linux 三端运行，但存在若干“环境前置条件 + 平台差异导致的边界”：

- **强依赖本机 `git` 在 PATH**（应用内 Git 工作流核心前提）。
- **Tauri 与浏览器模式能力不一致**（应用内 Git、写文件能力仅桌面壳可用）。
- **Unix 回退脚本依赖 Bash 功能**，在 macOS 默认 Bash 3.2 环境存在风险。
- **发布侧事项**（macOS 签名、公证；Linux 运行库依赖）仍需补充文档或基础设施。

---

## 2. 代码证据（关键点）

### 2.1 应用内 Git 依赖本机 git

- `src-tauri/src/git_workflow.rs` 中通过 `Command::new("git")` 调用系统 git。
- 含 Windows 特判 `CREATE_NO_WINDOW`，避免弹黑框。

```1:8:src-tauri/src/git_workflow.rs
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
```

```62:70:src-tauri/src/git_workflow.rs
fn git_command(repo: &str, args: &[&str]) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(repo).args(args);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
```

### 2.2 桌面端最小窗口与 CSP 已配置

```13:24:src-tauri/tauri.conf.json
"windows": [
  {
    "width": 1100,
    "height": 750,
    "minWidth": 640,
    "minHeight": 480
  }
],
"security": {
  "csp": "default-src 'self'; ...; connect-src ipc: http://ipc.localhost"
}
```

### 2.3 Git CLI 说明仍偏 Windows

`GitPushTool` 目前明确展示 `scripts\\git-push.cmd` 与 PowerShell 回退文案，Unix 路径未在 UI 对等展示。

```14:16:src/components/git-push/GitPushTool.tsx
const CMD_WIN = "scripts\\git-push.cmd";
const NOTE_PATH =
  "也可将 scripts 目录加入 PATH（需与 git-push.cmd / .mjs / .ps1 同目录），在任意仓库执行 git-push.cmd；无 Node 时走 PowerShell 回退。";
```

### 2.4 Unix 回退脚本使用 `mapfile`

`mapfile` 在 Bash 4+ 可用，macOS 默认 Bash 3.2 不支持。

```70:77:scripts/git-push.fallback.sh
mapfile -t initial < <(staged_paths)
...
mapfile -t to_exclude < <(pick_by_number "${initial[@]}")
```

---

## 3. 平台兼容风险清单（按影响）

## P0（高概率直接不可用）

- **未安装 git 或 git 不在 PATH**：应用内 Git 功能不可用（Win/macOS/Linux 全部受影响）。

## P1（部分环境不可用或明显降级）

- **macOS 默认 Bash 3.2**：`git-push.fallback.sh` 的 `mapfile` 不兼容；无 Node 时 CLI 回退脚本可能直接失败。
- **Linux 运行库缺失**：若目标机器缺 WebKitGTK / GTK 等运行依赖，应用可能启动失败。
- **macOS 未签名/未公证**：分发安装存在 Gatekeeper 拦截。

## P2（可用但易引起误解或额外成本）

- **Git 工具文案偏 Windows**：Unix 用户在 UI 中不易发现 `scripts/git-push.sh` 的等价路径。
- **`bundle.targets = all`**：构建产物多，用户下载时容易选错安装包类型。
- **浏览器模式与桌面模式差异**：用户在 `pnpm dev` 下会误以为 Git 面板“不可用/坏了”，实际是设计限制。

---

## 4. “平台差异导致不可用”的明确边界

1. **应用内 Git 面板**：仅在 Tauri 桌面壳中可用；纯网页预览模式不可用（设计如此）。
2. **Markdown 保存到本地文件**：依赖 Tauri 插件权限与桌面环境；浏览器模式降级为纯前端能力。
3. **Unix 无 Node 回退脚本**：在 Bash 版本不足时不可用（需升级 bash 或改脚本实现）。

---

## 5. 建议补充（下一轮可执行）

1. **文档补充（优先）**
   - README 增加“平台前置条件”章节：git PATH、Linux 运行库、macOS 签名现状、浏览器/桌面差异。
   - Git 推送助手文案增加 Unix 说明：`scripts/git-push.sh`、`chmod +x`、无 Node 回退说明。

2. **脚本兼容增强（建议）**
   - 将 `git-push.fallback.sh` 改为不依赖 `mapfile` 的写法，兼容 Bash 3.2。

3. **发布工程（需基础设施）**
   - 引入更新通道（updater + 发布源）。
   - 建立 macOS 签名与公证流程。

---

## 6. 新对话快速提示语（可复制）

```
请先读取 .cursor/docs/VERSIONS.md 与最新的 devkit-project-analysis-*.md。
当前优先关注跨平台边界：git PATH、macOS Bash 版本、Linux 运行库、桌面/浏览器能力差异。
```

---

*文档类型：跨平台专项复盘 · v2 · 2026-04-10*

# DevKit Rust 演进路线（v1 · 2026-04-14）

> 目标：明确 DevKit 不是“全量 Rust 重写”，而是“保持 Tauri + React 前端，逐步将高价值能力下沉到 Rust”。

---

## 1. 架构决策（已确认）

## 决策

- 当前阶段不进行全量 Rust 重写。
- 采用增量 Rust 化：UI 保持 React/TypeScript，系统能力与重逻辑逐步下沉到 Rust。

## 原因

- 现有项目已经是 Tauri + Rust + React 的混合架构，Rust 已承担 Git/文件系统等核心桌面能力。
- 当前主要问题是跨平台工程边界与发布基础设施，而非前端技术栈本身。
- 工具集产品需要高频 UI 迭代，React 组件生态与交互开发效率更高。

---

## 2. Rust 能力下沉候选 Backlog

按“收益高 + 风险可控 + 易测试”排序：

1. Git 工作流增强（已有 `git_workflow.rs`，继续扩展）
   - 统一错误码（如 `repo_not_found`、`detached_head`、`git_missing`）
   - 增加长任务状态上报（可用于前端进度提示）
2. 大文本处理工具（Diff、文本批处理）
   - 对大输入采用 Rust 流式处理，降低前端主线程压力
3. 文件类工具（Markdown 持久化、批量文件扫描）
   - 由 Rust 统一路径校验、权限与跨平台兼容
4. 时间/格式化类纯算法
   - 仅迁移“跨端一致性要求高”且已有明显维护成本的部分

---

## 3. Tauri invoke 契约规范（新增）

所有新增 Rust 命令遵循同一返回包结构，避免前端按字符串猜错：

```ts
type CommandOk<T> = { ok: true; data: T };
type CommandErr = {
  ok: false;
  error: {
    code:
      | "invalid_input"
      | "repo_not_found"
      | "git_missing"
      | "detached_head"
      | "permission_denied"
      | "timeout"
      | "internal";
    message: string;
    details?: string;
  };
};
type CommandResult<T> = CommandOk<T> | CommandErr;
```

命令设计约束：

- 参数必须显式可序列化，禁止隐式读取全局状态。
- 长任务应提供阶段性状态（后续可接事件流）。
- 错误码稳定，文案可本地化；前端基于 `code` 做分支处理。
- 结果类型需要在 `src/lib/*-types.ts` 保持与 Rust 对齐。

---

## 4. 发布工程路线图

### 阶段 A（最小可用）

- README 补全平台前置条件：
  - Git 安装与 PATH
  - Linux 运行依赖（WebKitGTK/GTK）
  - 浏览器预览与桌面模式能力差异
- 保持手动发布，但规范产物命名与下载说明

### 阶段 B（可持续交付）

- 配置 Tauri updater（发布源 + 签名密钥管理）
- 建立 CI 打包任务（Windows/macOS/Linux）
- 输出发布检查清单（版本号、变更日志、校验）

### 阶段 C（生产级分发）

- macOS 签名与公证流程自动化
- Linux 按目标发行版输出依赖矩阵与安装指引
- 将 updater 接入稳定/灰度通道

---

## 5. 里程碑验收标准

- M1：跨平台阻塞项关闭（Bash 3.2、文案误导、前置条件说明）。
- M2：至少 1 个高价值工具完成 Rust 下沉，并具备稳定错误码契约。
- M3：完成基础发布流水线，支持可重复的跨平台打包。

---

*文档类型：技术决策与执行路线 · v1 · 2026-04-14*

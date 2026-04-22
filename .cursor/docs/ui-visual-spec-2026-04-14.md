# DevKit UI 视觉规范（v1 · 2026-04-14）

## 目标

- 建立统一、可复用、可扩展的视觉系统，避免页面各自为战。
- 保持现有技术栈（Tailwind v4 + shadcn/ui），通过设计 token 与组件规范完成升级。
- 明确亮色/暗色主题下的主色、渐变、层级、交互反馈标准。

## 视觉基调

- 风格关键词：清爽、专业、轻量、可读性优先。
- 品牌色策略：天蓝为主色，草绿为过渡色（主渐变）。
- 渐变使用原则：用于品牌强调，不覆盖核心内容可读区域。

## 颜色与渐变规范

- Primary（主色）：`hsl(199 89% 60%)`（亮色），`hsl(197 100% 68%)`（暗色）。
- Gradient Brand：
  - Start：`hsl(199 89% 60%)` / 暗色 `hsl(197 100% 68%)`
  - End：`hsl(94 70% 45%)` / 暗色 `hsl(97 72% 54%)`
- 使用级别：
  - `bg-brand-gradient`：主按钮、当前导航激活、品牌徽标
  - `bg-brand-gradient-soft`：页面头部、工具区容器背景
  - `bg-sidebar-gradient`：侧栏背景
  - `text-brand-gradient`：仅用于标题或品牌字样

## 层级与空间规范

- 圆角：容器 `rounded-2xl`，工具面板 `rounded-xl`，控件 `rounded-lg`。
- 阴影：
  - `elev-1`：普通卡片、导航激活项
  - `elev-2`：仅用于高层浮层（谨慎）
- 间距节奏：优先 4/6/8/12/16/20/24（按 Tailwind 对应间距表达）。

## 组件语义骨架（已落地）

- `tool-page-shell`
- `tool-page-header`
- `tool-page-actions`
- `tool-dual-grid`
- `tool-panel`
- `tool-panel-label`
- `tool-panel-body`
- `tool-input-area`

要求：工具页优先复用以上语义样式，不再直接散写重复 class。

## 交互与可访问性

- 所有可交互元素必须有 `focus-visible` 显著反馈。
- Hover 与 Active 必须同时具备视觉差异（不依赖颜色单一变化）。
- 小字号文本优先保证对比度，不得出现“灰底+浅灰字”。

## 页面应用优先级（建议）

1. 高使用频率工具页（JSON、URL、Base64、JWT、文本、正则）
2. 复杂业务页（Git 工作流相关）
3. 其余工具页统一收敛

## 禁止项

- 禁止在页面内临时定义与 token 冲突的新颜色值。
- 禁止为了“好看”引入高频动画影响性能。
- 禁止在暗色模式下使用低对比度渐变文字承载关键信息。

---

文档类型：UI 视觉规范 · v1 · 2026-04-14

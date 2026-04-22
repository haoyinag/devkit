import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalStorageDebounced } from "@/hooks/useLocalStorageDebounced";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { GitBranchLists, GitRepoState, GitWorktreeLists } from "@/lib/git-workflow-types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleHelp, FolderOpen, ListPlus, Loader2, MinusCircle, PlusCircle, RefreshCw, Trash2, Upload } from "lucide-react";

const REPO_PATH_KEY = "devkit-git-workflow-repo";
const AUTO_REFRESH_KEY = "devkit-git-auto-refresh";
const RECENT_BRANCHES_KEY = "devkit-git-recent-branches";
const FILE_LIST_RENDER_CAP = 200;
const BRANCH_ROW_HEIGHT = 32;
const BRANCH_VIEWPORT_HEIGHT = 256;
const BRANCH_OVERSCAN = 8;

const GIT_AUTO_REFRESH_MODES = ["off", "focus", "interval-8", "interval-15", "interval-30"] as const;
type GitAutoRefreshMode = (typeof GIT_AUTO_REFRESH_MODES)[number];

function parseAutoRefreshMode(raw: string): GitAutoRefreshMode {
  return GIT_AUTO_REFRESH_MODES.includes(raw as GitAutoRefreshMode) ? (raw as GitAutoRefreshMode) : "off";
}

function autoRefreshIntervalMs(mode: GitAutoRefreshMode): number {
  if (mode === "interval-8") return 8000;
  if (mode === "interval-15") return 15000;
  if (mode === "interval-30") return 30000;
  return 0;
}

function autoRefreshDescription(mode: GitAutoRefreshMode): string {
  switch (mode) {
    case "off":
      return "不会自动刷新；外部改过 Git 后请手动点「刷新」。";
    case "focus":
      return "从其它窗口切回本应用、或从后台切回前台时，会静默同步一次状态。";
    case "interval-8":
      return "切回窗口时会同步；本窗口可见时约每 8 秒再静默同步一次。";
    case "interval-15":
      return "切回窗口时会同步；本窗口可见时约每 15 秒再静默同步一次。";
    case "interval-30":
      return "切回窗口时会同步；本窗口可见时约每 30 秒再静默同步一次。";
    default:
      return "";
  }
}

function syncSummaryText(s: GitRepoState): string {
  const a = s.commitsAhead ?? 0;
  const b = s.commitsBehind ?? 0;
  if (s.upstreamRef == null) {
    if (a > 0) {
      return `未配置上游跟踪分支；已用 Git 的 @{push} 或 origin/${s.branch} 与本地比较，估计约有 ${a} 个提交尚未推送（以下「尚未推送的提交」列表为准）。建议在终端执行一次：git push -u origin ${s.branch}`;
    }
    return "当前分支未设置上游，且无法对照 origin 上的同名分支估算（可能尚无远程分支）。请查看下方完整 git status。";
  }
  if (a === 0 && b === 0) {
    return `已跟踪 ${s.upstreamRef}，与远程一致（无未推送、未拉取的提交）。`;
  }
  const parts: string[] = [];
  if (a > 0) parts.push(`本地已有 ${a} 个提交尚未 push`);
  if (b > 0) parts.push(`落后远程 ${b} 个提交，可先 pull`);
  return `跟踪 ${s.upstreamRef}：${parts.join("；")}。`;
}

function hasUnpushedWork(s: GitRepoState): boolean {
  return (s.commitsAhead ?? 0) > 0 || s.unpushedLog.trim().length > 0;
}

function caseConflicts(input: string, candidates: string[]): string[] {
  const target = input.trim();
  if (!target) return [];
  const lower = target.toLowerCase();
  return candidates.filter((c) => c !== target && c.toLowerCase() === lower);
}

/** 仅在工作区「干净」且无未推送时置于顶部；与提交/推送流程相关的提示在「提交」卡片内展示 */
function overviewStepHint(s: GitRepoState): string | null {
  const hasStaged = s.stagedFiles.length > 0;
  const hasAddable = s.addableFiles.length > 0;
  const unpushed = hasUnpushedWork(s);
  if (!unpushed && !hasStaged && !hasAddable) {
    return "工作区干净，且与远程对齐（或无可比对远程）。改代码后再走：暂存 → 提交 →（可选）推送。";
  }
  return null;
}

/** 与提交、暂存、推送相关的下一步说明 */
function commitWorkflowHint(s: GitRepoState, commitDraft: string): string | null {
  const behind = s.commitsBehind ?? 0;
  const hasStaged = s.stagedFiles.length > 0;
  const hasAddable = s.addableFiles.length > 0;
  const msg = commitDraft.trim();
  const unpushed = hasUnpushedWork(s);

  if (behind > 0 && unpushed) {
    return "你既「落后远程」又有「未推送提交」，容易冲突。建议先点「拉取」，再决定提交或仅推送。";
  }
  if (behind > 0) {
    return "当前分支落后于远程，直接推送可能被拒绝。建议先「拉取」再提交/推送。";
  }
  if (unpushed && !hasStaged && !hasAddable) {
    return "没有新的改动要打包成提交；若要把已有本地 commit 送到远程，请在本页上方「尚未推送的提交」里点「仅推送到 origin」。";
  }
  if (hasStaged && !msg) {
    return "暂存区已有文件，请写好提交说明，再点「提交」。";
  }
  if (hasStaged && msg) {
    return "可以点「提交」：会先弹出本次将纳入的文件清单，确认后再真正执行 commit；若选推送到 origin，提交后还会再询问一次。";
  }
  if (!hasStaged && hasAddable) {
    return "还有改动未进暂存区：可用本列表「全部加入」，或逐个点 +；再到左侧勾选并「移出所选」定稿后提交。亦可用上方「暂存全部（git add -A）」。";
  }
  return null;
}

const FLOW_TOOLTIP_CLASS =
  "max-w-[min(22rem,calc(100vw-2rem))] text-left text-xs leading-relaxed font-normal whitespace-normal";

function FlowTooltipSteps() {
  return (
    <div className="space-y-2">
      <p className="font-medium text-background">Git 工作流（与终端脚本思路一致）</p>
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>拉取：可选，与推送不同。</li>
        <li>暂存：可先「暂存全部」，再在列表里多选/单文件移出，定稿本次要提交的文件。</li>
        <li>提交：只打包当前暂存区；与「推送」分开。</li>
        <li>推送：把已有 commit 送远程；无新暂存时用「仅推送」。</li>
      </ol>
      <p className="text-background/90">
        工作区干净时顶部会有简要说明；与提交、推送相关的提示在下方「提交」卡片内。提交前会列出暂存文件清单供确认。自动同步可在「分支与远程同步」里调整。
      </p>
    </div>
  );
}

const StagedFileItem = memo(function StagedFileItem({
  path,
  checked,
  disabled,
  pending,
  onToggle,
  onUnstage,
}: {
  path: string;
  checked: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: () => void;
  onUnstage: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-border/60 p-1.5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled || pending}
          className="mt-0.5 accent-primary"
        />
        <span className="min-w-0 break-all font-mono text-xs">{path}</span>
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-0.5 px-2"
        disabled={disabled || pending}
        onClick={onUnstage}
        title="移出暂存区"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <MinusCircle size={14} />}
      </Button>
    </li>
  );
});

const AddableFileItem = memo(function AddableFileItem({
  path,
  disabled,
  pending,
  onStage,
}: {
  path: string;
  disabled: boolean;
  pending: boolean;
  onStage: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-border/60 p-1.5">
      <span className="min-w-0 flex-1 break-all font-mono text-xs">{path}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-0.5 px-2"
        disabled={disabled || pending}
        onClick={onStage}
        title="加入暂存区"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
      </Button>
    </li>
  );
});

interface GitWorkflowPanelProps {
  mode?: "all" | "push" | "branch";
}

export function GitWorkflowPanel({ mode = "all" }: GitWorkflowPanelProps) {
  const showPushSections = mode !== "branch";
  const showBranchSections = mode !== "push";
  const inApp = isTauri();
  const [confirmPush, ConfirmPushDialog] = useConfirmDialog();

  const [pathInput, setPathInput, pathPersistErr] = useLocalStorageDebounced(REPO_PATH_KEY, "", 300);
  const [autoRefreshRaw, setAutoRefreshRaw, autoRefreshPersistErr] = useLocalStorageDebounced(
    AUTO_REFRESH_KEY,
    "off",
    200,
  );
  const [recentBranchesRaw, setRecentBranchesRaw, recentBranchesPersistErr] = useLocalStorageDebounced(
    RECENT_BRANCHES_KEY,
    "[]",
    200,
  );
  const autoRefreshMode = parseAutoRefreshMode(autoRefreshRaw);
  const [state, setState] = useState<GitRepoState | null>(null);
  const [branchLists, setBranchLists] = useState<GitBranchLists | null>(null);
  const [switchBranchInput, setSwitchBranchInput] = useState("");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchPickerScrollTop, setBranchPickerScrollTop] = useState(0);
  const [newBranchInput, setNewBranchInput] = useState("");
  const [createFromInput, setCreateFromInput] = useState("");
  const [deleteBranchInput, setDeleteBranchInput] = useState("");
  const [deleteForce, setDeleteForce] = useState(false);
  const [upstreamInput, setUpstreamInput] = useState("");
  const [renameOldInput, setRenameOldInput] = useState("");
  const [renameNewInput, setRenameNewInput] = useState("");
  const [mergedBaseInput, setMergedBaseInput] = useState("");
  const [mergedBranches, setMergedBranches] = useState<string[]>([]);
  const [diffStat, setDiffStat] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [afterCommit, setAfterCommit] = useState<"push" | "local">("push");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  /** 勾选 = 将参与「批量移出暂存」的文件 */
  const [stagedPick, setStagedPick] = useState<Record<string, boolean>>({});
  /** 提交前二次确认：展示将纳入 commit 的文件列表 */
  const [commitPreviewOpen, setCommitPreviewOpen] = useState(false);
  /** 高频操作的用户反馈：正在批量应用暂存/移出 */
  const [pendingStageCount, setPendingStageCount] = useState(0);
  const [pendingUnstageCount, setPendingUnstageCount] = useState(0);
  const [pendingStageMap, setPendingStageMap] = useState<Record<string, boolean>>({});
  const [pendingUnstageMap, setPendingUnstageMap] = useState<Record<string, boolean>>({});

  const rootRef = useRef<string | null>(null);
  const busyRef = useRef<string | null>(null);
  const branchPickerRef = useRef<HTMLDivElement | null>(null);
  /** 互斥锁：防止自动刷新与手动操作同时调用 git */
  const gitLockRef = useRef(false);
  rootRef.current = state?.root ?? null;
  busyRef.current = busy;

  const appendLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-120), line]);
  }, []);

  const run = useCallback(
    async (label: string | null, fn: () => Promise<void>) => {
      if (gitLockRef.current) return;
      gitLockRef.current = true;
      if (label) setBusy(label);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(String(e));
      } finally {
        if (label) setBusy(null);
        gitLockRef.current = false;
      }
    },
    [],
  );

  const refreshDiffStat = useCallback(
    async (root: string) => {
      try {
        const stat = await invoke<string>("git_workflow_diff_cached_stat", { repoRoot: root });
        setDiffStat(stat || "（暂无已暂存变更）");
      } catch {
        setDiffStat("");
      }
    },
    [],
  );

  const refreshBranchLists = useCallback(async (root: string, adoptCurrent = false) => {
    try {
      const lists = await invoke<GitBranchLists>("git_workflow_list_branches", { repoRoot: root });
      setBranchLists(lists);
      setSwitchBranchInput((prev) => {
        if (adoptCurrent) return lists.currentBranch || prev;
        return prev.trim() ? prev : lists.currentBranch || prev;
      });
    } catch {
      setBranchLists(null);
    }
  }, []);

  const applyState = useCallback(async (s: GitRepoState) => {
    setState(s);
  }, []);

  /** 仅合并暂存/可加入列表与短状态（避免每次 add 都跑完整 refresh 里的一串 git） */
  const applyListsMerge = useCallback(
    async (root: string, lists: GitWorktreeLists) => {
      setState((prev) => {
        if (!prev || prev.root !== root) return prev;
        const sameStatus = prev.statusSb === lists.statusSb;
        const sameStaged =
          prev.stagedFiles.length === lists.stagedFiles.length &&
          prev.stagedFiles.every((f, i) => f === lists.stagedFiles[i]);
        const sameAddable =
          prev.addableFiles.length === lists.addableFiles.length &&
          prev.addableFiles.every((f, i) => f === lists.addableFiles[i]);
        if (sameStatus && sameStaged && sameAddable) return prev;
        return {
          ...prev,
          statusSb: lists.statusSb,
          stagedFiles: sameStaged ? prev.stagedFiles : lists.stagedFiles,
          addableFiles: sameAddable ? prev.addableFiles : lists.addableFiles,
        };
      });
    },
    [],
  );

  // 高频点击会导致多次 invoke+git；这里做合并：200ms 内把多次 add/unstage 聚合成一次 git 调用
  const stageQueueRef = useRef<{ root: string; paths: Set<string>; timer: number | null }>({
    root: "",
    paths: new Set(),
    timer: null,
  });
  const unstageQueueRef = useRef<{ root: string; paths: Set<string>; timer: number | null }>({
    root: "",
    paths: new Set(),
    timer: null,
  });

  useEffect(() => {
    return () => {
      if (stageQueueRef.current.timer != null) window.clearTimeout(stageQueueRef.current.timer);
      if (unstageQueueRef.current.timer != null) window.clearTimeout(unstageQueueRef.current.timer);
    };
  }, []);

  const flushStageQueue = useCallback(async () => {
    const root = stageQueueRef.current.root;
    const paths = [...stageQueueRef.current.paths];
    stageQueueRef.current.paths.clear();
    stageQueueRef.current.timer = null;
    setPendingStageCount(0);
    if (!root || paths.length === 0) return;
    // 这里不走 run(label) 以免把全局 busy 卡死（用户可能还想滚动/编辑说明）；用轻量反馈即可
    try {
      await invoke("git_workflow_add_paths", { repoRoot: root, paths });
      const lists = await invoke<GitWorktreeLists>("git_workflow_refresh_lists", { repoRoot: root });
      await applyListsMerge(root, lists);
      setPendingStageMap((prev) => {
        const next = { ...prev };
        for (const p of paths) delete next[p];
        return next;
      });
    } catch (e) {
      setError(String(e));
      // 失败时回到真实状态（用轻量刷新恢复列表）
      try {
        const lists = await invoke<GitWorktreeLists>("git_workflow_refresh_lists", { repoRoot: root });
        await applyListsMerge(root, lists);
      } catch {
        /* ignore */
      }
      setPendingStageMap((prev) => {
        const next = { ...prev };
        for (const p of paths) delete next[p];
        return next;
      });
    }
  }, [applyListsMerge]);

  const flushUnstageQueue = useCallback(async () => {
    const root = unstageQueueRef.current.root;
    const paths = [...unstageQueueRef.current.paths];
    unstageQueueRef.current.paths.clear();
    unstageQueueRef.current.timer = null;
    setPendingUnstageCount(0);
    if (!root || paths.length === 0) return;
    try {
      await invoke("git_workflow_restore_staged", { repoRoot: root, paths });
      const lists = await invoke<GitWorktreeLists>("git_workflow_refresh_lists", { repoRoot: root });
      await applyListsMerge(root, lists);
      setPendingUnstageMap((prev) => {
        const next = { ...prev };
        for (const p of paths) delete next[p];
        return next;
      });
    } catch (e) {
      setError(String(e));
      try {
        const lists = await invoke<GitWorktreeLists>("git_workflow_refresh_lists", { repoRoot: root });
        await applyListsMerge(root, lists);
      } catch {
        /* ignore */
      }
      setPendingUnstageMap((prev) => {
        const next = { ...prev };
        for (const p of paths) delete next[p];
        return next;
      });
    }
  }, [applyListsMerge]);

  const enqueueStagePaths = useCallback(
    (root: string, paths: string[]) => {
      if (paths.length === 0) return;
      if (stageQueueRef.current.root !== root) {
        stageQueueRef.current.root = root;
        stageQueueRef.current.paths.clear();
        if (stageQueueRef.current.timer != null) window.clearTimeout(stageQueueRef.current.timer);
        stageQueueRef.current.timer = null;
      }
      for (const p of paths) stageQueueRef.current.paths.add(p);
      setPendingStageCount(stageQueueRef.current.paths.size);
      setPendingStageMap((prev) => {
        const next = { ...prev };
        for (const p of paths) next[p] = true;
        return next;
      });
      if (stageQueueRef.current.timer != null) return;
      stageQueueRef.current.timer = window.setTimeout(() => void flushStageQueue(), 200);
    },
    [flushStageQueue],
  );

  const enqueueUnstagePaths = useCallback(
    (root: string, paths: string[]) => {
      if (paths.length === 0) return;
      if (unstageQueueRef.current.root !== root) {
        unstageQueueRef.current.root = root;
        unstageQueueRef.current.paths.clear();
        if (unstageQueueRef.current.timer != null) window.clearTimeout(unstageQueueRef.current.timer);
        unstageQueueRef.current.timer = null;
      }
      for (const p of paths) unstageQueueRef.current.paths.add(p);
      setPendingUnstageCount(unstageQueueRef.current.paths.size);
      setPendingUnstageMap((prev) => {
        const next = { ...prev };
        for (const p of paths) next[p] = true;
        return next;
      });
      if (unstageQueueRef.current.timer != null) return;
      unstageQueueRef.current.timer = window.setTimeout(() => void flushUnstageQueue(), 200);
    },
    [flushUnstageQueue],
  );

  /** 外部终端改过 Git 时同步界面，不刷屏写日志 */
  const silentRefresh = useCallback(async () => {
    const root = rootRef.current;
    if (!root || busyRef.current || gitLockRef.current) return;
    gitLockRef.current = true;
    try {
      const lists = await invoke<GitWorktreeLists>("git_workflow_refresh_lists", { repoRoot: root });
      await applyListsMerge(root, lists);
      await refreshBranchLists(root);
    } catch {
      /* 忽略 */
    } finally {
      gitLockRef.current = false;
    }
  }, [applyListsMerge, refreshBranchLists]);

  useEffect(() => {
    if (!state?.stagedFiles.length) {
      setStagedPick({});
      return;
    }
    setStagedPick((prev) => {
      const next: Record<string, boolean> = {};
      for (const f of state.stagedFiles) {
        if (prev[f]) next[f] = true;
      }
      return next;
    });
  }, [state?.stagedFiles]);

  useEffect(() => {
    if (!state?.root) {
      setBranchLists(null);
      setSwitchBranchInput("");
      setBranchPickerOpen(false);
      setCreateFromInput("");
      setDeleteBranchInput("");
      setUpstreamInput("");
      return;
    }
    const defaultRemote = branchLists?.remotes?.[0] || "origin";
    setCreateFromInput((prev) => (prev.trim() ? prev : state.branch));
    setMergedBaseInput((prev) => (prev.trim() ? prev : state.branch));
    setUpstreamInput((prev) => (prev.trim() ? prev : `${defaultRemote}/${state.branch}`));
    void refreshBranchLists(state.root);
  }, [state?.root, state?.branch, refreshBranchLists]);

  useEffect(() => {
    if (!branchPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (branchPickerRef.current && !branchPickerRef.current.contains(target)) {
        setBranchPickerOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [branchPickerOpen]);

  useEffect(() => {
    const candidates = (branchLists?.localBranches ?? []).filter((b) => b !== (branchLists?.currentBranch || state?.branch || ""));
    if (candidates.length === 0) {
      setDeleteBranchInput("");
      return;
    }
    setDeleteBranchInput((prev) => {
      if (!prev.trim()) return candidates[0];
      return candidates.includes(prev.trim()) ? prev : candidates[0];
    });
  }, [branchLists?.localBranches, branchLists?.currentBranch, state?.branch]);

  useEffect(() => {
    const locals = branchLists?.localBranches ?? [];
    if (locals.length === 0) {
      setRenameOldInput("");
      return;
    }
    const current = branchLists?.currentBranch || state?.branch || locals[0];
    setRenameOldInput((prev) => (prev.trim() && locals.includes(prev.trim()) ? prev : current));
  }, [branchLists?.localBranches, branchLists?.currentBranch, state?.branch]);

  useEffect(() => {
    if (!state?.root) {
      setMergedBranches([]);
    }
  }, [state?.root]);

  useEffect(() => {
    if (!inApp || !state?.root) return;
    if (autoRefreshMode === "off") return;
    const onWinFocus = () => {
      void silentRefresh();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void silentRefresh();
    };
    window.addEventListener("focus", onWinFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onWinFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [inApp, state?.root, silentRefresh, autoRefreshMode]);

  useEffect(() => {
    if (!inApp || !state?.root) return;
    const ms = autoRefreshIntervalMs(autoRefreshMode);
    if (ms <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void silentRefresh();
    }, ms);
    return () => clearInterval(id);
  }, [inApp, state?.root, silentRefresh, autoRefreshMode]);

  // 为避免进入 Git 页就触发大量后台 git 命令，改为手动点击「打开 / 解析」后再加载仓库状态。

  const handleOpen = useCallback(() => {
    void run("打开仓库", async () => {
      const s = await invoke<GitRepoState>("git_workflow_resolve", { path: pathInput.trim() });
      await applyState(s);
      await refreshDiffStat(s.root);
      await refreshBranchLists(s.root, true);
      appendLog(`已打开：${s.root}（${s.branch}）`);
    });
  }, [pathInput, run, applyState, refreshDiffStat, refreshBranchLists, appendLog]);

  const handleRefresh = useCallback(() => {
    if (!state?.root) return;
    void run("刷新", async () => {
      const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
      await applyState(s);
      await refreshDiffStat(s.root);
      await refreshBranchLists(s.root, true);
      appendLog("已刷新状态");
    });
  }, [state?.root, run, applyState, refreshDiffStat, refreshBranchLists, appendLog]);

  const handlePickFolder = useCallback(async () => {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "选择 Git 仓库文件夹",
      defaultPath: pathInput.trim() || undefined,
    });
    if (typeof picked === "string" && picked) {
      setPathInput(picked.trim());
    }
  }, [pathInput, setPathInput]);

  const handlePull = useCallback(() => {
    if (!state?.root) return;
    void run("拉取", async () => {
      const out = await invoke<string>("git_workflow_pull", { repoRoot: state.root });
      if (out) appendLog(out);
      const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
      await applyState(s);
      await refreshDiffStat(s.root);
    });
  }, [state?.root, run, appendLog, applyState, refreshDiffStat]);

  const handleAddAll = useCallback(() => {
    if (!state?.root) return;
    const root = state.root;
    void run("暂存", async () => {
      await invoke("git_workflow_add_all", { repoRoot: root });
      appendLog("已执行 git add -A");
      const lists = await invoke<GitWorktreeLists>("git_workflow_refresh_lists", { repoRoot: root });
      await applyListsMerge(root, lists);
    });
  }, [state?.root, run, appendLog, applyListsMerge]);

  const handleUnstage = useCallback(
    (path: string) => {
      if (!state?.root) return;
      const root = state.root;
      appendLog(`移出暂存（排队中）：${path}`);
      enqueueUnstagePaths(root, [path]);
    },
    [state?.root, appendLog, enqueueUnstagePaths],
  );

  const pickedForUnstage = state?.stagedFiles.filter((p) => stagedPick[p]) ?? [];

  const handleUnstageSelected = useCallback(() => {
    if (!state?.root || pickedForUnstage.length === 0) return;
    const root = state.root;
    const paths = [...pickedForUnstage];
    appendLog(`批量移出暂存（排队中）：${paths.length} 个文件`);
    setStagedPick({});
    enqueueUnstagePaths(root, paths);
  }, [state?.root, pickedForUnstage, appendLog, enqueueUnstagePaths]);

  const handleStagePath = useCallback(
    (path: string) => {
      if (!state?.root) return;
      const root = state.root;
      appendLog(`加入暂存（排队中）：${path}`);
      enqueueStagePaths(root, [path]);
    },
    [state?.root, appendLog, enqueueStagePaths],
  );

  const handleStageAllAddable = useCallback(() => {
    if (!state?.root || state.addableFiles.length === 0) return;
    const root = state.root;
    const paths = [...state.addableFiles];
    appendLog(`批量加入暂存（排队中）：${paths.length} 个文件`);
    enqueueStagePaths(root, paths);
  }, [state?.root, state?.addableFiles, appendLog, enqueueStagePaths]);

  const handlePushOnly = useCallback(() => {
    if (!state?.root) return;
    void (async () => {
      const ok = await confirmPush({
        title: `推送到 origin`,
        description: `将分支「${state.branch}」推送到 origin？（不新建提交，只把已有本地提交送到远程）`,
        confirmText: "推送",
      });
      if (!ok) return;
      await run("推送", async () => {
      const pushOut = await invoke<string>("git_workflow_push", {
        repoRoot: state.root,
        remote: "origin",
        branch: state.branch,
      });
      if (pushOut) appendLog(pushOut);
      else appendLog("push 完成");
      const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
      await applyState(s);
      await refreshDiffStat(s.root);
      });
    })();
  }, [state, run, appendLog, applyState, refreshDiffStat, confirmPush]);

  const hasDirtyWorktree = useMemo(() => {
    if (!state) return false;
    return state.stagedFiles.length > 0 || state.addableFiles.length > 0;
  }, [state]);

  const remoteShortBranches = useMemo(
    () =>
      (branchLists?.remoteBranches ?? [])
        .map((r) => r.replace(/^[^/]+\//, ""))
        .filter((r) => r.length > 0),
    [branchLists?.remoteBranches],
  );

  const switchBranchCandidates = useMemo(() => {
    const local = branchLists?.localBranches ?? [];
    const rows: Array<{ name: string; source: "local" | "remote" }> = local.map((name) => ({
      name,
      source: "local",
    }));
    for (const rb of branchLists?.remoteBranches ?? []) {
      rows.push({ name: rb, source: "remote" });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [branchLists?.localBranches, branchLists?.remoteBranches]);
  const recentBranches = useMemo(() => {
    try {
      const parsed = JSON.parse(recentBranchesRaw) as unknown;
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    } catch {
      return [] as string[];
    }
  }, [recentBranchesRaw]);
  const pushRecentBranch = useCallback(
    (branch: string) => {
      const b = branch.trim();
      if (!b) return;
      const next = [b, ...recentBranches.filter((x) => x !== b)].slice(0, 10);
      setRecentBranchesRaw(JSON.stringify(next));
    },
    [recentBranches, setRecentBranchesRaw],
  );
  const filteredSwitchBranchCandidates = useMemo(() => {
    const q = switchBranchInput.trim().toLowerCase();
    if (!q) return switchBranchCandidates;
    const filtered = switchBranchCandidates.filter((b) => b.name.toLowerCase().includes(q));
    if (switchBranchInput.trim() && !filtered.some((b) => b.name === switchBranchInput.trim())) {
      const picked = switchBranchCandidates.find((b) => b.name === switchBranchInput.trim());
      if (picked) return [picked, ...filtered];
    }
    return filtered;
  }, [switchBranchCandidates, switchBranchInput]);
  const branchQuickCandidates = useMemo(() => {
    const available = new Set(switchBranchCandidates.map((b) => b.name));
    const quick: string[] = [];
    for (const b of recentBranches) {
      if (available.has(b)) quick.push(b);
    }
    for (const b of switchBranchCandidates.map((x) => x.name)) {
      if (quick.length >= 8) break;
      if (!quick.includes(b)) quick.push(b);
    }
    return quick.slice(0, 8);
  }, [recentBranches, switchBranchCandidates]);
  const currentBranchName = branchLists?.currentBranch || state?.branch || "";
  const deletableBranches = useMemo(
    () => (branchLists?.localBranches ?? []).filter((b) => b !== currentBranchName),
    [branchLists?.localBranches, currentBranchName],
  );
  const branchVirtualRange = useMemo(() => {
    const total = filteredSwitchBranchCandidates.length;
    if (total === 0) return { start: 0, end: 0, totalHeight: 0 };
    const start = Math.max(0, Math.floor(branchPickerScrollTop / BRANCH_ROW_HEIGHT) - BRANCH_OVERSCAN);
    const end = Math.min(
      total,
      Math.ceil((branchPickerScrollTop + BRANCH_VIEWPORT_HEIGHT) / BRANCH_ROW_HEIGHT) + BRANCH_OVERSCAN,
    );
    return {
      start,
      end,
      totalHeight: total * BRANCH_ROW_HEIGHT,
    };
  }, [filteredSwitchBranchCandidates.length, branchPickerScrollTop]);
  const virtualSwitchRows = useMemo(
    () => filteredSwitchBranchCandidates.slice(branchVirtualRange.start, branchVirtualRange.end),
    [filteredSwitchBranchCandidates, branchVirtualRange.start, branchVirtualRange.end],
  );
  const createFromCandidates = useMemo(() => {
    const rows = new Set<string>();
    for (const b of branchLists?.localBranches ?? []) rows.add(b);
    for (const b of branchLists?.remoteBranches ?? []) rows.add(b);
    if (state?.branch) rows.add(state.branch);
    return [...rows];
  }, [branchLists?.localBranches, branchLists?.remoteBranches, state?.branch]);

  const switchTarget = switchBranchInput.trim();
  const switchExactExists = useMemo(
    () => switchBranchCandidates.some((b) => b.name === switchTarget),
    [switchBranchCandidates, switchTarget],
  );
  const switchCaseConflict = useMemo(() => {
    if (!switchTarget || switchExactExists) return [];
    return caseConflicts(
      switchTarget,
      switchBranchCandidates.map((b) => b.name),
    );
  }, [switchTarget, switchExactExists, switchBranchCandidates]);

  const newBranchCaseConflict = useMemo(() => {
    const candidates = [...(branchLists?.localBranches ?? []), ...remoteShortBranches];
    return caseConflicts(newBranchInput, candidates);
  }, [newBranchInput, branchLists?.localBranches, remoteShortBranches]);

  const handleSwitchBranch = useCallback(() => {
    if (!state?.root) return;
    const target = switchBranchInput.trim();
    if (!target) {
      setError("请先输入要切换的分支名。");
      return;
    }
    if (switchCaseConflict.length > 0) {
      setError(`检测到仅大小写不同的分支：${switchCaseConflict.join("、")}。请从列表中选择精确分支名。`);
      return;
    }
    void (async () => {
      let autoStashBeforeSwitch = false;
      if (hasDirtyWorktree) {
        const autoStash = await confirmPush({
          title: "切换分支：检测到未提交改动",
          description: "建议优先「自动暂存并切换」以降低冲突与被拒绝概率。若不自动暂存，可继续直接尝试切换。",
          confirmText: "自动暂存并切换",
          cancelText: "更多选项",
        });
        if (autoStash) {
          autoStashBeforeSwitch = true;
        } else {
          const directTry = await confirmPush({
            title: "继续直接切换？",
            description: "将不处理当前改动，Git 可能拒绝切换。若失败可回到当前分支继续处理。",
            confirmText: "继续尝试（不处理改动）",
            cancelText: "取消",
          });
          if (!directTry) return;
        }
      }
      await run("切换分支", async () => {
        const s = await invoke<GitRepoState>("git_workflow_switch_branch", {
          repoRoot: state.root,
          branch: target,
          allowCreateFromRemote: true,
          autoStashBeforeSwitch,
        });
        await applyState(s);
        await refreshDiffStat(s.root);
        await refreshBranchLists(s.root, true);
        appendLog(`已切换分支：${s.branch}`);
        pushRecentBranch(s.branch);
        if (autoStashBeforeSwitch) {
          appendLog("已执行自动暂存并尝试恢复改动；如有冲突，可在终端执行 git stash list / git stash pop 排查。");
        }
      });
    })();
  }, [
    state,
    switchBranchInput,
    switchCaseConflict,
    hasDirtyWorktree,
    confirmPush,
    run,
    applyState,
    refreshDiffStat,
    refreshBranchLists,
    appendLog,
    pushRecentBranch,
  ]);

  const handleCreateBranch = useCallback(() => {
    if (!state?.root) return;
    const target = newBranchInput.trim();
    const startPoint = createFromInput.trim();
    if (!target) {
      setError("请先输入新分支名。");
      return;
    }
    if (newBranchCaseConflict.length > 0) {
      setError(`检测到仅大小写不同的分支：${newBranchCaseConflict.join("、")}。请更换分支名。`);
      return;
    }
    void run("新建分支", async () => {
      const s = await invoke<GitRepoState>("git_workflow_create_branch", {
        repoRoot: state.root,
        branch: target,
        checkout: true,
        startPoint: startPoint || null,
      });
      await applyState(s);
      await refreshDiffStat(s.root);
      await refreshBranchLists(s.root, true);
      setNewBranchInput("");
      appendLog(startPoint ? `已从 ${startPoint} 新建并切换：${s.branch}` : `已新建并切换：${s.branch}`);
      pushRecentBranch(s.branch);
    });
  }, [
    state,
    newBranchInput,
    createFromInput,
    newBranchCaseConflict,
    run,
    applyState,
    refreshDiffStat,
    refreshBranchLists,
    appendLog,
    pushRecentBranch,
  ]);

  const refreshMergedBranches = useCallback(
    async (root: string, baseBranch: string) => {
      try {
        const rows = await invoke<string[]>("git_workflow_list_merged_branches", {
          repoRoot: root,
          baseBranch: baseBranch.trim() || null,
        });
        setMergedBranches(rows);
      } catch {
        setMergedBranches([]);
      }
    },
    [],
  );

  const handleDeleteBranch = useCallback(() => {
    if (!state?.root) return;
    const target = deleteBranchInput.trim();
    if (!target) {
      setError("请先选择要删除的本地分支。");
      return;
    }
    if (target === currentBranchName) {
      setError("不能删除当前分支，请先切换到其他分支。");
      return;
    }
    void (async () => {
      const ok = await confirmPush({
        title: deleteForce ? "强制删除分支确认" : "删除分支确认",
        description: deleteForce
          ? `将强制删除本地分支「${target}」，即使其未合并。此操作不可撤销，是否继续？`
          : `将删除本地分支「${target}」。若该分支存在未合并提交，Git 会拒绝。是否继续？`,
        confirmText: deleteForce ? "强制删除" : "删除",
        variant: "destructive",
      });
      if (!ok) return;
      await run("删除分支", async () => {
        const s = await invoke<GitRepoState>("git_workflow_delete_branch", {
          repoRoot: state.root,
          branch: target,
          force: deleteForce,
        });
        await applyState(s);
        await refreshDiffStat(s.root);
        await refreshBranchLists(s.root, true);
        appendLog(`已删除本地分支：${target}${deleteForce ? "（强制）" : ""}`);
      });
    })();
  }, [
    state,
    deleteBranchInput,
    currentBranchName,
    deleteForce,
    confirmPush,
    run,
    applyState,
    refreshDiffStat,
    refreshBranchLists,
    appendLog,
  ]);

  const handleSetUpstream = useCallback(() => {
    if (!state?.root) return;
    const upstream = upstreamInput.trim();
    if (!upstream) {
      setError("请先输入上游引用（如 origin/main）。");
      return;
    }
    const branch = currentBranchName;
    if (!branch) {
      setError("当前分支为空，无法设置上游。");
      return;
    }
    void run("设置上游", async () => {
      const s = await invoke<GitRepoState>("git_workflow_set_upstream", {
        repoRoot: state.root,
        branch,
        upstream,
      });
      await applyState(s);
      await refreshDiffStat(s.root);
      await refreshBranchLists(s.root, true);
      appendLog(`已设置上游：${branch} -> ${upstream}`);
    });
  }, [state, upstreamInput, currentBranchName, run, applyState, refreshDiffStat, refreshBranchLists, appendLog]);

  const handleRenameBranch = useCallback(() => {
    if (!state?.root) return;
    const oldBranch = renameOldInput.trim();
    const newBranch = renameNewInput.trim();
    if (!oldBranch || !newBranch) {
      setError("请填写要重命名的分支与新名称。");
      return;
    }
    void run("重命名分支", async () => {
      const s = await invoke<GitRepoState>("git_workflow_rename_branch", {
        repoRoot: state.root,
        oldBranch,
        newBranch,
      });
      await applyState(s);
      await refreshDiffStat(s.root);
      await refreshBranchLists(s.root, true);
      appendLog(`已重命名分支：${oldBranch} -> ${newBranch}`);
      pushRecentBranch(s.branch);
      setRenameNewInput("");
    });
  }, [
    state,
    renameOldInput,
    renameNewInput,
    run,
    applyState,
    refreshDiffStat,
    refreshBranchLists,
    appendLog,
    pushRecentBranch,
  ]);

  const handleRefreshMergedBranches = useCallback(() => {
    if (!state?.root) return;
    void refreshMergedBranches(state.root, mergedBaseInput);
  }, [state?.root, mergedBaseInput, refreshMergedBranches]);

  const handleCleanupMergedBranches = useCallback(() => {
    if (!state?.root || mergedBranches.length === 0) return;
    void (async () => {
      const ok = await confirmPush({
        title: "批量清理已合并分支",
        description: `将删除 ${mergedBranches.length} 个已合并本地分支（保留当前分支与基线分支）。是否继续？`,
        confirmText: "批量删除",
        variant: "destructive",
      });
      if (!ok) return;
      await run("清理分支", async () => {
        for (const b of mergedBranches) {
          await invoke<GitRepoState>("git_workflow_delete_branch", {
            repoRoot: state.root,
            branch: b,
            force: false,
          });
        }
        const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
        await applyState(s);
        await refreshDiffStat(s.root);
        await refreshBranchLists(s.root, true);
        await refreshMergedBranches(s.root, mergedBaseInput);
        appendLog(`已清理已合并本地分支：${mergedBranches.length} 个`);
      });
    })();
  }, [
    state,
    mergedBranches,
    mergedBaseInput,
    confirmPush,
    run,
    applyState,
    refreshDiffStat,
    refreshBranchLists,
    refreshMergedBranches,
    appendLog,
  ]);

  const overviewHint = useMemo(() => (state ? overviewStepHint(state) : null), [state]);
  const commitHint = useMemo(
    () => (state ? commitWorkflowHint(state, commitMessage) : null),
    [state, commitMessage],
  );

  const handleCommitClick = useCallback(() => {
    if (!state?.root) return;
    const msg = commitMessage.trim();
    if (!msg) {
      setError("请填写提交说明");
      return;
    }
    if (state.stagedFiles.length === 0) {
      setError("暂存区为空，无法提交");
      return;
    }
    setError(null);
    setCommitPreviewOpen(true);
  }, [state, commitMessage]);

  const handleCommitPreviewCancel = useCallback(() => {
    setCommitPreviewOpen(false);
  }, []);

  const executeCommitConfirmed = useCallback(() => {
    if (!state?.root) return;
    const msg = commitMessage.trim();
    if (!msg || state.stagedFiles.length === 0) return;
    setCommitPreviewOpen(false);
    void run("提交", async () => {
      await invoke("git_workflow_commit", { repoRoot: state.root, message: msg });
      appendLog(`已提交：${msg}`);
      setCommitMessage("");
      if (afterCommit === "local") {
        appendLog("未执行 push（仅本地提交）");
        const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
        await applyState(s);
        await refreshDiffStat(s.root);
        return;
      }
      const ok = await confirmPush({
        title: "推送确认",
        description: `确认推送到 origin ${state.branch}？`,
        confirmText: "推送",
      });
      if (!ok) {
        appendLog("已取消推送，提交仅存在于本地");
        const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
        await applyState(s);
        await refreshDiffStat(s.root);
        return;
      }
      setBusy("推送");
      try {
        const pushOut = await invoke<string>("git_workflow_push", {
          repoRoot: state.root,
          remote: "origin",
          branch: state.branch,
        });
        if (pushOut) appendLog(pushOut);
        else appendLog("push 完成");
      } finally {
        setBusy(null);
      }
      const s = await invoke<GitRepoState>("git_workflow_refresh", { repoRoot: state.root });
      await applyState(s);
      await refreshDiffStat(s.root);
    });
  }, [state, commitMessage, afterCommit, run, appendLog, applyState, refreshDiffStat, confirmPush]);

  useEffect(() => {
    if (!commitPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCommitPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commitPreviewOpen]);

  if (!inApp) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">应用内 Git 流程</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>当前为纯网页预览（<code className="rounded bg-muted px-1 font-mono text-xs">pnpm dev</code>），无法调用本机 git。</p>
          <p>
            请使用桌面版：<code className="rounded bg-muted px-1 font-mono text-xs">pnpm tauri dev</code>
            或打包后的 DevKit，即可在此页用图形界面完成拉取、暂存、提交与推送（直接调用系统{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">git</code>，分支名与终端一致）。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {ConfirmPushDialog}
      {(pathPersistErr || autoRefreshPersistErr || recentBranchesPersistErr) && (
        <div className="flex flex-wrap gap-2">
          {pathPersistErr && (
            <Badge variant="destructive" className="w-fit">
              {pathPersistErr}
            </Badge>
          )}
          {autoRefreshPersistErr && (
            <Badge variant="destructive" className="w-fit">
              {autoRefreshPersistErr}
            </Badge>
          )}
          {recentBranchesPersistErr && (
            <Badge variant="destructive" className="w-fit">
              {recentBranchesPersistErr}
            </Badge>
          )}
        </div>
      )}
      {error && (
        <Badge variant="destructive" className="w-fit whitespace-pre-wrap font-normal">
          {error}
        </Badge>
      )}

      <Card className="shrink-0 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">仓库路径</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[200px] flex-1 font-mono text-sm"
              placeholder="仓库根目录或仓库内任意路径"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              spellCheck={false}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void handlePickFolder()}>
              <FolderOpen size={14} />
              浏览
            </Button>
            <Button type="button" size="sm" disabled={!pathInput.trim() || busy !== null} onClick={handleOpen}>
              {busy === "打开仓库" ? <Loader2 size={14} className="animate-spin" /> : null}
              打开 / 解析
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              disabled={!state?.root || busy !== null}
              onClick={handleRefresh}
            >
              <RefreshCw size={14} className={cn(busy === "刷新" && "animate-spin")} />
              刷新
            </Button>
          </div>
              {!state?.root && pathInput.trim() && (
                <p className="text-xs text-muted-foreground">
                  已记住路径，点击「打开 / 解析」后再加载 Git 状态（可减少页面切换卡顿）。
                </p>
              )}
          {state && (
            <p className="text-xs text-muted-foreground">
              根目录 <span className="font-mono">{state.root}</span> · 分支{" "}
              <span className="font-mono text-foreground">{state.branch}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {state && (
        <>
          {overviewHint && (
            <div
              className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
              role="status"
            >
              <span className="font-medium text-muted-foreground">工作区概览 · </span>
              {overviewHint}
            </div>
          )}

          {showPushSections && hasUnpushedWork(state) && (
            <Card className="border-primary/40 bg-primary/5 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">
                  尚未推送的提交
                  {state.commitsAhead != null && state.commitsAhead > 0 ? (
                    <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                      （约 {state.commitsAhead} 条）
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  这些 commit 已在本地仓库中，不在「已暂存」列表里。要送到远程请点「仅推送到 origin」，或先拉取/处理冲突后再推送。
                </p>
                <pre className="max-h-56 overflow-auto rounded-md bg-background/80 p-2 font-mono text-xs whitespace-pre-wrap ring-1 ring-border">
                  {state.unpushedLog.trim() || "（Git 无法列出范围，但估计仍有未推送提交，可直接尝试推送）"}
                </pre>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={handlePushOnly}
                >
                  {busy === "推送" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  仅推送到 origin（不新建提交）
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">分支与远程同步</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{syncSummaryText(state)}</p>
              <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 font-mono text-xs whitespace-pre-wrap">
                {state.statusSb || "（空）"}
              </pre>
              <p className="text-xs text-muted-foreground">
                短状态一行通常含 <code className="rounded bg-muted px-1">[ahead N]</code> 表示有 N 次本地提交未推送；完整说明见下一块。
              </p>
              <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Label htmlFor="git-auto-refresh" className="shrink-0 text-xs text-muted-foreground">
                  自动同步状态
                </Label>
                <select
                  id="git-auto-refresh"
                  className="border-input bg-background h-9 max-w-full rounded-md border px-2 text-sm sm:min-w-[240px]"
                  value={autoRefreshRaw}
                  onChange={(e) => setAutoRefreshRaw(e.target.value)}
                >
                  <option value="off">关闭（仅手动「刷新」）</option>
                  <option value="focus">切回窗口时</option>
                  <option value="interval-8">切回窗口 + 每 8 秒</option>
                  <option value="interval-15">切回窗口 + 每 15 秒</option>
                  <option value="interval-30">切回窗口 + 每 30 秒</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">{autoRefreshDescription(autoRefreshMode)}</p>
            </CardContent>
          </Card>

          {showBranchSections && (
            <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">分支</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">切换分支</p>
                  <Input
                    placeholder="输入分支名，实时模糊筛选；点击下方结果即可选中"
                    value={switchBranchInput}
                    onChange={(e) => {
                      setSwitchBranchInput(e.target.value);
                      setBranchPickerScrollTop(0);
                      setBranchPickerOpen(true);
                    }}
                    onFocus={() => setBranchPickerOpen(true)}
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    匹配结果：{filteredSwitchBranchCandidates.length} / {switchBranchCandidates.length}（虚拟滚动渲染）
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {branchQuickCandidates.length === 0 ? (
                      <span className="text-xs text-muted-foreground">暂无最近分支</span>
                    ) : (
                      branchQuickCandidates.map((b) => (
                        <Button
                          key={`quick:${b}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 font-mono text-xs"
                        onClick={() => {
                          setSwitchBranchInput(b);
                          setBranchPickerOpen(true);
                          setBranchPickerScrollTop(0);
                        }}
                          disabled={busy !== null}
                        >
                          {b}
                        </Button>
                      ))
                    )}
                  </div>
                  <div className="relative" ref={branchPickerRef}>
                    {branchPickerOpen && (
                      <div className="bg-popover text-popover-foreground absolute z-20 w-full rounded-md border shadow-md">
                        <div
                          className="max-h-64 overflow-y-auto"
                          style={{ height: BRANCH_VIEWPORT_HEIGHT }}
                          onScroll={(e) => setBranchPickerScrollTop(e.currentTarget.scrollTop)}
                        >
                          {filteredSwitchBranchCandidates.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">无匹配分支</div>
                          ) : (
                            <div className="relative" style={{ height: branchVirtualRange.totalHeight }}>
                              {virtualSwitchRows.map((row, idx) => {
                                const absoluteIndex = branchVirtualRange.start + idx;
                                return (
                                  <button
                                    key={`${row.source}:${row.name}`}
                                    type="button"
                                    className={cn(
                                      "hover:bg-accent absolute left-0 right-0 flex h-8 items-center justify-between px-3 text-left text-sm",
                                      switchBranchInput === row.name && "bg-accent",
                                    )}
                                    style={{ top: absoluteIndex * BRANCH_ROW_HEIGHT }}
                                    onClick={() => {
                                      setSwitchBranchInput(row.name);
                                      setBranchPickerOpen(false);
                                    }}
                                  >
                                    <span className="truncate font-mono">{row.name}</span>
                                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                      {row.source === "local" ? "本地" : "远程"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    当前分支：<span className="font-mono text-foreground">{branchLists?.currentBranch || state.branch}</span>
                    {hasDirtyWorktree ? "（当前有未提交改动）" : ""}
                  </p>
                  {switchCaseConflict.length > 0 && (
                    <p className="text-xs text-destructive">
                      与以下分支仅大小写不同：{switchCaseConflict.join("、")}。请从候选中选择精确分支名。
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    disabled={busy !== null || !switchTarget || switchCaseConflict.length > 0}
                    onClick={handleSwitchBranch}
                  >
                    {busy === "切换分支" ? <Loader2 size={14} className="animate-spin" /> : null}
                    切换
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">新建分支</p>
                  <Input
                    placeholder="如 feature/login"
                    value={newBranchInput}
                    onChange={(e) => setNewBranchInput(e.target.value)}
                    spellCheck={false}
                  />
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm font-mono"
                    value={createFromInput}
                    onChange={(e) => setCreateFromInput(e.target.value)}
                  >
                    <option value="">默认当前分支</option>
                    {createFromCandidates.map((b) => (
                      <option key={`from:${b}`} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">将执行“新建并切换”；默认从当前分支创建，也可改选其他基线。</p>
                  {newBranchCaseConflict.length > 0 && (
                    <p className="text-xs text-destructive">
                      与以下分支仅大小写不同：{newBranchCaseConflict.join("、")}。请更换分支名。
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    disabled={busy !== null || !newBranchInput.trim() || newBranchCaseConflict.length > 0}
                    onClick={handleCreateBranch}
                  >
                    {busy === "新建分支" ? <Loader2 size={14} className="animate-spin" /> : null}
                    新建并切换
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">上游跟踪</p>
                  <p className="text-xs text-muted-foreground">
                    当前分支：<span className="font-mono text-foreground">{currentBranchName || "（无）"}</span>
                  </p>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm font-mono"
                    value={upstreamInput}
                    onChange={(e) => setUpstreamInput(e.target.value)}
                  >
                    <option value="">请选择远程分支</option>
                    {branchLists?.remoteBranches.map((b) => (
                      <option key={`up:${b}`} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <Button type="button" size="sm" className="gap-1" disabled={busy !== null || !upstreamInput.trim()} onClick={handleSetUpstream}>
                    {busy === "设置上游" ? <Loader2 size={14} className="animate-spin" /> : null}
                    设置当前分支上游
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">删除本地分支</p>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm font-mono"
                    value={deleteBranchInput}
                    onChange={(e) => setDeleteBranchInput(e.target.value)}
                  >
                    <option value="">请选择本地分支</option>
                    {deletableBranches.map((b) => (
                      <option key={`del:${b}`} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={deleteForce}
                      onChange={(e) => setDeleteForce(e.target.checked)}
                      className="accent-primary"
                    />
                    强制删除（未合并也删除）
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    disabled={busy !== null || !deleteBranchInput.trim()}
                    onClick={handleDeleteBranch}
                  >
                    {busy === "删除分支" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    删除本地分支
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">重命名本地分支</p>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm font-mono"
                    value={renameOldInput}
                    onChange={(e) => setRenameOldInput(e.target.value)}
                  >
                    <option value="">请选择旧分支</option>
                    {(branchLists?.localBranches ?? []).map((b) => (
                      <option key={`local:${b}`} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="输入新分支名"
                    value={renameNewInput}
                    onChange={(e) => setRenameNewInput(e.target.value)}
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    disabled={busy !== null || !renameOldInput.trim() || !renameNewInput.trim()}
                    onClick={handleRenameBranch}
                  >
                    {busy === "重命名分支" ? <Loader2 size={14} className="animate-spin" /> : null}
                    重命名分支
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <p className="text-sm font-medium">清理已合并本地分支</p>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm font-mono"
                    value={mergedBaseInput}
                    onChange={(e) => setMergedBaseInput(e.target.value)}
                  >
                    <option value="">默认当前分支</option>
                    {createFromCandidates.map((b) => (
                      <option key={`base:${b}`} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">候选可清理分支：{mergedBranches.length} 个</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={handleRefreshMergedBranches}>
                      刷新候选
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy !== null || mergedBranches.length === 0}
                      onClick={handleCleanupMergedBranches}
                    >
                      批量删除已合并分支
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                支持跨平台系统 Git；切换时可直接输入完整远程分支名（如 upstream/main），短分支名若在多个远程同名会提示你显式选择。
              </p>
            </CardContent>
            </Card>
          )}

          <details className="group rounded-lg border border-border bg-card">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="text-foreground">完整状态（git status）</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
                点击展开 · 与上一块摘要可能重复，排错时再细看
              </span>
              <span className="ml-2 hidden text-xs font-normal text-muted-foreground group-open:inline">
                点击收起
              </span>
            </summary>
            <div className="border-t border-border px-4 pb-3">
              <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-xs whitespace-pre-wrap">
                {state.statusFull || "（空）"}
              </pre>
            </div>
          </details>

          {showPushSections && (
            <Card className="overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-2">
              <CardTitle className="text-base">操作</CardTitle>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex rounded p-0.5"
                  aria-label="流程说明"
                >
                  <CircleHelp size={16} />
                </TooltipTrigger>
                <TooltipContent side="bottom" className={FLOW_TOOLTIP_CLASS}>
                  <FlowTooltipSteps />
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={handlePull}>
                {busy === "拉取" ? <Loader2 size={14} className="animate-spin" /> : null}
                拉取（rebase + autostash）
              </Button>
              {(state.commitsBehind ?? 0) > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="text-amber-600 dark:text-amber-500 inline-flex rounded p-0.5"
                    aria-label="落后远程说明"
                  >
                    <CircleHelp size={16} />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className={FLOW_TOOLTIP_CLASS}>
                    当前落后远程约 {state.commitsBehind} 个提交：推送前一般应先「拉取」，否则可能被拒绝或需解决冲突。
                  </TooltipContent>
                </Tooltip>
              )}
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" disabled={busy !== null} onClick={handleAddAll}>
                  {busy === "暂存" ? <Loader2 size={14} className="animate-spin" /> : null}
                  暂存全部（git add -A）
                </Button>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex rounded p-0.5"
                    aria-label="暂存全部说明"
                  >
                    <CircleHelp size={15} />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className={FLOW_TOOLTIP_CLASS}>
                    <p>
                      与脚本一致：先等价于 <code className="rounded bg-muted/80 px-1">git add -A</code>
                      ，再在「已暂存」里用勾选 +「移出所选」或单文件按钮，把不想进本次 commit 的路径剔出暂存区，最后再提交。
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
            </Card>
          )}

          {showPushSections && (
            <div className="grid gap-3 md:grid-cols-2">
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="shrink-0 space-y-2 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">已暂存 · {state.stagedFiles.length}</CardTitle>
                  <div className="min-h-[1.75rem]">
                    <Badge
                      variant="secondary"
                      className={cn("w-fit transition-opacity", pendingUnstageCount > 0 ? "opacity-100" : "opacity-0")}
                      aria-hidden={pendingUnstageCount <= 0}
                    >
                      正在移出… {pendingUnstageCount}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs font-normal text-muted-foreground">
                  勾选后点「移出所选」可从<strong>本次提交清单</strong>剔除（仍保留在工作区，只是不进下一次 commit）。
                </p>
                {state.stagedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        const next: Record<string, boolean> = {};
                        for (const f of state.stagedFiles) next[f] = true;
                        setStagedPick(next);
                      }}
                    >
                      全选
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => setStagedPick({})}>
                      清空勾选
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy !== null || pickedForUnstage.length === 0}
                      onClick={handleUnstageSelected}
                    >
                      移出所选（{pickedForUnstage.length}）
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="max-h-72 overflow-y-auto">
                {state.stagedFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {state.stagedFiles.slice(0, FILE_LIST_RENDER_CAP).map((p) => (
                      <StagedFileItem
                        key={p}
                        path={p}
                        checked={Boolean(stagedPick[p])}
                        disabled={busy !== null}
                        pending={Boolean(pendingUnstageMap[p])}
                        onToggle={() => setStagedPick((prev) => ({ ...prev, [p]: !prev[p] }))}
                        onUnstage={() => handleUnstage(p)}
                      />
                    ))}
                    {state.stagedFiles.length > FILE_LIST_RENDER_CAP && (
                      <li className="px-2 py-1.5 text-xs text-muted-foreground">
                        …还有 {state.stagedFiles.length - FILE_LIST_RENDER_CAP} 个文件未显示（操作不受影响）
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="shrink-0 space-y-2 pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base">可加入暂存 · {state.addableFiles.length}</CardTitle>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1"
                      disabled={busy !== null || state.addableFiles.length === 0}
                      onClick={handleStageAllAddable}
                    >
                      {busy === "加入暂存" ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />}
                      全部加入（{state.addableFiles.length}）
                    </Button>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        className="text-muted-foreground hover:text-foreground inline-flex rounded p-0.5"
                        aria-label="全部加入说明"
                      >
                        <CircleHelp size={15} />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className={FLOW_TOOLTIP_CLASS}>
                        <p>
                          对本列表中的路径一次性执行 <code className="rounded bg-muted/80 px-1">git add</code>
                          ，比逐个点 + 少一次往返；加入后可在左侧「已暂存」里勾选并移出不需要的文件。与「暂存全部」不同：此处只加入当前列表中的未暂存/未跟踪文件。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="min-h-[1.75rem]">
                  <Badge
                    variant="secondary"
                    className={cn("w-fit transition-opacity", pendingStageCount > 0 ? "opacity-100" : "opacity-0")}
                    aria-hidden={pendingStageCount <= 0}
                  >
                    正在加入… {pendingStageCount}
                  </Badge>
                </div>
                <p className="text-xs font-normal text-muted-foreground">
                  点 + 或「全部加入」后仅快速同步文件列表；分支领先/落后、未推送列表等需点「刷新」或等待自动同步更新。
                </p>
              </CardHeader>
              <CardContent className="max-h-72 overflow-y-auto">
                {state.addableFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {state.addableFiles.slice(0, FILE_LIST_RENDER_CAP).map((p) => (
                      <AddableFileItem
                        key={p}
                        path={p}
                        disabled={busy !== null}
                        pending={Boolean(pendingStageMap[p])}
                        onStage={() => handleStagePath(p)}
                      />
                    ))}
                    {state.addableFiles.length > FILE_LIST_RENDER_CAP && (
                      <li className="px-2 py-1.5 text-xs text-muted-foreground">
                        …还有 {state.addableFiles.length - FILE_LIST_RENDER_CAP} 个文件未显示（操作不受影响）
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
            </div>
          )}

          {showPushSections && (
            <Card className="shrink-0 overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">暂存区 diff 统计</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!state.root || busy !== null}
                onClick={() => void refreshDiffStat(state.root)}
              >
                刷新统计
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-36 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-xs whitespace-pre-wrap">
                {diffStat || "点击「刷新统计」"}
              </pre>
            </CardContent>
            </Card>
          )}

          {showPushSections && (
            <Card className="shrink-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">提交</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commitHint && (
                <div
                  className="rounded-md border border-primary/35 bg-primary/5 px-3 py-2 text-sm"
                  role="status"
                >
                  <span className="font-medium text-primary">提交与推送 · </span>
                  <span className="text-foreground">{commitHint}</span>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="git-commit-msg">提交说明</Label>
                <textarea
                  id="git-commit-msg"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="如 feat(scope): subject"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || (!e.ctrlKey && !e.metaKey)) return;
                    e.preventDefault();
                    if (state.stagedFiles.length === 0 || busy !== null || commitPreviewOpen) return;
                    handleCommitClick();
                  }}
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  有暂存内容时可用 Ctrl+Enter（Mac：⌘+Enter）打开<strong>提交前确认</strong>（文件清单）。
                </p>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">提交完成后</legend>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="after-commit"
                    checked={afterCommit === "push"}
                    onChange={() => setAfterCommit("push")}
                    className="accent-primary"
                  />
                  推送到 origin（提交后需再确认一次）
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="after-commit"
                    checked={afterCommit === "local"}
                    onChange={() => setAfterCommit("local")}
                    className="accent-primary"
                  />
                  仅本地提交，不推送
                </label>
              </fieldset>
              {state.stagedFiles.length === 0 && (
                <p className="rounded-md bg-muted/80 p-2 text-sm text-muted-foreground">
                  当前<strong className="text-foreground">暂存区为空</strong>，无法点击「提交」——「提交」只会把<strong>已暂存</strong>的改动打成新 commit。
                  {hasUnpushedWork(state)
                    ? " 你已有本地 commit 未推送时，请用上方「尚未推送的提交」里的「仅推送到 origin」。"
                    : " 若有未跟踪/未暂存的改动，请先用「暂存全部」或单文件「加入」。"}
                </p>
              )}
              {commitPreviewOpen && state.stagedFiles.length > 0 && (
                <div
                  className="space-y-3 rounded-lg border border-primary/45 bg-primary/5 p-3 ring-1 ring-primary/15"
                  role="dialog"
                  aria-labelledby="commit-preview-title"
                >
                  <p id="commit-preview-title" className="text-sm font-medium text-foreground">
                    确认本次提交
                  </p>
                  <p className="text-xs text-muted-foreground">
                    将使用下列说明创建 <strong className="text-foreground">一条</strong> commit，且<strong className="text-foreground">仅</strong>包含列表中的文件。可按 Esc
                    或「返回修改」关闭。
                  </p>
                  <div className="rounded-md bg-muted/80 px-2 py-1.5 font-mono text-xs whitespace-pre-wrap">
                    {commitMessage.trim()}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">将纳入本次 commit 的文件（{state.stagedFiles.length}）</p>
                    <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-background/80 p-2 font-mono text-xs">
                      {state.stagedFiles.map((f) => (
                        <li key={f} className="break-all py-0.5">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    提交完成后：
                    {afterCommit === "push"
                      ? " 将再弹窗询问是否推送到 origin。"
                      : " 不推送，仅保留在本地。"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={busy !== null} onClick={executeCommitConfirmed} className="gap-1">
                      {busy === "提交" || busy === "推送" ? <Loader2 size={14} className="animate-spin" /> : null}
                      确认提交
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={handleCommitPreviewCancel}
                    >
                      返回修改
                    </Button>
                  </div>
                </div>
              )}
              <Button
                type="button"
                disabled={state.stagedFiles.length === 0 || busy !== null || commitPreviewOpen}
                onClick={handleCommitClick}
                className="gap-1"
              >
                {busy === "提交" || busy === "推送" ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy === "推送" ? "推送中…" : commitPreviewOpen ? "请先确认或取消上方清单" : "提交（先确认文件清单）"}
              </Button>
            </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">操作记录</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                {logLines.length === 0 ? "（空）" : logLines.join("\n")}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

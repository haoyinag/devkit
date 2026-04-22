/** `git_workflow_refresh_lists` 返回值：合并进现有 `GitRepoState` 的局部字段 */
export interface GitWorktreeLists {
  statusSb: string;
  stagedFiles: string[];
  addableFiles: string[];
}

/** `git_workflow_list_branches` 返回值 */
export interface GitBranchLists {
  localBranches: string[];
  remoteBranches: string[];
  remotes: string[];
  currentBranch: string;
}

/** 与 Tauri `git_workflow` 返回的 `GitRepoState`（camelCase）一致 */
export interface GitRepoState {
  root: string;
  branch: string;
  statusSb: string;
  /** `git status` 全文 */
  statusFull: string;
  upstreamRef: string | null;
  commitsAhead: number | null;
  commitsBehind: number | null;
  /** 未推送提交 oneline 列表 */
  unpushedLog: string;
  stagedFiles: string[];
  addableFiles: string[];
}

//! 应用内 Git 工作流：直接调用本机 `git`，行为与 `scripts/git-push.mjs` 对齐（含分支名由 Git 解析，避免 GUI 工具链的大小写等问题）。

use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoState {
    pub root: String,
    pub branch: String,
    /// `git status -sb`（一行摘要，含 `[ahead N]` 等）
    pub status_sb: String,
    /// `git status` 完整输出，便于查看已提交未推送等工作区说明
    pub status_full: String,
    /// 上游引用，如 `origin/main`；未设置上游时为 `None`
    pub upstream_ref: Option<String>,
    /// 相对上游多出的本地提交数（已 commit 未 push）
    pub commits_ahead: Option<u32>,
    /// 相对上游落后的提交数
    pub commits_behind: Option<u32>,
    /// 尚未出现在远程对比范围内的提交列表（`git log … --oneline`），便于与「提交」区分
    pub unpushed_log: String,
    pub staged_files: Vec<String>,
    pub addable_files: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchLists {
    pub local_branches: Vec<String>,
    pub remote_branches: Vec<String>,
    pub remotes: Vec<String>,
    pub current_branch: String,
}

fn lines_nonempty(s: &str) -> Vec<String> {
    s.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(String::from)
        .collect()
}

fn git_output(repo: &str, args: &[&str]) -> Result<String, String> {
    let out = git_command(repo, args)
        .output()
        .map_err(|e| format!("无法执行 git：{e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if !out.status.success() {
        let msg = stderr.trim();
        if msg.is_empty() {
            return Err(format!("git 失败（退出码 {:?}）", out.status.code()));
        }
        return Err(msg.to_string());
    }
    Ok(stdout.trim_end().to_string())
}

fn git_output_allow_empty(repo: &str, args: &[&str]) -> String {
    git_command(repo, args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim_end().to_string())
        .unwrap_or_default()
}

fn git_command(repo: &str, args: &[&str]) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(repo).args(args);
    // Windows：从 GUI 程序拉起 console 程序（git.exe）可能会弹出 cmd 窗口
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn parse_u32_trim(s: &str) -> Option<u32> {
    s.trim().parse().ok()
}

fn list_remotes(root: &str) -> Vec<String> {
    let out = git_output_allow_empty(root, &["remote"]);
    let mut rows = lines_nonempty(&out);
    rows.sort();
    rows.dedup();
    rows
}

fn list_local_branches(root: &str) -> Vec<String> {
    let out = git_output_allow_empty(root, &["for-each-ref", "refs/heads", "--format=%(refname:short)"]);
    let mut rows = lines_nonempty(&out);
    rows.sort();
    rows
}

fn list_remote_branches(root: &str) -> Vec<String> {
    let out = git_output_allow_empty(root, &["for-each-ref", "refs/remotes", "--format=%(refname:short)"]);
    let mut rows: Vec<String> = lines_nonempty(&out)
        .into_iter()
        .filter(|r| !r.ends_with("/HEAD"))
        .collect();
    rows.sort();
    rows
}

fn remote_short_branches(remote_branches: &[String]) -> Vec<String> {
    remote_branches
        .iter()
        .filter_map(|r| {
            let mut it = r.splitn(2, '/');
            let _remote = it.next()?;
            let short = it.next()?;
            if short.is_empty() { None } else { Some(short.to_string()) }
        })
        .collect()
}

fn resolve_remote_target(target: &str, remote_branches: &[String]) -> Result<Option<String>, String> {
    if target.is_empty() {
        return Ok(None);
    }
    if target.contains('/') {
        if remote_branches.iter().any(|r| r == target) {
            return Ok(Some(target.to_string()));
        }
        return Ok(None);
    }
    let matches: Vec<String> = remote_branches
        .iter()
        .filter_map(|r| {
            let mut it = r.splitn(2, '/');
            let remote = it.next()?;
            let short = it.next()?;
            if short == target {
                Some(format!("{remote}/{short}"))
            } else {
                None
            }
        })
        .collect();
    if matches.is_empty() {
        return Ok(None);
    }
    if matches.len() == 1 {
        return Ok(matches.first().cloned());
    }
    Err(format!(
        "在多个远程中都找到了分支「{target}」：{}。请改为输入完整远程分支名（如 origin/{target}）。",
        matches.join("、")
    ))
}

fn validate_branch_name(root: &str, branch: &str) -> Result<(), String> {
    let b = branch.trim();
    if b.is_empty() {
        return Err("分支名不能为空。".into());
    }
    let out = git_command(root, &["check-ref-format", "--branch", b])
        .output()
        .map_err(|e| format!("无法执行 git：{e}"))?;
    if out.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if stderr.is_empty() {
        return Err(format!("分支名「{b}」不合法。"));
    }
    Err(format!("分支名「{b}」不合法：{stderr}"))
}

fn case_conflict_names(target: &str, candidates: &[String]) -> Vec<String> {
    let target_fold = target.to_lowercase();
    candidates
        .iter()
        .filter(|c| c.as_str() != target && c.to_lowercase() == target_fold)
        .cloned()
        .collect()
}

fn branch_case_conflict_message(conflicts: &[String]) -> String {
    format!(
        "检测到与目标分支仅大小写不同的现有分支：{}。为避免误切换，请从列表中选择已有分支，或改用其他新分支名。",
        conflicts.join("、")
    )
}

fn normalize_switch_error(raw: String) -> String {
    let msg = raw.trim();
    if msg.contains("Please commit your changes or stash them before you switch branches")
        || msg.contains("would be overwritten by checkout")
        || msg.contains("would be overwritten by merge")
    {
        return "工作区中存在会被覆盖的改动，无法切换分支。请先提交、暂存（stash）或回退改动后再试。".into();
    }
    raw
}

fn stash_has_changes(output: &str) -> bool {
    let s = output.trim();
    !s.is_empty() && !s.contains("No local changes to save")
}

fn try_restore_stash(root: &str) {
    let _ = git_command(root, &["stash", "pop"]).output();
}

/// 校验 `repo_root` 并返回真实仓库根目录（统一用于各命令入口）。
fn ensure_repo_root(repo_root: &str) -> Result<String, String> {
    let root = repo_root.trim();
    if root.is_empty() || !Path::new(root).is_dir() {
        return Err("仓库根路径无效。".into());
    }
    let resolved = git_output(root, &["rev-parse", "--show-toplevel"])?;
    if resolved.is_empty() {
        return Err("无法解析 Git 仓库根目录。".into());
    }
    Ok(resolved)
}

fn has_upstream(root: &str) -> bool {
    let out = git_command(
        root,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{u}",
        ],
    )
    .output();
    matches!(out, Ok(o) if o.status.success())
}

/// 解析当前分支的上游及 ahead/behind（与 `git status` 中「您的分支领先/落后」一致）
fn upstream_sync(root: &str) -> (Option<String>, Option<u32>, Option<u32>) {
    let out = git_command(
        root,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{u}",
        ],
    )
    .output();
    let Ok(out) = out else {
        return (None, None, None);
    };
    if !out.status.success() {
        return (None, None, None);
    }
    let upstream = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if upstream.is_empty() {
        return (None, None, None);
    }
    let ahead = git_output(root, &["rev-list", "--count", "@{u}..HEAD"])
        .ok()
        .and_then(|s| parse_u32_trim(&s));
    let behind = git_output(root, &["rev-list", "--count", "HEAD..@{u}"])
        .ok()
        .and_then(|s| parse_u32_trim(&s));
    (Some(upstream), ahead, behind)
}

/// 无 `@{u}` 时，用 `@{push}` 或 `refs/remotes/origin/<branch>` 估算领先远程的提交数
fn commits_ahead_without_upstream(root: &str, branch: &str) -> Option<u32> {
    if let Ok(push) = git_output(root, &["rev-parse", "--abbrev-ref", "@{push}"]) {
        if !push.is_empty() {
            return git_output(root, &["rev-list", "--count", "@{push}..HEAD"])
                .ok()
                .and_then(|s| parse_u32_trim(&s));
        }
    }
    let rb = format!("refs/remotes/origin/{branch}");
    let o = git_command(root, &["rev-parse", "--verify", &rb])
        .output()
        .ok()?;
    if !o.status.success() {
        return None;
    }
    let range = format!("origin/{branch}..HEAD");
    git_output(root, &["rev-list", "--count", &range])
        .ok()
        .and_then(|s| parse_u32_trim(&s))
}

/// 与 [`commits_ahead_without_upstream`] / `@{u}` 使用同一套范围，生成可读的 log
fn unpushed_log_lines(root: &str, branch: &str, upstream_ref: &Option<String>) -> String {
    if upstream_ref.is_some() {
        return git_output(root, &["log", "@{u}..HEAD", "--oneline", "-n", "50"]).unwrap_or_default();
    }
    if let Ok(push) = git_output(root, &["rev-parse", "--abbrev-ref", "@{push}"]) {
        if !push.is_empty() {
            return git_output(root, &["log", "@{push}..HEAD", "--oneline", "-n", "50"]).unwrap_or_default();
        }
    }
    let rb = format!("refs/remotes/origin/{branch}");
    let Ok(verify) = git_command(root, &["rev-parse", "--verify", &rb]).output()
    else {
        return String::new();
    };
    if !verify.status.success() {
        return String::new();
    }
    let range = format!("origin/{branch}..HEAD");
    git_output(root, &["log", &range, "--oneline", "-n", "50"]).unwrap_or_default()
}

fn refresh_state(root: &str) -> Result<GitRepoState, String> {
    let branch = git_output(root, &["branch", "--show-current"])?;
    if branch.is_empty() {
        return Err("当前为分离 HEAD 或无法解析分支名，请检出到具体分支后再操作。".into());
    }
    let status_sb = git_output(root, &["status", "-sb"])?;
    let status_full = git_output(root, &["status"]).unwrap_or_else(|e| format!("（无法获取 git status：{e}）"));
    let (upstream_ref, mut commits_ahead, commits_behind) = upstream_sync(root);
    if upstream_ref.is_none() {
        commits_ahead = commits_ahead_without_upstream(root, &branch).or(commits_ahead);
    }
    let unpushed_log = unpushed_log_lines(root, &branch, &upstream_ref);
    let staged_raw = git_output_allow_empty(root, &["diff", "--cached", "--name-only"]);
    let staged_files = lines_nonempty(&staged_raw);
    let mod_raw = git_output_allow_empty(root, &["diff", "--name-only"]);
    let untracked_raw = git_output_allow_empty(root, &["ls-files", "--others", "--exclude-standard"]);
    let mut addable_files: Vec<String> = lines_nonempty(&mod_raw);
    addable_files.extend(lines_nonempty(&untracked_raw));
    addable_files.sort();
    addable_files.dedup();

    Ok(GitRepoState {
        root: root.to_string(),
        branch,
        status_sb,
        status_full,
        upstream_ref,
        commits_ahead,
        commits_behind,
        unpushed_log,
        staged_files,
        addable_files,
    })
}

/// 仅刷新「短状态 + 暂存/可加入」列表（`git add` / `restore --staged` 后使用，避免重复跑 log、upstream 等）
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeLists {
    pub status_sb: String,
    pub staged_files: Vec<String>,
    pub addable_files: Vec<String>,
}

fn refresh_lists(root: &str) -> Result<GitWorktreeLists, String> {
    let status_sb = git_output(root, &["status", "-sb"])?;
    let staged_raw = git_output_allow_empty(root, &["diff", "--cached", "--name-only"]);
    let staged_files = lines_nonempty(&staged_raw);
    let mod_raw = git_output_allow_empty(root, &["diff", "--name-only"]);
    let untracked_raw = git_output_allow_empty(root, &["ls-files", "--others", "--exclude-standard"]);
    let mut addable_files: Vec<String> = lines_nonempty(&mod_raw);
    addable_files.extend(lines_nonempty(&untracked_raw));
    addable_files.sort();
    addable_files.dedup();
    Ok(GitWorktreeLists {
        status_sb,
        staged_files,
        addable_files,
    })
}

#[tauri::command]
pub fn git_workflow_refresh_lists(repo_root: String) -> Result<GitWorktreeLists, String> {
    let root = ensure_repo_root(&repo_root)?;
    refresh_lists(&root)
}

/// `path` 可为仓库根、子目录或仓库内文件路径。
#[tauri::command]
pub fn git_workflow_resolve(path: String) -> Result<GitRepoState, String> {
    let path_trim = path.trim().to_string();
    let p = Path::new(&path_trim);
    if !p.exists() {
        return Err("路径不存在。".into());
    }
    let work = if p.is_dir() {
        path_trim.clone()
    } else {
        p.parent()
            .map(|x| x.to_string_lossy().into_owned())
            .ok_or_else(|| "无法解析所在目录。".to_string())?
    };
    let root = git_output(&work, &["rev-parse", "--show-toplevel"])?;
    refresh_state(&root)
}

#[tauri::command]
pub fn git_workflow_refresh(repo_root: String) -> Result<GitRepoState, String> {
    let root = ensure_repo_root(&repo_root)?;
    refresh_state(&root)
}

#[tauri::command]
pub fn git_workflow_list_branches(repo_root: String) -> Result<GitBranchLists, String> {
    let root = ensure_repo_root(&repo_root)?;
    let current_branch = git_output_allow_empty(&root, &["branch", "--show-current"]);
    Ok(GitBranchLists {
        local_branches: list_local_branches(&root),
        remote_branches: list_remote_branches(&root),
        remotes: list_remotes(&root),
        current_branch,
    })
}

#[tauri::command]
pub fn git_workflow_switch_branch(
    repo_root: String,
    branch: String,
    allow_create_from_remote: bool,
    auto_stash_before_switch: bool,
) -> Result<GitRepoState, String> {
    let root = ensure_repo_root(&repo_root)?;
    let target = branch.trim().trim_start_matches("refs/remotes/").to_string();
    validate_branch_name(&root, &target)?;

    let local = list_local_branches(&root);
    let remote = list_remote_branches(&root);
    let mut case_pool = local.clone();
    case_pool.extend(remote_short_branches(&remote));
    let conflicts = case_conflict_names(&target, &case_pool);
    if !conflicts.is_empty() {
        return Err(branch_case_conflict_message(&conflicts));
    }

    let mut stash_created = false;
    if auto_stash_before_switch {
        let msg = format!("devkit:auto-stash before switch to {target}");
        let out = git_output_allow_empty(&root, &["stash", "push", "-u", "-m", &msg]);
        stash_created = stash_has_changes(&out);
    }

    let switch_result: Result<(), String> = if local.iter().any(|b| b == &target) {
        git_output(&root, &["switch", &target])
            .map(|_| ())
            .map_err(normalize_switch_error)
    } else if allow_create_from_remote {
        let remote_ref = resolve_remote_target(&target, &remote)?;
        if let Some(r) = remote_ref {
            git_output(&root, &["switch", "--track", &r])
                .map(|_| ())
                .map_err(normalize_switch_error)
        } else {
            Err(format!(
                "未找到分支「{target}」。可先在“新建分支”中创建，或确认远程是否存在同名分支。"
            ))
        }
    } else {
        Err(format!(
            "未找到分支「{target}」。可先在“新建分支”中创建，或确认远程是否存在同名分支。"
        ))
    };

    if let Err(e) = switch_result {
        if stash_created {
            try_restore_stash(&root);
        }
        return Err(e);
    }

    if stash_created {
        // 尝试把变更带到目标分支；若冲突/失败则保留在 stash 中，用户可稍后手动处理。
        let _ = git_command(&root, &["stash", "pop"]).output();
    }
    return refresh_state(&root);
}

#[tauri::command]
pub fn git_workflow_create_branch(
    repo_root: String,
    branch: String,
    checkout: bool,
    start_point: Option<String>,
) -> Result<GitRepoState, String> {
    let root = ensure_repo_root(&repo_root)?;
    let target = branch.trim().to_string();
    validate_branch_name(&root, &target)?;

    let local = list_local_branches(&root);
    if local.iter().any(|b| b == &target) {
        return Err(format!("本地已存在分支「{target}」，请直接切换。"));
    }
    let remote = list_remote_branches(&root);
    let mut case_pool = local;
    case_pool.extend(remote_short_branches(&remote));
    let conflicts = case_conflict_names(&target, &case_pool);
    if !conflicts.is_empty() {
        return Err(branch_case_conflict_message(&conflicts));
    }

    let start = start_point.unwrap_or_default().trim().to_string();
    if !start.is_empty() {
        let rev = format!("{start}^{{commit}}");
        let ok = git_command(&root, &["rev-parse", "--verify", "--quiet", &rev])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !ok {
            return Err(format!("基线分支/提交「{start}」不存在，请从候选列表选择或确认输入。"));
        }
    }

    if checkout {
        if start.is_empty() {
            git_output(&root, &["switch", "-c", &target]).map_err(normalize_switch_error)?;
        } else {
            git_output(&root, &["switch", "-c", &target, &start]).map_err(normalize_switch_error)?;
        }
    } else {
        if start.is_empty() {
            git_output(&root, &["branch", &target])?;
        } else {
            git_output(&root, &["branch", &target, &start])?;
        }
    }
    refresh_state(&root)
}

#[tauri::command]
pub fn git_workflow_delete_branch(
    repo_root: String,
    branch: String,
    force: bool,
) -> Result<GitRepoState, String> {
    let root = ensure_repo_root(&repo_root)?;
    let target = branch.trim().to_string();
    validate_branch_name(&root, &target)?;
    let current = git_output(&root, &["branch", "--show-current"])?;
    if current == target {
        return Err("不能删除当前分支，请先切换到其他分支。".into());
    }
    let local = list_local_branches(&root);
    if !local.iter().any(|b| b == &target) {
        return Err(format!("本地不存在分支「{target}」。"));
    }
    let delete_flag = if force { "-D" } else { "-d" };
    git_output(&root, &["branch", delete_flag, &target]).map_err(normalize_switch_error)?;
    refresh_state(&root)
}

#[tauri::command]
pub fn git_workflow_set_upstream(
    repo_root: String,
    branch: String,
    upstream: String,
) -> Result<GitRepoState, String> {
    let root = ensure_repo_root(&repo_root)?;
    let target_branch = branch.trim();
    let target_upstream = upstream.trim();
    if target_branch.is_empty() || target_upstream.is_empty() {
        return Err("分支名和上游引用不能为空。".into());
    }
    validate_branch_name(&root, target_branch)?;
    let local = list_local_branches(&root);
    if !local.iter().any(|b| b == target_branch) {
        return Err(format!("本地不存在分支「{target_branch}」。"));
    }
    git_output(
        &root,
        &["branch", "--set-upstream-to", target_upstream, target_branch],
    )?;
    refresh_state(&root)
}

#[tauri::command]
pub fn git_workflow_rename_branch(
    repo_root: String,
    old_branch: String,
    new_branch: String,
) -> Result<GitRepoState, String> {
    let root = ensure_repo_root(&repo_root)?;
    let old_name = old_branch.trim().to_string();
    let new_name = new_branch.trim().to_string();
    validate_branch_name(&root, &old_name)?;
    validate_branch_name(&root, &new_name)?;
    if old_name == new_name {
        return Err("旧分支名与新分支名相同，无需重命名。".into());
    }
    let local = list_local_branches(&root);
    if !local.iter().any(|b| b == &old_name) {
        return Err(format!("本地不存在分支「{old_name}」。"));
    }
    if local.iter().any(|b| b == &new_name) {
        return Err(format!("本地已存在分支「{new_name}」。"));
    }
    let current = git_output_allow_empty(&root, &["branch", "--show-current"]);
    if current == old_name {
        git_output(&root, &["branch", "-m", &new_name])?;
    } else {
        git_output(&root, &["branch", "-m", &old_name, &new_name])?;
    }
    refresh_state(&root)
}

#[tauri::command]
pub fn git_workflow_list_merged_branches(
    repo_root: String,
    base_branch: Option<String>,
) -> Result<Vec<String>, String> {
    let root = ensure_repo_root(&repo_root)?;
    let current = git_output_allow_empty(&root, &["branch", "--show-current"]);
    let base = base_branch.unwrap_or_default().trim().to_string();
    let merged_out = if base.is_empty() {
        git_output_allow_empty(&root, &["branch", "--merged"])
    } else {
        git_output_allow_empty(&root, &["branch", "--merged", &base])
    };
    let mut merged: Vec<String> = merged_out
        .lines()
        .map(str::trim)
        .map(|l| l.trim_start_matches('*').trim())
        .filter(|l| !l.is_empty() && *l != current && *l != base)
        .map(ToString::to_string)
        .collect();
    merged.sort();
    merged.dedup();
    Ok(merged)
}

#[tauri::command]
pub fn git_workflow_pull(repo_root: String) -> Result<String, String> {
    let root = ensure_repo_root(&repo_root)?;
    let out = git_command(&root, &["pull", "--rebase", "--autostash", "--no-tags"])
        .output()
        .map_err(|e| format!("无法执行 git：{e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let combined = format!("{stdout}{stderr}").trim().to_string();
    if !out.status.success() {
        return Err(if combined.is_empty() {
            format!("pull 失败（退出码 {:?}）", out.status.code())
        } else {
            combined
        });
    }
    Ok(combined)
}

#[tauri::command]
pub fn git_workflow_add_all(repo_root: String) -> Result<(), String> {
    let root = ensure_repo_root(&repo_root)?;
    git_output(&root, &["add", "-A"])?;
    Ok(())
}

#[tauri::command]
pub fn git_workflow_restore_staged(repo_root: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let root = ensure_repo_root(&repo_root)?;
    let mut args: Vec<&str> = vec!["restore", "--staged", "--"];
    for p in &paths {
        args.push(p.as_str());
    }
    git_output(&root, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_workflow_add_paths(repo_root: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let root = ensure_repo_root(&repo_root)?;
    let mut args: Vec<&str> = vec!["add", "--"];
    for p in &paths {
        args.push(p.as_str());
    }
    git_output(&root, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_workflow_diff_cached_stat(repo_root: String) -> Result<String, String> {
    let root = ensure_repo_root(&repo_root)?;
    git_output(&root, &["--no-pager", "diff", "--cached", "--stat"])
}

#[tauri::command]
pub fn git_workflow_commit(repo_root: String, message: String) -> Result<(), String> {
    let root = ensure_repo_root(&repo_root)?;
    let msg = message.trim();
    if msg.is_empty() {
        return Err("提交说明不能为空。".into());
    }
    git_output(&root, &["commit", "-m", msg])?;
    Ok(())
}

#[tauri::command]
pub fn git_workflow_push(repo_root: String, remote: String, branch: String) -> Result<String, String> {
    let root = ensure_repo_root(&repo_root)?;
    let remote = remote.trim();
    let branch = branch.trim();
    if remote.is_empty() || branch.is_empty() {
        return Err("远程名或分支名无效。".into());
    }
    git_output(&root, &["remote", "get-url", remote]).map_err(|e| format!("远程「{remote}」不可用：{e}"))?;

    let args: Vec<&str> = if has_upstream(&root) {
        vec!["push", remote, branch]
    } else {
        vec!["push", "-u", remote, branch]
    };
    let out = git_command(&root, &args)
        .output()
        .map_err(|e| format!("无法执行 git：{e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let combined = format!("{stdout}{stderr}").trim().to_string();
    if !out.status.success() {
        return Err(if combined.is_empty() {
            format!("push 失败（退出码 {:?}）", out.status.code())
        } else {
            combined
        });
    }
    Ok(combined)
}

#[cfg(test)]
mod tests {
    use super::{remote_short_branches, resolve_remote_target};

    #[test]
    fn remote_short_branches_extracts_all_remotes() {
        let rows = vec![
            "origin/main".to_string(),
            "upstream/feature/x".to_string(),
            "fork/bugfix/y".to_string(),
        ];
        let shorts = remote_short_branches(&rows);
        assert_eq!(shorts, vec!["main", "feature/x", "bugfix/y"]);
    }

    #[test]
    fn resolve_remote_target_with_full_remote_ref() {
        let rows = vec!["origin/main".to_string(), "upstream/main".to_string()];
        let resolved = resolve_remote_target("origin/main", &rows).expect("resolve should succeed");
        assert_eq!(resolved.as_deref(), Some("origin/main"));
    }

    #[test]
    fn resolve_remote_target_with_single_match() {
        let rows = vec!["origin/dev".to_string(), "upstream/main".to_string()];
        let resolved = resolve_remote_target("dev", &rows).expect("resolve should succeed");
        assert_eq!(resolved.as_deref(), Some("origin/dev"));
    }

    #[test]
    fn resolve_remote_target_ambiguous() {
        let rows = vec!["origin/main".to_string(), "upstream/main".to_string()];
        let err = resolve_remote_target("main", &rows).expect_err("should be ambiguous");
        assert!(err.contains("多个远程"));
    }
}

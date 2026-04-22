mod git_workflow;
mod http_fetch;

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct CursorRuleFile {
    path: String,
    filename: String,
    content: String,
    project_root: String,
}

fn collect_mdc(dir: &Path, project_root: &str, results: &mut Vec<CursorRuleFile>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |e| e == "mdc") {
            if let Ok(content) = fs::read_to_string(&path) {
                results.push(CursorRuleFile {
                    path: path.to_string_lossy().to_string(),
                    filename: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    content,
                    project_root: project_root.to_string(),
                });
            }
        }
    }
}

#[tauri::command]
fn scan_cursor_rules(workspace_roots: Vec<String>) -> Vec<CursorRuleFile> {
    let mut results = Vec::new();

    // Auto-detect global ~/.cursor/rules/
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        let cursor_dir = Path::new(&home).join(".cursor");
        let rules_dir = cursor_dir.join("rules");
        if rules_dir.is_dir() {
            collect_mdc(&rules_dir, &cursor_dir.to_string_lossy(), &mut results);
        }
    }

    for root in &workspace_roots {
        let root_path = Path::new(root);
        if !root_path.exists() {
            continue;
        }

        // <root>/.cursor/rules/*.mdc
        let direct_rules = root_path.join(".cursor").join("rules");
        if direct_rules.is_dir() {
            collect_mdc(&direct_rules, root, &mut results);
        }

        // <root>/<child>/.cursor/rules/*.mdc
        let Ok(entries) = fs::read_dir(root_path) else {
            continue;
        };
        for entry in entries.flatten() {
            let child = entry.path();
            if child.is_dir() {
                let child_rules = child.join(".cursor").join("rules");
                if child_rules.is_dir() {
                    collect_mdc(&child_rules, &child.to_string_lossy(), &mut results);
                }
            }
        }
    }

    results
}

/// 返回 `workspace_roots` 中在本地不存在的路径，供界面提示用户修正扫描配置。
#[tauri::command]
fn workspace_roots_missing(roots: Vec<String>) -> Vec<String> {
    roots
        .into_iter()
        .filter(|r| !r.is_empty() && !Path::new(r).exists())
        .collect()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_cursor_rules,
            workspace_roots_missing,
            git_workflow::git_workflow_resolve,
            git_workflow::git_workflow_refresh,
            git_workflow::git_workflow_list_branches,
            git_workflow::git_workflow_switch_branch,
            git_workflow::git_workflow_create_branch,
            git_workflow::git_workflow_delete_branch,
            git_workflow::git_workflow_set_upstream,
            git_workflow::git_workflow_rename_branch,
            git_workflow::git_workflow_list_merged_branches,
            git_workflow::git_workflow_refresh_lists,
            git_workflow::git_workflow_pull,
            git_workflow::git_workflow_add_all,
            git_workflow::git_workflow_restore_staged,
            git_workflow::git_workflow_add_paths,
            git_workflow::git_workflow_diff_cached_stat,
            git_workflow::git_workflow_commit,
            git_workflow::git_workflow_push,
            http_fetch::http_fetch_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

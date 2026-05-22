use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Clone)]
pub struct LocalConfigItem {
    id: String,
    source_kind: String,
    source_label: String,
    path: String,
    name: String,
    trigger: String,
    command: String,
    description: String,
    raw: String,
    category: String,
    language: String,
}

#[derive(Serialize, Clone)]
pub struct LocalConfigWarning {
    source_kind: String,
    path: String,
    message: String,
}

#[derive(Serialize)]
pub struct LocalConfigScanResult {
    items: Vec<LocalConfigItem>,
    warnings: Vec<LocalConfigWarning>,
}

#[tauri::command]
pub fn scan_local_dev_configs(extra_cmd_paths: Vec<String>) -> LocalConfigScanResult {
    let mut items = Vec::new();
    let mut warnings = Vec::new();

    scan_powershell(&mut items, &mut warnings);
    scan_cmd(extra_cmd_paths, &mut items, &mut warnings);
    scan_git(&mut items, &mut warnings);
    scan_bash(&mut items, &mut warnings);
    scan_vscode_snippets(&mut items, &mut warnings);

    items.sort_by(|a, b| {
        a.source_kind
            .cmp(&b.source_kind)
            .then(a.path.cmp(&b.path))
            .then(a.name.cmp(&b.name))
    });

    LocalConfigScanResult { items, warnings }
}

fn warn(warnings: &mut Vec<LocalConfigWarning>, source_kind: &str, path: &Path, message: String) {
    warnings.push(LocalConfigWarning {
        source_kind: source_kind.to_string(),
        path: path.to_string_lossy().to_string(),
        message,
    });
}

fn home_dir() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(PathBuf::from)
}

fn read_to_string(path: &Path, source_kind: &str, warnings: &mut Vec<LocalConfigWarning>) -> Option<String> {
    match fs::read_to_string(path) {
        Ok(content) => Some(content),
        Err(err) => {
            warn(warnings, source_kind, path, err.to_string());
            None
        }
    }
}

fn push_item(
    items: &mut Vec<LocalConfigItem>,
    source_kind: &str,
    source_label: &str,
    path: &Path,
    name: &str,
    trigger: &str,
    command: &str,
    description: &str,
    raw: &str,
    category: &str,
    language: &str,
) {
    let path_str = path.to_string_lossy().to_string();
    items.push(LocalConfigItem {
        id: format!("{source_kind}:{path_str}:{name}:{trigger}"),
        source_kind: source_kind.to_string(),
        source_label: source_label.to_string(),
        path: path_str,
        name: name.to_string(),
        trigger: trigger.to_string(),
        command: command.to_string(),
        description: description.to_string(),
        raw: raw.to_string(),
        category: category.to_string(),
        language: language.to_string(),
    });
}

fn scan_powershell(items: &mut Vec<LocalConfigItem>, warnings: &mut Vec<LocalConfigWarning>) {
    let Some(home) = home_dir() else {
        return;
    };
    let mut candidates = vec![
        home.join("Documents")
            .join("WindowsPowerShell")
            .join("Microsoft.PowerShell_profile.ps1"),
        home.join("Documents")
            .join("WindowsPowerShell")
            .join("profile.ps1"),
        home.join("Documents")
            .join("PowerShell")
            .join("Microsoft.PowerShell_profile.ps1"),
        home.join("Documents").join("PowerShell").join("profile.ps1"),
    ];
    if let Some(profile) = read_powershell_profile_path() {
        candidates.insert(0, profile);
    }

    let mut seen = HashSet::new();
    for path in candidates {
        let path_key = path.to_string_lossy().to_string().to_ascii_lowercase();
        if !seen.insert(path_key) || !path.is_file() {
            continue;
        }
        let Some(content) = read_to_string(&path, "powershell", warnings) else {
            continue;
        };
        parse_powershell_profile(&content, &path, items);
    }
}

fn read_powershell_profile_path() -> Option<PathBuf> {
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", "$PROFILE"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!text.is_empty()).then(|| PathBuf::from(text))
}

fn parse_powershell_profile(content: &str, path: &Path, items: &mut Vec<LocalConfigItem>) {
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim_start();
        if let Some(name) = parse_powershell_function_name(trimmed) {
            let start = i;
            let mut end = i;
            let mut depth = brace_delta(lines[i]);
            while depth > 0 && end + 1 < lines.len() {
                end += 1;
                depth += brace_delta(lines[end]);
            }
            let raw = lines[start..=end].join("\n");
            let body = extract_powershell_body(&raw);
            let command = summarize_powershell_body(&body);
            let category = categorize_command(&command);
            push_item(
                items,
                "powershell",
                "PowerShell profile",
                path,
                &name,
                &name,
                &command,
                "",
                &raw,
                &category,
                "powershell",
            );
            i = end + 1;
            continue;
        }

        if let Some((name, target)) = parse_powershell_alias(trimmed) {
            let category = categorize_command(&target);
            push_item(
                items,
                "powershell",
                "PowerShell profile",
                path,
                &name,
                &name,
                &target,
                "",
                lines[i],
                &category,
                "powershell",
            );
        }
        i += 1;
    }
}

fn parse_powershell_function_name(line: &str) -> Option<String> {
    let lower = line.to_ascii_lowercase();
    let rest = lower
        .strip_prefix("function")
        .and_then(|_| line.get("function".len()..))?
        .trim_start();
    let name = rest
        .split(|c: char| c.is_whitespace() || c == '{' || c == '(')
        .next()
        .unwrap_or("")
        .trim()
        .trim_start_matches("global:")
        .trim_start_matches("script:");
    (!name.is_empty()).then(|| name.to_string())
}

fn parse_powershell_alias(line: &str) -> Option<(String, String)> {
    let lower = line.to_ascii_lowercase();
    if !(lower.starts_with("set-alias ") || lower.starts_with("new-alias ")) {
        return None;
    }
    if lower.contains(" -name ") && lower.contains(" -value ") {
        return parse_named_powershell_alias(line);
    }
    let mut parts = line.split_whitespace();
    parts.next()?;
    let name = parts.next()?.trim_matches('"').trim_matches('\'').to_string();
    let target = parts.collect::<Vec<_>>().join(" ");
    if name.is_empty() || target.is_empty() {
        return None;
    }
    Some((name, target))
}

fn parse_named_powershell_alias(line: &str) -> Option<(String, String)> {
    let parts = line.split_whitespace().collect::<Vec<_>>();
    let mut name = None;
    let mut value = None;
    for (idx, part) in parts.iter().enumerate() {
        let lower = part.to_ascii_lowercase();
        if lower == "-name" {
            name = parts.get(idx + 1).map(|v| v.trim_matches('"').trim_matches('\'').to_string());
        } else if lower == "-value" {
            value = parts.get(idx + 1).map(|v| v.trim_matches('"').trim_matches('\'').to_string());
        }
    }
    let name = name?;
    let value = value?;
    if name.is_empty() || value.is_empty() {
        return None;
    }
    Some((name, value))
}

fn brace_delta(line: &str) -> i32 {
    let mut delta = 0;
    let mut in_single = false;
    let mut in_double = false;
    for ch in line.chars() {
        match ch {
            '\'' if !in_double => in_single = !in_single,
            '"' if !in_single => in_double = !in_double,
            '{' if !in_single && !in_double => delta += 1,
            '}' if !in_single && !in_double => delta -= 1,
            _ => {}
        }
    }
    delta
}

fn extract_powershell_body(raw: &str) -> String {
    let Some(start) = raw.find('{') else {
        return raw.to_string();
    };
    let Some(end) = raw.rfind('}') else {
        return raw[start + 1..].trim().to_string();
    };
    raw[start + 1..end].trim().to_string()
}

fn summarize_powershell_body(body: &str) -> String {
    body.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("param("))
        .take(6)
        .collect::<Vec<_>>()
        .join("\n")
}

fn scan_cmd(
    extra_cmd_paths: Vec<String>,
    items: &mut Vec<LocalConfigItem>,
    warnings: &mut Vec<LocalConfigWarning>,
) {
    let mut paths = Vec::new();
    if let Some(autorun) = read_cmd_autorun() {
        for path in extract_cmd_paths_from_autorun(&autorun) {
            paths.push(path);
        }
        let virtual_path = PathBuf::from("HKCU\\Software\\Microsoft\\Command Processor\\AutoRun");
        push_item(
            items,
            "cmd",
            "CMD AutoRun",
            &virtual_path,
            "AutoRun",
            "AutoRun",
            &autorun,
            "Command Processor AutoRun",
            &autorun,
            "cmd",
            "cmd",
        );
    }

    for extra in extra_cmd_paths {
        let trimmed = extra.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }

    let mut seen = HashSet::new();
    for path in paths {
        let path_key = path.to_string_lossy().to_string().to_ascii_lowercase();
        if !seen.insert(path_key) || !path.is_file() {
            continue;
        }
        let Some(content) = read_to_string(&path, "cmd", warnings) else {
            continue;
        };
        parse_cmd_file(&content, &path, items);
    }
}

fn read_cmd_autorun() -> Option<String> {
    let output = Command::new("reg")
        .args([
            "query",
            "HKCU\\Software\\Microsoft\\Command Processor",
            "/v",
            "AutoRun",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.contains("AutoRun") {
            let parts = line.split_whitespace().collect::<Vec<_>>();
            if parts.len() >= 3 {
                return Some(parts[2..].join(" "));
            }
        }
    }
    None
}

fn extract_cmd_paths_from_autorun(autorun: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for token in autorun.split(['&', ';']) {
        let trimmed = token.trim().trim_matches('"');
        let lower = trimmed.to_ascii_lowercase();
        if lower.ends_with(".cmd") || lower.ends_with(".bat") {
            paths.push(PathBuf::from(trimmed));
        } else if let Some(idx) = lower.find(".cmd") {
            paths.push(PathBuf::from(trimmed[..idx + 4].trim_matches('"')));
        } else if let Some(idx) = lower.find(".bat") {
            paths.push(PathBuf::from(trimmed[..idx + 4].trim_matches('"')));
        }
    }
    paths
}

fn parse_cmd_file(content: &str, path: &Path, items: &mut Vec<LocalConfigItem>) {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("::") || trimmed.to_ascii_lowercase().starts_with("rem ") {
            continue;
        }
        let lower = trimmed.to_ascii_lowercase();
        if !lower.starts_with("doskey ") {
            continue;
        }
        let rest = trimmed[7..].trim();
        let Some(eq_idx) = rest.find('=') else {
            continue;
        };
        let name = rest[..eq_idx].trim();
        let command = rest[eq_idx + 1..].trim();
        if name.is_empty() || command.is_empty() {
            continue;
        }
        let category = categorize_command(command);
        push_item(
            items,
            "cmd",
            "CMD doskey",
            path,
            name,
            name,
            command,
            "",
            trimmed,
            &category,
            "cmd",
        );
    }
}

fn scan_git(items: &mut Vec<LocalConfigItem>, warnings: &mut Vec<LocalConfigWarning>) {
    let mut candidates = Vec::new();
    if let Some(home) = home_dir() {
        candidates.push(home.join(".gitconfig"));
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join("Git").join("etc").join("gitconfig"));
    }
    if let Ok(program_data) = std::env::var("ProgramData") {
        candidates.push(PathBuf::from(program_data).join("Git").join("config"));
    }

    let mut seen = HashSet::new();
    for path in candidates {
        let path_key = path.to_string_lossy().to_string().to_ascii_lowercase();
        if !seen.insert(path_key) || !path.is_file() {
            continue;
        }
        let Some(content) = read_to_string(&path, "git", warnings) else {
            continue;
        };
        parse_git_config(&content, &path, items);
    }
}

fn parse_git_config(content: &str, path: &Path, items: &mut Vec<LocalConfigItem>) {
    let mut in_alias = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
            continue;
        }
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_alias = trimmed.trim_matches(['[', ']']).trim() == "alias";
            continue;
        }
        if !in_alias {
            continue;
        }
        let Some(eq_idx) = trimmed.find('=') else {
            continue;
        };
        let name = trimmed[..eq_idx].trim();
        let value = trimmed[eq_idx + 1..].trim();
        if name.is_empty() || value.is_empty() {
            continue;
        }
        push_item(
            items,
            "git",
            "Git aliases",
            path,
            name,
            name,
            &format!("git {value}"),
            "",
            trimmed,
            "git",
            "gitconfig",
        );
    }
}

fn scan_bash(items: &mut Vec<LocalConfigItem>, warnings: &mut Vec<LocalConfigWarning>) {
    let Some(home) = home_dir() else {
        return;
    };
    let candidates = [
        home.join(".bashrc"),
        home.join(".bash_profile"),
        home.join(".bash_aliases"),
        home.join(".profile"),
    ];
    for path in candidates {
        if !path.is_file() {
            continue;
        }
        let Some(content) = read_to_string(&path, "bash", warnings) else {
            continue;
        };
        parse_bash_config(&content, &path, items);
    }
}

fn parse_bash_config(content: &str, path: &Path, items: &mut Vec<LocalConfigItem>) {
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim_start();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            i += 1;
            continue;
        }

        if let Some((name, command)) = parse_bash_alias(trimmed) {
            let category = categorize_command(&command);
            push_item(
                items,
                "bash",
                "Git Bash",
                path,
                &name,
                &name,
                &command,
                "",
                lines[i],
                &category,
                "bash",
            );
            i += 1;
            continue;
        }

        if let Some(name) = parse_bash_function_name(trimmed) {
            let start = i;
            let mut end = i;
            let mut depth = brace_delta(lines[i]);
            while depth > 0 && end + 1 < lines.len() {
                end += 1;
                depth += brace_delta(lines[end]);
            }
            let raw = lines[start..=end].join("\n");
            let body = extract_powershell_body(&raw);
            let command = summarize_bash_body(&body);
            let category = categorize_command(&command);
            push_item(
                items,
                "bash",
                "Git Bash",
                path,
                &name,
                &name,
                &command,
                "",
                &raw,
                &category,
                "bash",
            );
            i = end + 1;
            continue;
        }

        i += 1;
    }
}

fn parse_bash_alias(line: &str) -> Option<(String, String)> {
    let rest = line.strip_prefix("alias ")?;
    let eq_idx = rest.find('=')?;
    let name = rest[..eq_idx].trim();
    let command = rest[eq_idx + 1..]
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .to_string();
    if name.is_empty() || command.is_empty() {
        return None;
    }
    Some((name.to_string(), command))
}

fn parse_bash_function_name(line: &str) -> Option<String> {
    let rest = line.strip_prefix("function ").unwrap_or(line).trim_start();
    if let Some(paren_idx) = rest.find("()") {
        let name = rest[..paren_idx].trim();
        if !name.is_empty() && rest[paren_idx + 2..].trim_start().starts_with('{') {
            return Some(name.to_string());
        }
    }

    if line.starts_with("function ") {
        let name = rest
            .split(|c: char| c.is_whitespace() || c == '{' || c == '(')
            .next()
            .unwrap_or("")
            .trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

fn summarize_bash_body(body: &str) -> String {
    body.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("local "))
        .take(8)
        .collect::<Vec<_>>()
        .join("\n")
}

fn scan_vscode_snippets(items: &mut Vec<LocalConfigItem>, warnings: &mut Vec<LocalConfigWarning>) {
    let Ok(appdata) = std::env::var("APPDATA") else {
        return;
    };
    let snippets_dir = PathBuf::from(appdata).join("Code").join("User").join("snippets");
    let Ok(entries) = fs::read_dir(&snippets_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() || path.extension().map_or(true, |e| e != "json") {
            continue;
        }
        let Some(content) = read_to_string(&path, "vscode-snippet", warnings) else {
            continue;
        };
        parse_vscode_snippet_file(&content, &path, items, warnings);
    }
}

fn parse_vscode_snippet_file(
    content: &str,
    path: &Path,
    items: &mut Vec<LocalConfigItem>,
    warnings: &mut Vec<LocalConfigWarning>,
) {
    let cleaned = remove_trailing_json_commas(&strip_json_comments(content));
    let parsed: Value = match serde_json::from_str(&cleaned) {
        Ok(value) => value,
        Err(err) => {
            warn(warnings, "vscode-snippet", path, err.to_string());
            return;
        }
    };
    let Some(obj) = parsed.as_object() else {
        return;
    };
    let language = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("snippet")
        .to_string();
    for (name, snippet) in obj {
        let Some(snippet_obj) = snippet.as_object() else {
            continue;
        };
        let prefix = json_string_or_array(snippet_obj.get("prefix"));
        let body = json_string_or_array(snippet_obj.get("body"));
        let description = json_string_or_array(snippet_obj.get("description"));
        if prefix.is_empty() && body.is_empty() {
            continue;
        }
        push_item(
            items,
            "vscode-snippet",
            "VS Code snippets",
            path,
            name,
            &prefix,
            &body,
            &description,
            &snippet.to_string(),
            "snippet",
            &language,
        );
    }
}

fn json_string_or_array(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|v| v.as_str())
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn strip_json_comments(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;
    while let Some(ch) = chars.next() {
        if in_string {
            out.push(ch);
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }
        if ch == '"' {
            in_string = true;
            out.push(ch);
            continue;
        }
        if ch == '/' && chars.peek() == Some(&'/') {
            chars.next();
            for next in chars.by_ref() {
                if next == '\n' {
                    out.push('\n');
                    break;
                }
            }
            continue;
        }
        if ch == '/' && chars.peek() == Some(&'*') {
            chars.next();
            let mut prev = '\0';
            for next in chars.by_ref() {
                if next == '\n' {
                    out.push('\n');
                }
                if prev == '*' && next == '/' {
                    break;
                }
                prev = next;
            }
            continue;
        }
        out.push(ch);
    }
    out
}

fn remove_trailing_json_commas(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    let mut in_string = false;
    let mut escaped = false;
    while i < chars.len() {
        let ch = chars[i];
        if in_string {
            out.push(ch);
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if ch == '"' {
            in_string = true;
            out.push(ch);
            i += 1;
            continue;
        }
        if ch == ',' {
            let mut j = i + 1;
            while j < chars.len() && chars[j].is_whitespace() {
                j += 1;
            }
            if j < chars.len() && (chars[j] == '}' || chars[j] == ']') {
                i += 1;
                continue;
            }
        }
        out.push(ch);
        i += 1;
    }
    out
}

fn categorize_command(command: &str) -> String {
    let lower = command.to_ascii_lowercase();
    if lower.contains("git ") || lower.starts_with("git") {
        "git".to_string()
    } else if lower.contains("yarn") || lower.contains("npm") || lower.contains("pnpm") {
        "package".to_string()
    } else if lower.contains("react-native") || lower.contains("adb") {
        "mobile".to_string()
    } else if lower.contains("set-location") || lower.starts_with("cd ") {
        "navigation".to_string()
    } else {
        "custom".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_powershell_functions_with_and_without_space_before_brace() {
        let mut items = Vec::new();
        let path = Path::new("profile.ps1");
        parse_powershell_profile(
            r#"
function gaa { git add --all }
function tstart{ pnpm tauri dev $args }
function yrn {
  param([string] $Script)
  yarn run $Script
}
"#,
            path,
            &mut items,
        );

        let names = items.iter().map(|item| item.name.as_str()).collect::<Vec<_>>();
        assert!(names.contains(&"gaa"));
        assert!(names.contains(&"tstart"));
        assert!(names.contains(&"yrn"));
    }

    #[test]
    fn parses_bash_aliases_and_functions() {
        let mut items = Vec::new();
        let path = Path::new(".bashrc");
        parse_bash_config(
            r#"
alias gs='git status'
gm() {
  git fetch origin "$1"
  git merge FETCH_HEAD
}
function gcb() {
  git checkout -b "$1"
}
"#,
            path,
            &mut items,
        );

        let names = items.iter().map(|item| item.name.as_str()).collect::<Vec<_>>();
        assert!(names.contains(&"gs"));
        assert!(names.contains(&"gm"));
        assert!(names.contains(&"gcb"));
    }
}

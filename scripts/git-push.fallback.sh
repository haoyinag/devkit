#!/usr/bin/env bash
# 无 Node 时的交互式拉取、暂存区裁剪、提交与推送（与 git-push.mjs 流程对齐）
set -euo pipefail

ask_yn() {
  local prompt="$1" default="$2" reply
  read -rp "$prompt " reply
  reply="${reply:-$default}"
  [[ "$reply" =~ ^[Yy] ]]
}

git_or_die() {
  if ! git "$@"; then
    exit $?
  fi
}

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "当前目录不是 Git 仓库。"; exit 1; }
cd "$root"

branch=$(git branch --show-current)
[[ -z "$branch" ]] && { echo "无法获取当前分支（可能处于分离 HEAD）。"; exit 1; }

echo ""
echo "仓库根目录: $root"
echo "当前分支: $branch"
echo ""
git status -sb
echo ""

no_pull=false
for arg in "$@"; do [[ "$arg" == "--no-pull" ]] && no_pull=true; done

if ! $no_pull; then
  if ask_yn "是否执行 git pull --rebase --autostash --no-tags？(Y/n)" "Y"; then
    git pull --rebase --autostash --no-tags
    echo ""
  fi
fi

git add -A

staged_paths() {
  git diff --cached --name-only
}

addable_paths() {
  { git diff --name-only; git ls-files --others --exclude-standard; } | sort -u
}

pick_by_number() {
  local -a items=("$@")
  local count=${#items[@]}
  [[ $count -eq 0 ]] && return
  local i=1
  for f in "${items[@]}"; do
    printf "%3d: %s\n" "$i" "$f"
    ((i++))
  done
  read -rp "输入编号（逗号或空格分隔），留空跳过: " line
  [[ -z "$line" ]] && return
  IFS=', ' read -ra nums <<< "$line"
  for n in "${nums[@]}"; do
    if [[ "$n" =~ ^[0-9]+$ ]] && ((n >= 1 && n <= count)); then
      echo "${items[$((n-1))]}"
    fi
  done
}

initial=()
while IFS= read -r line; do
  initial+=("$line")
done < <(staged_paths)
if [[ ${#initial[@]} -eq 0 ]]; then
  echo "暂存区为空，无需提交。"
  exit 0
fi

echo "当前暂存区文件："
to_exclude=()
while IFS= read -r line; do
  to_exclude+=("$line")
done < <(pick_by_number "${initial[@]}")
for f in "${to_exclude[@]}"; do
  [[ -n "$f" ]] && git restore --staged -- "$f"
done

while true; do
  read -rp "是否继续调整暂存区？(y/N) " adj
  [[ ! "$adj" =~ ^[Yy] ]] && break
  echo "1) 从暂存区剔除  2) 加入暂存区  3) 完成"
  read -rp "选择 (1-3): " op
  case "$op" in
    1)
      cur=()
      while IFS= read -r line; do
        cur+=("$line")
      done < <(staged_paths)
      if [[ ${#cur[@]} -eq 0 ]]; then
        echo "当前没有已暂存文件。"
      else
        picked=()
        while IFS= read -r line; do
          picked+=("$line")
        done < <(pick_by_number "${cur[@]}")
        for f in "${picked[@]}"; do
          [[ -n "$f" ]] && git restore --staged -- "$f"
        done
      fi
      ;;
    2)
      addable=()
      while IFS= read -r line; do
        addable+=("$line")
      done < <(addable_paths)
      if [[ ${#addable[@]} -eq 0 ]]; then
        echo "没有可加入暂存区的文件。"
      else
        picked=()
        while IFS= read -r line; do
          picked+=("$line")
        done < <(pick_by_number "${addable[@]}")
        for f in "${picked[@]}"; do
          [[ -n "$f" ]] && git add -- "$f"
        done
      fi
      ;;
    3) break ;;
  esac
  git status -sb
  echo ""
done

final=()
while IFS= read -r line; do
  final+=("$line")
done < <(staged_paths)
if [[ ${#final[@]} -eq 0 ]]; then
  echo "暂存区为空，已取消提交。"
  exit 1
fi

echo ""
echo "即将提交的文件："
for f in "${final[@]}"; do echo "  $f"; done
echo ""
git --no-pager diff --cached --stat
echo ""

read -rp "提交说明（如 feat(scope): subject）: " msg
msg="${msg## }"
msg="${msg%% }"
[[ -z "$msg" ]] && { echo "提交说明不能为空。"; exit 1; }

echo "提交完成后：1) 推送到 origin  2) 仅本地提交，不推送"
read -rp "选择 (1/2，默认 1): " delivery
delivery="${delivery:-1}"

if ! ask_yn "使用以上说明执行提交？(Y/n)" "Y"; then
  echo "已取消提交。"
  exit 0
fi

git commit -m "$msg"

if [[ "$delivery" == "2" ]]; then
  echo ""
  echo "已完成本地提交，未执行 git push。"
  echo "需要推送时可执行：git push origin $branch"
  git status -sb
  exit 0
fi

if ! ask_yn "确认推送到 origin $branch ？(Y/n)" "Y"; then
  echo "已取消推送；提交仅存在于本地。"
  echo "稍后可执行：git push origin $branch"
  git status -sb
  exit 0
fi

if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  git push origin "$branch"
else
  git push -u origin "$branch"
fi
echo ""
git status -sb

import { useMemo, useState, useCallback } from "react";
import { BookOpen, Copy, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GitSnippet {
  title: string;
  /** 一句话说明 */
  desc: string;
  /** 命令或命令组合，可多行 */
  cmd: string;
  /** 补充说明（可选） */
  note?: string;
}

interface GitSection {
  id: string;
  label: string;
  items: GitSnippet[];
}

const SECTIONS: GitSection[] = [
  {
    id: "basics",
    label: "基础与配置",
    items: [
      { title: "版本", desc: "查看 Git 版本", cmd: "git --version" },
      { title: "全局用户名与邮箱", desc: "提交记录中显示的作者信息", cmd: "git config --global user.name \"Your Name\"\ngit config --global user.email you@example.com" },
      { title: "查看配置", desc: "列出全局配置", cmd: "git config --global --list" },
      { title: "别名示例", desc: "缩短常用命令", cmd: "git config --global alias.st status\ngit config --global alias.co checkout\ngit config --global alias.br branch" },
      { title: "帮助", desc: "查看子命令说明", cmd: "git help switch\ngit switch --help" },
    ],
  },
  {
    id: "repo",
    label: "仓库与克隆",
    items: [
      { title: "初始化仓库", desc: "当前目录创建 .git", cmd: "git init" },
      { title: "克隆远程", desc: "下载完整历史与默认分支", cmd: "git clone https://github.com/org/repo.git\ncd repo" },
      { title: "浅克隆", desc: "只取最近若干提交，加快大仓库", cmd: "git clone --depth 1 https://github.com/org/repo.git" },
      { title: "查看远程", desc: "列出已配置的 remote", cmd: "git remote -v" },
      { title: "添加远程", desc: "常用名 origin", cmd: "git remote add origin git@github.com:org/repo.git" },
      { title: "修改远程 URL", desc: "HTTPS 与 SSH 切换", cmd: "git remote set-url origin git@github.com:org/repo.git" },
    ],
  },
  {
    id: "status",
    label: "状态与查看",
    items: [
      { title: "短状态", desc: "一行摘要，含分支与 ahead/behind", cmd: "git status -sb" },
      { title: "完整状态", desc: "未跟踪、已修改等详细说明", cmd: "git status" },
      { title: "最近提交", desc: "图形化分支拓扑（需终端支持）", cmd: "git log --oneline --graph --decorate -n 20" },
      { title: "单文件历史", desc: "查看某路径的提交记录", cmd: "git log --oneline -- path/to/file" },
      { title: "某次提交详情", desc: "替换为实际 commit hash", cmd: "git show abc1234" },
      { title: "忽略空白差异", desc: "对比时忽略行尾空白", cmd: "git diff -w\ngit diff --cached -w" },
    ],
  },
  {
    id: "branch",
    label: "分支",
    items: [
      { title: "列出本地分支", desc: "当前分支前有 *", cmd: "git branch" },
      { title: "列出远程分支", desc: "含 origin/ 前缀", cmd: "git branch -r" },
      { title: "切换分支", desc: "Git 2.23+ 推荐", cmd: "git switch main" },
      { title: "新建并切换", desc: "从当前 HEAD 创建", cmd: "git switch -c feature/login" },
      { title: "跟踪远程分支", desc: "本地不存在时从 origin 检出", cmd: "git switch --track origin/feature/foo" },
      { title: "查看已合并到当前分支的分支", desc: "对照列表后逐个删除：git branch -d <name>", cmd: "git branch --merged" },
      { title: "强制删除本地分支", desc: "未合并也会删，慎用", cmd: "git branch -D old-branch" },
    ],
  },
  {
    id: "stage",
    label: "暂存与提交",
    items: [
      { title: "暂存单个文件", desc: "", cmd: "git add path/to/file" },
      { title: "暂存所有变更", desc: "含删除与未跟踪（与旧版行为一致时常用）", cmd: "git add -A" },
      { title: "交互式暂存", desc: "按块挑选", cmd: "git add -p" },
      { title: "取消暂存", desc: "保留工作区修改", cmd: "git restore --staged path/to/file" },
      { title: "提交", desc: "附说明", cmd: "git commit -m \"feat(auth): add login\"" },
      { title: "修改最近一次提交说明", desc: "未推送时常用", cmd: "git commit --amend -m \"fix: typo\"" },
      { title: "把新改动并入上一次提交", desc: "未推送时", cmd: "git add .\ngit commit --amend --no-edit" },
    ],
  },
  {
    id: "remote-push-pull",
    label: "远程、拉取与推送",
    items: [
      { title: "获取远程更新", desc: "不合并到当前分支", cmd: "git fetch origin" },
      { title: "拉取并合并", desc: "默认 merge；团队规范可能不同", cmd: "git pull origin main" },
      { title: "拉取并 rebase", desc: "线性历史，常用组合", cmd: "git pull --rebase origin main" },
      { title: "拉取 + rebase + 自动暂存本地改动", desc: "有未提交修改时省事", cmd: "git pull --rebase --autostash" },
      { title: "首次推送并设置上游", desc: "之后可直接 git push", cmd: "git push -u origin feature/foo" },
      { title: "推送当前分支", desc: "已设置 upstream 时", cmd: "git push" },
      { title: "推送指定分支", desc: "", cmd: "git push origin main" },
      { title: "强制推送", desc: "会改写远程历史，仅限个人分支且团队同意", cmd: "git push --force-with-lease origin feature/foo" },
    ],
  },
  {
    id: "merge-rebase",
    label: "合并与变基",
    items: [
      { title: "合并分支", desc: "把 feature 合入当前分支", cmd: "git merge feature/foo" },
      { title: "中止合并", desc: "冲突解决不了时", cmd: "git merge --abort" },
      { title: "变基到 main", desc: "在 feature 分支上执行", cmd: "git fetch origin\ngit rebase origin/main" },
      { title: "交互式 rebase", desc: " squash / 改顺序 / 改说明", cmd: "git rebase -i HEAD~5" },
      { title: "中止 rebase", desc: "", cmd: "git rebase --abort" },
      { title: "解决冲突后继续", desc: "", cmd: "git add .\ngit rebase --continue" },
    ],
  },
  {
    id: "stash",
    label: "贮藏 stash",
    items: [
      { title: "暂存工作区", desc: "含已跟踪修改；默认不含未跟踪可加 -u", cmd: "git stash push -m \"wip: before switch\"" },
      { title: "含未跟踪文件", desc: "", cmd: "git stash push -u -m \"wip\"" },
      { title: "列表", desc: "", cmd: "git stash list" },
      { title: "应用最近一条", desc: "默认不删除 stash", cmd: "git stash apply" },
      { title: "弹出最近一条", desc: "应用并删除该条", cmd: "git stash pop" },
      { title: "丢弃某条", desc: "stash@{n} 来自 list", cmd: "git stash drop stash@{0}" },
    ],
  },
  {
    id: "undo",
    label: "撤销与恢复",
    items: [
      { title: "丢弃工作区对某文件的修改", desc: "未暂存部分，慎用", cmd: "git restore path/to/file" },
      { title: "恢复文件到某次提交", desc: "", cmd: "git restore --source=abc1234 -- path/to/file" },
      { title: "重置暂存区", desc: "保留工作区", cmd: "git restore --staged ." },
      { title: "软重置", desc: "回退提交但保留改动在暂存区", cmd: "git reset --soft HEAD~1" },
      { title: "混合重置（默认）", desc: "回退提交，改动回工作区", cmd: "git reset HEAD~1" },
      { title: "硬重置", desc: "丢弃本地提交与改动，极度危险", cmd: "git reset --hard origin/main" },
      { title: "还原某次提交的修改", desc: "生成新提交", cmd: "git revert abc1234" },
    ],
  },
  {
    id: "tag",
    label: "标签",
    items: [
      { title: "列出标签", desc: "", cmd: "git tag -l" },
      { title: "附注标签", desc: "推荐用于发布", cmd: "git tag -a v1.0.0 -m \"Release 1.0.0\"" },
      { title: "推送标签", desc: "", cmd: "git push origin v1.0.0\ngit push origin --tags" },
    ],
  },
  {
    id: "submodule",
    label: "子模块（简要）",
    items: [
      { title: "添加子模块", desc: "", cmd: "git submodule add https://github.com/org/lib.git vendor/lib" },
      { title: "克隆含子模块的仓库", desc: "", cmd: "git clone --recurse-submodules https://github.com/org/repo.git" },
      { title: "拉取后更新子模块", desc: "", cmd: "git submodule update --init --recursive" },
    ],
  },
  {
    id: "combo",
    label: "常用组合场景",
    items: [
      {
        title: "日常同步后开发",
        desc: "先更新主分支再开功能分支",
        cmd: "git fetch origin\ngit switch main\ngit pull --rebase origin main\ngit switch -c feature/foo",
      },
      {
        title: "提交前看一眼差异",
        desc: "",
        cmd: "git status -sb\ngit diff\ngit diff --cached",
      },
      {
        title: "临时切分支但不想提交",
        desc: "先 stash 再 switch",
        cmd: "git stash push -u -m \"wip\"\ngit switch other-branch\n# ... 做完再回来\ngit switch -\ngit stash pop",
      },
      {
        title: "把当前 feature 变基到最新 main",
        desc: "",
        cmd: "git fetch origin\ngit rebase origin/main\n# 若有冲突：解决后 git add . && git rebase --continue",
      },
      {
        title: "查找谁改了某行",
        desc: "",
        cmd: "git blame -L 10,30 path/to/file",
      },
      {
        title: "清理已删除远程分支的本地引用",
        desc: "",
        cmd: "git fetch --prune",
        note: "或配置 git config --global fetch.prune true",
      },
    ],
  },
];

export function GitCheatsheetTool() {
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return SECTIONS;
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter(
        (it) =>
          it.title.toLowerCase().includes(query) ||
          it.desc.toLowerCase().includes(query) ||
          it.cmd.toLowerCase().includes(query) ||
          (it.note?.toLowerCase().includes(query) ?? false),
      ),
    })).filter((sec) => sec.items.length > 0);
  }, [q]);

  const totalVisible = useMemo(() => filtered.reduce((n, s) => n + s.items.length, 0), [filtered]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Git 速查</h2>
          <Badge variant="secondary" className="font-normal">
            {totalVisible} 条
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          日常命令与常用组合说明；示例中的分支名、远程名、提交 hash 请按你的仓库替换。
        </p>
        <div className="relative mt-3 max-w-xl">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="按标题、说明或命令搜索…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">没有匹配项，请换个关键词。</p>
        ) : (
          filtered.map((sec) => (
            <section key={sec.id} aria-labelledby={`git-cheat-${sec.id}`}>
              <h3 id={`git-cheat-${sec.id}`} className="mb-3 text-sm font-semibold text-foreground">
                {sec.label}
              </h3>
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                {sec.items.map((it) => {
                  const key = `${sec.id}:${it.title}`;
                  return (
                    <Card key={key} className="overflow-hidden">
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug">{it.title}</CardTitle>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1"
                            onClick={() => void copy(it.cmd, key)}
                          >
                            {copied === key ? <Check size={14} /> : <Copy size={14} />}
                            {copied === key ? "已复制" : "复制命令"}
                          </Button>
                        </div>
                        {it.desc ? <p className="text-sm text-muted-foreground">{it.desc}</p> : null}
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <pre className="max-h-48 overflow-auto rounded-md bg-muted/70 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap ring-1 ring-border/60">
                          {it.cmd}
                        </pre>
                        {it.note ? <p className="text-xs text-muted-foreground">{it.note}</p> : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

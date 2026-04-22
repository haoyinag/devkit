#!/usr/bin/env node
/**
 * 交互式拉取、暂存区裁剪、提交与推送。
 * 在任意 Git 仓库子目录执行均可（会自动 cd 到仓库根目录）。
 */
import { spawnSync } from "node:child_process";
import { checkbox, confirm, input, select } from "@inquirer/prompts";

/** @param {string[]} args @param {{ inherit?: boolean }} [opts] */
function git(args, opts = {}) {
  const inherit = opts.inherit ?? false;
  const r = spawnSync("git", args, {
    encoding: "utf-8",
    shell: false,
    stdio: inherit ? "inherit" : ["pipe", "pipe", "pipe"],
  });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0 && r.status != null) {
    if (!inherit && r.stderr) console.error(r.stderr.trimEnd());
    process.exit(r.status);
  }
  return (r.stdout ?? "").trimEnd();
}

const rootProbe = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
  shell: false,
  stdio: ["pipe", "pipe", "pipe"],
});
if (rootProbe.status !== 0) {
  console.error("当前目录不是 Git 仓库。");
  process.exit(1);
}
const root = (rootProbe.stdout ?? "").trim();
process.chdir(root);

let branch = git(["branch", "--show-current"]);
if (!branch) {
  console.error("无法获取当前分支（可能处于分离 HEAD）。");
  process.exit(1);
}

console.log(`\n仓库根目录: ${root}`);
console.log(`当前分支: ${branch}\n`);
console.log(git(["status", "-sb"]));
console.log("");

const skipPull = process.argv.includes("--no-pull");
if (!skipPull) {
  const doPull = await confirm({
    message: "是否执行 git pull --rebase --autostash --no-tags？",
    default: true,
  });
  if (doPull) {
    git(["pull", "--rebase", "--autostash", "--no-tags"], { inherit: true });
    console.log("");
  }
}

git(["add", "-A"]);

/** @returns {string[]} */
function stagedPaths() {
  const out = git(["diff", "--cached", "--name-only"]);
  return out ? out.split("\n").filter(Boolean) : [];
}

/** @returns {string[]} */
function pathsToMaybeStage() {
  const mod = git(["diff", "--name-only"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  const a = mod ? mod.split("\n").filter(Boolean) : [];
  const b = untracked ? untracked.split("\n").filter(Boolean) : [];
  return [...new Set([...a, ...b])].sort();
}

/** @returns {boolean} */
function hasUpstream() {
  const r = spawnSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
    encoding: "utf-8",
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return r.status === 0;
}

const initialStaged = stagedPaths();
if (initialStaged.length === 0) {
  console.log("暂存区为空，无需提交。");
  process.exit(0);
}

const excludeFirst = await checkbox({
  message: "勾选要从暂存区移除的文件（不纳入本次提交），不选则全部保留在暂存区",
  choices: initialStaged.map((f) => ({ name: f, value: f })),
});
for (const f of excludeFirst) {
  git(["restore", "--staged", "--", f]);
}

let adjusting = await confirm({
  message: "是否继续调整暂存区（再次剔除或把文件加回暂存区）？",
  default: false,
});

while (adjusting) {
  const action = await select({
    message: "选择操作",
    choices: [
      { name: "从暂存区剔除", value: "unstage" },
      { name: "加入暂存区", value: "stage" },
      { name: "完成调整", value: "done" },
    ],
  });

  if (action === "done") break;

  if (action === "unstage") {
    const cur = stagedPaths();
    if (cur.length === 0) {
      console.log("当前没有已暂存文件。\n");
    } else {
      const pick = await checkbox({
        message: "选择要从暂存区移除的文件",
        choices: cur.map((f) => ({ name: f, value: f })),
      });
      for (const f of pick) git(["restore", "--staged", "--", f]);
    }
  }

  if (action === "stage") {
    const addable = pathsToMaybeStage();
    if (addable.length === 0) {
      console.log("没有可加入暂存区的文件。\n");
    } else {
      const pick = await checkbox({
        message: "选择要加入暂存区的文件",
        choices: addable.map((f) => ({ name: f, value: f })),
      });
      for (const f of pick) git(["add", "--", f]);
    }
  }

  console.log(git(["status", "-sb"]));
  console.log("");

  adjusting = await confirm({
    message: "继续调整暂存区？",
    default: false,
  });
}

const finalStaged = stagedPaths();
if (finalStaged.length === 0) {
  console.error("暂存区为空，已取消提交。");
  process.exit(1);
}

console.log("\n即将提交的文件：");
console.log(finalStaged.map((f) => `  ${f}`).join("\n"));
console.log("");

git(["--no-pager", "diff", "--cached", "--stat"], { inherit: true });
console.log("");

const msg = await input({
  message: "提交说明（符合约定，如 feat(scope): subject）",
  validate: (v) => (v.trim() ? true : "不能为空"),
});

const afterCommit = await select({
  message: "提交完成后",
  choices: [
    {
      name: `推送到 origin（${branch}）`,
      value: "push",
      description: "执行 git push origin",
    },
    {
      name: "仅本地提交，不推送远程",
      value: "local",
      description: "只生成本地 commit，稍后可手动 push",
    },
  ],
  default: "push",
});

const okCommit = await confirm({ message: `使用说明「${msg.trim()}」执行提交？`, default: true });
if (!okCommit) {
  console.log("已取消提交。");
  process.exit(0);
}

git(["commit", "-m", msg.trim()]);

if (afterCommit === "local") {
  console.log("\n已完成本地提交，未执行 git push。");
  console.log(`需要推送时可执行：git push origin ${branch}`);
  console.log(git(["status", "-sb"]));
  process.exit(0);
}

const okPush = await confirm({
  message: `确认推送到 origin ${branch}？`,
  default: true,
});
if (!okPush) {
  console.log("已取消推送；提交仅存在于本地。");
  console.log(`稍后可执行：git push origin ${branch}`);
  console.log(git(["status", "-sb"]));
  process.exit(0);
}

const pushArgs = hasUpstream() ? ["push", "origin", branch] : ["push", "-u", "origin", branch];
git(pushArgs, { inherit: true });
console.log("");
console.log(git(["status", "-sb"]));

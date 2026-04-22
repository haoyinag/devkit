#!/usr/bin/env node
/**
 * CLI 入口：供 npm/pnpm 的 bin 字段注册；实际逻辑在 scripts/git-push.mjs。
 */
await import(new URL("../scripts/git-push.mjs", import.meta.url));

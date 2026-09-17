# 插件快照与发版

## 为什么是快照

`vendor/` 存的是 11 个插件仓库在发布版本上的源码副本，不是 submodule，也不是安装时拉取。
这样同一个 commit 里的插件组合是确定的：使用者不会因为某个插件仓库前进、
tag 被移动或 npm 上的同名包而拿到没测过的组合；离线也能装配。

代价是两处要同步。`scripts/vendor.mjs` 专门处理这件事。

## 数据结构

`manifest.json` 是唯一的版本清单：

- `desktop`：fork 仓库、`ref`、上游应用版本与 DSH 运行时版本；
- `profile.bundles`：会并入 `dsh.profile.bundles` 的包；
- `profile.runtimeDependencies`：插件导入但应用不自带的运行时包（当前只有
  `@deepseek-ai/dsh-tool-terminal`，其余 `@deepseek-ai/*` 都在应用包内）；
- `plugins[]`：每个插件的 `name`、`version`、`commit`、`repository`。

`vendor/<name>/` 与 `plugins[]` 一一对应；`setup.sh` 装配时把每个插件作为
`file:<bundle>/vendor/<name>` 写进 profile 的 dependencies，再在该 profile 里
`pnpm install`，`nodeLinker: hoisted` 保证插件与应用都从 profile 的
`node_modules` 解析，回退到应用自带副本的情况会被 `verify.mjs` 判为失败。

## 同步插件

```bash
# 报告各插件源码仓库当前 HEAD 与清单的差异
node scripts/vendor.mjs --from <插件源码根目录> --check

# 按各仓库当前 HEAD 刷新 vendor/ 与版本号
node scripts/vendor.mjs --from <插件源码根目录>

# 只同步其中几个
node scripts/vendor.mjs --from <插件源码根目录> --only dsh-plugin-terminal,dsh-plugin-browser
```

`--from` 指向本地插件检出根目录时，脚本用临时 clone 导出该 commit 的树：
不带 `.git`，也不带 `node_modules`；本地未提交的改动会在导出期间被 stash，
导出后恢复，因此工作区里的半成品不会进快照。不给 `--from` 时按
`manifest.json` 里的 `repository` 逐个 clone。

## 发版流程

1. 在插件仓库里提交、打 tag、推送（各自的 `main`）；
2. 回到本仓库 `node scripts/vendor.mjs --from <插件源码根目录>`，刷新 `vendor/` 与 pin；
3. `node scripts/vendor.mjs --check` 复核，`git diff` 确认只有预期的插件变化；
4. 桌面壳有更新时 `./build-dmg.sh --ref <revision>`，并更新 `manifest.json` 的 `desktop` 段；
5. 提交（英文 conventional commit），打 annotated tag `vX.Y.Z` 并推送；
6. 把 dmg 与 `shasum -a 256` 结果上传 Release，写清架构、revision 与放行步骤。

## 边界

- 桌面壳不在本仓库里，只在 `manifest.json` 里 pin 了 revision；壳的源码与构建细节见
  [build.md](build.md)。
- `dsh-plugin-suite` 与 `dsh-desktop-suite` 各自维护同一批成员插件的清单，
  两者都在本快照里：前者是 Web/桌面通用的组合层与 CLI，后者是在 Desktop 内
  通过 `desktopProfiles` / `desktopPnpm` 管理同一 profile 的 Host 行。
  两者都只在组合层插入自己，不重复挂载成员插件，因此可以并存；
  只想保留一个入口时从 `manifest.json` 的 `profile.bundles` 里去掉对应项即可
  （`vendor/` 中的源码可以继续保留）。
- 第三方插件（如 `dsh-better-reasoning-effort`、`nowledge-mem-deepseek-harness`）
  不属于这个快照：它们由使用者按自己的需要在 Desktop 插件市场里安装，
  版本与升级节奏与本组合无关。
- 本仓库不收录任何个人配置：模型端点、凭据、SSH 连接、会话与工作区都不在其中。

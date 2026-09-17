# 构建桌面应用

`build-dmg.sh` 从固定 revision 的 [hzxwonder/dsh-desktop](https://github.com/hzxwonder/dsh-desktop)
编译出 dmg。这个 fork 在上游 master 之上只有一个提交
（`feat(shell): host a native browser view from the desktop main process`），
提供浏览器面板的原生承载面；上游仓库没有这部分代码，所以需要同款壳时必须走这条路径。

## 前提

- macOS（Apple Silicon 用于 arm64 产物）；
- Node.js ≥ 24 与随附的 corepack；
- 首次构建会联网下载 Electron、原生模块头文件与 Yarn 依赖；
- 磁盘：构建目录 3–4 GB，暂存目录约 1.5 GB。

## 用法

```bash
./build-dmg.sh                          # 克隆 master、构建、出 arm64 dmg
./build-dmg.sh --ref <commit>           # 固定到某个 revision
./build-dmg.sh --source ~/src/dsh-desktop --skip-build   # 复用已有构建产物，只打包
./build-dmg.sh --arch universal         # 尝试 universal（见下）
./build-dmg.sh --out /tmp/out           # 改 dmg 输出目录
```

产物：`dist/DSH-Desktop-<版本>-<架构>.dmg`，脚本末尾打印大小与 sha256，
并挂载镜像复核其中的 ad-hoc 签名。

## 脚本做了什么

1. `git clone`（或复用 `--source`）并把 fork 的 `deepseek-harness` 子模块初始化；
2. `corepack yarn install --immutable`，再构建 `dsh-community-market` 与 `dsh-plugin-desktop`，
   并重建 `fs-ext` 原生模块；
3. `electron-builder --mac --<架构> --dir` 打包到 `--stage` 指定的普通 APFS 路径；
4. `xattr -cr` 后 `codesign --force --deep --sign -` 做 ad-hoc 签名并复核；
5. `hdiutil create -format UDZO` 生成 dmg，内含 `Applications` 软链；
6. 挂载 dmg、复核应用签名、卸载。

缓存全部落在 `--work`（默认 `<仓库>/.build`）：Corepack、Yarn、Electron、
electron-builder 与 node-gyp 的默认位置在 `~/Library`、`~/.cache` 与 `~/npm`，
受限环境里会失败；`npm_config_devdir` 必须设置，否则重建 `fs-ext` 时
下载 Electron 头文件会 EPERM。

## 已知输出与预期报错

- `electron-builder` 末尾的 fuse 校验会报
  `cannot determine requested Electron architecture(s) for mac`，
  这是发布校验，产物此时已生成，脚本据此继续；
- 打包目录必须放在普通 APFS 路径：工作区若位于 `~/Documents`，
  新文件会带 `com.apple.FinderInfo` 与 `com.apple.fileprovider.*`，
  `codesign` 会以 `resource fork, Finder information, or similar detritus not allowed` 拒绝整个包；
- `hdiutil` 需要能创建与挂载镜像的权限，受限沙箱里会以
  `hdiutil: create failed - 目录非空` 失败。

## 架构

当前只产出 arm64（Apple Silicon）。`--arch universal` 会交给
`electron-builder --mac --universal` 处理，但原生模块（`fs-ext`）需要双架构产物，
Intel 目标尚未验证；需要 Intel 版时先跑一次 universal 并检查
`@electron/universal` 的合并日志。

## 当前产物的验证边界

已发布的第一版 dmg 用 `--source <已有 fork 检出> --skip-build` 打包，
验证覆盖：打包目录结构、ad-hoc 签名（含镜像内复核）、`hdiutil` 产出、
安装脚本在普通 APFS 路径上的复制与验签、以及在组合后的 home 上跑通
`scripts/verify.mjs` 与 `pnpm install`。**未覆盖**：从零 clone 的
`yarn install --immutable` 与 `prepare:electron-native` 全量构建，
以及 `--arch universal`。首次走完整构建路径时请留意这两项。

## 版本与渠道

`manifest.json` 的 `desktop` 段记录 fork 仓库、`ref`、上游应用版本与 DSH 运行时版本。
fork 的两个渠道由它自己的 `upstream.json` 决定：`stable` 用 `@deepseek-ai/dsh` 0.1.5-rc.2，
`beta` 用 0.1.6-alpha.1，`activeChannel` 决定子模块 checkout。
发布新 dmg 的流程：

1. `node scripts/vendor.mjs --check` 确认插件 pin 没有漂移；
2. `./build-dmg.sh --ref <新的 fork revision>`；
3. 更新 `manifest.json` 的 `desktop.commit` / `appVersion` / `runtimeVersion`；
4. 提交并把 dmg 与 sha256 上传到 Release。

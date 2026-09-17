# 安装

## 1. 准备工具

```bash
node -v      # 需要 ≥ 24
npm -v
pnpm -v      # 没有就 npm i -g pnpm
```

## 2. 安装桌面应用

从 Release 下载 `DSH-Desktop-<版本>-arm64.dmg`，然后：

```bash
./setup.sh --app ~/Downloads/DSH-Desktop-2.0.10-arm64.dmg
```

脚本会挂载 dmg、用 `ditto` 把 `DSH Desktop.app` 复制进 `/Applications`
（写入 `/Applications` 需要权限）、校验签名并清掉 quarantine 标记。

手工安装等价于：打开 dmg，把 `DSH Desktop.app` 拖进 `/Applications`。

### 首次打开的放行

应用是 ad-hoc 签名、未公证，macOS 会拦一次：

1. 在“应用程序”里右键 `DSH Desktop` → “打开” → 在对话框里再点“打开”；
2. 如果只看到“已损坏”或没有“打开”按钮，去“系统设置 → 隐私与安全性”，
   在安全一栏点“仍要打开”；
3. 仍然被拦时执行 `xattr -dr com.apple.quarantine "/Applications/DSH Desktop.app"` 后重试。

Apple Silicon 之外或需要 Intel 版时，用 `./build-dmg.sh` 自行编译，见 [build.md](build.md)。

## 3. 装配插件

```bash
git clone https://github.com/hzxwonder/dsh-desktop-bundle.git
cd dsh-desktop-bundle
./setup.sh
```

已装好应用时不需要再传 `--app`。脚本会：

1. 检查 node / npm / pnpm 版本；
2. 找到 `/Applications/DSH Desktop.app`，读取它的 DSH 运行时版本；
3. 在每个 `vendor/<插件>` 里 `npm install`（已装过则跳过）；
4. 写 `~/.dsh-desktop/profiles/desktop/{package.json,pnpm-workspace.yaml,cordis.patch.yml}`；
5. 在该 profile 里 `pnpm install`（`nodeLinker: hoisted`，与桌面壳的解析方式一致）；
6. 写启动器状态（`data-directory/state.json` 指向该 home、按 profile 记录 Setup 完成、
   首次写入固定端口的 `settings.yaml`）；
7. 跑 `scripts/verify.mjs`。

装到别的 home 或 profile 名：

```bash
./setup.sh --home ~/dsh-lab --profile desktop --skip-register
```

`--skip-register` 适合只想装配、不想改动启动器状态的场合；此时应用首次启动会显示
Setup Wizard，选好数据目录后即可使用。

## 4. 启动与自检

启动 DSH Desktop，确认：

- 侧边栏出现终端面板开关与文件树；
- 命令目录里有 `/ssh`、`/workflow`、`/desktop-suite`、`/desktop-workbench`；
- 工作流面板能打开（`工作流` 树在工作区列表上方）。

命令行自检：

```bash
node scripts/verify.mjs --home ~/.dsh-desktop --app "/Applications/DSH Desktop.app"
lsof -nP -iTCP:43189 -sTCP:LISTEN      # 换成 settings.yaml 里的端口
tail -20 ~/Library/Application\ Support/DSH\ Desktop/logs/host/dsh-$(date +%F).log
```

## 5. 留给使用者的配置

仓库不含任何个人配置，以下在应用里自行设置：

- **模型 provider 与凭据**：设置 → 模型，密钥写进官方凭据服务；
- **SSH 连接**：SSH 插件的设置页添加连接，远程终端与远程文件树都基于它；
- **工作区**：选择本地目录或 SSH 工作区，会话与终端跟随所选工作区；
- **浏览器插件**：默认用无头 Chrome，`cordis.patch.yml` 里带的是 `setup.sh` 探测到的路径；
  没有 Chrome 时执行 `cd vendor/dsh-plugin-browser && npm run browser:install`，
  或把 `DSH_CHROME_EXECUTABLE` 指向本机浏览器后重跑 `./setup.sh`。

## 已知边界

- 只支持 macOS arm64；Intel 与 Windows 需要自行编译壳。
- 插件依赖从 npm registry 拉取，离线环境需要先准备 registry 或缓存。
- 端口由 home 路径派生；同一台机器上两个 home 端口不同，
  因此同一份界面状态不会在两个 home 间串用。

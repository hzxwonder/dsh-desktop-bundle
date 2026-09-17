# DSH Desktop 插件集管理

`dsh-desktop-suite` 是基于 [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) 仓库的插件，按该仓库的插件规范编写：只使用宿主公开的 `desktopProfiles` 与 `desktopPnpm` 两个 Host service，在 Desktop 自己的 profile 与包管理路径上维护一组固定的 DeepSeek Harness 插件。

Web 端的对应仓库是 [`dsh-plugin-suite`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-suite)。Web 端由该仓库的 `bin/manage.mjs` 直接准备 profile 清单并运行 pnpm，桌面端不重复这套动作：它把同一组成员交给 Desktop 的包服务，profile 归属由 `desktopProfiles.current` 决定，清单与 `dsh.profile.bundles` 收敛由打包的 `dsh plugin` CLI 负责。

这是一个 Desktop 专用插件：两个 service 都是必需注入，插件在普通 `dsh web` 宿主里保持 pending，不会以半可用状态加载。

## 使用

```sh
# 在 DSH Desktop 的终端里安装到活动 profile，然后重启 Desktop
dsh plugin --profile desktop add github:hzxwonder-dsh-plugins/dsh-desktop-suite
```

重启后有两种入口，动作完全一致：

- 会话内斜杠命令：`/desktop-suite status`、`/desktop-suite install`、`/desktop-suite update`；
- agent 工具 `desktop_suite`，参数 `action` 为 `status`、`install` 或 `update`。

`status` 只读：列出活动 profile 的名称与目录、每个成员的声明目标（`declaredSpec`）、已安装版本、是否进入 `dsh.profile.bundles`，以及是否有包操作正在进行。`install` 只添加 profile 尚未声明的成员，`update` 只重新解析已经声明的成员；两者都会用打包的 `dsh plugin` CLI 执行一次操作，并在结束后重新读取 profile，把实际结果作为 `verified` 返回，而不是复述包管理器的输出。

## 与 Web 端的差异

| 方面 | Web 端 `dsh-plugin-suite` | 桌面端 `dsh-desktop-suite` |
| --- | --- | --- |
| 入口 | `npm run suite -- install\|update --profile-dir <绝对路径> --source-dir <绝对路径>` | `/desktop-suite …` 与 `desktop_suite` 工具 |
| profile 定位 | 调用方给出绝对路径 | `desktopProfiles.current`，不接受其他来源 |
| 包操作 | 自己写 profile 清单，再执行一次 `pnpm install` | `desktopPnpm.runPlugin()`，由打包的 `dsh plugin` 完成清单与 bundle 收敛 |
| 成员来源 | 源码目录里七个同级仓库 | 配置的成员清单，默认同六个插件；成员名即安装目标白名单 |
| 并发 | 无约束 | 每代只允许一个包操作，第二个调用同步拒绝 |

## 配置

profile 的 patch 层可以覆盖以下字段：

```yaml
- id: dsh-desktop-suite
  config:
    members: [dsh-plugin-terminal, dsh-plugin-sidebar]
    specs:
      dsh-plugin-terminal: github:hzxwonder-dsh-plugins/dsh-plugin-terminal#v0.5.0
    timeoutMs: 600000
    maxOutputChars: 16384
```

`members` 必须是合法包名且不重复；`specs` 只能为 `members` 里的包名给出安装目标，未给出的成员使用 `github:hzxwonder-dsh-plugins/<name>`。`timeoutMs` 是单次操作的截止时间，`maxOutputChars` 是每条输出流保留的尾部字符数。

## 安全边界

- 只读会话不能执行 `install` 与 `update`；其他会话、以及带 agent 的命令调用需要 approval 确认；完全访问模式与用户直接输入的命令本身已是显式动作。
- 安装目标只能来自 `members` 白名单，模型无法借这个插件安装任意包。
- 只读取活动 profile 的清单与 `node_modules`，不修改 profile 文件；所有写操作都发生在 Desktop 的包服务里。
- 同一代同时只允许一个包操作，插件卸载时先取消当前操作并等待其子进程树退出。
- stdout 与 stderr 都会持续读取，但只保留有界的尾部，避免长时间操作占满内存。

## 验证

```sh
npm test
```

11 项单元测试覆盖：配置校验、profile 清单读取、动作规划、工具与命令注册、approval 与只读拒绝、非零退出与终止信号与 spawn 失败的区分、并发拒绝、卸载取消与等待、结果渲染，以及 bundle patch 与 `dsh.bundle.patch` 落点。桌面实例上的安装与更新路径需要在 DSH Desktop 内实测，验证方式见 [`docs/desktop-contract.md`](docs/desktop-contract.md)。

## 许可证

LGPL-3.0-only。

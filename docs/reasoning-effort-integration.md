# Better Reasoning Effort 集成验收

日期：2026-09-19。

## 固定组成

- 插件：`dsh-better-reasoning-effort@0.3.10`
- 上游：<https://github.com/HaoyueQin/dsh-better-reasoning-effort>
- Commit：`1d951a7a436dd4780aa038fb34e27c3af4d8f156`，对应 `v0.3.10`
- 许可证：MIT，保留于插件目录
- Bundle 运行时：DeepSeek Harness `0.1.5-rc.2`

插件源码位于 `vendor/dsh-better-reasoning-effort/`，通过 `manifest.json` 加入默认 bundle 列表。安装时 `npm install` 的 prepare 阶段构建 Host 与前端入口；profile 使用固定源码的本地依赖。已有 profile 按装配脚本的保留规则处理，更新时需将该插件纳入其依赖和 bundle 列表。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| npm ci / prepare 构建 | 通过，Host、Client、类型声明均生成 |
| npm run typecheck | 通过 |
| npm test -- --maxWorkers=1 | 18 个测试文件、325 项测试通过 |
| 滑块键盘用例复核 | 单独执行 5/5 通过；默认并行全量首轮出现 1 项异步初始化时序失败，串行全量通过 |
| 临时 profile 依赖安装 | pnpm install 通过 |
| compose-profile 与 verify | 14/14 插件解析通过，0 warning |
| 插件 Host 与前端入口 | 均可解析，Host 动态导入提供 apply 函数 |
| 上游版本固定 | vendor --check 显示 in sync |
| 发布范围检查 | 保留上游源码、许可证和公开演示素材；不包含本机配置、凭据及依赖安装目录 |

本轮验证对象为仓库装配与插件入口。当前 Desktop 已安装的同版本插件保持原配置；本轮未重装用户 profile，也未将临时 profile 的静态检查标记为新 Desktop 实例的交互验收。

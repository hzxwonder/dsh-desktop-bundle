import { mkdir, writeFile, readFile, lstat, rename } from "node:fs/promises";
import { join } from "node:path";

export const PAPER_AGENTS = `# 论文工作区

你正在论文工作台中协助用户完善当前论文。

## 写作与审阅

结合 abstract、section 和段落上下文修改文字，保持术语、论证与引用一致。保留 LaTeX 命令及数学表达式的语义。
审阅意见涉及多处时逐项核对原文，明确修改范围；事实、实验数据和参考文献需要有可核查依据。
修改完成后说明修改内容及验证结果；需要验证排版时使用项目配置的本地编译工具。

## Git 与 Overleaf 同步

开始操作前，先检查当前工作目录是否位于 Git 工作树中。
如果是 Git 仓库，每次完成一轮论文文件修改后，都需要将本轮论文修改提交并 push 到对应的 Overleaf 仓库。
先核实 Git 工作树根目录、当前分支和 remote；确认远端确实属于当前论文的 Overleaf 项目。不能仅凭 remote 名称为 origin 就认定它是 Overleaf。
提交前检查差异，只纳入本轮论文相关修改，保留用户已有的其他修改。普通 push 后检查结果，只有成功才报告已同步。
如果不是 Git 仓库，正常完成本地论文编辑并说明尚未配置 Git 同步。如果缺少 Overleaf remote、存在多个不明确的目标、凭据缺失、远端领先或合并冲突，保留本地成果并说明具体阻碍，请用户补充必要信息。
不强制推送，不重写远端历史，不擅自创建或更换 remote，不推送到未经确认的其他仓库。不要在回复、日志或提交中泄露访问令牌、密码或含凭据的远端 URL。`;

export async function loadPaperInstructions(directory, projects = []) {
  const folder = join(directory, "instructions");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const file = join(folder, "AGENTS.md");
  try {
    await writeFile(file, PAPER_AGENTS + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024)
    throw new Error("论文工作台内部指令文件无效");
  const text = await readFile(file, "utf8");
  // Archive the exact template produced by the project-file migration.
  for (const project of projects) {
    const source = join(project.root, "AGENTS.md");
    try {
      const entry = await lstat(source);
      if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 128 * 1024) continue;
      if (await readFile(source, "utf8") !== PAPER_AGENTS + "\n") continue;
      const archive = join(folder, "project-template-backups", project.id);
      await mkdir(archive, { recursive: true, mode: 0o700 });
      await rename(source, join(archive, "AGENTS.md"));
    } catch (error) {
      if (!["ENOENT", "EACCES", "EPERM", "EXDEV"].includes(error.code)) throw error;
    }
  }
  return text;
}

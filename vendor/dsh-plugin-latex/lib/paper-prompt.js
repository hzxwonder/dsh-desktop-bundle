import { mkdir, writeFile, readFile, lstat, rename } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const PAPER_AGENTS = `# 论文工作区

你正在论文工作台中协助用户完善当前论文。

## 写作与审阅

结合 abstract、section 和段落上下文修改文字，保持术语、论证与引用一致。保留 LaTeX 命令及数学表达式的语义。
审阅意见涉及多处时逐项核对原文，明确修改范围；事实、实验数据和参考文献需要有可核查依据。
修改完成后说明修改内容及验证结果；需要验证排版时使用项目配置的本地编译工具。

## 修改审阅与 Overleaf 同步

开始操作前检查当前目录与 Git 状态。所有 Agent 产生的文件修改（包括导图注释）由工作台记录为待审阅修改。修改完成后说明文件与验证结果，等待用户在界面接受或拒绝；不要自行执行 git commit、git push、pull、reset 或修改 Git 配置。只有全部修改处理完毕后，工作台才负责保存、编译并使用系统凭证同步绑定的 Overleaf 项目。
不要读取、打印或索取 Overleaf token，不要把凭证写入文件或 Git remote。同步失败时读取工作台日志并向用户解释冲突文件与原因，保留原文和远端历史。`;

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
  let text = await readFile(file, "utf8");
  if (createHash("sha256").update(text.trimEnd()).digest("hex") === "82f4495b10c5a3b251bd5d0201f04b9e6bf7edfedf0ef49c8215e2c07e60b845") {
    await writeFile(join(folder, "AGENTS.backup.md"), text, {mode:0o600});
    const temporary = file + "." + randomUUID() + ".tmp";
    text = PAPER_AGENTS + "\n";
    await writeFile(temporary, text, {mode:0o600,flag:"wx"});
    await rename(temporary,file);
  }
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

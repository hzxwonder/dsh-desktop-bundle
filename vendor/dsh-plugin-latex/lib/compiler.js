import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  mkdtemp,
  rm,
  stat,
} from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { inside, fail, digest } from "./store.js";
const paths = [
  "/Library/TeX/texbin",
  "/usr/local/texlive/bin/universal-darwin",
  "/usr/local/bin",
  "/usr/bin",
];
export function run(command, args, { cwd, signal, timeout = 120000, onOutput } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        PATH: [...paths, process.env.PATH].join(":"),
        openin_any: "p",
        openout_any: "p",
        shell_escape: "f",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "",
      reason;
    const stop = (why) => {
      reason = why;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {}
    };
    const timer = setTimeout(() => stop("编译超时"), timeout);
    const cancel = () => stop("编译已取消");
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    const collect = (data) => {
      const text = data.toString();
      output += text;
      if (output.length > 200000) output = output.slice(-200000);
      onOutput?.(text);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    };
    child.on("error", (e) => {
      cleanup();
      reject(
        new Error(
          e.code === "ENOENT"
            ? "未检测到 LaTeX 工具，请安装 TeX Live 或 MacTeX"
            : e.message,
        ),
      );
    });
    child.on("close", (code) => {
      cleanup();
      resolve({ code, output, reason });
    });
  });
}
export async function compile(store, id, signal, onProgress = () => {}) {
  const p = store.get(id),
    files = await store.listFiles(id);
  if (!files.some((f) => f.name === p.main)) fail("请选择存在的主文件");
  const dir = await mkdtemp(join(tmpdir(), "dsh-latex-"));
  let total = 0;
  const versions = {};
  try {
    onProgress("正在准备项目文件");
    for (const f of files) {
      const src = await inside(p.root, f.name);
      const info = await stat(src);
      total += info.size;
      if (total > 100 * 1024 * 1024) fail("编译项目超过 100 MB");
      if (
        /\.(?:pdf|tex|bib|sty|cls|bst|png|jpg|jpeg|eps|csv|txt|dat)$/i.test(
          f.name,
        )
      ) {
        const bytes = await readFile(src);
        versions[f.name] = digest(bytes);
        const target = join(dir, f.name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
      }
    }
    const main = p.main,
      engine = p.engine;
    const flag = {
      pdflatex: "-pdf",
      xelatex: "-xelatex",
      lualatex: "-lualatex",
    }[engine];
    onProgress(`正在运行 ${engine}，等待 LaTeX 检查依赖`);
    let pendingOutput = "";
    const result = await run(
      "latexmk",
      [
        flag,
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        "-no-shell-escape",
        main,
      ],
      {
        cwd: dir,
        signal,
        onOutput(chunk) {
          pendingOutput += chunk.replace(/\r/g, "\n");
          const lines = pendingOutput.split("\n");
          pendingOutput = lines.pop() || "";
          for (const raw of lines) {
            const line = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
            if (!line) continue;
            const stage = line.match(/(?:applying rule|Rule)\s+['\"]?([^'\"]+)|Run number\s+(\d+)|Output written on\s+(.+)|LaTeX Warning:\s*(.+)/i);
            if (stage) {
              onProgress(stage[3] ? `正在生成 PDF：${stage[3]}` : stage[4] ? `正在检查引用：${stage[4]}` : stage[2] ? `LaTeX 第 ${stage[2]} 轮排版` : `正在执行：${stage[1]}`);
            }
          }
        },
      },
    );
    const log = result.output
      .replaceAll(dir, "<build>")
      .replaceAll(p.root, "<paper>");
    if (result.reason || result.code !== 0)
      return { ok: false, log, error: result.reason || "编译失败，请查看日志" };
    const pdfPath = join(dir, basename(main, ".tex") + ".pdf");
    const pdf = await readFile(pdfPath);
    if (pdf.length > 30 * 1024 * 1024) fail("PDF 超过 30 MB");
    const target = join(store.directory, "pdf", id + ".pdf");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, pdf);
    let stale = false;
    for (const [name, hash] of Object.entries(versions)) {
      try {
        if (digest(await readFile(await inside(p.root, name))) !== hash)
          stale = true;
      } catch {
        stale = true;
      }
    }
    return {
      ok: true,
      pdf: pdf.toString("base64"),
      hash: digest(pdf),
      stale,
      log,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

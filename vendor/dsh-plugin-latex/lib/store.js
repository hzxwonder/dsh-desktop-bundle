import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  realpath,
  lstat,
  open,
  unlink,
} from "node:fs/promises";
import {
  join,
  resolve,
  relative,
  isAbsolute,
  dirname,
  extname,
} from "node:path";
import { createHash, randomUUID } from "node:crypto";
export const digest = (text) => createHash("sha256").update(text).digest("hex");
export function fail(message, code = "INVALID_REQUEST") {
  throw Object.assign(new Error(message), { code });
}
export function fileName(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 512 ||
    isAbsolute(value) ||
    /[\\\x00-\x1f]/.test(value) ||
    value
      .split("/")
      .some((x) => !x || x === "." || x === ".." || x.startsWith("."))
  )
    fail("请输入项目内的有效文件路径");
  return value;
}
export async function inside(root, name, creating = false) {
  name = fileName(name);
  const path = resolve(root, name);
  let parent = root;
  for (const segment of name.split("/").slice(0, -1)) {
    parent = join(parent, segment);
    if (creating) await mkdir(parent, { recursive: true });
    const st = await lstat(parent);
    if (st.isSymbolicLink() || !st.isDirectory())
      fail("文件路径包含符号链接或无效目录");
  }
  try {
    if ((await lstat(path)).isSymbolicLink()) fail("文件路径包含符号链接");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const actual = await realpath(dirname(path));
  if (
    relative(root, actual).startsWith("..") ||
    isAbsolute(relative(root, actual))
  )
    fail("文件超出论文项目");
  return path;
}
export const editable = (name) =>
  [".tex", ".bib", ".sty", ".cls", ".bst", ".txt", ".md", ".csv"].includes(
    extname(name).toLowerCase(),
  );
async function atomic(path, value) {
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temp, value, { mode: 0o600 });
    await rename(temp, path);
  } finally {
    await unlink(temp).catch(() => {});
  }
}
export class Store {
  constructor(directory) {
    this.directory = directory;
    this.projects = [];
    this.queue = Promise.resolve();
  }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      this.projects = JSON.parse(
        await readFile(join(this.directory, "projects.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    return this;
  }
  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }
  async persist() {
    await atomic(
      join(this.directory, "projects.json"),
      JSON.stringify(this.projects, null, 2),
    );
  }
  get(id) {
    const p = this.projects.find((p) => p.id === id);
    if (!p) fail("论文项目不存在", "NOT_FOUND");
    return p;
  }
  async add({ name, path }) {
    return this.serial(async () => {
      if (typeof name !== "string" || !name.trim() || name.length > 120)
        fail("请填写论文名称");
      const id = randomUUID();
      let root;
      if (path) {
        if (!isAbsolute(path)) fail("请选择本地绝对目录");
        root = await realpath(path);
        if (!(await lstat(root)).isDirectory()) fail("请选择目录");
        if (this.projects.some((p) => p.root === root))
          return this.projects.find((p) => p.root === root);
      } else {
        root = join(this.directory, "papers", id);
        await mkdir(root, { recursive: true });
        await writeFile(
          join(root, "main.tex"),
          String.raw`\documentclass{article}
\usepackage{amsmath,graphicx}
\title{Research Paper}
\author{}
\begin{document}
\maketitle
\begin{abstract}
Describe the research question and the central contribution.
\end{abstract}
\section{Introduction}
Introduce the problem, the evidence, and the research direction.

Explain the limitations of existing approaches.
\section{Method}
Describe the proposed method.
\section{Evaluation}
Define the experimental protocol and report verified results.
\section{Limitations}
State the scope and limitations.
\end{document}
`,
        );
      }
      root = await realpath(root);
      const p = {
        id,
        name: name.trim(),
        root,
        main: "main.tex",
        engine: "pdflatex",
        revision: 0,
        reviews: [],
        chats: [],
        lastChat: null,
        snapshot: null,
      };
      this.projects.push(p);
      await this.persist();
      return p;
    });
  }
  async listFiles(id) {
    const p = this.get(id),
      files = [];
    let count = 0;
    const walk = async (dir, prefix = "") => {
      for (const ent of await readdir(dir, { withFileTypes: true })) {
        if (
          ent.name.startsWith(".") ||
          ["node_modules", "build", "dist"].includes(ent.name)
        )
          continue;
        if (++count > 3000) fail("项目文件过多，请选择论文子目录");
        const name = prefix + ent.name;
        if (ent.isSymbolicLink()) continue;
        if (ent.isDirectory()) await walk(join(dir, ent.name), name + "/");
        else if (ent.isFile()) files.push({ name, editable: editable(name) });
      }
    };
    await walk(p.root);
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }
  async read(id, name) {
    const p = this.get(id);
    if (!editable(name)) fail("此文件可用于编译，请使用对应应用编辑");
    const path = await inside(p.root, name),
      s = await lstat(path);
    if (s.size > 2 * 1024 * 1024) fail("文本文件超过 2 MB");
    const content = await readFile(path, "utf8");
    return { name, content, hash: digest(content) };
  }
  async save(id, name, content, expectedHash) {
    return this.serial(async () => {
      if (
        typeof content !== "string" ||
        Buffer.byteLength(content) > 2 * 1024 * 1024 ||
        !editable(name)
      )
        fail("文件格式或大小不支持");
      const before = await this.read(id, name);
      if (before.hash !== expectedHash)
        fail("文件已被 Agent 或其他编辑器修改，请重新读取并合并", "CONFLICT");
      const p = this.get(id),
        path = await inside(p.root, name);
      await atomic(path, content);
      p.revision++;
      await this.persist();
      return { name, content, hash: digest(content) };
    });
  }
  async createFile(id, name) {
    return this.serial(async () => {
      if (!editable(name))
        fail("请创建 tex、bib、sty、cls、bst、txt、md 或 csv 文件");
      const p = this.get(id),
        path = await inside(p.root, name, true);
      const fd = await open(path, "wx", 0o600).catch((e) => {
        if (e.code === "EEXIST") fail("已存在同名文件", "CONFLICT");
        throw e;
      });
      await fd.close();
      p.revision++;
      await this.persist();
      return { name, content: "", hash: digest("") };
    });
  }
  async update(id, patch) {
    return this.serial(async () => {
      const p = this.get(id);
      if (patch.main !== undefined) {
        fileName(patch.main);
        if (!patch.main.endsWith(".tex")) fail("主文件必须是 .tex");
        p.main = patch.main;
      }
      if (patch.engine !== undefined) {
        if (!["pdflatex", "xelatex", "lualatex"].includes(patch.engine))
          fail("不支持该编译器");
        p.engine = patch.engine;
      }
      if (patch.reviews !== undefined) {
        if (!Array.isArray(patch.reviews) || patch.reviews.length > 1000)
          fail("审阅数量超限");
        for (const r of patch.reviews) {
          fileName(r.file);
          if (
            typeof r.id !== "string" ||
            typeof r.text !== "string" ||
            !Array.isArray(r.messages) ||
            r.messages.some((x) => typeof x !== "string") ||
            !Number.isInteger(r.start) ||
            !Number.isInteger(r.end) ||
            r.start < 0 ||
            r.end < r.start
          )
            fail("审阅格式不正确");
        }
        p.reviews = patch.reviews;
      }
      if (patch.chat) {
        if (
          typeof patch.chat.id !== "string" ||
          typeof patch.chat.title !== "string"
        )
          fail("会话格式不正确");
        if (!p.chats.some((c) => c.id === patch.chat.id))
          p.chats.push(patch.chat);
        p.lastChat = patch.chat.id;
      }
      if (patch.lastChat) {
        if (!p.chats.some((c) => c.id === patch.lastChat))
          fail("会话不属于当前论文");
        p.lastChat = patch.lastChat;
      }
      await this.persist();
      return p;
    });
  }
}

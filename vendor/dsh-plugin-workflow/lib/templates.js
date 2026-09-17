const agent = (id, name, prompt, source, y) => ({
  id,
  name,
  kind: "agent",
  prompt,
  input: { material: source },
  tools: [],
  skills: [],
  effects: "read-only",
  timeoutSeconds: 600,
  maxAttempts: 1,
  position: { x: 100, y },
});
export function paperTemplate(id = "paper-reader") {
  const nodes = [
    {
      id: "material",
      name: "论文材料",
      kind: "interact",
      interaction: "once",
      prompt: "请提供论文 PDF 附件或论文链接。",
      // A run started from a message that already carried the paper reads it
      // directly instead of asking for it again.
      provided: { source: "workflow", path: "/attachments" },
      input: { material: { source: "workflow", path: "/text" } },
      position: { x: 100, y: 0 },
    },
    agent(
      "evidence",
      "原文与证据",
      "阅读论文材料，提取研究问题、方法、实验条件、数据、结论和局限。每项标注原文页码或章节。材料缺失时明确指出。保留图片/图表引用。区分作者报告与独立验证。",
      { source: "node", nodeId: "material", path: "/text" },
      160,
    ),
    agent(
      "explain",
      "概念与方法",
      "面向初学者解释术语、研究问题与方法，按因果关系逐步展开，用具体例子说明，保留证据来源。",
      { source: "node", nodeId: "evidence", path: "/text" },
      320,
    ),
    agent(
      "article",
      "生成解读文章",
      "生成中文 Markdown 论文解读，包含标题、研究问题、背景概念、方法详解、实验与证据、适用边界、问答及原文引用。以编者对读者口吻写作。不得虚构图片和引用。",
      { source: "node", nodeId: "explain", path: "/text" },
      480,
    ),
    agent(
      "review",
      "核验与定稿",
      "对照证据检查文章的事实、引用、概念和适用边界，修正不受证据支持的断言。只输出可交付的完整 Markdown 文章。",
      { source: "node", nodeId: "article", path: "/text" },
      640,
    ),
    {
      id: "output",
      name: "论文解读",
      kind: "artifact",
      input: { content: { source: "node", nodeId: "review", path: "/text" } },
      format: "text/markdown",
      position: { x: 100, y: 800 },
    },
  ];
  const evidence = { source: "node", nodeId: "evidence", path: "/text" };
  for (const node of nodes.filter((n) =>
    ["article", "review"].includes(n.id),
  ))
    node.input.evidence = evidence;
  return {
    schemaVersion: "1.0",
    id,
    name: "论文精读",
    description: "面向初学者的论文解读与证据核验",
    trigger: "material",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string", minLength: 1 } },
    },
    nodes,
    edges: nodes
      .slice(1)
      .map((n, i) => ({ from: nodes[i].id, to: n.id, on: "success" })),
    outputs: {
      article: { source: "node", nodeId: "output", path: "/artifact" },
    },
    limits: { concurrency: 2, maxNodeCalls: 30, timeoutSeconds: 3600 },
  };
}
export function blankTemplate(id, name = "新工作流") {
  return {
    schemaVersion: "1.0",
    id,
    name,
    trigger: "material",
    nodes: [
      agent(
        "task",
        "任务",
        "根据用户材料完成任务，并返回完整结果。",
        { source: "workflow", path: "/text" },
        0,
      ),
      {
        id: "output",
        name: "结果",
        kind: "artifact",
        input: { content: { source: "node", nodeId: "task", path: "/text" } },
        format: "text/markdown",
        position: { x: 100, y: 180 },
      },
    ],
    edges: [{ from: "task", to: "output" }],
  };
}

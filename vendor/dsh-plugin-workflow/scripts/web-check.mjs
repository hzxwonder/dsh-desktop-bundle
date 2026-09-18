import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";
import { chromium } from "../../dsh-plugin-browser/node_modules/playwright/index.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const plugin = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp("/private/tmp/dsh-workflow-check-");
const workspace = join(temporary, "workspace");
await mkdir(workspace);
const profile = join(temporary, "profiles", "workflow-check");
await mkdir(join(profile, "node_modules"), { recursive: true });
await writeFile(
  join(profile, "package.json"),
  JSON.stringify({
    name: "workflow-check",
    private: true,
    dependencies: { "dsh-plugin-workflow": `link:${plugin}` },
    dsh: {
      profile: {
        bundles: [
          "@deepseek-ai/dsh-base",
          "@deepseek-ai/dsh-web-app",
          "dsh-plugin-workflow",
        ],
        patchReload: "startup",
      },
    },
  }),
);
await writeFile(join(profile, "cordis.yml"), "[]\n");
await symlink(
  join(root, "runtime/node_modules/@deepseek-ai"),
  join(profile, "node_modules/@deepseek-ai"),
);
await symlink(plugin, join(profile, "node_modules/dsh-plugin-workflow"));
await writeFile(
  join(profile, "cordis.patch.yml"),
  `- insert:\n    - id: workflow-verification-fixture\n      name: ${JSON.stringify(join(plugin, "scripts/fixture.js"))}\n      config:\n        cwd: ${JSON.stringify(workspace)}\n`,
);
const port = Number(process.env.WORKFLOW_TEST_PORT ?? 3398);
const child = spawn(
  process.execPath,
  [
    join(root, "runtime/node_modules/@deepseek-ai/dsh/lib/bin.js"),
    "--profile",
    "workflow-check",
    "--port",
    String(port),
    "--no-open",
  ],
  {
    cwd: root,
    env: { ...process.env, DSH_HOME: temporary, DSH_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
let browser;
let browserServer;
let page;
const exited = new Promise((r) => child.once("exit", r));
const scrub = (text) => text.replace(/token=[^\s\x1b]+/g, "token=[redacted]");
const launch = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("STARTUP_TIMEOUT")), 60000);
  const collect = (data) => {
    logs = (logs + data.toString()).slice(-40000);
    const match = new RegExp(
      `http://(?:localhost|127\\.0\\.0\\.1):${port}/\\?token=[^\\s\\x1b]+`,
    ).exec(logs);
    if (match) {
      clearTimeout(timer);
      resolve(match[0]);
    }
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.once("exit", () => {
    clearTimeout(timer);
    reject(new Error("STARTUP_EXIT"));
  });
});
try {
  const url = await launch;
  browserServer = await chromium.launchServer({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  browser = await chromium.connect(browserServer.wsEndpoint());
  page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
  const errors = [];
  const networkOrigins = new Set();
  page.on("request", request => { try { networkOrigins.add(new URL(request.url()).origin); } catch {} });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => localStorage.removeItem("workflow-studio:expanded"));
  await page.reload();
  await page.waitForTimeout(2000);
  for (const name of ["继续", "稍后配置"])
    if (await page.getByRole("button", { name, exact: true }).count()) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.waitForTimeout(300);
    }
  if (await page.getByRole("dialog").count())
    await page.keyboard.press("Escape");
  const api = (path, args) =>
    page.evaluate(
      async ({ path, args }) => {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        return response.json();
      },
      { path, args },
    );
  const call = async (args) => {
    const r = await api("/api/workflow-studio", args);
    assert(r.ok, JSON.stringify(r));
    return r.value;
  };
  if (process.argv.includes("--acceptance")) {
    const { acceptance } = await import("./acceptance-scenarios.mjs");
    await acceptance({ page, call, api, plugin, errors });
    await writeFile(join(plugin, 'docs/acceptance/web/network.json'), JSON.stringify({ origins: [...networkOrigins] }, null, 2));
  } else if (process.argv.includes("--interactive")) {
    console.log("READY", scrub(url));
    console.log("STATE", await page.locator("body").ariaSnapshot());
    for await (const line of createInterface({ input: process.stdin })) {
      try {
        const a = JSON.parse(line);
        if (a.kind === "done") break;
        const locator = a.selector
          ? page.locator(a.selector)
          : a.role
            ? page.getByRole(a.role, { name: a.name, exact: true })
            : null;
        if (a.kind === "click") await locator.click({ timeout: 5000 });
        if (a.kind === "hover") await locator.hover({ timeout: 5000 });
        if (a.kind === "fill") await locator.fill(a.text, { timeout: 5000 });
        if (a.kind === "press") await page.keyboard.press(a.key);
        if (a.kind === "type") await page.keyboard.type(a.text, { delay: a.delay ?? 25 });
        if (a.kind === "wait") await page.waitForTimeout(a.ms ?? 500);
        if (a.kind === "reload") { await page.reload(); await page.waitForTimeout(a.ms ?? 2500); }
        if (a.kind === "api")
          console.log(
            "API",
            await api(a.path ?? "/api/workflow-studio", a.args),
          );
        if (a.kind === "viewport")
          await page.setViewportSize({ width: a.width, height: a.height });
        if (a.kind === "screenshot") {
          await mkdir(join(plugin, "docs/screenshots"), { recursive: true });
          await page.screenshot({
            path: join(plugin, "docs/screenshots", a.name ?? "workflow.png"),
          });
        }
        if (a.kind === "eval") console.log("EVAL", await page.evaluate(a.code));
        await page.waitForTimeout(300);
        console.log("STATE", await page.locator("body").ariaSnapshot());
        console.log("ERRORS", errors);
      } catch (e) {
        console.log("ACTION_ERROR", e.message);
      }
    }
  } else {
  const openWorkflowPanel = async (scope) => {
    const entry = scope.getByRole("button", { name: "工作流", exact: true });
    if ((await entry.getAttribute("aria-expanded")) !== "true") await entry.click();
    await scope.waitForTimeout(500);
  };
    // The sidebar owns exactly one workflow entry: it toggles the main panel.
    const sidebarEntry = page.getByRole("button", { name: "工作流", exact: true });
    await sidebarEntry.waitFor({ timeout: 15000 });
    assert.equal(await sidebarEntry.getAttribute("aria-expanded"), "false");
    assert.equal(
      await page.getByRole("button", { name: "管理工作流", exact: true }).count(),
      0,
      "the sidebar keeps a single entry",
    );
    const created = await api("/api/workflow-fixture", { action: "create" });
    const sessionId = created.sessionId;
    const record = await call({ action: "read", id: "paper-reader" });
    const definition = record.snapshot.definition;
    assert.equal(definition.nodes[0].kind, "interact");
    const routed = definition.nodes.find((n) => n.kind === "agent");
    routed.provider = { mode: "explicit", id: "workflow-test" };
    routed.model = { mode: "explicit", id: "fixture-node" };
    routed.effort = { mode: "explicit", id: "high" };
    await call({ action: "save", definition, expectedRevision: 1 });
    await call({ action: "bind", id: "paper-reader", revision: 2, sessionId });
    // The paper template opens with an interaction node: the first message
    // starts the run, and the paper itself arrives as the user's next message
    // in the same conversation and continues that run.
    await api("/api/workflow-fixture", {
      action: "prompt",
      sessionId,
      text: "Synthetic request without the paper.",
    });
    let state = await call({ action: "state" });
    assert.equal(
      state.runs[0].status,
      "waiting_input",
      JSON.stringify(state.runs[0]),
    );
    assert.match(state.runs[0].pending.question, /论文 PDF/);
    const runId = state.runs[0].id;
    await api("/api/workflow-fixture", {
      action: "prompt",
      sessionId,
      text: "Synthetic research paper. Section 1: method. Section 2: evidence.",
    });
    state = await call({ action: "state" });
    assert.equal(
      state.runs[0].status,
      "completed",
      JSON.stringify(state.runs[0]),
    );
    assert.equal(state.runs[0].id, runId, "the answer continues the same run");
    assert.equal(state.runs.length, 1, "the answer starts no second run");
    assert.equal(state.runs[0].pending, null);
    const calls = (await api("/api/workflow-fixture", { action: "calls" }))
      .calls;
    assert(calls.some((c) => c.model === "fixture-node" && c.effort === "high"));
    assert(calls.some((c) => c.model === "fixture-root" && c.effort === "low"));
    await page.reload();
    await sidebarEntry.waitFor({ timeout: 15000 });
    await sidebarEntry.click();
    assert.equal(await sidebarEntry.getAttribute("aria-expanded"), "true");
    const card = page.locator('[data-workflow-card="paper-reader"]');
    await card.waitFor({ timeout: 10000 });
    assert.equal(await card.getByText("论文精读", { exact: true }).count(), 1);
    // Cards and rows render the same records; the choice is remembered.
    await page.getByRole("tab", { name: "列表", exact: true }).click();
    const row = page.locator('[data-workflow-row="paper-reader"]');
    await row.waitFor({ timeout: 5000 });
    assert.equal(await page.locator('[data-workflow-card="paper-reader"]').count(), 0);
    await page.getByRole("tab", { name: "卡片", exact: true }).click();
    await card.waitFor({ timeout: 5000 });
    // Conversations of a workflow live in the panel, with the session actions.
    await card.locator("summary").click();
    const sessionRow = card.locator(".wf-session-row").first();
    await sessionRow.waitFor({ timeout: 5000 });
    await sessionRow.locator(".wf-session-menu-trigger").click();
    for (const label of ["复制会话引用", "重命名", "分叉会话", "归档会话"])
      await page.getByRole("menuitem", { name: label, exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await sessionRow
      .locator('.wf-row-action[aria-label^="新建"]')
      .waitFor({ state: "attached" });
    // Copy forks the newest definition into a fresh, unpublished draft and opens it.
    await card.getByRole("button", { name: "拷贝", exact: true }).click();
    await page.getByLabel("工作流名称", { exact: true }).waitFor({ timeout: 10000 });
    const copied = (await call({ action: "state" })).workflows.find(
      (w) => w.name === "论文精读 副本",
    );
    assert(copied, "the copy exists");
    assert.equal(copied.published, null, "the copy starts unpublished");
    assert.equal(copied.revision, 1, "the copy starts at its own revision 1");
    assert.equal(
      await page.getByLabel("工作流名称", { exact: true }).inputValue(),
      "论文精读 副本",
    );
    assert.equal(await page.locator(".react-flow__node").count(), 6);
    await page.getByRole("button", { name: "返回工作流列表", exact: true }).click();
    await card.waitFor({ timeout: 5000 });
    assert(
      await page.locator(`[data-workflow-card="${copied.id}"]`).count(),
      "the copy shows up in the gallery",
    );
    // "创建工作流" starts the authoring conversation that drafts the definition.
    await page.getByRole("button", { name: "创建工作流", exact: true }).click();
    await page
      .locator('.wf-composer-tag[data-workflow-tag="new"]')
      .waitFor({ timeout: 10000 });
    // Workflow conversations live in their own Workspace, titled for humans
    // instead of by their directory id.
    await page.reload();
    await page
      .getByText("工作流对话", { exact: true })
      .first()
      .waitFor({ timeout: 10000 });
    await openWorkflowPanel(page);
    // The editor still owns the graph, persistence and the run surface.
    await card.getByRole("button", { name: "打开", exact: true }).click();
    await page.locator(".react-flow__node").first().waitFor();
    assert.equal(await page.locator(".react-flow__node").count(), 6);
    // The interaction step is a first-class node: its card selects, and the
    // inspector exposes the two interaction modes.
    await page.locator(".react-flow__node.wf-node-interact").click();
    await page.locator(".wf-panel-head.wf-step-interact").waitFor({ timeout: 5000 });
    const modeSelect = page.getByRole("combobox", {
      name: "交互方式",
      exact: true,
    });
    assert.equal(await modeSelect.inputValue(), "once");
    await modeSelect.selectOption("goal");
    await page
      .getByRole("spinbutton", { name: "最多回答轮次", exact: true })
      .waitFor();
    await page.waitForTimeout(300);
    await modeSelect.selectOption("once");
    await page.getByRole("button", { name: "保存版本", exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(
      (await call({ action: "read", id: "paper-reader" })).snapshot.definition
        .nodes[0].interaction,
      "once",
    );
    await page.getByLabel("工作流名称", { exact: true }).fill("论文精读验证");
    await page.getByRole("button", { name: "保存版本", exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(
      (await call({ action: "read", id: "paper-reader" })).name,
      "论文精读验证",
    );
    await mkdir(join(plugin, "docs/screenshots"), { recursive: true });
    await page.screenshot({
      path: join(plugin, "docs/screenshots/workflow-desktop.png"),
    });
    // The step panel is a first-class surface of the editor.
    for (const tab of ["预览", "控制台", "主题"])
      await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.getByRole("tab", { name: "步骤", exact: true }).click();
    await page.getByRole("tab", { name: "应用", exact: true }).click();
    await page.getByRole("button", { name: "运行记录", exact: true }).click();
    await page.getByText("已完成", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: join(plugin, "docs/screenshots/workflow-mobile.png"),
    });
    const mobileOverflow = await page.locator(".wf-main").evaluate((el) => el.scrollWidth - el.clientWidth);
    assert(mobileOverflow < 40, `mobile overflow ${mobileOverflow}px`);
    // Starting a run from the gallery titles the run Workspace after the workflow.
    await page.setViewportSize({ width: 1500, height: 980 });
    await page.getByRole("button", { name: "返回工作流列表", exact: true }).click();
    await page
      .locator('[data-workflow-card="paper-reader"]')
      .waitFor({ timeout: 10000 });
    await page
      .locator('[data-workflow-card="paper-reader"]')
      .getByRole("button", { name: "运行", exact: true })
      .click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page
      .getByText("论文精读验证", { exact: true })
      .first()
      .waitFor({ timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: native Host execution, root/node routes, single sidebar entry, workflow gallery (cards/list), panel conversations, workflow copy, authoring conversation, titled workflow Workspaces, editor persistence, interaction node modes, run history and mobile layout",
    );
  }
} catch (e) {
  console.error(e.message);
  console.error(scrub(logs).slice(-16000));
  if (page)
    console.error((await page.locator("body").ariaSnapshot()).slice(0, 10000));
  process.exitCode = 1;
} finally {
  await Promise.race([browser?.close(), new Promise(r => setTimeout(r, 2000))]);
  await browserServer?.kill();
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((r) => setTimeout(r, 4000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await exited;
  await rm(temporary, { recursive: true, force: true });
}

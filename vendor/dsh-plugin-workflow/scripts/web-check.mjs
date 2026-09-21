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
import { paperTemplate } from '../lib/templates.js';
import { reviewedPaperTemplate } from '../lib/paper-workflow.js';
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
  await page.evaluate(() => { localStorage.removeItem("workflow-studio:expanded"); localStorage.setItem("workflow-studio:editor-view","graph"); });
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
    assert.equal(record.snapshot.definition.nodes.length, 4, 'default paper workflow has four stages');
    // Retain the persisted interaction-template fixture to cover compatibility.
    const definition = paperTemplate();
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
    await api('/api/workflow-fixture', { action: 'create', sessionId: 'workflow-empty-history-check' });
    await call({ action: 'bind', id: 'paper-reader', revision: 2, sessionId: 'workflow-empty-history-check' });
    await page.reload();
    await sidebarEntry.waitFor({ timeout: 15000 });
    await sidebarEntry.click();
    assert.equal(await sidebarEntry.getAttribute("aria-expanded"), "true");
    const card = page.locator('[data-workflow-card="paper-reader"]');
    await card.waitFor({ timeout: 10000 });
    assert.equal(await card.getByText("论文精读", { exact: true }).count(), 1);
    const search = page.getByRole('textbox', {name:'搜索工作流', exact:true});
    await search.fill('不存在的工作流');
    await page.getByText('没有找到匹配的工作流，试试其他名称或关键词。', {exact:true}).waitFor();
    await page.getByRole('button',{name:'清除搜索',exact:true}).click();
    await card.waitFor();
    await page.screenshot({path:join(plugin,'docs/acceptance/web/gallery-light.png')});
    // Cards and rows render the same records; the choice is remembered.
    await page.getByRole("tab", { name: "列表", exact: true }).click();
    const row = page.locator('[data-workflow-row="paper-reader"]');
    await row.waitFor({ timeout: 5000 });
    assert.equal(await page.locator('[data-workflow-card="paper-reader"]').count(), 0);
    await page.getByRole("tab", { name: "卡片", exact: true }).click();
    await card.waitFor({ timeout: 5000 });
    // Conversations of a workflow live in the panel, with the session actions.
    await card.locator("summary").click();
    assert.equal(await card.locator('.wf-session-row').count(), 1, 'unused bindings are excluded from history');
    const sessionRow = card.locator(".wf-session-row").first();
    await sessionRow.waitFor({ timeout: 5000 });
    await sessionRow.locator(".wf-session-menu-trigger").click();
    for (const label of ["复制会话引用", "重命名", "分叉会话", "归档会话"])
      await page.getByRole("menuitem", { name: label, exact: true }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await sessionRow.locator('.wf-row-action[aria-label^="新建"]').count(), 0);
    // Selecting a conversation must reveal it, including the already-current session.
    for (let attempt = 0; attempt < 2; attempt++) {
      await sessionRow.locator('.wf-session-name').click();
      await page.waitForFunction(() => !document.querySelector('.wf-cards'));
      assert.equal(await sidebarEntry.getAttribute('aria-expanded'), 'false');
      await page.locator('.wf-timeline').waitFor({ state: 'visible', timeout: 10000 });
      if (!(await page.locator('.wf-root-conversation').evaluate(el => el.open))) await page.locator('.wf-root-conversation summary').click();
      await page.locator('.wf-root-conversation').getByText('Synthetic request without the paper.', { exact: false }).first().waitFor({ state: 'visible' });
      assert.equal((await call({ action: 'state' })).runs[0].sessionId, sessionId);
      if (attempt === 0) {
        const composer = page.getByRole('textbox', { name: '发消息或创建任务, / 调用指令, @ 文件或对话', exact: true });
        await composer.fill('Continue the original history: explain the evidence.');
        await page.getByRole('button', { name: '发送消息', exact: true }).click();
      }
      await page.locator('.wf-root-conversation').getByText('Continue the original history: explain the evidence.', {exact:false}).first().waitFor({state:'visible'});
      const continued = await call({action:'state'});
      assert.equal(continued.runs.length, 1, 'continuing history does not create a new workflow run');
      assert.equal(continued.runs[0].id, runId);
      await page.getByRole('button',{name:'停止生成',exact:true}).waitFor({state:'hidden'});
      await page.locator('.wf-root-conversation').getByText('Continue the original history: explain the evidence.', {exact:false}).first().evaluate(el => el.scrollIntoView({block:'center'}));
      await page.screenshot({path: join(plugin, 'docs/acceptance/web/history-continuation.png')});
      if (attempt === 0) await page.reload();
      await openWorkflowPanel(page);
      await card.waitFor();
      if (!(await card.locator('details').evaluate(el => el.open))) await card.locator('summary').click();
    }
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
    // Expanding one card leaves neighboring cards compact and actions near metadata.
    if (!(await card.locator('details').evaluate(el => el.open))) await card.locator('summary').click();
    const neighbor = page.locator(`[data-workflow-card="${copied.id}"]`);
    const neighborBefore = await neighbor.boundingBox();
    await card.locator('summary').click();
    const neighborAfter = await neighbor.boundingBox();
    assert(Math.abs(neighborBefore.height - neighborAfter.height) < 1, 'neighbor height stays independent');
    assert.equal(await page.locator('.wf-cards').evaluate(el => getComputedStyle(el).alignItems), 'start');
    await page.getByRole('tab', { name: '列表', exact: true }).click();
    await row.locator('.wf-link[aria-expanded]').click();
    await page.locator('.wf-detail-row .wf-session-name').first().click();
    await page.waitForFunction(() => !document.querySelector('.wf-table'));
    await page.locator('.wf-timeline').waitFor({ state: 'visible', timeout: 10000 });
    await openWorkflowPanel(page);
    await page.getByRole('tab', { name: '卡片', exact: true }).click();
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
    await page.getByRole("tab", { name: "运行记录", exact: true }).click();
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
    await call({ action: 'save', definition: reviewedPaperTemplate('reviewed-paper-ui'), expectedRevision: 0 });
    await sidebarEntry.click();
    const reviewedCard = page.locator('[data-workflow-card="reviewed-paper-ui"]');
    await reviewedCard.getByRole('button', { name: '打开', exact: true }).click();
    await page.getByRole('tab',{name:'步骤列表',exact:true}).click();
    await page.getByRole('region',{name:'工作流步骤列表',exact:true}).waitFor();
    assert.equal(await page.locator('.wf-outline-step').count(),4);
    await page.getByRole('toolbar',{name:'添加步骤',exact:true}).getByRole('button',{name:'用户输入',exact:true}).click();
    assert.equal(await page.locator('.wf-outline-step').count(),5);
    await page.getByRole('button',{name:'删除节点',exact:true}).click();
    assert.equal(await page.locator('.wf-outline-step').count(),4);
    await page.locator('.wf-editor-notice').getByRole('button',{name:'撤销',exact:true}).click();
    assert.equal(await page.locator('.wf-outline-step').count(),5);
    await page.getByRole('button',{name:'删除步骤 用户输入',exact:true}).click();
    assert.equal(await page.locator('.wf-outline-step').count(),4);
    await page.getByRole('toolbar',{name:'添加步骤',exact:true}).getByRole('button',{name:'用户输入',exact:true}).click();
    await page.locator('.wf-outline-step').last().focus();
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('.wf-outline-step').count(),4);


    await page.locator('.wf-outline-step').nth(2).click();
    assert.equal(await page.getByLabel('步骤说明',{exact:true}).textContent(),reviewedPaperTemplate('reviewed-paper-ui').nodes[2].prompt);
    const promptEditor = page.getByLabel('步骤说明',{exact:true});
    const originalPrompt = await promptEditor.textContent();
    await promptEditor.fill(originalPrompt + ' 保留草稿检查。');
    await page.getByRole('tab',{name:'流程图',exact:true}).click();
    await page.getByRole('tab',{name:'步骤列表',exact:true}).click();
    assert.equal(await promptEditor.textContent(), originalPrompt + ' 保留草稿检查。');
    await promptEditor.fill(originalPrompt);
    await page.screenshot({path:join(plugin,'docs/screenshots/desktop-step-list.png')});
    await page.locator('.wf-outline-step').nth(1).click();
    const inputWidthBefore = await page.getByLabel('步骤说明',{exact:true}).evaluate(el=>el.getBoundingClientRect().width);
    await page.locator('.wf-settings-group').filter({hasText:'技能与工具'}).locator('summary').click();
    const inputWidthAfter = await page.getByLabel('步骤说明',{exact:true}).evaluate(el=>el.getBoundingClientRect().width);
    assert(Math.abs(inputWidthBefore-inputWidthAfter)<1, `expanding settings changes prompt width: ${inputWidthBefore} -> ${inputWidthAfter}`);

    await page.getByRole('button',{name:'编辑 paper-explainer',exact:true}).click();
    const skillContent=page.getByRole('textbox',{name:'Skill 内容',exact:true});
    await skillContent.fill('Use an accessible example and preserve citations.');
    await page.getByRole('button',{name:'应用到步骤',exact:true}).click();
    await page.getByRole('button',{name:'保存版本',exact:true}).click();
    await page.waitForTimeout(500);
    assert.equal((await call({action:'read',id:'reviewed-paper-ui'})).snapshot.definition.nodes[1].skillOverrides['paper-explainer'],'Use an accessible example and preserve citations.');
    await page.getByRole('tab',{name:'流程图',exact:true}).click();
    await page.locator('.wf-edge-loop').waitFor({state:'attached'});
    assert.equal(await page.locator('.wf-edge-loop').count(),1);
    await page.getByRole('toolbar',{name:'添加步骤',exact:true}).waitFor();
    assert.equal(await page.locator('.wf-addbar > button').count(),5);
    await page.getByRole('button',{name:'更多步骤',exact:true}).click();
    const pickerSpacing = await page.locator('.wf-step-picker').evaluate(el => {
      const a=el.getBoundingClientRect(), b=el.closest('dialog').getBoundingClientRect();
      return {left:a.left-b.left,right:b.right-a.right,bottom:b.bottom-a.bottom};
    });
    assert.ok(pickerSpacing.left >= 16 && pickerSpacing.right >= 16 && pickerSpacing.bottom >= 16);
    await page.screenshot({path:join(plugin,'docs/screenshots/step-picker-spacing.png')});
    for (const name of ['工具','条件','循环','子工作流','发布']) await page.getByRole('menuitem',{name,exact:true}).waitFor();
    await page.getByRole('menuitem',{name:'工具',exact:true}).click();
    assert.equal(await page.locator('.react-flow__node').count(),5);
    await page.locator('.wf-canvas-tools').getByRole('button',{name:'撤销',exact:true}).click();
    assert.equal(await page.locator('.react-flow__node').count(),4);
    await page.locator('.react-flow__node[data-id="review"]').click();
    await page.getByText('评审与循环', { exact: true }).click();
    assert.equal(await page.getByText('子代理', {exact:true}).count(),0);
    const panel=page.locator('.wf-inspector .wf-panel-body');
    await panel.hover();
    await page.mouse.wheel(0,1800);
    await page.waitForTimeout(250);
    const scrollState=await panel.evaluate(el=>({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight,bottom:el.getBoundingClientRect().bottom}));
    assert.ok(scrollState.top>0,'expanded inspector must scroll with wheel');
    assert.ok(scrollState.bottom <= 980,'inspector must remain inside viewport');
    await page.screenshot({path:join(plugin,'docs/screenshots/inspector-expanded-scroll.png')});
    const sessionMode = page.getByRole('combobox', { name: '每轮会话', exact: true });
    await sessionMode.selectOption('continue');
    await page.getByRole('button', { name: '保存版本', exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal((await call({ action: 'read', id: 'reviewed-paper-ui' })).snapshot.definition.nodes[2].repeat.sessionMode, 'continue');
    assert.equal(await page.getByPlaceholder('描述你想调整的步骤…').count(), 0);
    await page.screenshot({ path: join(plugin, 'docs/screenshots/reviewed-paper-editor.png') });
    await page.getByRole('tab',{name:'步骤列表',exact:true}).click();
    for (const [name, suffix] of [['深色', 'dark'], ['浅色', 'light']]) {
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('dialog', { name: '设置', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
      await page.waitForTimeout(350);
      const ratio = await page.getByRole('button',{name:'试运行',exact:true}).evaluate(el=>{
        const c=getComputedStyle(el); const lum=s=>{const rgb=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}; const a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });
      assert(ratio>=4.5, `${suffix} primary button contrast ${ratio}`);
      await page.screenshot({ path: join(plugin, `docs/screenshots/reviewed-paper-${suffix}.png`) });
    }
    await page.setViewportSize({ width: 640, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(plugin, 'docs/screenshots/reviewed-paper-narrow.png') });
    assert(await page.locator('.wf-main').evaluate(el => el.scrollWidth - el.clientWidth) < 40);
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

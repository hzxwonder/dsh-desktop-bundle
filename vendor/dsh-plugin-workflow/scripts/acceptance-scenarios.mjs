import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function acceptance({ page, call, api, plugin, errors, environment = 'web' }) {
  const results = [], directory = join(plugin, 'docs/acceptance', environment);
  await mkdir(directory, { recursive: true });
  const record = async (id, title, work) => {
    const start = Date.now();
    try { await work(); results.push({ id, title, status: '通过', ms: Date.now() - start }); }
    catch (e) { results.push({ id, title, status: '失败', error: e.message.slice(0, 1200), ms: Date.now() - start }); throw e; }
    finally { await writeFile(join(directory, 'results.json'), JSON.stringify(results, null, 2)); }
  };
  const shot = async name => { await page.screenshot({ path: join(directory, name + '.png') }); };
  const waitRun = async (id, status) => {
    let result;
    for (let i = 0; i < 120; i++) { result = (await call({ action: 'runRead', id })).run; if (result?.status === status) return result; await page.waitForTimeout(150); }
    assert.equal(result?.status, status, JSON.stringify({ status: result?.status, error: result?.error }));
  };
  const def = {
    schemaVersion: '1.0', id: 'editorial-demo', name: '研究简报', description: '资料核对、撰写与交付', trigger: 'manual',
    nodes: [
      { id: 'research', name: '并行核对资料', kind: 'agent', prompt: 'Summarize the supplied material and parallel findings.', input: { material: { source: 'workflow', path: '/text' } }, subagents: [
        { id: 'facts', name: '事实核对', prompt: 'Check the supplied material.', tools: ['verify_material'], model: { mode: 'explicit', id: 'fixture-node' } },
        { id: 'structure', name: '结构分析', prompt: 'Outline the supplied material.' },
      ] },
      { id: 'draft', name: '撰写简报', kind: 'agent', prompt: 'Write a concise brief from the input.', input: { material: { source: 'node', nodeId: 'research', path: '/text' } } },
      { id: 'output', name: '保存交付材料', kind: 'artifact', input: { content: { source: 'node', nodeId: 'draft', path: '/text' } } },
    ], edges: [{ from: 'research', to: 'draft' }, { from: 'draft', to: 'output' }],
  };
  let sessionId, runId, run;
  await record('C03', '创建多个独立工作流', async () => {
    await call({ action: 'save', definition: def, expectedRevision: 0 });
    await call({ action: 'save', definition: { ...def, id: 'release-demo', name: '发布说明' }, expectedRevision: 0 });
    const state = await call({ action: 'state' });
    assert(state.workflows.some(w => w.id === 'editorial-demo')); assert(state.workflows.some(w => w.id === 'release-demo'));
  });
  await record('U12', '编辑器调试设置持久化并传递到新绑定', async () => {
    await call({action:'setWorkflowDebug',id:def.id,debug:true});
    assert.equal((await call({action:'read',id:def.id})).debug,true);
    const sid=(await api('/api/workflow-fixture',{action:'create',sessionId:'debug-setting-session'})).sessionId;
    const binding=await call({action:'bind',id:def.id,revision:1,sessionId:sid});assert.equal(binding.debug,true);
    await call({action:'setWorkflowDebug',id:def.id,debug:false});
    assert.equal((await call({action:'state'})).bindings.find(b=>b.sessionId===sid).debug,false);
  });
  await record('D01', '调试执行一个步骤后停止', async () => {
    const created = await api('/api/workflow-fixture', { action: 'create', sessionId: 'editorial-session' }); sessionId = created.sessionId;
    await call({ action: 'bind', id: def.id, revision: 1, sessionId });
    const started = await call({ action: 'run', id: def.id, revision: 1, input: { text: 'A synthetic research brief about reproducible experiments.' }, sessionId, debug: true, background: true });
    runId = started.runId; run = await waitRun(runId, 'paused');
    assert.equal(run.nodes.research.status, 'completed'); assert.equal(run.nodes.draft, undefined);
  });
  await record('S07', 'Host 中并行子代理产生独立会话', async () => {
    const team = Object.values(run.nodes.research.subagents); assert.equal(team.length, 2);
    assert(team.every(m => m.status === 'completed' && m.sessionId)); assert.notEqual(team[0].sessionId, team[1].sessionId);
  });
  await record('U05', '总会话时间线显示步骤摘要', async () => {
    await page.getByRole('button', { name: '工作流', exact: true }).click();
    await page.locator('[data-workflow-card="editorial-demo"]').getByRole('button', { name: '打开', exact: true }).click();
    await page.getByRole('tab', { name: '运行记录', exact: true }).click();
    await page.getByRole('button', { name: '运行记录', exact: true }).click();
    await page.getByRole('button', { name: runId.slice(0, 18), exact: true }).click();
    await page.getByRole('button', { name: '打开总会话', exact: true }).click();
    await page.getByRole('region', { name: '工作流运行时间线' }).waitFor({ timeout: 10000 });
    assert.equal(await page.locator('[data-step-id]').count(), 3);
    assert.equal(await page.getByRole('checkbox',{name:'逐步调试',exact:true}).count(),0);
    await shot('timeline-debug');
  });
  await record('D02', '界面单步推进并自动折叠历史', async () => {
    await page.getByRole('button', { name: '运行一步', exact: true }).click();
    run = await waitRun(runId, 'paused'); if (!run.nodes.draft) { await page.waitForTimeout(500); run = await waitRun(runId, 'paused'); } assert.equal(run.nodes.draft.status, 'completed');
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('[data-step-id="research"] .wf-activity-toggle').getAttribute('aria-expanded'), 'false');
    await shot('timeline-next-step');
  });
  await record('S01', '打开步骤独立会话再返回', async () => {
    await page.locator('[data-step-id="draft"]').getByRole('button', { name: '打开步骤会话', exact: true }).click();
    await page.getByRole('button', { name: '返回工作流总会话', exact: true }).waitFor({ timeout: 10000 });
    await shot('step-conversation');
    await page.getByRole('button', { name: '返回工作流总会话', exact: true }).click();
    await page.getByRole('region', { name: '工作流运行时间线' }).waitFor();
  });
  await record('S02', '步骤补聊保留原输出并完成新回答', async () => {
    const original = run.nodes.draft.output;
    await page.getByRole('combobox', { name: '步骤消息接收者' }).selectOption(run.nodes.draft.sessionId);
    await page.getByRole('textbox', { name: /发消息或创建任务|描述你想要构建/ }).fill('Please add a short reproducibility checklist.');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    for (let i = 0; i < 80; i++) { run = (await call({ action: 'runRead', id: runId })).run; if (run.nodes.draft.attempts.some(a => a.kind === 'followup')) break; await page.waitForTimeout(150); }
    assert(run.nodes.draft.attempts.some(a => a.kind === 'followup'));
    assert.deepEqual(run.nodes.draft.output, original);
  });
  await record('U09', '采用输出确认支持 Escape 且取消不改变输出', async () => {
    const before = (await call({ action: 'runRead', id: runId })).run.checkpointRevision;
    await page.locator('[data-step-id="draft"]').getByRole('button', { name: '更新步骤输出', exact: true }).click();
    await page.getByRole('dialog', { name: '更新步骤输出' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: '更新步骤输出' }).count(), 0);
    assert.equal((await call({ action: 'runRead', id: runId })).run.checkpointRevision, before);
  });
  await record('D12', '手动采用步骤最新输出', async () => {
    await page.locator('[data-step-id="draft"]').getByRole('button', { name: '更新步骤输出', exact: true }).click();
    const reply = page.waitForResponse(async r => r.url().endsWith('/api/workflow-studio') && r.request().postDataJSON()?.action === 'adopt');
    await page.getByRole('dialog', { name: '更新步骤输出' }).getByRole('button', { name: '确认', exact: true }).click();
    assert((await (await reply).json()).ok, 'adoption request succeeds');
    await page.waitForTimeout(1200);
    run = (await call({ action: 'runRead', id: runId })).run;
    assert.equal(run.nodes.draft.outputHistory?.length, 1, JSON.stringify({ error: await page.locator('.wf-error').allTextContents(), revision: run.checkpointRevision }));
  });
  await record('D09', '最后一步完成后停止提供继续按钮', async () => {
    await page.getByRole('button', { name: '运行一步', exact: true }).click();
    run = await waitRun(runId, 'completed'); await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('button', { name: '运行一步', exact: true }).count(), 0);
    await shot('timeline-completed');
  });
  await record('U04', '展开与收起历史轨迹', async () => {
    const step = page.locator('[data-step-id="research"]');
    await step.getByRole('button', { name: '展开过程', exact: true }).click();
    await step.locator('.wf-native-step [data-chat-flow]').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-step-id=research] .wf-native-step [data-chat-flow]')].length === 3 && [...document.querySelectorAll('[data-step-id=research] .wf-native-step [data-chat-flow]')].every(e => e.textContent.includes('Synthetic local execution completed'))); assert.equal(await step.locator('[data-slot-error]').count(), 0); assert(await step.locator('.wf-native-step [data-slot="conversation.view"]').count(), 'native conversation renders'); await step.scrollIntoViewIfNeeded(); await shot('parallel-traces');
    const native = step.locator('.wf-native-step').first();
    assert.equal(await native.getByRole('tab').count(), 0);
    await step.getByRole('button', { name: '收起过程', exact: true }).click();
    assert.equal(await step.locator('.wf-native-step').count(), 0);
  });
  await record('S15', '产物步骤可展开为独立检视会话', async () => {
    await page.locator('[data-step-id="output"]').getByRole('button', { name: '打开步骤会话', exact: true }).click();
    await page.getByRole('button', { name: '返回工作流总会话', exact: true }).waitFor();
    await page.getByRole('button', { name: '返回工作流总会话', exact: true }).click();
    await page.getByRole('region', { name: '工作流运行时间线' }).waitFor();
  });
  await record('S04', '十次往返保持步骤会话身份', async () => {
    const id = run.nodes.draft.sessionId;
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-step-id="draft"]').getByRole('button', { name: '打开步骤会话', exact: true }).click();
      await page.getByRole('button', { name: '返回工作流总会话', exact: true }).click();
      await page.getByRole('region', { name: '工作流运行时间线' }).waitFor();
    }
    assert.equal((await call({ action: 'runRead', id: runId })).run.nodes.draft.sessionId, id);
  });
  await record('U01', '浅色深色系统主题切换保留运行与草稿', async () => {
    const composer = page.getByRole('textbox', { name: /发消息或创建任务|描述你想要构建/ });
    await composer.fill('待发送的检视问题');
    for (const [name, dark] of [['深色', true], ['浅色', false], ['跟随系统', false]]) {
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('dialog', { name: '设置', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('body').evaluate(e => e.hasAttribute('data-ds-dark-theme')), dark);
      assert.equal(await composer.innerText(), '待发送的检视问题');
      await page.locator('.wf-run-header').scrollIntoViewIfNeeded();
      await shot(dark ? 'theme-dark' : name === '浅色' ? 'theme-light' : 'theme-system');
    }
    await composer.fill('');
  });
  await record('L01', '反复关闭工作流面板恢复总会话', async () => {
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: '工作流', exact: true }).click();
      await page.getByRole('button', { name: '工作流', exact: true }).click();
      await page.getByRole('region', { name: '工作流运行时间线' }).waitFor();
    }
  });
  await record('R03', '运行中投递消息后关闭页面，重开恢复同一次运行', async () => {
    const sid = (await api('/api/workflow-fixture', { action: 'create', sessionId: 'live-interaction-session' })).sessionId;
    const started = await call({ action: 'run', id: def.id, revision: 1, input: { text: 'DELAYED_WORKFLOW_FIXTURE synthetic material' }, sessionId: sid, debug: true, background: true });
    let live;
    for (let i = 0; i < 80; i++) {
      live = (await call({ action: 'runRead', id: started.runId })).run;
      if (live.nodes.research?.subagents?.structure?.sessionId) break;
      await page.waitForTimeout(100);
    }
    const sent = await call({ action: 'stepMessage', runId: started.runId, nodeId: 'research', memberId: 'structure', text: 'Include a reproducibility checklist.' });
    assert.equal(sent.delivered, true);
    await page.reload();
    live = await waitRun(started.runId, 'paused');
    const trace = await call({ action: 'stepTrace', runId: started.runId, nodeId: 'research', memberId: 'structure' });
    assert(trace.events.some(e => e.type === 'user/message' && (e.data.message?.content ?? e.data.content ?? []).some(b => b.type === 'text' && b.text.includes('Include a reproducibility checklist.'))));
    assert.equal(live.nodes.draft, undefined);
  });
  await record('L06', '连续刷新恢复同一运行', async () => {
    for (let i = 0; i < 5; i++) { await page.reload(); await page.getByRole('region', { name: '工作流运行时间线' }).waitFor(); }
    const state = await call({ action: 'state' }); assert.equal(state.runs.filter(r => r.sessionId === sessionId).length, 1);
  });
  await record('U07', '多窗口尺寸布局', async () => {
    for (const [width, height] of [[1600, 1000], [1280, 800], [900, 600], [640, 600]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      const overflow = await page.locator('.wf-timeline').evaluate(e => e.scrollWidth - e.clientWidth);
      assert(overflow < 3, `timeline overflow ${overflow} at ${width}`); await shot(`layout-${width}`);
    }
    await page.setViewportSize({ width: 1500, height: 980 });
  });
  await record('N01', '总会话编辑输入、添加文件、保存并单步重跑', async () => {
    const step = page.locator('[data-step-id="draft"]');
    await step.getByRole('button', { name: '编辑输入', exact: true }).click();
    await step.getByRole('textbox', { name: '步骤输入 prompt' }).fill('根据所附材料整理可复现性清单。');
    await step.locator('input[type=file]').setInputFiles([{ name: 'research-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment: deterministic seed 42.') }, {name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAH0lEQVR4nGNYte8SVRDDqEGjBo0aNGrQqEGjBg28QQA8AwLMZG9QWAAAAABJRU5ErkJggg==','base64')}]);
    await step.getByRole('button', { name: '移除 research-notes.txt' }).waitFor();
    await shot('notebook-edit');
    await step.getByRole('button', { name: '保存输入' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-step-id=draft] textarea'));
    run = (await call({ action: 'runRead', id: runId })).run;
    assert.equal(run.stepOverrides.draft.prompt, '根据所附材料整理可复现性清单。');
    assert.equal((await call({action:'read',id:def.id})).snapshot.definition.nodes[1].prompt, def.nodes[1].prompt);
    await step.getByRole('button', { name: '运行此步骤', exact: true }).click();
    for (let i = 0; i < 100; i++) { run = (await call({ action: 'runRead', id: runId })).run; if (run.status === 'paused' && run.nodes.draft.status === 'completed' && run.nodes.draft.prompt === '根据所附材料整理可复现性清单。') break; await page.waitForTimeout(150); }
    assert.equal(run.nodes.draft.prompt, '根据所附材料整理可复现性清单。');
    assert.equal(run.nodes.output.status, 'stale');
    const trace = await call({action:'stepTrace',runId,nodeId:'draft'});
    assert(trace.events.some(e => e.type === 'user/message' && e.data.content?.some(b => b.type === 'file' && b.attachment.name === 'research-notes.txt')), 'actual child input contains durable file block');
    assert(trace.events.some(e => e.type === 'user/message' && e.data.content?.some(b => b.type === 'image' && b.attachment.name === 'sample.png')), 'image is passed to child');
    await page.waitForTimeout(1100); await step.scrollIntoViewIfNeeded(); await shot('notebook-attachments');
  });
  await record('N02', '独立步骤页编辑同一次运行并返回', async () => {
    await page.locator('[data-step-id="draft"]').getByRole('button', { name: '打开步骤会话' }).click();
    const step = page.locator('[data-step-id="draft"]');
    await step.getByRole('button', { name: '编辑输入', exact: true }).click();
    await step.getByRole('textbox', { name: '步骤输入 prompt' }).fill('整理复现清单并说明限制。');
    await step.getByRole('button', { name: '保存输入' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-step-id=draft] textarea'));
    await page.getByRole('button', { name: '返回工作流总会话' }).click();
    await page.getByRole('region', { name: '工作流运行时间线' }).waitFor();
    assert.equal((await call({action:'runRead',id:runId})).run.stepOverrides.draft.prompt, '整理复现清单并说明限制。');
  });
  await record('N03', '展开过程区域滚轮驱动外层页面且可反向滚动', async () => {
    const step = page.locator('[data-step-id="research"]');
    await step.getByRole('button', { name: '展开过程', exact: true }).click();
    await step.locator('.wf-native-step [data-chat-flow]').first().waitFor();
    const native = step.locator('.wf-native-scroll').first();
    await native.scrollIntoViewIfNeeded();
    assert.equal(await native.evaluate(e => getComputedStyle(e).overflowY), 'visible');
    const host = page.locator('[data-conversation-scroll]').filter({ has: page.locator('.wf-timeline') }).first();
    await native.hover();
    const before = await host.evaluate(e => e.scrollTop);
    await page.mouse.wheel(0, 320); await page.waitForTimeout(500);
    const down = await host.evaluate(e => e.scrollTop); assert(down > before + 30, `down ${before} -> ${down}`);
    await page.mouse.wheel(0, -260); await page.waitForTimeout(500);
    assert(await host.evaluate(e => e.scrollTop) < down - 30, 'reverse wheel moves outer page');
    await step.getByRole('button', { name: '收起过程', exact: true }).click();
    await page.locator('.wf-run-header').scrollIntoViewIfNeeded(); await shot('notebook-overview');
  });
  await record('N04', '陈旧编辑与伪造附件引用拒绝', async () => {
    run = (await call({action:'runRead',id:runId})).run;
    const stale = await api('/api/workflow-studio', {action:'stepEdit',runId,nodeId:'draft',prompt:'stale',expectedRevision:run.checkpointRevision-1}); assert.equal(stale.ok,false);
    const forged = await api('/api/workflow-studio', {action:'stepEdit',runId,nodeId:'draft',prompt:'test',keep:['unknown'],expectedRevision:run.checkpointRevision}); assert.equal(forged.ok,false);
    const file = await api('/api/workflow-studio', {action:'stepFile',runId,attachmentId:'unknown'}); assert.equal(file.ok,false);
  });
  await record('X01', '运行期间没有客户端未捕获异常', async () => { assert.deepEqual(errors, []); });
  console.log(`Acceptance: ${results.length} scenarios passed`);
}

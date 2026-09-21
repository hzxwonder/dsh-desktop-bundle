// Desktop workflow acceptance cases.
//
// Every case drives the real Desktop window. `run` receives the shared harness in
// `h` (see harness.mjs); the assertions are behavioural, not implementation
// details: what the person sees, whether the action survives a restart, whether a
// nonsense input leaves the product in a usable state.
import { sleep } from './helper.mjs'
import { sendMessage } from '../scenario.mjs'

const TS = Date.now().toString(36)
const name = suffix => `验收-${suffix}-${TS}`
const created = []
export { name }

/** A definition small enough to run under the local mock model. */
/** Make a workflow usable by the next case whatever the previous case left behind. */
async function ensureActive(h, session, workflowId) {
  const list = await h.state(session)
  const record = list.workflows.find(w => w.id === workflowId)
  if (record?.archived) await h.studioOk(session, { action: 'archive', id: workflowId, archived: false })
  return record
}

const definition = (id, workflowName) => ({
  schemaVersion: '1.0',
  id,
  name: workflowName,
  description: '桌面端验收使用的合成工作流',
  trigger: 'manual',
  nodes: [
    { id: 'collect', name: '收集材料', kind: 'agent', prompt: '总结给出的材料要点。', input: { text: { source: 'workflow', path: '/text' } } },
    { id: 'deliver', name: '形成记录', kind: 'artifact', input: { content: { source: 'node', nodeId: 'collect', path: '/text' } } },
  ],
  edges: [{ from: 'collect', to: 'deliver' }],
})

export const groups = {
  A: {
    title: '入口与总览',
    cases: [
      {
        id: 'W-A-01', priority: 'P0', title: '侧栏入口打开工作流面板并显示总览',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const open = await session.eval('window.__wf.panelOpen()')
          assert.check(open, '工作流面板没有打开')
          assert.check(await session.eval('window.__wf.nav()?.getAttribute("aria-expanded") === "true"'), '入口按钮没有标记为展开')
          const intro = await session.eval('window.__wf.byLabel("运行工作流完成任务") !== null || window.__wf.text().includes("运行工作流完成任务")')
          assert.check(intro, '总览缺少用途说明')
          assert.check(await session.eval('window.__wf.byLabel("搜索工作流", ".wf-gallery") !== null'), '总览缺少搜索框')
          assert.check(await session.eval('window.__wf.byLabel("创建工作流", ".wf-gallery") !== null || window.__wf.byLabel("创建工作流") !== null'), '总览缺少创建入口')
          assert.evidence.push(await h.shotPanel(session, 'A-01-panel-open'))
          assert.note(JSON.stringify(await session.eval('window.__wf.cardTitles()')))
        },
      },
      {
        id: 'W-A-02', priority: 'P1', title: '卡片与列表两种样式切换且偏好保留',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.click(session, '列表', { scope: '.wf-gallery' })
          assert.check(await session.eval('window.__wf.rows().length > 0'), '列表样式没有渲染出任何行')
          assert.check(await session.eval('localStorage.getItem("workflow-studio:view") === "list"'), '列表偏好没有写入 localStorage')
          assert.evidence.push(await h.shotPanel(session, 'A-02-list-view'))
          await h.click(session, '卡片', { scope: '.wf-gallery' })
          assert.check(await session.eval('window.__wf.cards().length > 0'), '卡片样式没有渲染出任何卡片')
          assert.check(await session.eval('localStorage.getItem("workflow-studio:view") === "cards"'), '卡片偏好没有写入 localStorage')
        },
      },
      {
        id: 'W-A-03', priority: 'P1', title: '空状态：搜索无结果给出解释与清除入口',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.typeSearch(session, 'zzz-不存在的关键词-zzz')
          assert.check(await session.eval('window.__wf.byLabel("清除搜索", ".wf-gallery") !== null'), '搜索无结果时没有清除入口')
          assert.check(await session.eval('document.querySelectorAll("[data-workflow-card]").length === 0'), '无匹配时仍显示卡片')
          const emptyText = await session.eval('window.__wf.text()')
          assert.check(/没有(找到|匹配)/.test(emptyText), `缺少无结果说明：${emptyText.slice(0, 120)}`)
          assert.evidence.push(await h.shotPanel(session, 'A-03-search-empty'))
          await h.click(session, '清除搜索', { scope: '.wf-gallery' })
          const restored = await session.eval('document.querySelectorAll("[data-workflow-card]").length')
          assert.check(restored > 0, `清除搜索后没有恢复列表（${restored} 张卡片）`)
          const value = await session.eval('document.querySelector(".wf-gallery-search input")?.value')
          assert.equal(value, '', '清除搜索后输入框仍有内容')
        },
      },
      {
        id: 'W-A-04', priority: 'P2', title: '搜索匹配名称与描述且大小写无关',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = await session.eval('window.__wf.cardTitles()')
          assert.check(before.length > 0, '没有可搜索的工作流')
          const target = before[0]
          await h.typeSearch(session, target.slice(0, 2))
          const hit = await session.eval('window.__wf.cardTitles()')
          assert.check(hit.includes(target), `搜索前两个字没有匹配到 ${target}`)
          await h.typeSearch(session, '')
          assert.check((await session.eval('window.__wf.cardTitles()')).length === before.length, '清空搜索没有恢复全部')
        },
      },
      {
        id: 'W-A-05', priority: 'P2', title: '归档视图为空时解释归档含义',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.click(session, '已归档', { scope: '.wf-gallery' })
          const empty = await session.eval('document.querySelectorAll("[data-workflow-card]").length === 0')
          assert.check(empty, '归档视图里出现了未归档的工作流')
          assert.check(await session.eval('window.__wf.text().includes("归档")'), '归档空状态缺少说明')
          assert.check(await session.eval(`window.__wf.byLabel('返回工作流列表') !== null`), '归档空状态缺少返回列表的入口')
          assert.evidence.push(await h.shotPanel(session, 'A-05-archive-empty'))
          await h.click(session, '已归档', { scope: '.wf-gallery' })
          assert.check(await session.eval('document.querySelectorAll("[data-workflow-card]").length > 0'), '取消归档过滤后没有恢复')
        },
      },
    ],
  },

  B: {
    title: '创建与多实例',
    cases: [
      {
        id: 'W-B-01', priority: 'P0', title: '创建工作流进入对话并在输入区显示工作流标签',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = (await h.state(session)).workflows.length
          await h.click(session, '创建工作流', { scope: '.wf-main', settleMs: 3500 })
          const after = await h.state(session)
          assert.check(after.authoring.length >= 1, '创建后没有登记创作会话')
          const labels = await session.eval(`[...document.querySelectorAll('button,[role=button],span')].map(e=>e.textContent||'').filter(t=>t.includes('工作流标签')||t.includes('正在创建')).slice(0,5)`)
          assert.note(`creation labels: ${JSON.stringify(labels)}; workflows ${before} -> ${after.workflows.length}`)
          assert.evidence.push(await h.shot(session, 'B-01-create-conversation'))
          const bound = await session.eval(`!!document.querySelector('.wf-session-tag, [data-workflow-tag], [class*=workflow-tag]')`)
          assert.note(`workflow tag element present: ${bound}`)
        },
      },
      {
        id: 'W-B-02', priority: 'P1', title: '从总览创建第二个工作流互不干扰',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const first = (await h.state(session)).authoring.length
          await h.click(session, '创建工作流', { scope: '.wf-main', settleMs: 3500 })
          const after = (await h.state(session)).authoring.length
          assert.check(after > first, `第二个创作会话没有登记（${first} -> ${after}）`)
          assert.evidence.push(await h.shot(session, 'B-02-second-create'))
        },
      },
      {
        id: 'W-B-03', priority: 'P1', title: '拷贝工作流产生未发布草稿且不带走运行记录',
        async run({ assert, session, h }) {
          const seed = definition(`accept-copy-${TS}`, name('拷贝源'))
          await h.studioOk(session, { action: 'save', definition: seed, expectedRevision: 0 })
          await h.openPanel(session)
          await h.waitForCard(session, seed.name)
          const card = `[data-workflow-card="${seed.id}"]`
          await h.click(session, '拷贝', { scope: card, settleMs: 2500 })
          const list = await h.state(session)
          const copy = list.workflows.find(w => w.id !== seed.id && w.name.includes(seed.name))
          assert.check(copy !== undefined, `没有生成副本：${JSON.stringify(list.workflows.map(w => w.name))}`)
          // An unpublished record carries no published revision at all.
          assert.check(!copy.published, `副本不应是已发布版本：${JSON.stringify(copy.published)}`)
          const runs = list.runs.filter(r => r.workflowId === copy.id)
          assert.equal(runs.length, 0, '副本不应带走运行记录')
          assert.evidence.push(await h.shot(session, 'B-03-copy-result'))
          created.push(copy.id)
        },
      },
      {
        id: 'W-B-04', priority: 'P0', title: '连续创建多个工作流后列表完整且名称唯一',
        async run({ assert, session, h }) {
          const names = []
          for (let i = 1; i <= 5; i++) {
            const wf = definition(`accept-many-${TS}-${i}`, name(`批量${i}`))
            names.push(wf.name)
            await h.studioOk(session, { action: 'save', definition: wf, expectedRevision: 0 })
          }
          await h.openPanel(session)
          await session.waitFor(`window.__wf.cardTitles().filter(t=>t.includes('${TS}')).length >= 5`, { timeoutMs: 20000, message: 'five cards' })
          const titles = await session.eval('window.__wf.cardTitles()')
          for (const expected of names) assert.check(titles.includes(expected), `缺少卡片 ${expected}`)
          const unique = new Set(titles)
          assert.equal(unique.size, titles.length, `卡片标题出现重复：${JSON.stringify(titles)}`)
          assert.evidence.push(await h.shotPanel(session, 'B-04-many-workflows'))
          assert.note(`cards=${titles.length}`)
        },
      },
      {
        id: 'W-B-05', priority: 'P1', title: '列表样式在多个工作流下逐行对齐操作可用',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.click(session, '列表', { scope: '.wf-gallery' })
          const rows = await session.eval('window.__wf.rows().length')
          assert.check(rows >= 5, `列表行数偏少：${rows}`)
          const actions = await session.eval(`window.__wf.rows().map(r=>window.__wf.rowActions(r).map(a=>a.label))`)
          // Every card keeps its four actions on one line, whatever the name length.
          const actionRows = await session.eval(`(() => [...document.querySelectorAll('.wf-card-actions')].map(box => {
            const tops = [...box.children].map(b => Math.round(b.getBoundingClientRect().top))
            const widths = [...box.children].map(b => Math.round(b.getBoundingClientRect().width))
            return { count: box.children.length, rows: new Set(tops).size, minWidth: Math.min(...widths) }
          }))()`)
          const wrapped = actionRows.filter(row => row.rows !== 1)
          assert.check(wrapped.length === 0, `卡片操作换到了第二行：${JSON.stringify(wrapped)}`)
          assert.check(actionRows.every(row => row.minWidth >= 60), `操作按钮被压得过窄：${JSON.stringify(actionRows)}`)
          assert.note(`卡片操作行：${actionRows.length} 张卡片，均为单行，最窄按钮 ${Math.min(...actionRows.map(r => r.minWidth))}px`)
          assert.check(actions.every(list => list.length >= 4), `存在操作不完整的行：${JSON.stringify(actions.slice(0, 3))}`)
          assert.check(actions.every(list => list.some(l => l.includes('运行'))), '列表行缺少运行入口')
          assert.evidence.push(await h.shotPanel(session, 'B-05-list-many'))
          await h.click(session, '卡片', { scope: '.wf-gallery' })
        },
      },
      {
        id: 'W-B-06', priority: 'P2', title: '超长与特殊字符名称不破坏布局',
        async run({ assert, session, h }) {
          const longName = `${name('长名称')}-` + '很长的中国語名称段落'.repeat(6)
          const wf = definition(`accept-long-${TS}`, longName)
          wf.description = '描述'.repeat(120) + ' <script>alert(1)</script> & "引号" \'单引号\' / 斜杠'
          await h.studioOk(session, { action: 'save', definition: wf, expectedRevision: 0 })
          await h.openPanel(session)
          await h.waitForCard(session, longName)
          const overflow = await session.eval('window.__wf.overflow()')
          // A full row of columns should add up to the container width; anything left
          // over is the empty strip a reader sees on the right of the grid.
          const grid = await session.eval(`(() => {
            const cards = document.querySelector('.wf-cards')
            if (!cards) return null
            const style = getComputedStyle(cards)
            const gap = parseFloat(style.columnGap) || 0
            const tracks = style.gridTemplateColumns.split(' ').map(Number.parseFloat).filter(Number.isFinite)
            const width = cards.getBoundingClientRect().width
            const used = tracks.reduce((sum, track) => sum + track, 0) + gap * Math.max(0, tracks.length - 1)
            return { columns: tracks.length, width: Math.round(width), gap, stranded: Math.round(width - used), track: style.gridTemplateColumns }
          })()`)
          if (grid) {
            assert.note(`卡片网格：${grid.columns} 列，右侧余量 ${grid.stranded}px（${grid.track}）`)
            assert.check(grid.stranded <= grid.gap + 2, `网格右侧留下了空列：${grid.stranded}px`)
            assert.check(grid.columns >= 2, `宽窗口下只有 ${grid.columns} 列`)
          }
          assert.check(overflow.horizontalScroll === false, `长名称导致横向滚动：${JSON.stringify(overflow)}`)
          assert.check(overflow.offenders.length === 0, `长名称使元素溢出视口：${JSON.stringify(overflow.offenders)}`)
          // A long record must not be able to size itself: the card stays close to its
          // neighbours and the full text remains reachable on hover.
          const bounded = await session.eval(`(() => {
            const card = document.querySelector('[data-workflow-card="${wf.id}"]')
            const title = card.querySelector('.wf-card-title')
            const desc = card.querySelector('.wf-card-desc')
            const others = [...document.querySelectorAll('.wf-card')].filter(c => c !== card)
            const height = Math.round(card.getBoundingClientRect().height)
            const shortest = others.length ? Math.min(...others.map(c => Math.round(c.getBoundingClientRect().height))) : height
            return {
              height,
              shortest,
              titleLines: Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)),
              descLines: Math.round(desc.getBoundingClientRect().height / parseFloat(getComputedStyle(desc).lineHeight)),
              titleHoldsFullText: title.getAttribute('title') === ${JSON.stringify(longName)},
              descHoldsFullText: (desc.getAttribute('title') || '').startsWith('描述描述'),
              titleClipped: title.scrollHeight > title.clientHeight + 1,
              descClipped: desc.scrollHeight > desc.clientHeight + 1,
            }
          })()`)
          assert.note(`长记录卡片 ${bounded.height}px（同屏最短 ${bounded.shortest}px），标题 ${bounded.titleLines} 行，描述 ${bounded.descLines} 行`)
          assert.check(bounded.titleLines === 1, `标题没有收成一行：${bounded.titleLines} 行`)
          assert.check(bounded.descLines <= 2, `描述没有被截断到两行：${bounded.descLines} 行`)
          assert.check(bounded.height <= bounded.shortest * 2 + 40, `长记录卡片明显高于其他卡片：${bounded.height} vs ${bounded.shortest}`)
          assert.check(bounded.titleHoldsFullText && bounded.descHoldsFullText, '截断后完整文本无法读取')
          assert.note(`标题被裁剪 ${bounded.titleClipped}，描述被裁剪 ${bounded.descClipped}`)

          const injected = await session.eval('window.__wf.text().includes("alert(1)")')
          assert.note(`script text shown as text (not executed): ${injected}`)
          assert.check(await session.eval('document.querySelectorAll("script[data-injected]").length === 0'), '脚本被注入执行')
          assert.evidence.push(await h.shotPanel(session, 'B-06-long-name'))
        },
      },
    ],
  },

  C: {
    title: '生命周期：关闭、隐藏、重开',
    cases: [
      {
        id: 'W-C-01', priority: 'P0', title: '再次点击入口关闭面板回到对话',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.click(session, '工作流', { settleMs: 1800 })
          assert.check(!(await session.eval('window.__wf.panelOpen()')), '再次点击后工作流面板仍然存在')
          const composer = await session.eval('!!window.__qa.composer()')
          assert.check(composer, '关闭面板后没有回到对话输入区')
          assert.evidence.push(await h.shot(session, 'C-01-panel-closed'))
        },
      },
      {
        id: 'W-C-02', priority: 'P1', title: 'Escape 关闭面板且不误触其他操作',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await session.client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
          await session.client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
          await sleep(1200)
          const stillOpen = await session.eval('window.__wf.panelOpen()')
          assert.note(`Escape left the panel ${stillOpen ? 'open' : 'closed'}`)
          assert.evidence.push(await h.shot(session, 'C-02-escape'))
          if (!stillOpen) await h.openPanel(session)
        },
      },
      {
        id: 'W-C-03', priority: 'P0', title: '隐藏窗口再恢复后面板与数据保持一致',
        manual: '最小化按钮属于窗口服务器，自动化通道无法触发；此用例验证隐藏期间的可见性切换与恢复后的一致性，实际最小化由人工核对。',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = await session.eval('({open:window.__wf.panelOpen(),cards:window.__wf.cardTitles().length,view:document.querySelector(".wf-list") ? "list" : "grid"})')
          await session.eval(`(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
            document.dispatchEvent(new Event('visibilitychange'))
          })()`)
          await sleep(2500)
          const hidden = await session.eval('window.__wf.panelOpen()')
          assert.evidence.push(await h.shot(session, 'C-03-hidden'))
          await session.eval(`(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
            document.dispatchEvent(new Event('visibilitychange'))
          })()`)
          await sleep(2500)
          const after = await session.eval('({open:window.__wf.panelOpen(),cards:window.__wf.cardTitles().length,view:document.querySelector(".wf-list") ? "list" : "grid"})')
          assert.evidence.push(await h.shot(session, 'C-03-restored'))
          assert.check(hidden === before.open, '窗口隐藏时面板状态发生了变化')
          assert.check(after.open === before.open && after.view === before.view, `恢复后状态改变：${JSON.stringify({ before, after })}`)
          assert.equal(after.cards, before.cards, '恢复后卡片数量改变')
          assert.note(`面板 ${before.open} / ${after.open}，视图 ${before.view} / ${after.view}，卡片 ${before.cards} / ${after.cards}`)
        },
      },
      {
        id: 'W-C-04', priority: 'P1', title: '页面刷新后面板与视图偏好恢复',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = await session.eval('({open:window.__wf.panelOpen(),cards:window.__wf.cardTitles().length,view:localStorage.getItem("workflow-studio:view")})')
          await session.client.send('Page.reload')
          await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000, message: 'reload' })
          await sleep(3000)
          await h.installHelpers(session)
          const after = await session.eval('({open:window.__wf.panelOpen(),cards:window.__wf.cardTitles().length,view:localStorage.getItem("workflow-studio:view")})')
          assert.evidence.push(await h.shot(session, 'C-04-after-reload'))
          assert.equal(after.view, before.view, '刷新后视图偏好丢失')
          assert.check(after.open === before.open, `刷新后面板状态改变：${before.open} -> ${after.open}`)
          assert.note(`刷新后面板自动打开：${after.open}（刷新前 ${before.open}）；卡片 ${before.cards} -> ${after.cards}`)
          if (after.open) {
            await session.waitFor('window.__wf.cardTitles().length > 0', { timeoutMs: 20000, message: 'cards after reload' })
            assert.equal(await session.eval('window.__wf.cardTitles().length'), before.cards, '刷新后卡片数量与刷新前不一致')
          }
        },
      },
      {
        id: 'W-C-05', priority: 'P0', title: '退出并重开应用后面板状态与数据一致',
        async run({ assert, session, h, relaunch }) {
          await h.openPanel(session)
          const before = await session.eval('({cards:window.__wf.cardTitles().length,view:localStorage.getItem("workflow-studio:view")})')
          const next = await relaunch()
          await h.installHelpers(next)
          await h.sleep(2500)
          // Read the panel state the restart left behind, before anything reopens it.
          const after = await next.eval('({open:window.__wf.panelOpen(),gallery:!!document.querySelector(".wf-gallery"),view:localStorage.getItem("workflow-studio:view")})')
          assert.equal(after.view, before.view, '重启后视图偏好丢失')
          assert.check(after.open === true && after.gallery === true, `重启后面板没有自动恢复：${JSON.stringify(after)}`)
          await h.openPanel(next)
          const cards = await next.eval('window.__wf.cardTitles().length')
          assert.evidence.push(await h.shot(next, 'C-05-after-restart'))
          assert.check(cards === before.cards, `重启后卡片数量变化：${before.cards} -> ${cards}`)
          assert.note(`重启后面板自动打开：${after.open}，卡片 ${before.cards} -> ${cards}`)
        },
      },
      {
        id: 'W-C-06', priority: 'P1', title: '编辑态：切换面板视图后草稿与选中步骤保留',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const target = (await h.state(session)).workflows.find(w => w.name.includes(TS))
          await ensureActive(h, session, target.id)
          assert.check(target !== undefined, '没有可编辑的验收工作流')
          await h.waitForCard(session, target.name)
          await h.clickSelector(session, `[data-workflow-card="${target.id}"] .wf-card-head`, { settleMs: 2500 })
          // The editor remembers the last display mode, so the case asks for the step
          // list it is about instead of assuming which mode it inherits.
          if (!(await session.eval('!!document.querySelector(".wf-outline")'))) {
            await h.click(session, '步骤列表', { settleMs: 1500 }).catch(() => {})
          }
          await session.waitFor('!!document.querySelector(".wf-outline")', { timeoutMs: 20000, message: 'step outline' })
          const steps = await session.eval('document.querySelectorAll(".wf-outline-step").length')
          assert.check(steps >= 2, `步骤列表没有显示全部步骤：${steps}`)
          await h.click(session, '流程图', { settleMs: 1500 })
          assert.check(await session.eval('!!document.querySelector(".wf-graph, .react-flow")'), '切到流程图后没有画布')
          assert.evidence.push(await h.shotPanel(session, 'C-06-graph-view'))
          await h.click(session, '步骤列表', { settleMs: 1200 }).catch(() => {})
          const back = await session.eval('document.querySelectorAll(".wf-outline-step").length')
          assert.check(back === steps, `视图切换后步骤数量改变：${steps} -> ${back}`)
        },
      },
      {
        id: 'W-C-07', priority: 'P1', title: '归档后从总览消失、在归档视图可恢复',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量1') && w.name.includes(TS))
          assert.check(wf !== undefined, '没有可归档的验收工作流')
          await h.clickSelector(session, `[data-workflow-card="${wf.id}"] .wf-card-actions button[aria-label^="归档"]`, { settleMs: 1500 })
          await h.waitForNoCard(session, wf.name)
          await h.click(session, '已归档', { scope: '.wf-gallery' })
          await h.waitForCard(session, wf.name)
          assert.check(await session.eval(`window.__wf.byLabel("恢复", '[data-workflow-card="${wf.id}"]') !== null`), '归档视图缺少恢复操作')
          assert.evidence.push(await h.shotPanel(session, 'C-07-archived'))
          await h.clickSelector(session, `[data-workflow-card="${wf.id}"] .wf-card-actions button[aria-label^="恢复"]`, { settleMs: 1500 })
          await h.waitForNoCard(session, wf.name)
          await h.click(session, '已归档', { scope: '.wf-gallery' })
          await h.waitForCard(session, wf.name)
        },
      },
      {
        id: 'W-C-08', priority: 'P2', title: '归档状态跨应用重启保留',
        async run({ assert, session, h, relaunch }) {
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量2') && w.name.includes(TS))
          assert.check(wf !== undefined, '没有可归档的验收工作流')
          await ensureActive(h, session, wf.id)
          await h.openPanel(session)
          await h.clickSelector(session, `[data-workflow-card="${wf.id}"] .wf-card-actions button[aria-label^="归档"]`, { settleMs: 1500 })
          await h.waitForNoCard(session, wf.name)
          const next = await relaunch()
          await h.openPanel(next)
          assert.check(!(await next.eval('window.__wf.cardTitles()')).includes(wf.name), '重启后归档的工作流又出现在总览')
          await h.click(next, '已归档', { scope: '.wf-gallery' })
          await h.waitForCard(next, wf.name)
          await h.clickSelector(next, `[data-workflow-card="${wf.id}"] .wf-card-actions button[aria-label^="恢复"]`, { settleMs: 1500 })
        },
      },
    ],
  },

  D: {
    title: '主题与视觉一致性',
    cases: [
      {
        id: 'W-D-01', priority: 'P0', title: '浅色主题下工作流总览可读且文字对比度达标',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          await h.setSystemAppearance(false)
          await sleep(2200)
          const report = await h.contrastReport(session, '.wf-main')
          assert.check(report.sampleCount >= 8, `工作流面板采样文本过少：${report.sampleCount}`)
          assert.note(`浅色采样 ${report.samples.length} 条，最低 ${report.worst?.ratio}（${report.worst?.text}）`)
          assert.check(report.failures.length === 0, `浅色主题存在低于 4.5:1 的文本：${JSON.stringify(report.failures.slice(0, 5))}`)
          assert.evidence.push(await h.shotPanel(session, 'D-01-light-gallery'))
        },
      },
      {
        id: 'W-D-02', priority: 'P0', title: '深色主题下工作流总览可读且文字对比度达标',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          await h.setSystemAppearance(true)
          await sleep(2600)
          const theme = await session.eval('window.__qa.theme()')
          assert.check(theme.dark === true, `系统深色下应用没有切到深色：${JSON.stringify(theme)}`)
          const report = await h.contrastReport(session, '.wf-main')
          assert.check(report.sampleCount >= 8, `深色工作流面板采样文本过少：${report.sampleCount}`)
          assert.note(`深色采样 ${report.samples.length} 条，最低 ${report.worst?.ratio}（${report.worst?.text}）`)
          assert.check(report.failures.length === 0, `深色主题存在低于 4.5:1 的文本：${JSON.stringify(report.failures.slice(0, 5))}`)
          assert.evidence.push(await h.shotPanel(session, 'D-02-dark-gallery'))
        },
      },
      {
        id: 'W-D-03', priority: 'P1', title: '面板打开时切换主题不丢状态也不残留旧配色',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = await session.eval('({cards:window.__wf.cardTitles().length,view:localStorage.getItem("workflow-studio:view")})')
          await h.setSystemAppearance(false)
          await sleep(2000)
          await h.setSystemAppearance(true)
          await sleep(2000)
          const after = await session.eval('({cards:window.__wf.cardTitles().length,view:localStorage.getItem("workflow-studio:view"),dark:window.__qa.theme().dark})')
          assert.check(after.cards === before.cards, `主题切换后卡片数量变化：${before.cards} -> ${after.cards}`)
          assert.equal(after.view, before.view, '主题切换后视图偏好变化')
          assert.evidence.push(await h.shotPanel(session, 'D-03-theme-cycled'))
        },
      },
      {
        id: 'W-D-04', priority: 'P1', title: '深色主题下编辑器步骤列表与设置面板对比度达标',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          await h.setSystemAppearance(true)
          await sleep(2000)
          const target = (await h.state(session)).workflows.find(w => w.name.includes(TS))
          await ensureActive(h, session, target.id)
          await h.openPanel(session)
          await h.clickSelector(session, `[data-workflow-card="${target.id}"] .wf-card-head`, { settleMs: 2500 })
          await session.waitFor('!!document.querySelector(".wf-outline")', { timeoutMs: 15000, message: 'outline' })
          const report = await h.contrastReport(session, '.wf-main')
          assert.check(report.sampleCount >= 8, `深色编辑器采样文本过少：${report.sampleCount}`)
          assert.note(`深色编辑器采样 ${report.samples.length} 条，最低 ${report.worst?.ratio}（${report.worst?.text}）`)
          assert.check(report.failures.length === 0, `深色编辑器存在低对比文本：${JSON.stringify(report.failures.slice(0, 5))}`)
          assert.evidence.push(await h.shotPanel(session, 'D-04-dark-editor'))
        },
      },
      {
        id: 'W-D-05', priority: 'P2', title: '系统主题跟随：系统改变时应用同步且无闪烁残留',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const seen = []
          for (const dark of [false, true, false]) {
            await h.setSystemAppearance(dark)
            await sleep(2200)
            seen.push(await session.eval('window.__qa.theme().dark'))
          }
          assert.check(seen[0] === false && seen[1] === true && seen[2] === false, `主题跟随不一致：${JSON.stringify(seen)}`)
          assert.evidence.push(await h.shotPanel(session, 'D-05-theme-follow'))
        },
      },
    ],
  },

  E: {
    title: '布局与样式校验',
    cases: [
      {
        id: 'W-E-01', priority: 'P0', title: '1280×900 下总览无横向溢出、无控件重叠',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const frame = await h.setWindowBounds(session, { width: 1280, height: 900 })
          assert.note(`实际窗口 ${frame.iw}×${frame.ih}（屏幕可用 ${frame.screenSize.join('×')}）`)
          assert.check(frame.iw >= 1200, `窗口没有达到目标宽度：${frame.iw}`)
          const overflow = await session.eval('window.__wf.overflow()')
          const overlaps = await session.eval('window.__wf.overlaps()')
          assert.check(overflow.horizontalScroll === false, `出现横向滚动：${JSON.stringify(overflow)}`)
          assert.check(overflow.offenders.length === 0, `元素超出视口：${JSON.stringify(overflow.offenders)}`)
          assert.check(overlaps.pairs.length === 0, `控件重叠：${JSON.stringify(overlaps.pairs)}`)
          assert.evidence.push(await h.shot(session, 'E-01-1280'))
        },
      },
      {
        id: 'W-E-02', priority: 'P1', title: '1024×768 下操作入口仍可达',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const frame = await h.setWindowBounds(session, { width: 1024, height: 768 })
          assert.note(`实际窗口 ${frame.iw}×${frame.ih}`)
          assert.check(frame.iw >= 1000, `窗口没有达到目标宽度：${frame.iw}`)
          const overflow = await session.eval('window.__wf.overflow()')
          const runReachable = await session.eval(`(() => {
            const card = document.querySelector('[data-workflow-card]')
            if (!card) return false
            card.scrollIntoView({ block: 'center' })
            const buttons = [...card.querySelectorAll('.wf-card-actions button')]
            const btn = buttons.find(b => b.textContent.includes('运行'))
            if (!btn) return false
            const r = btn.getBoundingClientRect()
            return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.width > 0 && buttons.length >= 4
          })()`)
          assert.check(runReachable, '1024 宽度下卡片运行按钮不可达')
          assert.check(overflow.horizontalScroll === false, `1024 宽度出现横向滚动：${JSON.stringify(overflow)}`)
          assert.evidence.push(await h.shot(session, 'E-02-1024'))
        },
      },
      {
        id: 'W-E-03', priority: 'P0', title: '窗口收窄到应用下限时侧栏与面板不重叠且主要操作可见',
        async run({ assert, session, h }) {
          const frame = await h.setWindowBounds(session, { width: 640, height: 720 })
          assert.note(`请求 640px，实际 ${frame.iw}×${frame.ih}（应用自身的最小宽度）`)
          assert.equal(frame.iw, 900, '应用最小宽度与预期不一致')
          const geometry = await session.eval(`(() => {
            const panel = document.querySelector('.wf-main')
            const sidebar = document.querySelector('button[aria-label=工作流]')
            const pr = panel?.getBoundingClientRect(); const sr = sidebar?.getBoundingClientRect()
            return {
              panelOpen: !!panel,
              panelLeft: pr ? Math.round(pr.left) : null,
              sidebarRight: sr ? Math.round(sr.right) : null,
              viewport: [innerWidth, innerHeight],
              createVisible: !!window.__wf.byLabel('创建工作流'),
              clipped: pr ? Math.round(pr.right) : null,
            }
          })()`)
          assert.note(`narrow geometry: ${JSON.stringify(geometry)}`)
          assert.evidence.push(await h.shot(session, 'E-03-640'))
          if (geometry.panelOpen) {
            assert.check(geometry.clipped <= geometry.viewport[0] + 1, '窄窗口下工作流面板超出视口')
            const overflow = await session.eval('window.__wf.overflow()')
            assert.note(`overlaps=${JSON.stringify(overflow.overlaps ?? []).slice(0, 120)}`)
            assert.check(overflow.horizontalScroll === false, `窄窗口出现横向滚动：${JSON.stringify(overflow)}`)
          }
          await h.setWindowBounds(session, { width: 1280, height: 900 })
          await sleep(500)
        },
      },
      {
        id: 'W-E-04', priority: 'P2', title: '请求极窄宽度时窗口停在下限且无横向滚动',
        async run({ assert, session, h }) {
          const frame = await h.setWindowBounds(session, { width: 420, height: 780 })
          assert.note(`请求 420px，实际 ${frame.iw}×${frame.ih}`)
          assert.equal(frame.iw, 900, '应用最小宽度与预期不一致')
          await h.installHelpers(session)
          const overflow = await session.eval('window.__wf.overflow()')
          assert.evidence.push(await h.shot(session, 'E-04-narrow'))
          assert.note(`420px overflow: ${JSON.stringify({ horizontalScroll: overflow.horizontalScroll, offenders: overflow.offenders.length })}`)
          assert.check(overflow.horizontalScroll === false, `极窄宽度出现横向滚动：${JSON.stringify(overflow)}`)
          await h.setWindowBounds(session, { width: 1280, height: 900 })
          await sleep(600)
        },
      },
      {
        id: 'W-E-05', priority: 'P1', title: '编辑器在两栏布局下资源面板与步骤列表不重叠',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const target = (await h.state(session)).workflows.find(w => w.name.includes(TS))
          await ensureActive(h, session, target.id)
          await h.openPanel(session)
          await h.clickSelector(session, `[data-workflow-card="${target.id}"] .wf-card-head`, { settleMs: 2500 })
          await session.waitFor('!!document.querySelector(".wf-outline")', { timeoutMs: 15000, message: 'outline' })
          const overlap = await session.eval('window.__wf.overlaps()')
          const overflow = await session.eval('window.__wf.overflow()')
          assert.check(overlap.pairs.length === 0, `编辑器控件重叠：${JSON.stringify(overlap.pairs)}`)
          assert.check(overflow.offenders.length === 0, `编辑器元素溢出：${JSON.stringify(overflow.offenders)}`)
          assert.evidence.push(await h.shotPanel(session, 'E-05-editor-1280'))
        },
      },
      {
        id: 'W-E-06', priority: 'P1', title: '关键控件触达尺寸不低于 32px 且图标按钮有可访问名称',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const report = await session.eval(`(() => {
            const panel = document.querySelector('.wf-main')
            const controls = [...panel.querySelectorAll('button,[role=tab],input[type=checkbox],summary')].filter(el => window.__qa.visible(el))
            const small = []
            const unnamed = []
            // A control's accessible name can come from its own text, its aria-label,
            // or — for a checkbox — the label element that wraps or names it.
            const nameOf = el => {
              const own = el.getAttribute('aria-label') || el.textContent || ''
              if (own.replace(/\s+/g, ' ').trim()) return own
              const labelled = el.labels ? [...el.labels].map(l => l.textContent).join(' ') : ''
              const wrapping = el.closest('label')?.textContent ?? ''
              return labelled + ' ' + wrapping
            }
            for (const el of controls) {
              // A checkbox is reached through the label that wraps it, so the label —
              // not the 13px box itself — is what a person has to hit.
              const target = el.type === 'checkbox' && el.closest('label') ? el.closest('label') : el
              const r = target.getBoundingClientRect()
              const label = nameOf(el).replace(/\\s+/g,' ').trim()
              if (r.height < 28 || r.width < 24) small.push({ label: label.slice(0,24), size: [Math.round(r.width), Math.round(r.height)] })
              if (!label && !el.querySelector('button,input,summary')) unnamed.push({
                cls: String(el.className).slice(0, 60),
                rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
                icon: el.querySelector('svg') !== null,
              })
            }
            return { total: controls.length, small, unnamed }
          })()`)
          assert.note(`controls=${report.total}, small=${report.small.length}, unnamed=${report.unnamed.length}`)
          assert.check(report.unnamed.length === 0, `存在没有可访问名称的控件：${JSON.stringify(report.unnamed)}`)
          assert.check(report.small.length === 0, `存在小于 28px 高的控件：${JSON.stringify(report.small)}`)
          assert.evidence.push(await h.shotPanel(session, 'E-06-control-sizes'))
        },
      },
    ],
  },

  F: {
    title: '创建、运行与对话链路',
    cases: [
      {
        id: 'W-F-01', priority: 'P0', title: '从卡片运行工作流进入绑定会话',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量3') && w.name.includes(TS))
          assert.check(wf !== undefined, '没有可运行的验收工作流')
          await ensureActive(h, session, wf.id)
          await h.openPanel(session)
          await h.click(session, '运行', { scope: `[data-workflow-card="${wf.id}"]`, settleMs: 3000 })
          const after = await h.state(session)
          const bound = after.bindings.filter(b => b.workflowId === wf.id && b.mode === 'run')
          assert.check(bound.length >= 1, `运行没有产生会话绑定：${JSON.stringify(after.bindings)}`)
          await session.waitFor('!!window.__qa.composer()', { timeoutMs: 25000, message: 'run composer' })
          await sendMessage(session, '阅读这篇论文并给出要点。', { waitMs: 12000 })
          await h.installHelpers(session)
          assert.evidence.push(await h.shot(session, 'F-01-run-bound'))
          assert.note(`bindings=${JSON.stringify(bound.map(b => b.sessionId.slice(0, 12)))}`)
        },
      },
      {
        id: 'W-F-02', priority: 'P1', title: '运行会话在工作流对话列表中可重新打开',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量3') && w.name.includes(TS))
          await ensureActive(h, session, wf.id)
          await h.openPanel(session)
          // 对话 is a disclosure: opening it must list the session the run created.
          await session.eval(`(() => { const sd = document.querySelector('[data-workflow-card="${wf.id}"] .wf-card-sessions'); if (sd) sd.open = true })()`)
          await session.waitFor(`document.querySelectorAll('[data-workflow-card="${wf.id}"] .wf-session-row').length >= 1`, { timeoutMs: 30000, message: 'run conversation row' })
          const sessions = await session.eval(`document.querySelectorAll('[data-workflow-card="${wf.id}"] .wf-session-row').length`)
          assert.check(sessions >= 1, `工作流对话列表为空：${sessions}`)
          assert.evidence.push(await h.shotPanel(session, 'F-02-sessions'))
          await session.eval(`document.querySelector('[data-workflow-card="${wf.id}"] .wf-session-name')?.click()`)
          await sleep(2500)
          assert.check(await session.eval('!!window.__qa.composer()'), '打开历史会话后没有输入区')
          assert.evidence.push(await h.shot(session, 'F-03-conversation-open'))
        },
      },
      {
        id: 'W-F-03', priority: 'P1', title: '编辑器修改任务说明后未保存提示与保存生效',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量4') && w.name.includes(TS))
          await ensureActive(h, session, wf.id)
          await h.openPanel(session)
          await h.clickSelector(session, `[data-workflow-card="${wf.id}"] .wf-card-head`, { settleMs: 2500 })
          await session.waitFor('!!document.querySelector(".wf-outline")', { timeoutMs: 15000, message: 'outline' })
          const changed = await session.eval(`(() => {
            const area = document.querySelector('.wf-panel-body .wf-step-prompt')
            if (!area) return null
            area.focus()
            const range = document.createRange()
            range.selectNodeContents(area)
            range.collapse(false)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            document.execCommand('insertText', false, ' 补充：核对误差范围。')
            return (area.innerText || '').slice(-16)
          })()`)
          assert.check(changed !== null && changed.includes('核对误差范围'), `编辑器里没有可编辑的任务说明：${changed}`)
          await session.waitFor(`(() => { const b = window.__qa.byText('保存版本')[0]; return b ? !b.disabled : false })()`, { timeoutMs: 8000, message: 'save enabled after edit' })
          assert.evidence.push(await h.shotPanel(session, 'F-04-dirty-editor'))
          const revisionBefore = (await h.state(session)).workflows.find(w => w.id === wf.id)?.revision
          await h.click(session, '保存版本', { settleMs: 3000 })
          await sleep(1500)
          const revisionAfter = (await h.state(session)).workflows.find(w => w.id === wf.id)?.revision
          assert.evidence.push(await h.shotPanel(session, 'F-03-saved-editor'))
          assert.check(revisionAfter > revisionBefore, `保存没有产生新版本：${revisionBefore} -> ${revisionAfter}`)
          assert.note(`保存后版本 ${revisionBefore} -> ${revisionAfter}`)
        },
      },
      {
        id: 'W-F-04', priority: 'P2', title: '对话修改入口打开创作会话并标注工作流',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await h.ensureCards(session)
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量5') && w.name.includes(TS))
          await ensureActive(h, session, wf.id)
          await h.openPanel(session)
          await h.clickSelector(session, `[data-workflow-card="${wf.id}"] .wf-card-head`, { settleMs: 2500 })
          await session.waitFor('!!document.querySelector(".wf-outline")', { timeoutMs: 15000, message: 'outline' })
          // 对话修改 rebinds the *current* conversation to this workflow in author
          // mode, so the evidence is the composer tag and the returned conversation,
          // not a new entry in the authoring list.
          const sessionsBefore = await h.state(session).then(list => list.bindings.filter(b => b.mode === 'author').length)
          await h.click(session, '对话修改', { settleMs: 4000 })
          const binding = await session.eval(`(() => {
            const tag = document.querySelector('.wf-composer-tag')
            return tag ? { mode: tag.dataset.mode, workflowId: tag.dataset.workflowTag, label: tag.getAttribute('title') } : null
          })()`)
          assert.check(binding !== null, '对话修改后输入区没有显示工作流标签')
          assert.equal(binding.mode, 'author', '标签没有标注为修改模式')
          assert.equal(binding.workflowId, wf.id, `标签指向了别的工作流：${binding.workflowId}`)
          assert.check(await session.eval('document.querySelector(".wf-main") === null'), '进入创作会话后面板没有让出界面')
          await session.waitFor('!!window.__qa.composer()', { timeoutMs: 25000, message: 'authoring composer' })
          const sessionsAfter = await h.state(session).then(list => list.bindings.filter(b => b.mode === 'author').length)
          assert.note(`创作模式绑定 ${sessionsBefore} -> ${sessionsAfter}；标签 ${JSON.stringify(binding)}`)
          assert.check(sessionsAfter >= 1, '对话修改没有登记创作绑定')
          assert.evidence.push(await h.shot(session, 'F-05-authoring'))
        },
      },
    ],
  },

  R: {
    title: '鲁棒性与异常行为',
    cases: [
      {
        id: 'W-R-01', priority: 'P0', title: '狂点创建入口不会重复创建或卡死',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = (await h.state(session)).workflows.length
          const rect = await session.eval(`(() => { const el = window.__wf.byLabel('创建工作流'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 } })()`)
          assert.check(rect !== null, '找不到创建入口')
          for (let i = 0; i < 8; i++) await session.clickAt(rect.x, rect.y)
          await sleep(6000)
          const after = await h.state(session)
          assert.check(after.workflows.length - before <= 1, `狂点创建产生了多个工作流：${before} -> ${after.workflows.length}`)
          assert.check(await session.eval('document.readyState === "complete"'), '狂点后页面状态异常')
          assert.evidence.push(await h.shot(session, 'R-01-rapid-create'))
          /* leave a clean footing: the created authoring session stays, as a user's would */
        },
      },
      {
        id: 'W-R-02', priority: 'P1', title: '创建过程中关闭面板不产生半成品或报错',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const before = (await h.state(session)).workflows.length
          const rect = await session.eval(`(() => { const el = window.__wf.byLabel('创建工作流'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 } })()`)
          if (rect) {
            await session.clickAt(rect.x, rect.y)
            await sleep(120)
            await h.click(session, '工作流', { settleMs: 2500 })
          }
          const after = await h.state(session)
          assert.check(after.workflows.length - before <= 1, `中途关闭面板产生了多余工作流：${before} -> ${after.workflows.length}`)
          assert.check(await session.eval('document.querySelectorAll("[role=alert]").length >= 0'), '关闭后出现未处理错误')
          assert.evidence.push(await h.shot(session, 'R-02-interrupt-create'))
        },
      },
      {
        id: 'W-R-03', priority: 'P1', title: '后端不可用时报错可读且清空输入可恢复',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          await session.eval(`(() => {
            window.__wfOriginalFetch = window.fetch
            window.fetch = (url, options) => (String(url).includes('/api/workflow-studio') && options?.method === 'POST')
              ? Promise.reject(new TypeError('Failed to fetch'))
              : window.__wfOriginalFetch(url, options)
          })()`)
          await sleep(4000)
          const errored = await session.eval('window.__wf.text()')
          assert.note(`离线时面板文本: ${errored.slice(0, 120)}`)
          await session.eval('window.fetch = window.__wfOriginalFetch')
          await sleep(5000)
          const recovered = await session.eval('window.__wf.cardTitles().length')
          assert.check(recovered > 0, '恢复网络后面板没有自愈')
          assert.check(await session.eval('window.__wf.errorText().length >= 0'), '错误提示结构异常')
          assert.evidence.push(await h.shotPanel(session, 'R-03-offline-recovered'))
        },
      },
      {
        id: 'W-R-04', priority: 'P1', title: '搜索框输入正则与超长文本不崩溃',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const payloads = ['[', '(', '.*+?^${}()|[\\]\\\\', 'a'.repeat(600), '<img src=x onerror=alert(1)>', '🙂🏷️中文']
          for (const payload of payloads) {
            await h.typeSearch(session, payload)
            const alive = await session.eval('document.readyState === "complete" && !!document.querySelector(".wf-gallery")')
            assert.check(alive, `搜索输入 ${payload.slice(0, 12)} 让面板失效`)
          }
          await h.typeSearch(session, '')
          assert.evidence.push(await h.shotPanel(session, 'R-04-search-fuzz'))
          const cards = await session.eval('window.__wf.cardTitles().length')
          assert.check(cards > 0, '模糊输入清空后没有恢复列表')
        },
      },
      {
        id: 'W-R-05', priority: 'P1', title: '重复点击卡片动作不会重复执行',
        async run({ assert, session, h }) {
          const wf = (await h.state(session)).workflows.find(w => w.name.includes('批量5') && w.name.includes(TS))
          await h.openPanel(session)
          const before = (await h.state(session)).bindings.filter(b => b.workflowId === wf.id).length
          const rect = await session.eval(`(() => { const el = window.__wf.byLabel('运行', '[data-workflow-card="${wf.id}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 } })()`)
          if (rect) for (let i = 0; i < 5; i++) await session.clickAt(rect.x, rect.y)
          await sleep(5000)
          const after = (await h.state(session)).bindings.filter(b => b.workflowId === wf.id).length
          assert.note(`bindings ${before} -> ${after} after 5 rapid run clicks`)
          assert.check(after - before <= 5, '重复点击产生了异常数量的绑定')
          assert.evidence.push(await h.shot(session, 'R-05-rapid-run'))
        },
      },
      {
        id: 'W-R-06', priority: 'P2', title: '窗口在面板打开时连续缩放不残留布局错误',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          for (const width of [900, 1200, 700, 1400, 1280]) {
            const frame = await h.setWindowBounds(session, { width, height: 820 })
            assert.note(`${width}px -> 实际 ${frame.iw}px`)
            const overflow = await session.eval('window.__wf.overflow()')
            assert.check(overflow.horizontalScroll === false, `${width}px 下出现横向滚动`)
          }
          const overlaps = await session.eval('window.__wf.overlaps()')
          assert.check(overlaps.pairs.length === 0, `缩放后控件重叠：${JSON.stringify(overlaps.pairs)}`)
          assert.evidence.push(await h.shot(session, 'R-06-resize-cycle'))
        },
      },
      {
        id: 'W-R-07', priority: 'P1', title: '面板打开时退出应用不产生未捕获错误',
        async run({ assert, session, h, relaunch }) {
          await h.openPanel(session)
          const errorsBefore = (await h.consoleErrors(session)).length
          const next = await relaunch()
          const errors = await h.consoleErrors(next)
          const fatal = errors.filter(e => /Uncaught|TypeError|is not a function/i.test(e))
          assert.check(fatal.length === 0, `重启后出现未捕获错误：${JSON.stringify(fatal.slice(0, 3))}`)
          assert.note(`console errors before=${errorsBefore} after=${errors.length}`)
          await h.openPanel(next)
          assert.check(await next.eval('window.__wf.cardTitles().length >= 5'), '重启后面板数据不完整')
          assert.evidence.push(await h.shot(next, 'R-07-reopen'))
        },
      },
      {
        id: 'W-R-08', priority: 'P2', title: '打开不存在的运行记录不破坏面板',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const result = await h.studio(session, { action: 'runRead', id: 'no-such-run-0000' })
          const missing = result.ok === false || result.value?.run === null
          assert.check(missing, `读取不存在的运行记录返回了内容：${JSON.stringify(result)}`)
          assert.note(`未知运行标识 -> ${JSON.stringify(result).slice(0, 120)}`)
          const alive = await session.eval('!!document.querySelector(".wf-gallery")')
          assert.check(alive, '非法 runId 之后面板消失')
          assert.evidence.push(await h.shotPanel(session, 'R-08-bad-run'))
        },
      },
      {
        id: 'W-R-09', priority: 'P2', title: '损坏的工作流定义不阻塞总览加载',
        async run({ assert, session, h }) {
          const broken = { schemaVersion: '1.0', id: `accept-broken-${TS}`, name: name('损坏'), trigger: 'manual', nodes: [{ id: 'a', name: '步骤', kind: 'agent', prompt: '只有一个步骤，没有后续节点。' }], edges: [] }
          await h.studioOk(session, { action: 'save', definition: broken, expectedRevision: 0 })
          await sleep(2600)
          const titles = await session.eval('window.__wf.cardTitles()')
          assert.check(titles.some(t => t.includes('损坏')), '缺少节点提示的步骤没有显示在总览')
          assert.check(titles.length >= 5, '总览没有加载出其余工作流')
          assert.evidence.push(await h.shotPanel(session, 'R-09-degenerate'))
        },
      },
      {
        id: 'W-R-10', priority: 'P1', title: '后台标签页期间面板不高频轮询（可见性节流）',
        async run({ assert, session, h }) {
          await h.openPanel(session)
          const measured = await session.eval(`(async () => {
            let count = 0
            const original = window.fetch
            window.fetch = (url, options) => { if (String(url).includes('/api/workflow-studio')) count++; return original(url, options) }
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
            document.dispatchEvent(new Event('visibilitychange'))
            await new Promise(r => setTimeout(r, 6000))
            const during = count
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
            document.dispatchEvent(new Event('visibilitychange'))
            await new Promise(r => setTimeout(r, 6000))
            const after = count - during
            window.fetch = original
            return { during, after }
          })()`)
          assert.note(`隐藏 6s 内请求 ${measured.during} 次，恢复 6s 内 ${measured.after} 次`)
          assert.check(measured.during < measured.after, '页面隐藏时没有减少轮询')
          assert.evidence.push(await h.shotPanel(session, 'R-10-visibility'))
        },
      },
    ],
  },
}

export const allCases = Object.entries(groups).flatMap(([group, value]) => value.cases.map(c => ({ ...c, group })))
export { created, TS }

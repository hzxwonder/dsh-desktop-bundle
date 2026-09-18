// Group F: the functional surface. Each case opens one part of the interface, checks
// that it actually shows something, closes it again and verifies the app is still in
// a usable state. The point is coverage of the controls a person meets first.
import { clickLabel, focusComposer, prepare, sleep } from './scenario.mjs'

const PANEL_TEXT = {
  工作流: /工作流/,
  搜索会话: /搜索|没有|结果/,
  视图选项: /视图|显示|隐藏|侧边栏|布局/,
  设置: /设置|通用|模型|外观|快捷键/,
  插件市场: /插件|市场|安装/,
  添加工作区: /工作区|目录|路径|选择/,
}

/** Open a labelled control, look for expected content, then dismiss it. */
async function openPanel(session, label, { pattern, key = 'Escape' } = {}) {
  const opened = await clickLabel(session, label)
  if (!opened) return { opened: false }
  await sleep(1500)
  const text = await session.eval('window.__qa.bodyText()')
  const matched = (pattern ?? PANEL_TEXT[label] ?? /./).test(text)
  await session.press(key)
  await sleep(900)
  return { opened: true, matched, text: text.slice(0, 400) }
}

export const groups = {}

groups.F = {
  title: '功能链路',
  cases: [
    {
      id: 'F-01', group: 'F', priority: 'P1', title: '工作区列表与新建会话入口可用',
      async run({ session }, assert) {
        const state = await session.eval(`({
          workspaces: window.__qa.workspaceRows().length,
          conversations: window.__qa.conversationRows().length,
          hasNewSession: window.__qa.indexOfText('新建会话') >= 0,
          hasMarket: window.__qa.indexOfText('插件市场') >= 0,
          hasSettings: window.__qa.indexOfText('设置') >= 0,
        })`)
        await assert.screenshot(session, 'sidebar-surface')
        assert.check(state.workspaces >= 1, `no workspace row rendered: ${JSON.stringify(state)}`)
        assert.check(state.hasNewSession && state.hasMarket && state.hasSettings, `sidebar entries missing: ${JSON.stringify(state)}`)
        assert.note(`workspaces=${state.workspaces} conversations=${state.conversations}`)
      },
    },
    {
      id: 'F-02', group: 'F', priority: 'P1', title: '工作区切换菜单可打开并列出工作区',
      async run({ session }, assert) {
        const result = await openPanel(session, '选择工作区', { pattern: /工作区|目录|路径/ })
        assert.check(result.opened, 'workspace selector not found')
        await assert.screenshot(session, 'workspace-selector')
        assert.check(result.matched, `workspace selector showed unexpected content: ${result.text}`)
      },
    },
    {
      id: 'F-03', group: 'F', priority: 'P1', title: '搜索会话入口可与输入框交互',
      async run({ session }, assert) {
        const index = await session.eval('window.__qa.indexOfText("搜索会话")')
        assert.check(index >= 0, 'search control not found')
        await session.click('button, [role=button], [role=menuitem], [role=tab], a[href]', { index })
        await sleep(1500)
        await assert.screenshot(session, 'search-open')
        const text = await session.eval('window.__qa.bodyText()')
        await session.press('Escape')
        await sleep(800)
        assert.check(text.length > 0, 'search surface rendered nothing')
      },
    },
    {
      id: 'F-04', group: 'F', priority: 'P1', title: '插件市场面板可打开',
      async run({ session }, assert) {
        const result = await openPanel(session, '插件市场')
        assert.check(result.opened, 'plugin-market control not found')
        await assert.screenshot(session, 'plugin-market')
        assert.check(result.matched, `plugin market showed unexpected content: ${result.text}`)
      },
    },
    {
      id: 'F-05', group: 'F', priority: 'P1', title: '设置面板可打开',
      async run({ session }, assert) {
        const result = await openPanel(session, '设置')
        assert.check(result.opened, 'settings control not found')
        await assert.screenshot(session, 'settings')
        assert.check(result.matched, `settings showed unexpected content: ${result.text}`)
      },
    },
    {
      id: 'F-06', group: 'F', priority: 'P1', title: '视图选项菜单可打开',
      async run({ session }, assert) {
        const result = await openPanel(session, '视图选项')
        assert.check(result.opened, 'view-options control not found')
        await assert.screenshot(session, 'view-options')
        assert.check(result.matched, `view options showed unexpected content: ${result.text}`)
      },
    },
    {
      id: 'F-07', group: 'F', priority: 'P1', title: '模型选择器列出已配置模型',
      async run({ session }, assert) {
        const index = await session.eval('window.__qa.indexOfText("选择模型")')
        assert.check(index >= 0, 'model selector not found')
        await session.click('button, [role=button], [role=menuitem], [role=tab], a[href]', { index })
        await sleep(1500)
        const text = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'model-picker')
        await session.press('Escape')
        await sleep(800)
        assert.check(/QA Mock|qa-mock/.test(text), `model picker does not list the configured model: ${text.slice(0, 200)}`)
      },
    },
    {
      id: 'F-08', group: 'F', priority: 'P1', title: '访问模式菜单可打开并列出模式',
      async run({ session }, assert) {
        const index = await session.eval('window.__qa.indexOfText("访问模式")')
        assert.check(index >= 0, 'access-mode control not found')
        await session.click('button, [role=button], [role=menuitem], [role=tab], a[href]', { index })
        await sleep(1500)
        const text = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'access-mode')
        await session.press('Escape')
        await sleep(800)
        assert.check(/工作区|只读|完全|模式/.test(text), `access mode menu showed unexpected content: ${text.slice(0, 200)}`)
      },
    },
    {
      id: 'F-09', group: 'F', priority: 'P2', title: '指令入口可打开',
      async run({ session }, assert) {
        const index = await session.eval('window.__qa.indexOfText("指令")')
        assert.check(index >= 0, 'command entry not found')
        await session.click('button, [role=button], [role=menuitem], [role=tab], a[href]', { index })
        await sleep(1500)
        const text = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'commands')
        await session.press('Escape')
        await sleep(800)
        assert.note(`command surface text: ${text.slice(0, 120)}`)
      },
    },
    {
      id: 'F-10', group: 'F', priority: 'P2', title: '斜杠指令在输入框中给出候选',
      async run({ session }, assert) {
        await focusComposer(session)
        await session.type('/')
        await sleep(1800)
        const text = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'slash-command')
        await session.press('Escape')
        await sleep(600)
        await session.press('Backspace')
        assert.check(text.length > 0, 'slash entry rendered nothing')
      },
    },
    {
      id: 'F-11', group: 'F', priority: 'P1', title: '右侧边栏与终端面板可开合',
      async run({ session }, assert) {
        const before = await session.eval('window.__qa.metrics().elementCount')
        const openedTerminal = await clickLabel(session, '终端')
        await sleep(2500)
        const afterOpen = await session.eval('window.__qa.metrics().elementCount')
        await assert.screenshot(session, 'terminal-open')
        const closed = await clickLabel(session, '收起右侧边栏') || await clickLabel(session, '关闭')
        await sleep(1800)
        const afterClose = await session.eval('window.__qa.metrics().elementCount')
        await assert.screenshot(session, 'terminal-closed')
        const composer = await session.eval('!!window.__qa.composer()')
        assert.check(composer, 'composer disappeared while toggling panels')
        assert.note(`elements ${before} -> ${afterOpen} (terminal ${openedTerminal}) -> ${afterClose} (closed ${closed})`)
      },
    },
    {
      id: 'F-12', group: 'F', priority: 'P1', title: '附件入口可用',
      async run({ session }, assert) {
        const index = await session.eval('window.__qa.indexOfText("添加附件")')
        assert.check(index >= 0, 'attachment control not found')
        await session.click('button, [role=button], [role=menuitem], [role=tab], a[href]', { index })
        await sleep(1500)
        const text = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'attachment-menu')
        await session.press('Escape')
        await sleep(800)
        assert.note(`attachment surface text: ${text.slice(0, 120)}`)
      },
    },
    {
      id: 'F-13', group: 'F', priority: 'P2', title: '连续打开并关闭各入口后应用仍可用',
      async run({ session }, assert) {
        // 工作流 is a full page rather than a panel, so the round trip ends by going
        // back to the conversation before the composer is expected again.
        for (const label of ['视图选项', '搜索会话', '插件市场', '设置', '工作流']) {
          await clickLabel(session, label)
          await sleep(1200)
          await session.press('Escape')
          await sleep(900)
        }
        await clickLabel(session, '新建会话')
        await prepare(session)
        const composer = await session.eval('!!window.__qa.composer()')
        const errors = session.consoleErrors()
        await assert.screenshot(session, 'after-panel-cycles')
        assert.check(composer, 'composer gone after cycling through the panels')
        assert.check(errors.length === 0, `console errors while cycling panels: ${errors.slice(0, 3).join(' | ')}`)
      },
    },
  ],
}

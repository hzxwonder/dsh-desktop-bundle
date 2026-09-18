// Group A (startup and conversation lifecycle) and group B (closing, backgrounding,
// reopening and process behaviour).
//
// The environment cannot inject native menu keystrokes (macOS Accessibility is not
// granted to the test process), so the closing and backgrounding cases drive the
// window through the DevTools protocol and the application's own shutdown path
// instead. Every such substitution is named in the case title.
import { execFileSync } from 'node:child_process'
import {
  activateApp, activationCrash, appProcessCount, clickLabel, dismissWelcome, focusComposer,
  killApp, mainProcessId, prepare, requestQuitBySignal, sendMessage, sleep, startConversation,
  welcomeVisible,
} from './scenario.mjs'

export const groups = {}

groups.A = {
  title: '启动与会话生命周期',
  cases: [
    {
      id: 'A-01', group: 'A', priority: 'P0', title: '冷启动进入主界面且输入框可用',
      async run({ session }, assert) {
        const state = await session.eval(`({
          url: location.href,
          composer: !!window.__qa.composer(),
          theme: window.__qa.theme(),
          metrics: window.__qa.metrics(),
        })`)
        await assert.screenshot(session, 'boot')
        assert.check(state.url.startsWith('http://127.0.0.1'), `renderer did not load the local session page: ${state.url}`)
        assert.check(!state.url.includes('recovery.html'), 'application opened the recovery window for a healthy home')
        assert.check(state.composer, 'composer missing on first boot')
        assert.note(`viewport ${state.metrics.viewport.join('x')}, theme ${state.theme.colorScheme}`)
      },
    },
    {
      id: 'A-02', group: 'A', priority: 'P1', title: '首次运行的欢迎浮层可关闭且不阻塞输入',
      async run({ session }, assert) {
        const present = await welcomeVisible(session)
        assert.note(present ? 'welcome overlay shown on this profile' : 'welcome overlay already dismissed in this home')
        if (present) {
          await assert.screenshot(session, 'welcome')
          assert.check(await dismissWelcome(session), 'continue control did not dismiss the overlay')
          await sleep(800)
          assert.check(!(await welcomeVisible(session)), 'overlay still visible after confirming')
        }
        assert.check(await session.eval('!!window.__qa.composer()'), 'composer missing after onboarding')
      },
    },
    {
      id: 'A-03', group: 'A', priority: 'P0', title: '新建会话进入可输入状态',
      async run({ session }, assert) {
        assert.check(await clickLabel(session, '新建会话'), 'new-conversation control not found')
        await sleep(1500)
        await assert.screenshot(session, 'new-conversation')
        assert.check(await session.eval('!!window.__qa.composer()'), 'composer missing after starting a conversation')
        await focusComposer(session)
        await session.type('QA draft text')
        await sleep(600)
        const text = await session.eval('window.__qa.composerText()')
        assert.check(text.includes('QA draft text'), `composer did not accept typing: ${JSON.stringify(text.slice(0, 80))}`)
      },
    },
    {
      id: 'A-04', group: 'A', priority: 'P0', title: '发出消息后收到回复且会话被记录',
      async run({ session }, assert) {
        await sendMessage(session, 'QA: first conversation', { waitMs: 20000 })
        await assert.screenshot(session, 'first-reply')
        const state = await session.eval(`({ text: window.__qa.bodyText(), rows: window.__qa.conversationRows().length })`)
        assert.check(/QA mock reply/.test(state.text), `mock reply not rendered: ${state.text.slice(-200)}`)
        assert.check(state.rows >= 1, `conversation not listed in the sidebar: ${state.rows} rows`)
        assert.note(`sidebar rows: ${state.rows}`)
      },
    },
    {
      id: 'A-05', group: 'A', priority: 'P1', title: '连续创建 3 个会话各自独立',
      async run({ session }, assert) {
        const transcripts = []
        for (let round = 1; round <= 3; round += 1) {
          await startConversation(session, `QA: conversation ${round}`)
          transcripts.push(await session.eval('window.__qa.bodyText().slice(-200)'))
        }
        await assert.screenshot(session, 'three-conversations')
        const rows = await session.eval('window.__qa.conversationRows().length')
        const errors = session.consoleErrors()
        assert.check(new Set(transcripts).size === 3, 'conversations rendered identical content')
        assert.check(errors.length === 0, `console errors while creating conversations: ${errors.slice(0, 2).join(' | ')}`)
        assert.note(`sidebar rows after three conversations: ${rows}`)
      },
    },
    {
      id: 'A-06', group: 'A', priority: 'P1', title: '快速连点新建会话不产生重复会话',
      async run({ session }, assert) {
        const before = await session.eval('window.__qa.conversationRows().length')
        const rect = await session.eval('window.__qa.rectOfText("新会话")')
        assert.check(rect !== null, 'new-conversation control not found')
        for (let click = 0; click < 5; click += 1) {
          await session.clickAt(rect.x + rect.width / 2, rect.y + rect.height / 2)
          await sleep(150)
        }
        await sleep(5000)
        await assert.screenshot(session, 'rapid-new-conversation')
        const after = await session.eval('window.__qa.conversationRows().length')
        const errors = session.consoleErrors()
        assert.check(errors.length === 0, `console errors during rapid clicks: ${errors.slice(0, 2).join(' | ')}`)
        assert.check(after <= before + 1, `rapid clicks added ${after - before} conversation rows`)
        assert.note(`rows before=${before} after=${after}`)
      },
    },
    {
      id: 'A-07', group: 'A', priority: 'P1', title: '会话之间切换内容不串',
      async run({ session }, assert) {
        const rows = await session.eval(`window.__qa.conversationRows().slice(0, 3).map(el => {
          const rect = el.getBoundingClientRect()
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        })`)
        assert.check(rows.length >= 2, `need two conversations to switch, found ${rows.length}`)
        await session.clickAt(rows[0].x, rows[0].y)
        await sleep(2500)
        const first = await session.eval('window.__qa.bodyText().slice(0, 200)')
        await session.clickAt(rows[1].x, rows[1].y)
        await sleep(2500)
        const second = await session.eval('window.__qa.bodyText().slice(0, 200)')
        await assert.screenshot(session, 'switched')
        assert.check(first !== second, 'both conversations rendered identical content after switching')
      },
    },
    {
      id: 'A-08', group: 'A', priority: 'P1', title: '刷新渲染进程后会话记录保持',
      async run({ session }, assert) {
        const before = await session.eval('window.__qa.conversationRows().length')
        await session.eval('location.reload()')
        await sleep(10000)
        await prepare(session)
        await session.waitFor('document.readyState === "complete"', { timeoutMs: 40000, message: 'reload finished' })
        await sleep(3000)
        await assert.screenshot(session, 'after-reload')
        const after = await session.eval('window.__qa.conversationRows().length')
        assert.check(after >= before, `conversation rows shrank after reload: before=${before} after=${after}`)
      },
    },
    {
      id: 'A-09', group: 'A', priority: 'P2', title: '工作区菜单可打开并给出工作区入口',
      async run({ session }, assert) {
        const opened = await clickLabel(session, '选择工作区')
          || await clickLabel(session, '添加工作区')
          || await session.click('[role=treeitem][aria-expanded]', { index: 0 }).then(() => true).catch(() => false)
        assert.check(opened, 'no workspace control found in the sidebar')
        await sleep(1000)
        await assert.screenshot(session, 'workspace-menu')
        const text = await session.eval('window.__qa.bodyText()')
        assert.check(/工作区/.test(text), 'workspace menu content missing')
        await session.press('Escape')
        await sleep(600)
      },
    },
    {
      id: 'A-10', group: 'A', priority: 'P2', title: '输入超长草稿不卡死',
      async run({ session }, assert) {
        await clickLabel(session, '新建会话')
        await sleep(1200)
        await focusComposer(session)
        await session.type(`QA长文本${'x'.repeat(3000)}`, { delayMs: 0 })
        await sleep(2500)
        const text = await session.eval('window.__qa.composerText()')
        await assert.screenshot(session, 'long-input')
        assert.check(text.length > 1000, `composer dropped most of the long input (${text.length} chars)`)
        const connected = await session.eval('(() => { const node = window.__qa.composer(); return !!node && node.isConnected })()')
        assert.check(connected, 'composer disappeared after a long input')
      },
    },
  ],
}

groups.B = {
  title: '关闭、后台化、重开与进程行为',
  cases: [
    {
      id: 'A-11', group: 'A', priority: 'P1', title: '首轮对话全程无失败请求与控制台错误',
      async run(context, assert) {
        const before = context.session.responseCount()
        await startConversation(context.session, `QA: network ${Date.now() % 100000}`)
        const responses = context.session.responseCount() - before
        const failed = context.session.failedResponses()
        const errors = context.session.consoleErrors()
        await assert.screenshot(context.session, 'network-clean')
        assert.check(responses > 0, 'the renderer reported no network activity at all, so nothing was verified')
        assert.check(failed.length === 0, `failed requests during a conversation: ${failed.slice(0, 3).join(' | ')}`)
        assert.check(errors.length === 0, `console errors during a conversation: ${errors.slice(0, 3).join(' | ')}`)
        assert.note(`observed ${responses} responses, 0 failed, 0 console errors`)
      },
    },
    {
      id: 'B-01', group: 'B', priority: 'P0', title: '关闭窗口后应用按设计驻留后台',
      async run(context, assert) {
        const session = context.session
        await startConversation(session, 'QA: keep this conversation')
        context.state.rows = await session.eval('window.__qa.conversationRows().length')
        context.state.frame = await session.eval('window.__qa.frame()')
        const before = appProcessCount()
        await session.closeWindow()
        await sleep(6000)
        const after = appProcessCount()
        assert.note(`frame before close: ${JSON.stringify(context.state.frame)}; processes ${before} -> ${after}`)
        assert.check(after > 0, 'every process exited when the window closed; the tray-resident design expects the app to stay')
        assert.check(mainProcessId() > 0, 'the main process disappeared even though the app should stay resident')
      },
    },
    {
      id: 'B-02', group: 'B', priority: 'P0', title: '再次启动应用后窗口与会话列表恢复',
      async run(context, assert) {
        const before = appProcessCount()
        const exit = await startSecondInstance()
        await sleep(5000)
        const after = appProcessCount()
        const crash = activationCrash()
        assert.note(`second launch exit code ${exit}; processes ${before} -> ${after}`)
        if (crash !== undefined) assert.note(`app error log: ${crash}`)
        assert.check(crash === undefined || after > 0, `launching the app again killed the resident process: ${crash}`)
        const session = await context.attach()
        const rows = await session.eval('window.__qa.conversationRows().length')
        await assert.screenshot(session, 'reactivated')
        assert.check(rows >= 1, `conversation rows lost after reopening the window: ${rows}`)
        assert.note(`rows ${context.state.rows} -> ${rows}`)
      },
    },
    {
      id: 'B-03', group: 'B', priority: 'P1', title: '重开后窗口几何保持',
      async run(context, assert) {
        const frame = await context.session.eval('window.__qa.frame()')
        assert.note(`frame before=${JSON.stringify(context.state.frame)} after=${JSON.stringify(frame)}`)
        assert.check(frame.width > 0 && frame.height > 0, `window frame unreadable after reopening: ${JSON.stringify(frame)}`)
        assert.near(frame.width, context.state.frame.width, 8, 'window width changed across the window being closed and reopened')
        assert.near(frame.height, context.state.frame.height, 8, 'window height changed across the window being closed and reopened')
      },
    },
    {
      id: 'B-04', group: 'B', priority: 'P1', title: '点击 Dock 图标后窗口能够回来',
      async run(context, assert) {
        // The window is closed first, so the question is exactly what a person faces
        // after closing the window and then clicking the Dock icon.
        await context.session.closeWindow()
        await sleep(4000)
        activateApp()
        await sleep(6000)
        const crash = activationCrash()
        if (crash !== undefined) assert.note(`app error log: ${crash}`)
        assert.note(`processes after activation: ${appProcessCount()}`)
        const reopened = await context.tryAttach()
        if (reopened === undefined) {
          assert.check(false, `the Dock icon did not bring the window back (${crash ?? 'no window, process still resident'})`)
        }
        const rows = await reopened.eval('window.__qa.conversationRows().length')
        await assert.screenshot(reopened, 'dock-reactivated')
        assert.check(rows >= 1, `conversation rows lost after Dock activation: ${rows}`)
      },
    },
    {
      id: 'B-05', group: 'B', priority: 'P1', title: '收到退出请求后进程干净退出',
      async run(context, assert) {
        const requested = requestQuitBySignal('SIGTERM')
        assert.check(requested, 'no main process to signal')
        await sleep(8000)
        const remaining = appProcessCount()
        assert.check(remaining === 0, `${remaining} processes still alive after a shutdown request`)
      },
    },
    {
      id: 'B-06', group: 'B', priority: 'P1', title: '重启后会话记录与几何恢复',
      async run(context, assert) {
        const session = await context.relaunch()
        await sleep(4000)
        const rows = await session.eval('window.__qa.conversationRows().length')
        const frame = await session.eval('window.__qa.frame()')
        await assert.screenshot(session, 'after-restart')
        assert.check(rows >= 1, `conversation rows empty after restart: ${rows}`)
        assert.near(frame.width, context.state.frame.width, 8, 'window width not restored from the saved state')
        assert.note(`rows ${context.state.rows} -> ${rows}, frame ${JSON.stringify(frame)}`)
      },
    },
    {
      id: 'B-07', group: 'B', priority: 'P1', title: '窗口尺寸变更后重启仍保持',
      async run(context, assert) {
        const resized = await context.session.resize(1024, 700, { settleMs: 1800 })
        assert.check(resized.supported, `the window did not accept a resize request: ${JSON.stringify(resized)}`)
        await assert.screenshot(context.session, 'resized-before-restart')
        const restarted = await context.relaunch()
        await sleep(4000)
        const frame = await restarted.eval('window.__qa.frame()')
        await assert.screenshot(restarted, 'resized-after-restart')
        assert.near(frame.width, 1024, 16, 'window width not restored after a resize and restart')
        assert.near(frame.height, 700, 16, 'window height not restored after a resize and restart')
        assert.note(`frame after restart: ${JSON.stringify(frame)}`)
      },
    },
    {
      id: 'B-08', group: 'B', priority: 'P1', title: '后台冻结后恢复内容与输入都正常',
      async run(context, assert) {
        const session = context.session
        const frozen = await session.setLifecycleState('frozen')
        if (!frozen) {
          assert.note('the runtime refused the frozen lifecycle state; covered by the manual checklist')
          return
        }
        await sleep(4000)
        await session.setLifecycleState('active')
        await sleep(3000)
        const rows = await session.eval('window.__qa.conversationRows().length')
        const errors = session.consoleErrors()
        await assert.screenshot(session, 'after-background-return')
        assert.check(rows >= 1, `conversation rows lost after returning from the background: ${rows}`)
        assert.check(errors.length === 0, `console errors after returning from the background: ${errors.slice(0, 2).join(' | ')}`)
      },
    },
    {
      id: 'B-09', group: 'B', priority: 'P1', title: '应用已运行时再次启动不产生第二实例',
      async run(context, assert) {
        const before = appProcessCount()
        const exit = await startSecondInstance()
        await sleep(4000)
        const after = appProcessCount()
        await assert.screenshot(context.session, 'second-instance')
        assert.check(Math.abs(after - before) <= 2, `process count changed by ${after - before} on a second launch`)
        assert.note(`second launch exit code ${exit}; processes ${before} -> ${after}`)
      },
    },
    {
      id: 'B-10', group: 'B', priority: 'P2', title: '强制结束后重启数据仍可读',
      async run(context, assert) {
        killApp()
        await sleep(3000)
        const session = await context.relaunch()
        await sleep(4000)
        const rows = await session.eval('window.__qa.conversationRows().length')
        await assert.screenshot(session, 'after-forced-kill')
        assert.check(rows >= 1, `conversation rows unreadable after a forced kill: ${rows}`)
      },
    },
  ],
}

async function startSecondInstance() {
  try {
    execFileSync('/Applications/DSH Desktop.app/Contents/MacOS/DSH Desktop', [], { stdio: 'ignore', timeout: 20000 })
    return 0
  } catch (error) {
    return error.status ?? 'nonzero'
  }
}

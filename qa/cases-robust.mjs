// Group R: robustness against unusual, careless and hostile usage. Every case here
// stands for something a person actually does: pressing Enter on an empty box,
// pasting a wall of text, killing the app mid-answer, pointing it at a broken home.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  clickLabel, focusComposer, prepare, sendMessage, sleep, startConversation,
} from './scenario.mjs'

const MOCK_LOG = '/tmp/dsh-qa-mock-llm.log'

export const groups = {}

groups.R = {
  title: '鲁棒性与异常输入',
  cases: [
    {
      id: 'R-01', group: 'R', priority: 'P0', title: '空输入回车不产生空会话',
      async run({ session }, assert) {
        const before = await session.eval('window.__qa.conversationTitles().length')
        await focusComposer(session)
        for (let round = 0; round < 3; round += 1) {
          await session.press('Enter')
          await sleep(600)
        }
        await session.type('   ')
        await session.press('Enter')
        await sleep(3000)
        const after = await session.eval('window.__qa.conversationTitles().length')
        const errors = session.consoleErrors()
        await assert.screenshot(session, 'empty-enter')
        assert.check(after <= before, `empty submissions created ${after - before} conversation(s)`)
        assert.check(errors.length === 0, `console errors on empty submit: ${errors.slice(0, 2).join(' | ')}`)
      },
    },
    {
      id: 'R-02', group: 'R', priority: 'P1', title: '粘贴超长文本不崩溃且可继续操作',
      async run({ session }, assert) {
        await startConversation(session)
        await focusComposer(session)
        const huge = 'A'.repeat(20000) + '\n第二行中文\n' + 'B'.repeat(20000)
        await session.eval(`(() => {
          const node = window.__qa.composer()
          node.focus()
          const data = new DataTransfer()
          data.setData('text/plain', ${JSON.stringify(huge)})
          node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
          return true
        })()`)
        await sleep(3000)
        const length = await session.eval('window.__qa.composerText().length')
        const alive = await session.eval('!!window.__qa.composer() && window.__qa.composer().isConnected')
        const errors = session.consoleErrors()
        await assert.screenshot(session, 'huge-paste')
        assert.check(alive, 'composer detached after a very large paste')
        assert.check(errors.length === 0, `console errors after a very large paste: ${errors.slice(0, 2).join(' | ')}`)
        assert.note(`composer holds ${length} characters after pasting 40k`)
      },
    },
    {
      id: 'R-03', group: 'R', priority: 'P1', title: '表情、CJK 与控制字符混合输入正确回显',
      async run({ session }, assert) {
        await startConversation(session)
        const sample = 'QA🙂中文テスト\u200b零宽'
        await focusComposer(session)
        await session.type(sample)
        await sleep(1000)
        const text = await session.eval('window.__qa.composerText()')
        await assert.screenshot(session, 'unicode-input')
        assert.check(text.includes('中文') && text.includes('QA'), `composer mangled the sample: ${JSON.stringify(text.slice(0, 40))}`)
        assert.note(`composer text: ${JSON.stringify(text.slice(0, 40))}`)
      },
    },
    {
      id: 'R-04', group: 'R', priority: 'P1', title: '发送过程中重复回车不产生重复消息',
      async run({ session }, assert) {
        await startConversation(session)
        const marker = 'QA: duplicate guard'
        await focusComposer(session)
        await session.type(marker)
        for (let round = 0; round < 4; round += 1) {
          await session.press('Enter')
          await sleep(120)
        }
        await sleep(20000)
        const occurrences = await session.eval(`(() => {
          const sidebar = document.querySelector('[class*=EXfQ3q_root]')
          const edge = sidebar === null ? 0 : sidebar.getBoundingClientRect().right
          return [...document.querySelectorAll('body *')]
            .filter(el => el.childElementCount === 0
              && (el.textContent || '').includes(${JSON.stringify(marker)})
              && el.getBoundingClientRect().x >= edge)
            .length
        })()`)
        await assert.screenshot(session, 'duplicate-guard')
        assert.check(occurrences <= 1, `the same message was sent ${occurrences} times by repeated Enter presses`)
      },
    },
    {
      id: 'R-05', group: 'R', priority: 'P0', title: '模型服务不可用时错误可见且界面可继续使用',
      async run(context, assert) {
        const session = context.session
        context.stopMock()
        await sleep(1500)
        try {
          await startConversation(session, 'QA: provider offline')
          const text = await session.eval('window.__qa.bodyText()')
          await assert.screenshot(session, 'provider-offline')
          const alive = await session.eval('!!window.__qa.composer()')
          const errors = session.consoleErrors()
          assert.check(alive, 'composer disappeared after a provider failure')
          assert.check(/失败|错误|异常|error|重试|不可用/i.test(text),
            `no error surfaced when the provider was unreachable: ${text.slice(0, 200)}`)
          assert.check(errors.length === 0, `console errors during a provider failure: ${errors.slice(0, 2).join(' | ')}`)
        } finally {
          context.startMock()
          await sleep(2000)
        }
      },
    },
    {
      id: 'R-06', group: 'R', priority: 'P1', title: '模型服务恢复后可以继续发送',
      async run({ session }, assert) {
        await startConversation(session, 'QA: provider recovered')
        const text = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'provider-recovered')
        assert.check(/QA mock reply/.test(text), `no answer after the provider came back: ${text.slice(-200)}`)
      },
    },
    {
      id: 'R-07', group: 'R', priority: 'P1', title: '回答生成中关闭窗口后重启无损坏',
      async run(context, assert) {
        const session = context.session
        await clickLabel(session, '新建会话')
        await sleep(1200)
        await focusComposer(session)
        await session.type('QA: killed mid answer')
        await session.press('Enter')
        await sleep(1200) // deliberately far too early
        context.killApp()
        await sleep(3000)
        const restarted = await context.relaunch()
        await sleep(3000)
        const titles = await restarted.eval('window.__qa.conversationTitles().length')
        await assert.screenshot(restarted, 'after-mid-answer-kill')
        const errors = restarted.consoleErrors()
        assert.check(titles >= 1, `conversation list unreadable after killing the app mid-answer: ${titles}`)
        assert.check(errors.length === 0, `console errors after restarting: ${errors.slice(0, 2).join(' | ')}`)
      },
    },
    {
      id: 'R-08', group: 'R', priority: 'P1', title: '连续刷新 5 次无错误且状态保持一致',
      async run({ session }, assert) {
        for (let round = 0; round < 5; round += 1) {
          await session.eval('location.reload()')
          await sleep(4500)
          await prepare(session)
        }
        await sleep(3000)
        const titles = await session.eval('window.__qa.conversationTitles().length')
        const errors = session.consoleErrors()
        const failed = session.failedResponses()
        const responses = session.responseCount()
        await assert.screenshot(session, 'after-five-reloads')
        assert.note(`observed ${responses} responses across the reloads`)
        assert.check(responses > 0, 'the renderer reported no network activity at all, so nothing was verified')
        assert.check(titles >= 1, `conversation list empty after five reloads: ${titles}`)
        assert.check(errors.length === 0, `console errors across reloads: ${errors.slice(0, 3).join(' | ')}`)
        assert.check(failed.length === 0, `failed network requests across reloads: ${failed.slice(0, 3).join(' | ')}`)
      },
    },
    {
      id: 'R-09', group: 'R', priority: 'P2', title: '快速切换会话 20 次不崩溃',
      async run({ session }, assert) {
        for (const label of ['QA: switch one', 'QA: switch two']) await startConversation(session, label)
        const rows = await session.eval(`window.__qa.conversationRows().slice(0, 4).map(el => {
          const rect = el.getBoundingClientRect()
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        })`)
        assert.check(rows.length >= 2, `need at least two conversations, found ${rows.length}`)
        for (let round = 0; round < 20; round += 1) {
          const row = rows[round % rows.length]
          await session.clickAt(row.x, row.y)
          await sleep(220)
        }
        await sleep(4000)
        const errors = session.consoleErrors()
        await assert.screenshot(session, 'after-rapid-switching')
        assert.check(errors.length === 0, `console errors while switching conversations: ${errors.slice(0, 2).join(' | ')}`)
        assert.check(await session.eval('!!window.__qa.composer()'), 'composer gone after rapid switching')
      },
    },
    {
      id: 'R-10', group: 'R', priority: 'P1', title: '控件快速连点 20 次不产生异常状态',
      async run({ session }, assert) {
        const targets = ['视图选项', '搜索会话', '插件市场', '设置']
        for (const label of targets) {
          const index = await session.eval(`window.__qa.indexOfText(${JSON.stringify(label)})`)
          if (index < 0) continue
          for (let round = 0; round < 5; round += 1) {
            await session.click('button, [role=button], [role=menuitem], [role=tab], a[href]', { index })
            await sleep(180)
          }
          await session.press('Escape')
          await sleep(800)
        }
        await sleep(2500)
        const errors = session.consoleErrors()
        await assert.screenshot(session, 'after-rapid-control-clicks')
        assert.check(errors.length === 0, `console errors while rapidly clicking controls: ${errors.slice(0, 3).join(' | ')}`)
        assert.check(await session.eval('!!window.__qa.composer()'), 'composer gone after rapidly clicking controls')
      },
    },
    {
      id: 'R-11', group: 'R', priority: 'P1', title: '空数据目录启动进入可引导状态',
      async run(context, assert) {
        const session = await context.relaunch({ home: context.emptyHome, requireComposer: false })
        await sleep(4000)
        const state = await session.eval(`({
          url: location.href,
          composer: !!window.__qa.composer(),
          recovery: /recovery/.test(location.href),
          canAddWorkspace: window.__qa.indexOfText('添加工作区') >= 0,
          text: window.__qa.bodyText().slice(0, 160),
        })`)
        await assert.screenshot(session, 'empty-home-boot')
        assert.check(!state.recovery, `a fresh empty home opened the recovery page: ${state.text}`)
        // A home with no workspace asks the person to add one; that is the usable state here.
        assert.check(state.canAddWorkspace || state.composer,
          `a fresh empty home offered neither a workspace entry nor an input box: ${state.text}`)
        assert.note(`composer=${state.composer} addWorkspace=${state.canAddWorkspace}`)
      },
    },
    {
      id: 'R-12', group: 'R', priority: 'P1', title: '全新 Profile 首次启动的桌面设置向导可跳过',
      async run(context, assert) {
        const session = await context.relaunch({ home: context.freshHome, requireComposer: false })
        await sleep(5000)
        const state = await session.eval(`({
          url: location.href,
          composer: !!window.__qa.composer(),
          addWorkspace: window.__qa.indexOfText('添加工作区') >= 0,
          text: window.__qa.bodyText().slice(0, 120),
        })`)
        await assert.screenshot(session, 'fresh-profile')
        // A brand new profile has no workspace yet, so the window offers the workspace
        // entry points instead of an input box.
        assert.check(state.composer || state.addWorkspace,
          `a brand new profile did not reach a usable window: ${state.text}`)
        assert.check(!/recovery/.test(state.url), `a brand new profile opened the recovery page: ${state.url}`)

        // The wizard writes its outcome beside the app's user data, keyed by profile.
        const recorded = context.readSetupOutcome(context.freshHome)
        assert.note(`setup outcome for the new profile: ${JSON.stringify(recorded)}`)
        assert.check(recorded !== undefined, 'the setup wizard left no outcome for the new profile')

        await context.relaunch()
        await sleep(3000)
      },
    },
    {
      id: 'R-13', group: 'R', priority: 'P1', title: '配置损坏时进入恢复模式而不是空白页',
      async run(context, assert) {
        const backup = context.breakSettings()
        try {
          // Recovery mode replaces the normal window, so no composer is expected here.
          const session = await context.relaunch({ requireComposer: false })
          await sleep(4000)
          const state = await session.eval(`({
            url: location.href,
            text: window.__qa.bodyText().slice(0, 200),
            elements: document.querySelectorAll('*').length,
            hasAction: window.__qa.all('button, [role=button], a[href]').length > 0,
          })`)
          await assert.screenshot(session, 'broken-settings-boot')
          assert.note(`url=${state.url} text=${state.text.slice(0, 100)}`)
          assert.check(state.elements > 20, 'the window rendered nothing at all after the settings were corrupted')
          assert.check(/recovery/.test(state.url) || /恢复模式|恢复/.test(state.text),
            `a corrupted settings file produced neither the recovery window nor an explanation: ${state.text.slice(0, 80)}`)
          assert.check(state.hasAction, 'the recovery window offered no way out')
        } finally {
          context.restoreSettings(backup)
          await context.relaunch()
        }
      },
    },
    {
      id: 'R-14', group: 'R', priority: 'P2', title: '长时间空转后仍能响应输入',
      async run({ session }, assert) {
        await sleep(45000)
        await startConversation(session)
        await focusComposer(session)
        await session.type('QA: after idling')
        await sleep(800)
        const text = await session.eval('window.__qa.composerText()')
        await assert.screenshot(session, 'after-idle')
        assert.check(text.includes('after idling'), `composer did not respond after idling: ${JSON.stringify(text.slice(0, 40))}`)
        const errors = session.consoleErrors()
        assert.check(errors.length === 0, `console errors during idle: ${errors.slice(0, 2).join(' | ')}`)
      },
    },
  ],
}

/** The mock model is written to stop on demand so a provider failure is reproducible. */
export function stopMock() {
  try {
    execFileSync('/usr/bin/pkill', ['-f', 'qa/mock-llm.mjs'], { stdio: 'ignore' })
  } catch { /* already stopped */ }
}

export function startMock({ port = 43921, log = MOCK_LOG } = {}) {
  const bundle = join(import.meta.dirname, '..')
  execFileSync('/bin/sh', ['-c', `nohup "${process.execPath}" "${join(bundle, 'qa', 'mock-llm.mjs')}" --port ${port} --log ${log} > /tmp/dsh-qa-mock.out 2>&1 &`], { stdio: 'ignore' })
}

export function mockCalls() {
  if (!existsSync(MOCK_LOG)) return 0
  return readFileSync(MOCK_LOG, 'utf8').split('\n').filter(Boolean).length
}

export { writeFileSync }

// Group D: theme behaviour. The shell follows `nativeTheme.themeSource`, so the
// system appearance is the input and the rendered colors are the observable.
import { CONTRAST_HELPERS } from './contrast.mjs'
import { clickLabel, prepare, sendMessage, sleep, startConversation } from './scenario.mjs'

const PROBE = String.raw`
window.__theme = {
  regions() {
    const pick = (selector, name) => {
      const el = document.querySelector(selector)
      if (el === null) return null
      const style = getComputedStyle(el)
      return { name, background: style.backgroundColor, color: style.color, border: style.borderTopColor }
    }
    return [
      pick('body', 'body'),
      pick('[class*=EXfQ3q_root]', 'sidebar'),
      pick('[data-composer-input]', 'composer'),
      pick('button[aria-label*="发送消息"]', 'send'),
      pick('textarea, input[type=text]', 'input'),
    ].filter(Boolean)
  },
  luminance(color) {
    const parsed = window.__contrast.parse(color)
    if (parsed === null) return null
    return window.__contrast.luminance(parsed)
  },
  /**
   * Every large opaque surface, so a stale color from the previous theme shows up
   * as an outlier instead of hiding behind the one element a case happens to check.
   */
  surfaces() {
    const seen = new Map()
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect()
      if (rect.width * rect.height < 20000) continue
      const style = getComputedStyle(el)
      const parsed = window.__contrast.parse(style.backgroundColor)
      if (parsed === null || parsed.a < 0.9) continue
      const key = style.backgroundColor
      const entry = seen.get(key) ?? { color: style.backgroundColor, luminance: window.__contrast.luminance(parsed), area: 0, samples: [] }
      entry.area += rect.width * rect.height
      if (entry.samples.length < 2) entry.samples.push((el.getAttribute('aria-label') || el.className || el.tagName).toString().slice(0, 24))
      seen.set(key, entry)
    }
    return [...seen.values()].sort((a, b) => b.area - a.area).slice(0, 6)
      .map(entry => ({ ...entry, area: Math.round(entry.area), luminance: Math.round(entry.luminance * 1000) / 1000 }))
  },
}
true`

export const groups = {}

groups.D = {
  title: '主题与外观',
  cases: [
    {
      id: 'D-01', group: 'D', priority: 'P1', title: '启动主题与系统外观一致',
      async run(context, assert) {
        const systemDark = context.systemAppearance()
        const theme = await context.session.eval('window.__qa.theme()')
        await assert.screenshot(context.session, `boot-${systemDark ? 'dark' : 'light'}`)
        assert.check(theme.colorScheme === (systemDark ? 'dark' : 'light'),
          `renderer colorScheme=${theme.colorScheme} while the system is ${systemDark ? 'dark' : 'light'}`)
      },
    },
    {
      id: 'D-02', group: 'D', priority: 'P1', title: '系统外观变化时界面即时跟随',
      async run(context, assert) {
        const result = await context.withAppearance(false, async session => {
          await sleep(1500)
          const light = await session.eval('window.__qa.theme()')
          await assert.screenshot(session, 'switched-light')
          return light
        })
        assert.check(result.colorScheme === 'light', `interface did not follow the system into light mode: ${JSON.stringify(result)}`)
        const back = await context.session.eval('window.__qa.theme()')
        assert.check(back.colorScheme === 'dark', `interface did not return to dark mode: ${JSON.stringify(back)}`)
      },
    },
    {
      id: 'D-03', group: 'D', priority: 'P1', title: '浅色主题下不存在残留的深色大色块',
      async run(context, assert) {
        const result = await context.withAppearance(false, async session => {
          await session.eval(CONTRAST_HELPERS)
          await session.eval(PROBE)
          await sleep(1500)
          await assert.screenshot(session, 'light-surfaces')
          return { surfaces: await session.eval('window.__theme.surfaces()'), theme: await session.eval('window.__qa.theme()') }
        })
        const dark = result.surfaces.filter(surface => surface.luminance < 0.15 && surface.area > 60000)
        assert.check(dark.length === 0, `large dark surfaces remain in light mode: ${JSON.stringify(dark)}`)
        assert.note(`surfaces: ${JSON.stringify(result.surfaces.slice(0, 3))}`)
      },
    },
    {
      id: 'D-04', group: 'D', priority: 'P1', title: '深色主题下不存在残留的浅色大色块',
      async run(context, assert) {
        const result = await context.withAppearance(true, async session => {
          await session.eval(CONTRAST_HELPERS)
          await session.eval(PROBE)
          await sleep(1500)
          await assert.screenshot(session, 'dark-surfaces')
          return { surfaces: await session.eval('window.__theme.surfaces()'), theme: await session.eval('window.__qa.theme()') }
        })
        const light = result.surfaces.filter(surface => surface.luminance > 0.85 && surface.area > 60000)
        assert.check(light.length === 0, `large bright surfaces remain in dark mode: ${JSON.stringify(light)}`)
        assert.note(`surfaces: ${JSON.stringify(result.surfaces.slice(0, 3))}`)
      },
    },
    {
      id: 'D-05', group: 'D', priority: 'P2', title: '快速反复切换主题 10 次后界面正常',
      async run(context, assert) {
        for (let round = 0; round < 10; round += 1) await context.setAppearance(round % 2 === 0, { settleMs: 700 })
        const theme = await context.session.eval('window.__qa.theme()')
        const errors = context.session.consoleErrors()
        await assert.screenshot(context.session, 'after-theme-cycles')
        assert.check(errors.length === 0, `console errors while switching themes: ${errors.slice(0, 2).join(' | ')}`)
        assert.check(await context.session.eval('!!window.__qa.composer()'), 'composer disappeared after repeated theme switches')
        assert.note(`theme after ten switches: ${JSON.stringify(theme)}`)
      },
    },
    {
      id: 'D-06', group: 'D', priority: 'P1', title: '切换主题不丢失当前会话内容',
      async run(context, assert) {
        const session = context.session
        await startConversation(session, 'QA: theme persistence')
        const before = await session.eval('window.__qa.bodyText()')
        await context.setAppearance(false, { settleMs: 2500 })
        const light = await session.eval('window.__qa.bodyText()')
        await context.setAppearance(true, { settleMs: 2500 })
        const dark = await session.eval('window.__qa.bodyText()')
        await assert.screenshot(session, 'conversation-after-theme')
        assert.check(light.includes('QA: theme persistence'), 'conversation content vanished when switching to light')
        assert.check(dark.includes('QA: theme persistence'), 'conversation content vanished when switching back to dark')
        assert.note(`transcript length before=${before.length} light=${light.length} dark=${dark.length}`)
      },
    },
  ],
}

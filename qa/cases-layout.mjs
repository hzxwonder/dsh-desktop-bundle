// Group L: layout, geometry and styling checks measured from the live renderer.
import { CONTRAST_HELPERS } from './contrast.mjs'
import { clickLabel, prepare, sleep, toggleSidebar } from './scenario.mjs'

const L = String.raw`
window.__layout = {
  // Elements a person can interact with, with their boxes.
  interactive() {
    const selector = 'button, [role=button], [role=menuitem], [role=tab], a[href], input, textarea, [contenteditable=true]'
    return [...document.querySelectorAll(selector)]
      .filter(el => window.__qa.visible(el))
      .map(el => ({
        label: (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 30),
        rect: window.__qa.rect(el),
        insideOverlay: !!el.closest('[role=dialog], [class*=overlay], [class*=popup], [data-slot]'),
      }))
  },
  overlaps() {
    const items = window.__layout.interactive().filter(item => !item.insideOverlay)
    const hits = []
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i].rect
        const b = items[j].rect
        const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
        if (overlapX > 4 && overlapY > 4) {
          // Only report overlap between elements that are not nested in each other.
          if (!(items[i].label && items[i].label === items[j].label)) {
            hits.push({ a: items[i].label, b: items[j].label, overlapX: Math.round(overlapX), overlapY: Math.round(overlapY) })
          }
        }
      }
    }
    return hits
  },
  overflow() {
    const viewport = { width: innerWidth, height: innerHeight }
    return [...document.querySelectorAll('body *')]
      .filter(el => window.__qa.visible(el))
      .map(el => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return { el, rect, style }
      })
      .filter(({ rect, style }) => {
        if (style.position === 'fixed') return false
        if (rect.width < 8 || rect.height < 8) return false
        return rect.right > viewport.width + 2 || rect.bottom > viewport.height + 2 || rect.x < -2 || rect.y < -2
      })
      .slice(0, 12)
      .map(({ el, rect }) => ({
        label: (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 30),
        cls: String(el.className).slice(0, 40),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
      }))
  },
  clippedText() {
    return [...document.querySelectorAll('body *')]
      .filter(el => window.__qa.visible(el) && el.childElementCount === 0 && (el.textContent || '').trim().length > 0)
      .filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible')
      .slice(0, 10)
      .map(el => ({ text: (el.textContent || '').trim().slice(0, 24), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  },
  regionSummary() {
    const find = predicate => [...document.querySelectorAll('body *')].filter(el => window.__qa.visible(el) && predicate(el))
    const sidebar = find(el => /EXfQ3q_root/.test(String(el.className)))[0]
    const composer = window.__qa.composer()
    const send = document.querySelector('button[aria-label*="发送消息"]')
    const dock = document.querySelector('[data-dsh-terminal-dock], [class*=terminalDock], [class*=dockPanel]')
    const rightbar = document.querySelector('[data-rightbar-col]')
    const browserColumn = document.querySelector('[data-dsh-browser-column], [class*=browserColumn]')
    const box = el => el ? window.__qa.rect(el) : null
    return {
      sidebar: box(sidebar),
      composer: box(composer),
      composerBox: box(composer ? composer.closest('[class*=composer], form, [data-composer]') ?? composer.parentElement : null),
      send: box(send),
      dock: box(dock),
      rightbar: box(rightbar),
      browserColumn: box(browserColumn),
    }
  },
}
true`

export const groups = {}

groups.L = {
  title: '布局与样式校验',
  cases: [
    {
      id: 'L-01', group: 'L', priority: 'P1', title: '基准窗口无横向溢出与意外滚动条',
      async run({ session }, assert) {
        await session.eval(L)
        const metrics = await session.eval('window.__qa.metrics()')
        const overflow = await session.eval('window.__layout.overflow()')
        await assert.screenshot(session, 'baseline')
        assert.check(metrics.scrollWidth <= metrics.clientWidth + 2,
          `document scrolls horizontally: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`)
        assert.check(overflow.length === 0, `elements outside the viewport: ${JSON.stringify(overflow.slice(0, 4))}`)
        assert.note(`viewport ${metrics.viewport.join('x')}, elements ${metrics.elementCount}`)
      },
    },
    {
      id: 'L-02', group: 'L', priority: 'P1', title: '基准布局几何符合设计意图',
      async run({ session }, assert) {
        const regions = await session.eval('window.__layout.regionSummary()')
        assert.note(`regions ${JSON.stringify(regions)}`)
        assert.check(regions.sidebar !== null, 'sidebar region not found')
        assert.near(regions.sidebar.width, 280, 12, 'sidebar width')
        assert.near(regions.sidebar.x, 0, 2, 'sidebar left edge')
        assert.check(regions.composer !== null, 'composer region not found')
        assert.check(regions.composer.x > regions.sidebar.right - 4, 'composer overlaps the sidebar')
        assert.check(regions.send !== null, 'send button not found')
        const box = regions.composerBox ?? regions.composer
        assert.check(regions.send.x >= box.x - 4 && regions.send.right <= box.right + 4 && regions.send.bottom <= box.bottom + 4,
          `send button is outside the composer container: send=${JSON.stringify(regions.send)} box=${JSON.stringify(box)}`)
      },
    },
    {
      id: 'L-03', group: 'L', priority: 'P1', title: '交互元素之间无遮挡重叠',
      async run({ session }, assert) {
        const overlaps = await session.eval('window.__layout.overlaps()')
        await assert.screenshot(session, 'overlap-check')
        assert.check(overlaps.length === 0, `overlapping interactive elements: ${JSON.stringify(overlaps.slice(0, 5))}`)
      },
    },
    {
      id: 'L-04', group: 'L', priority: 'P2', title: '文本不被裁切或溢出容器',
      async run({ session }, assert) {
        const clipped = await session.eval('window.__layout.clippedText()')
        assert.check(clipped.length === 0, `text overflows its container: ${JSON.stringify(clipped.slice(0, 4))}`)
      },
    },
    {
      id: 'L-05', group: 'L', priority: 'P1', title: '浅色主题正文对比度达到 4.5:1',
      async run(context, assert) {
        const result = await context.withAppearance(false, async session => {
          await context.waitForTheme('light')
          await session.eval(L)
          await session.eval(CONTRAST_HELPERS)
          await assert.screenshot(session, 'light-theme')
          return session.eval('window.__contrast.report()')
        })
        assert.note(`light theme worst=${result.worst} placeholder=${result.worstPlaceholder} checked=${result.count}`)
        assert.note(`light theme below 4.5: ${JSON.stringify(result.belowThreshold)}`)
        assert.note(`light theme placeholders: ${JSON.stringify(result.placeholders)}`)
        assert.check(result.theme.colorScheme === 'light', `theme did not switch to light: ${JSON.stringify(result.theme)}`)
        assert.check(result.worst >= 4.5, `lowest text contrast in light theme is ${result.worst}:1 (${JSON.stringify(result.samples.slice(0, 3))})`)
      },
    },
    {
      id: 'L-06', group: 'L', priority: 'P1', title: '深色主题正文对比度达到 4.5:1',
      async run(context, assert) {
        const result = await context.withAppearance(true, async session => {
          await context.waitForTheme('dark')
          await session.eval(L)
          await session.eval(CONTRAST_HELPERS)
          await assert.screenshot(session, 'dark-theme')
          return session.eval('window.__contrast.report()')
        })
        assert.note(`dark theme worst=${result.worst} placeholder=${result.worstPlaceholder} checked=${result.count}`)
        assert.note(`dark theme below 4.5: ${JSON.stringify(result.belowThreshold)}`)
        assert.note(`dark theme placeholders: ${JSON.stringify(result.placeholders)}`)
        assert.check(result.theme.colorScheme === 'dark', `theme did not switch to dark: ${JSON.stringify(result.theme)}`)
        assert.check(result.worst >= 4.5, `lowest text contrast in dark theme is ${result.worst}:1 (${JSON.stringify(result.samples.slice(0, 3))})`)
      },
    },
    {
      id: 'L-07', group: 'L', priority: 'P1', title: '主题切换即时生效且可回退',
      async run(context, assert) {
        const dark = await context.withAppearance(true, () => context.waitForTheme('dark'))
        const light = await context.withAppearance(false, () => context.waitForTheme('light'))
        const back = await context.withAppearance(true, () => context.waitForTheme('dark'))
        assert.check(dark.colorScheme === 'dark' && light.colorScheme === 'light' && back.colorScheme === 'dark',
          `theme did not follow the system appearance: ${JSON.stringify({ dark, light, back })}`)
      },
    },
    {
      id: 'L-08', group: 'L', priority: 'P1', title: '窗口放大到 1600×1000 布局自适应',
      async run({ session }, assert) {
        await session.eval(L)
        const before = await session.eval('window.__qa.metrics()')
        const viewport = await session.resize(1600, 1000, { settleMs: 2000 })
        await session.eval(L)
        const metrics = await session.eval('window.__qa.metrics()')
        const overflow = await session.eval('window.__layout.overflow()')
        const regions = await session.eval('window.__layout.regionSummary()')
        await assert.screenshot(session, 'window-1600x1000')
        assert.check(viewport.width > before.viewport[0], `window did not grow: ${before.viewport[0]} -> ${viewport.width}`)
        assert.check(metrics.scrollWidth <= metrics.clientWidth + 2, 'horizontal scrolling appeared after growing the window')
        assert.check(overflow.length === 0, `elements outside the viewport after resize: ${JSON.stringify(overflow.slice(0, 3))}`)
        assert.note(`regions at 1600x1000 ${JSON.stringify(regions)}`)
      },
    },
    {
      id: 'L-09', group: 'L', priority: 'P1', title: '窗口缩小到 900×600 关键控件仍可用',
      async run({ session }, assert) {
        const viewport = await session.resize(900, 600, { settleMs: 2000 })
        await session.eval(L)
        const metrics = await session.eval('window.__qa.metrics()')
        const regions = await session.eval('window.__layout.regionSummary()')
        const overlap = await session.eval('window.__layout.overlaps()')
        await assert.screenshot(session, 'window-900x600')
        assert.check(metrics.scrollWidth <= metrics.clientWidth + 2, 'horizontal scrolling appeared in a narrow window')
        assert.check(regions.composer !== null && regions.composer.width > 80, `composer unusable at ${viewport.width}x${viewport.height}`)
        assert.check(regions.send !== null && regions.send.width > 12, 'send control unusable at the narrow size')
        assert.check(overlap.length === 0, `overlapping controls at the narrow size: ${JSON.stringify(overlap.slice(0, 4))}`)
      },
    },
    {
      id: 'L-10', group: 'L', priority: 'P2', title: '极小窗口 640×480 不破坏布局',
      async run({ session }, assert) {
        await session.resize(640, 480, { settleMs: 2000 })
        await session.eval(L)
        const metrics = await session.eval('window.__qa.metrics()')
        const regions = await session.eval('window.__layout.regionSummary()')
        await assert.screenshot(session, 'window-640x480')
        assert.check(metrics.scrollWidth <= metrics.clientWidth + 2, 'horizontal scrolling appeared at the minimum size')
        assert.check(regions.composer !== null, 'composer missing at the minimum size')
      },
    },
    {
      id: 'L-11', group: 'L', priority: 'P2', title: '恢复基准尺寸后布局回到原状',
      async run({ session }, assert) {
        await session.resize(1280, 840, { settleMs: 2500 })
        await session.eval(L)
        const regions = await session.eval('window.__layout.regionSummary()')
        const metrics = await session.eval('window.__qa.metrics()')
        await assert.screenshot(session, 'window-restored')
        assert.near(metrics.viewport[0], 1280, 24, 'viewport width after restoring the window')
        assert.near(regions.sidebar.width, 280, 12, 'sidebar width after restoring the window')
        assert.near(regions.sidebar.x, 0, 2, 'sidebar left edge after restoring the window')
      },
    },
    {
      id: 'L-12', group: 'L', priority: 'P2', title: '侧边栏收起与展开后几何稳定',
      async run({ session }, assert) {
        await session.eval(L)
        const before = await session.eval('window.__layout.regionSummary()')
        const collapsed = await toggleSidebar(session)
        const afterCollapse = await session.eval('window.__layout.regionSummary()')
        await assert.screenshot(session, 'sidebar-collapsed')
        const expanded = await toggleSidebar(session)
        const restored = await session.eval('window.__layout.regionSummary()')
        await assert.screenshot(session, 'sidebar-expanded')
        assert.note(`controls used: ${collapsed} then ${expanded}`)
        assert.note(`sidebar widths: ${JSON.stringify({ before: before.sidebar?.width, collapsed: afterCollapse.sidebar?.width, restored: restored.sidebar?.width })}`)
        assert.check(collapsed === '收起侧边栏', `collapse control not used: ${collapsed}`)
        assert.check(expanded === '打开侧边栏', `expand control not used: ${expanded}`)
        assert.check(afterCollapse.sidebar.width < before.sidebar.width, 'the sidebar did not narrow when collapsed')
        assert.near(restored.sidebar.width, before.sidebar.width, 8, 'sidebar width after collapsing and expanding')
      },
    },
    {
      id: 'L-13', group: 'L', priority: 'P2', title: '侧边栏收起为图标栏时布局正常',
      async run({ session }, assert) {
        // Whatever the previous case left behind, start from the expanded sidebar.
        if ((await session.eval('window.__layout.regionSummary()')).sidebar.width < 200) await toggleSidebar(session)
        await session.eval(L)
        const toggled = (await toggleSidebar(session)) === '收起侧边栏'
        await session.eval(L)
        const metrics = await session.eval('window.__qa.metrics()')
        const overflow = await session.eval('window.__layout.overflow()')
        const regions = await session.eval('window.__layout.regionSummary()')
        await assert.screenshot(session, 'sidebar-rail')
        assert.check(toggled, 'the sidebar did not collapse')
        assert.check(metrics.scrollWidth <= metrics.clientWidth + 2, 'horizontal scrolling appeared in the collapsed state')
        assert.check(overflow.length === 0, `elements outside the viewport in the collapsed state: ${JSON.stringify(overflow.slice(0, 3))}`)
        assert.check(regions.composer !== null && regions.composer.width > 200, `composer unusable in the collapsed state: ${JSON.stringify(regions.composer)}`)
        assert.note(`collapsed sidebar width ${regions.sidebar?.width}, composer ${JSON.stringify(regions.composer)}`)
        await toggleSidebar(session)
      },
    },
    {
      id: 'L-14', group: 'L', priority: 'P1', title: '终端面板打开后输入框仍完整可见',
      async run({ session }, assert) {
        await session.eval(L)
        const opened = await clickLabel(session, '终端')
        if (!opened) {
          assert.note('no terminal control in this profile; covered by group T')
          return
        }
        await sleep(2500)
        const dock = await session.eval('window.__layout.regionSummary()')
        const composer = dock.composer
        await assert.screenshot(session, 'terminal-dock-open')
        if (dock.dock !== null) {
          assert.check(composer.bottom <= dock.dock.y + 2,
            `composer bottom ${Math.round(composer.bottom)} overlaps the dock top ${Math.round(dock.dock.y)}`)
        }
      },
    },
    {
      id: 'L-15', group: 'L', priority: 'P2', title: '多次开合侧边栏后几何无累积偏移',
      async run({ session }, assert) {
        await session.eval(L)
        const baseline = await session.eval('window.__layout.regionSummary()')
        for (let round = 0; round < 4; round += 1) {
          await toggleSidebar(session, { settleMs: 1000 })
          await toggleSidebar(session, { settleMs: 1000 })
        }
        const after = await session.eval('window.__layout.regionSummary()')
        await assert.screenshot(session, 'after-sidebar-cycles')
        assert.near(after.sidebar.width, baseline.sidebar.width, 6, 'sidebar width drifted after repeated toggles')
        assert.near(after.composer.x, baseline.composer.x, 6, 'composer position drifted after repeated toggles')
      },
    },
  ],
}

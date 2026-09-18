// Contrast measurement: resolve the effective foreground and background of real
// text nodes in the renderer and report the WCAG contrast ratio, so a theme claim
// rests on pixels rather than on class names.
export const CONTRAST_HELPERS = String.raw`
window.__contrast = {
  parse(color) {
    const match = color.match(/rgba?\(([^)]+)\)/)
    if (!match) return null
    const parts = match[1].split(',').map(part => Number.parseFloat(part.trim()))
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  },
  over(foreground, background) {
    const alpha = foreground.a
    return {
      r: foreground.r * alpha + background.r * (1 - alpha),
      g: foreground.g * alpha + background.g * (1 - alpha),
      b: foreground.b * alpha + background.b * (1 - alpha),
      a: 1,
    }
  },
  /**
   * Walk ancestors until an opaque background shows through.
   *
   * When no ancestor paints one, what a reader actually sees is the canvas, whose
   * color follows the document's color-scheme. Assuming white there would report
   * light text on a dark surface as unreadable, which is the opposite of the truth.
   */
  backgroundOf(el) {
    const stack = []
    let node = el
    while (node) {
      const parsed = window.__contrast.parse(getComputedStyle(node).backgroundColor)
      if (parsed !== null && parsed.a > 0) stack.push(parsed)
      if (parsed !== null && parsed.a === 1) break
      node = node.parentElement
    }
    const scheme = getComputedStyle(document.documentElement).colorScheme || ''
    const canvas = /dark/.test(scheme) ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }
    let layer = canvas
    for (let index = stack.length - 1; index >= 0; index -= 1) layer = window.__contrast.over(stack[index], layer)
    return layer
  },
  luminance(color) {
    const channel = value => {
      const scaled = value / 255
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
  },
  ratio(a, b) {
    const first = window.__contrast.luminance(a)
    const second = window.__contrast.luminance(b)
    const lighter = Math.max(first, second)
    const darker = Math.min(first, second)
    return (lighter + 0.05) / (darker + 0.05)
  },
  report() {
    const root = document.documentElement
    const samples = []
    const nodes = [...document.querySelectorAll('body *')]
      .filter(el => el.childElementCount === 0 && (el.textContent || '').trim().length > 1)
      .filter(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width < 4 || rect.height < 4) return false
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.4) return false
        if (style.webkitTextFillColor === 'rgba(0, 0, 0, 0)') return false
        return true
      })
      .slice(0, 120)
    for (const el of nodes) {
      const style = getComputedStyle(el)
      const foreground = window.__contrast.parse(style.color)
      if (foreground === null) continue
      const background = window.__contrast.backgroundOf(el)
      const effective = foreground.a === 1 ? foreground : window.__contrast.over(foreground, background)
      const fontSize = Number.parseFloat(style.fontSize)
      const bold = Number(style.fontWeight) >= 700
      const large = fontSize >= 24 || (fontSize >= 18.66 && bold)
      const ratio = window.__contrast.ratio(effective, background)
      const isPlaceholder = el.closest('[data-composer-input], [data-composer]') !== null
        || /描述你想要构建的内容|发出消息或创建任务/.test(el.textContent || '')
      samples.push({
        role: isPlaceholder ? 'placeholder' : 'text',
        text: (el.textContent || '').trim().slice(0, 24),
        color: style.color,
        background: 'rgb(' + [background.r, background.g, background.b].map(Math.round).join(', ') + ')',
        fontSize,
        large,
        ratio: Math.round(ratio * 100) / 100,
      })
    }
    const normal = samples.filter(sample => !sample.large && sample.role === 'text')
    const sorted = [...normal].sort((a, b) => a.ratio - b.ratio)
    return {
      theme: window.__qa.theme(),
      count: samples.length,
      worst: sorted[0] ? sorted[0].ratio : 0,
      worstLarge: samples.filter(sample => sample.large).length > 0
        ? Math.min(...samples.filter(sample => sample.large).map(sample => sample.ratio))
        : null,
      worstPlaceholder: samples.filter(sample => sample.role === 'placeholder')
        .reduce((lowest, sample) => Math.min(lowest, sample.ratio), Number.POSITIVE_INFINITY),
      belowThreshold: [...samples].filter(sample => sample.ratio < 4.5 && sample.role === 'text')
        .sort((a, b) => a.ratio - b.ratio).slice(0, 8),
      placeholders: samples.filter(sample => sample.role === 'placeholder').map(sample => ({ text: sample.text, ratio: sample.ratio })),
      samples: sorted.slice(0, 5),
      colorSchemeAttribute: root.style.colorScheme,
    }
  },
}
true`

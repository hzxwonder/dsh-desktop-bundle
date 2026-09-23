// 会话状态符号（src/shared 纯逻辑 + SVG 字符串，浏览器与桌面 shared-core 共用）。
//
// 设计约定（形状与颜色双编码，任何一种单独可辨）：
//   - 单色描边/填充图标，16px 网格（viewBox 0 0 16 16），颜色经 currentColor 注入；
//   - 四档轮廓互不相似：转弧（运行）/ 盾牌（等你确认）/ 对勾圆（完成）/ 叹号圆（出错），
//     灰度打印或色觉障碍下仍可区分（形状承担语义，颜色只作强化）；
//   - 符号常驻一行右侧，与 GitHub checks 的「对勾=完成、点=进行、叉/叹=失败」语义对齐。
import type { WorkStatusState } from './work-status';

/** 展示档位（6 个状态压缩为 4 个粗粒度符号：三个进行中档共用转弧） */
export type StatusKind = 'running' | 'waiting' | 'done' | 'error';

export const STATUS_KIND: Record<WorkStatusState, StatusKind> = {
  thinking: 'running',
  working: 'running',
  result: 'running',
  waiting: 'waiting',
  success: 'done',
  error: 'error',
};

/** 符号颜色（形状已承担语义，颜色只作强化；与状态气泡文案体系不冲突） */
export const STATUS_COLOR: Record<StatusKind, string> = {
  running: '#2563eb', // 蓝：进行
  waiting: '#d97706', // 琥珀：等你确认（权限/选择/阻塞）
  done: '#16a34a', // 绿：完成
  error: '#dc2626', // 红：出错
};

/** 符号文字标签（title/aria 用；不依赖颜色传达语义） */
export const STATUS_LABEL: Record<StatusKind, string> = {
  running: '运行中',
  waiting: '等你确认',
  done: '已完成',
  error: '出错',
};

const SVG_OPEN = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">';

/** 状态符号 SVG（转弧带 CSS 旋转动画，class 由 STATUS_CSS 提供） */
export function statusSymbol(state: WorkStatusState): string {
  const kind = STATUS_KIND[state];
  const color = STATUS_COLOR[kind];
  switch (kind) {
    case 'running':
      // 开口圆弧（转弧）：与其他三档轮廓差异最大，且自带「进行中」的动态语义
      return (
        '<svg class="dsh-pet-status-spin" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="6" stroke="' +
        color +
        '" stroke-width="2" stroke-linecap="round" stroke-dasharray="26 12"/></svg>'
      );
    case 'waiting':
      // 盾牌 + 暂停双竖条：被挡住等你放行（与「出错」的圆形叹号、其余轮廓明确区分）
      return (
        SVG_OPEN +
        '<path d="M8 1.2 2.8 3.2v4.3c0 3.2 2.2 5.8 5.2 7.3 3-1.5 5.2-4.1 5.2-7.3V3.2L8 1.2Z" stroke="' +
        color +
        '" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.4 5.6v4.2M9.6 5.6v4.2" stroke="' +
        color +
        '" stroke-width="1.6" stroke-linecap="round"/></svg>'
      );
    case 'done':
      // 实心圆 + 白勾：完成（与 GitHub checks 成功语义一致）
      return (
        SVG_OPEN +
        '<circle cx="8" cy="8" r="6.4" fill="' +
        color +
        '"/><path d="M5 8.2 7.2 10.4 11.2 5.8" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      );
    case 'error':
      // 实心圆 + 白叹号：出错（内形是叹号，与完成的勾同壳不同芯）
      return (
        SVG_OPEN +
        '<circle cx="8" cy="8" r="6.4" fill="' +
        color +
        '"/><path d="M8 4.6v4.3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="11.3" r=".95" fill="#fff"/></svg>'
      );
  }
}

/** 符号动效样式（转弧旋转 + 淡入淡出过渡），两端注入同一份 */
export const STATUS_CSS = [
  '.dsh-pet-status-spin{animation:dsh-pet-status-rot 1s linear infinite;transform-origin:50% 50%}',
  '@keyframes dsh-pet-status-rot{to{transform:rotate(360deg)}}',
  '@media (prefers-reduced-motion:reduce){.dsh-pet-status-spin{animation:none;opacity:.85}}',
  '.dsh-pet-status{display:block;flex:none;width:16px;height:16px}',
].join('');

import type { WorkStatusState } from './work-status';
/** 展示档位（6 个状态压缩为 4 个粗粒度符号：三个进行中档共用转弧） */
export type StatusKind = 'running' | 'waiting' | 'done' | 'error';
export declare const STATUS_KIND: Record<WorkStatusState, StatusKind>;
/** 符号颜色（形状已承担语义，颜色只作强化；与状态气泡文案体系不冲突） */
export declare const STATUS_COLOR: Record<StatusKind, string>;
/** 符号文字标签（title/aria 用；不依赖颜色传达语义） */
export declare const STATUS_LABEL: Record<StatusKind, string>;
/** 状态符号 SVG（转弧带 CSS 旋转动画，class 由 STATUS_CSS 提供） */
export declare function statusSymbol(state: WorkStatusState): string;
/** 符号动效样式（转弧旋转 + 淡入淡出过渡），两端注入同一份 */
export declare const STATUS_CSS: string;

import type { WorkStatusSessionEntry } from './work-status';
/** 列表样式 —— 两端注入同一份（与 MENU_CSS / CHAT_CSS 同理） */
export declare const SESSIONS_CSS: string;
export interface SessionsList {
    /** 列表容器（挂到弹窗内合适位置；空列表时显示空态） */
    el: HTMLElement;
    /** 用最新条目刷新（新行插入、旧行更新、完成行排定 10s 淡出）；返回渲染行数 */
    update(entries: WorkStatusSessionEntry[]): number;
    /** 清定时器 + 摘 DOM（幂等） */
    dispose(): void;
}
/** 创建会话状态列表（纯 DOM 组件，生命周期由调用方的弹窗持有） */
export declare function createSessionsList(): SessionsList;

/** 提示音种类：done=会话完成、waiting=会话等你确认（权限/选择/阻塞） */
export type ChimeKind = 'done' | 'waiting';
/** 预热 AudioContext（幂等，可反复调用）：已解锁则续用，未解锁装一次指针手势解锁 */
export declare function ensureAudio(): void;
/** 播一声提示音（未解锁/无 AudioContext 时安静跳过——提示音是增强，不是唯一反馈通道） */
export declare function playChime(kind: ChimeKind): void;
/**
 * 合并一拍内的多会话翻档 → 最多两声（done 优先 waiting，各至多一声）。
 * 输入 [{kind}]（顺序无关），输出去重后的 kinds（done 在前）。
 */
export declare function mergeSessionChimes(kinds: ChimeKind[]): ChimeKind[];
/** 翻档判定的最小条目形状（与 WorkStatusSessionEntry 兼容，便于纯函数测试） */
export interface ChimeSession {
    id: string;
    state: string;
    subagent?: boolean;
}
/**
 * 会话翻档 → 提示音种类（纯函数）：维护 prev（会话 id → 上一拍档位），返回本拍该响的音。
 *   - 翻到 waiting（等你确认）**一律响**：权限申请/选择题必须用户响应，subagent 的也一样；
 *   - 翻到 success（完成）响一声 done：仅限用户自己的会话，subagent 完成不响（子任务刷屏防噪）；
 *   - 首拍（isBaseline）只记档不响（启动不重放历史状态）；同档不重复响；消失的会话从 prev 清掉。
 * 返回值已按 mergeSessionChimes 合并（一拍最多 done + waiting 各一声）。
 */
export declare function diffSessionChimes(prev: Map<string, string>, sessions: ChimeSession[], isBaseline?: boolean): ChimeKind[];

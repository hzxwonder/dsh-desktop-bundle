/**
 * host 侧工作状态联动核心（自包含，不 import src/shared —— DSH 单文件加载约束）。
 *
 * 职责：监听 DSH `session/event`，把 6 类会话事件压缩成"当前活动工作状态"，供
 * `/dsh-pet-7340/work-status` 端点给浏览器轮询（与 balance/whisper 轮询同族）。
 * 只做聚合与去重：状态无变化不产生新输出（签名比对防刷屏）；不调用任何模型。
 *
 * 档位与 animations.events.workStatus 数组索引严格一致（顺序勿在中间插入）：
 *   0 thinking / 1 working / 2 result / 3 waiting / 4 success / 5 error
 */
/** 工作状态档位（数组索引 = events.workStatus 档位） */
export type HostWorkStatusState = 'thinking' | 'working' | 'result' | 'waiting' | 'success' | 'error';
/** update_goal 工具名：目标工具，action=complete/blocked = 本轮是该目标任务的收尾轮 */
export declare const GOAL_UPDATE_TOOL = "update_goal";
/** 本 turn 的 turn 级标志（goal 续跑轮判定；不参与展示，由 index.ts 维护） */
export interface WorkStatusTurnContext {
    /** 本轮是否为自动目标续跑轮（user/message source.kind==='goal' 时置位，turn/start 清零） */
    goalRound?: boolean;
    /** 本轮是否调用过 update_goal 收尾（'complete' | 'blocked'；undefined/null = 未收尾） */
    closing?: 'complete' | 'blocked' | null;
}
/** 解析 update_goal 的 arguments（原始 JSON 字符串）→ 收尾动作；解析失败/非收尾动作 → null */
export declare function goalUpdateAction(args: string): 'complete' | 'blocked' | null;
/**
 * turn/end reason=completed 的终局判定：
 *   - 非 goal 轮（默认）→ success（原行为：一轮答完即成功）；
 *   - 自动续跑轮中间轮（goalRound && 未收尾）→ result：本轮完成 ≠ 整个任务完成，不庆祝；
 *   - 收尾轮 complete → success（整个目标达成，庆祝）；
 *   - 收尾轮 blocked → error（目标被阻塞结束，诚实地表沮丧而非庆祝）。
 */
export declare function completedState(turn: WorkStatusTurnContext | undefined): HostWorkStatusState;
/** 从会话事件压缩出工作状态；无变化/不关心返回 null。
 *  turn 为当前回合上下文（goal 续跑轮判定），只影响 turn/end completed 的终局语义。 */
export declare function reduceWorkStatus(event: {
    type?: string;
    data?: Record<string, unknown> & {
        reason?: {
            kind?: string;
        };
    };
}, turn?: WorkStatusTurnContext): HostWorkStatusState | null;
/** todo/write 的 in_progress/pending 项文本 → 任务详情；null = 无 */
export declare function currentTaskFromTodo(event: {
    data?: {
        todos?: Array<{
            status?: string;
            content?: string;
        }>;
    };
}): string | null;
/** 首条用户消息文本 → 会话标题兜底（session/title 尚未生成时用）。
 *  取 content 里的文本块拼接，压缩空白，超长截断加省略号；无文本返回 ''（调用方再退 id）。 */
export declare function userMessageTitle(data: {
    content?: unknown;
} | undefined, maxLen?: number): string;
/** 会话条目（/work-status 响应 sessions 数组元素；契约 = shared/work-status.ts 的 WorkStatusSessionEntry）。
 *  面板按此渲染「标题 + 任务 + 右侧状态符号」列表；subagent 条目也下发（提示音判定其「等你确认」要响），
 *  列表展示侧自行过滤。 */
export interface HostWorkStatusSessionEntry {
    id: string;
    title: string;
    state: HostWorkStatusState;
    task: string | null;
    ts: number;
    subagent: boolean;
}
/** 工作状态快照（/work-status 端点响应体）：state 为主状态；task 为 todo 详情（可 null） */
export interface WorkStatusSnapshot {
    state: HostWorkStatusState | null;
    task: string | null;
    ts: number;
    sessions?: HostWorkStatusSessionEntry[];
}

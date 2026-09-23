// 工作状态联动（workStatus）——浏览器侧纯逻辑（src/shared 单一来源）。
// host 侧（src/host/work-status.ts）有自己的自包含实现（DSH 单文件加载约束，host 不 import 本目录），
// 负责监听 session/event 并通过 /dsh-pet-7340/work-status 端点提供聚合状态；本模块只做：
//   档位常量（WORK_STATUS_STATES / WORK_STATUS_INDEX，与 events.workStatus 数组索引一致）+ 轮询解析
//   （fetchWorkStatus）。气泡文案不在代码里：浏览器直接读配置 events.workStatusTexts（host 不内置文案）。
// 纯函数无副作用；不依赖 React/DOM。

/** 工作状态档位（对应 animations.events.workStatus 数组索引，顺序即档位，勿在中间插入新档） */
export const WORK_STATUS_STATES = ['thinking', 'working', 'result', 'waiting', 'success', 'error'] as const;
export type WorkStatusState = (typeof WORK_STATUS_STATES)[number];

/** 档位 → workStatus 数组索引（与 events.workStatus 数组顺序严格一致） */
export const WORK_STATUS_INDEX: Record<WorkStatusState, number> = {
  thinking: 0, // turn/start → 思考
  working: 1, // tool/call → 工作
  result: 2, // tool/result → 整理
  waiting: 3, // approval/asked → 等待
  success: 4, // turn/end completed → 完成
  error: 5, // turn/end error/max-tokens → 出错
};

/** 会话条目（/dsh-pet-7340/work-status 响应 sessions 数组元素）。
 *  面板按此渲染「会话标题 + 任务详情 + 状态符号」粗略列表；subagent 条目供提示音判定（等你确认要响），
 *  列表展示侧过滤掉（用户看的是自己的会话）。 */
export interface WorkStatusSessionEntry {
  id: string;
  title: string; // 会话标题（session/title 事件；无标题时首条用户消息截断兜底）
  state: WorkStatusState; // 该会话当前档位（终态 success/error 也保留在列，由展示侧按终态时长淡出）
  task: string | null; // 该会话任务详情（todo/write 提供，可 null）
  ts: number; // 该会话最近档位变化时间（展示侧算完成行淡出起点）
  subagent?: boolean; // true = subagent 子会话（列表不展示；提示音仍判定其「等你确认」）
}

/** /dsh-pet-7340/work-status 响应（与 host 的 WorkStatusSnapshot 同构；两端按此结构校验）。
 *  text 不在此：气泡文案由浏览器读配置 events.workStatusTexts，host 不生成。 */
export interface WorkStatusSnapshot {
  state: WorkStatusState | null; // null = 空闲
  task: string | null; // 当前任务详情（todo/write 提供，可 null）
  ts: number; // 最近一次变化的时间戳（轮询侧检测变化用）
  sessions?: WorkStatusSessionEntry[]; // 多会话列表（不含 subagent；旧 host 无此字段 = 空列表）
}

const TIMEOUT_MS = 10000;

/** 解析响应体 sessions 数组：逐元素宽容校验，非法元素丢弃（绝不让一条坏数据打翻整个面板） */
function parseSessions(raw: unknown): WorkStatusSessionEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkStatusSessionEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const state = o.state as string;
    if (!id || !(WORK_STATUS_STATES as readonly string[]).includes(state)) continue;
    out.push({
      id,
      title: typeof o.title === 'string' && o.title ? o.title : id,
      state: state as WorkStatusState,
      task: typeof o.task === 'string' && o.task ? o.task : null,
      ts: Number(o.ts) || 0,
      subagent: o.subagent === true,
    });
  }
  return out;
}

/** 拉取当前工作状态快照；解析/网络失败显式抛错（上层决定，绝不静默伪造） */
export async function fetchWorkStatus(baseUrl: string = '/dsh-pet-7340/work-status'): Promise<WorkStatusSnapshot> {
  const res = await fetch(baseUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error('dsh-pet: work-status HTTP ' + res.status);
  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') throw new Error('dsh-pet: work-status 响应非法');
  const state: WorkStatusState | null =
    raw.state === null || (WORK_STATUS_STATES as readonly string[]).includes(raw.state as string)
      ? (raw.state as WorkStatusState | null)
      : null;
  return {
    state,
    task: typeof raw.task === 'string' ? raw.task : null,
    ts: Number(raw.ts) || 0,
    sessions: parseSessions(raw.sessions),
  };
}

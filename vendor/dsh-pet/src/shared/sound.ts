// 状态提示音（src/shared，浏览器与桌面 shared-core 共用）：完成 / 等你确认 各一声短促提示。
//
// 设计取舍：不带音频素材（webm/mp3 不入包，保持资产面小），用 WebAudio 合成两声短音——
//   done「叮—咚」上行两声（完成的正反馈），waiting「咚—」单声略长（要你注意但不刺耳）。
// 只在「会话列表里有会话状态翻到 done/waiting」时响（由调用方判定后逐次调用，本模块不做去重）；
// 同一 tick 多会话同时翻档时由调用方合并为一声（mergeSessionChimes）。
// 首次播放前需一次用户手势解锁（浏览器自动播放策略）：ensureAudio 在任意指针按下时预热。

/** 提示音种类：done=会话完成、waiting=会话等你确认（权限/选择/阻塞） */
export type ChimeKind = 'done' | 'waiting';

let audioCtx: AudioContext | null = null;
let unlockInstalled = false;

/** 预热 AudioContext（幂等，可反复调用）：已解锁则续用，未解锁装一次指针手势解锁 */
export function ensureAudio(): void {
  if (typeof window === 'undefined') return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'running') return;
  const unlock = () => {
    void audioCtx?.resume().catch(() => {});
  };
  if (!unlockInstalled) {
    unlockInstalled = true;
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }
  unlock(); // 立即也试一次：多数桌面壳（Electron）无自动播放限制，一次就跑起来
}

/** 一个音符：频率 + 起始偏移 + 时长（秒） */
function tone(ctx: AudioContext, freq: number, at: number, dur: number, gain: number): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // 快起短收的音量包络（5ms 淡入防爆音，指数淡出听感圆润）
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** 播一声提示音（未解锁/无 AudioContext 时安静跳过——提示音是增强，不是唯一反馈通道） */
export function playChime(kind: ChimeKind): void {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t0 = audioCtx.currentTime + 0.02;
  if (kind === 'done') {
    tone(audioCtx, 660, t0, 0.12, 0.12); // A5
    tone(audioCtx, 880, t0 + 0.1, 0.18, 0.12); // E6：上行，「搞定了」
  } else {
    tone(audioCtx, 520, t0, 0.1, 0.1); // E4 稍低
    tone(audioCtx, 520, t0 + 0.14, 0.2, 0.1); // 同音短重复：「等你哦」
  }
}

/**
 * 合并一拍内的多会话翻档 → 最多两声（done 优先 waiting，各至多一声）。
 * 输入 [{kind}]（顺序无关），输出去重后的 kinds（done 在前）。
 */
export function mergeSessionChimes(kinds: ChimeKind[]): ChimeKind[] {
  const set = new Set(kinds);
  return (['done', 'waiting'] as ChimeKind[]).filter((k) => set.has(k));
}

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
export function diffSessionChimes(
  prev: Map<string, string>,
  sessions: ChimeSession[],
  isBaseline = false,
): ChimeKind[] {
  const kinds: ChimeKind[] = [];
  const seen = new Set<string>();
  for (const s of sessions) {
    seen.add(s.id);
    const before = prev.get(s.id);
    prev.set(s.id, s.state);
    if (isBaseline || before === s.state) continue;
    if (s.state === 'waiting') kinds.push('waiting');
    else if (s.state === 'success' && !s.subagent) kinds.push('done');
  }
  for (const id of [...prev.keys()]) if (!seen.has(id)) prev.delete(id);
  return mergeSessionChimes(kinds);
}

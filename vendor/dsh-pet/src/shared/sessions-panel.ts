// 会话状态列表（src/shared，浏览器与桌面 shared-core 共用的第四个 DOM 例外）：
// 数据来自 host /dsh-pet-7340/work-status 的 sessions 数组，本组件只做
// 「粗略列表 + 右侧状态符号」的渲染与收尾动效，两端行为完全一致（与 menu/chat 同一模式）。
//
// 交互语义：
//   - 每行 = 一条会话：左侧标题（超宽省略）+ 副行任务详情（有才显示），右侧状态符号（形状+颜色双编码）；
//   - success 为「刚完成」：从该档状态变化起 10s 淡出移除（淡出期间仍可见，随后整行坍缩收起）；
//     error / 进行中 / 等你确认的行常驻——"还没过去的事"不自动消失；
//   - 被淡出的终态行不会因宿主仍报该条目而复活：同一状态时间戳只淡出一次，翻新档才回列表；
//   - 行序由调用方给出（宿主按优先级 + 最近更新排好），组件不重排。
import type { WorkStatusSessionEntry, WorkStatusState } from './work-status';
import { STATUS_COLOR, STATUS_CSS, STATUS_LABEL, STATUS_KIND, statusSymbol } from './status-symbols';

/** 列表样式 —— 两端注入同一份（与 MENU_CSS / CHAT_CSS 同理） */
export const SESSIONS_CSS = [
  '.dsh-pet-sessions-list{padding:3px 0;max-height:44vh;overflow-y:auto}',
  '.dsh-pet-sessions-empty{padding:14px 14px;color:rgba(43,43,43,.45);text-align:center;font-size:13px}',
  // 行：左文右符；10s 淡出（opacity→0 后坍缩，列表底部不留洞）
  '.dsh-pet-sessions-row{display:flex;align-items:center;gap:10px;padding:6px 14px;max-height:64px;overflow:hidden;',
  'transition:opacity 1s ease, max-height .35s ease, padding .35s ease}',
  '.dsh-pet-sessions-row.is-fading{opacity:0;max-height:0;padding-top:0;padding-bottom:0}',
  '.dsh-pet-sessions-main{flex:1;min-width:0}',
  '.dsh-pet-sessions-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2b2b2b}',
  '.dsh-pet-sessions-task{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
  'font-size:12px;color:rgba(43,43,43,.5);margin-top:1px}',
  '.dsh-pet-sessions-sym{flex:none;display:flex;align-items:center}',
  STATUS_CSS,
].join('');

/** 「刚完成」行的可见时长（ms）：状态变化起 10s 后开始淡出 */
const FADE_AFTER_MS = 10_000;

let sessionsCssInjected = false;
function injectSessionsCss(): void {
  if (sessionsCssInjected || typeof document === 'undefined') return;
  sessionsCssInjected = true;
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-pet';
  tag.dataset.pluginCss = 'dsh-pet/sessions';
  tag.textContent = SESSIONS_CSS;
  document.head.appendChild(tag);
}

/** 行内 DOM 状态（淡出定时器挂行上，行移除一并清） */
interface RowHandle {
  root: HTMLElement;
  name: HTMLElement;
  task: HTMLElement;
  sym: HTMLElement;
  state: WorkStatusState;
  ts: number;
  fadeTimer: number | null;
}

export interface SessionsList {
  /** 列表容器（挂到弹窗内合适位置；空列表时显示空态） */
  el: HTMLElement;
  /** 用最新条目刷新（新行插入、旧行更新、完成行排定 10s 淡出）；返回渲染行数 */
  update(entries: WorkStatusSessionEntry[]): number;
  /** 清定时器 + 摘 DOM（幂等） */
  dispose(): void;
}

/** 创建会话状态列表（纯 DOM 组件，生命周期由调用方的弹窗持有） */
export function createSessionsList(): SessionsList {
  injectSessionsCss();
  const el = document.createElement('div');
  el.className = 'dsh-pet-sessions-list';
  const empty = document.createElement('div');
  empty.className = 'dsh-pet-sessions-empty';
  empty.textContent = '当前没有会话活动';
  el.appendChild(empty);

  const rows = new Map<string, RowHandle>();
  /** 已淡出行（会话 id → 淡出时的状态时间戳）：同档旧条目不复活，翻新档清除标记回列表 */
  const faded = new Map<string, number>();
  let disposed = false;

  const removeRow = (id: string): void => {
    const row = rows.get(id);
    if (!row) return;
    if (row.fadeTimer !== null) window.clearTimeout(row.fadeTimer);
    row.root.remove();
    rows.delete(id);
  };

  const update = (entries: WorkStatusSessionEntry[]): number => {
    if (disposed) return 0;
    const seen = new Set<string>();
    let count = 0;
    for (const s of entries) {
      seen.add(s.id);
      if (faded.get(s.id) === s.ts) continue; // 同档已淡出：不复活
      count += 1;
      let row = rows.get(s.id);
      const isDone = s.state === 'success';
      if (!row) {
        const name = document.createElement('div');
        name.className = 'dsh-pet-sessions-name';
        const task = document.createElement('div');
        task.className = 'dsh-pet-sessions-task';
        const main = document.createElement('div');
        main.className = 'dsh-pet-sessions-main';
        main.appendChild(name);
        main.appendChild(task);
        const sym = document.createElement('div');
        sym.className = 'dsh-pet-sessions-sym';
        const root = document.createElement('div');
        root.className = 'dsh-pet-sessions-row';
        root.appendChild(main);
        root.appendChild(sym);
        el.appendChild(root);
        row = { root, name, task, sym, state: s.state, ts: s.ts, fadeTimer: null };
        rows.set(s.id, row);
      }
      row.name.textContent = s.title;
      row.task.textContent = s.task ?? '';
      row.task.style.display = s.task ? '' : 'none';
      row.root.title = STATUS_LABEL[STATUS_KIND[s.state]] + '：' + s.title;
      if (row.state !== s.state || row.ts !== s.ts) {
        // 翻档（或同档新时间戳）：换符号；完成行重排 10s 淡出，翻离完成则撤销淡出
        row.state = s.state;
        row.ts = s.ts;
        faded.delete(s.id);
        row.sym.innerHTML = statusSymbol(s.state);
        row.sym.setAttribute('aria-label', STATUS_LABEL[STATUS_KIND[s.state]]);
        row.sym.style.color = STATUS_COLOR[STATUS_KIND[s.state]];
      } else if (!row.sym.firstChild) {
        row.sym.innerHTML = statusSymbol(s.state);
      }
      if (isDone) {
        if (row.fadeTimer === null && !row.root.classList.contains('is-fading')) {
          // 淡出起点 = 该档状态变化时刻（s.ts）起 10s；弹窗晚开也按真实时刻走
          const remain = FADE_AFTER_MS - (Date.now() - s.ts);
          row.fadeTimer = window.setTimeout(() => {
            row.fadeTimer = null;
            faded.set(s.id, s.ts);
            row.root.classList.add('is-fading');
            // 淡出 + 坍缩动画走完再摘 DOM（坍缩 350ms 与淡出 1s 重叠，1.2s 后清）
            window.setTimeout(() => {
              if (faded.get(s.id) === s.ts) removeRow(s.id);
            }, 1200);
          }, Math.max(0, remain));
        }
      } else if (row.fadeTimer !== null || row.root.classList.contains('is-fading')) {
        // 完成档被新一轮活动顶掉：撤销淡出，行回列表
        if (row.fadeTimer !== null) window.clearTimeout(row.fadeTimer);
        row.fadeTimer = null;
        faded.delete(s.id);
        row.root.classList.remove('is-fading');
      }
    }
    for (const id of [...rows.keys()]) {
      if (seen.has(id)) continue;
      faded.delete(id); // 条目已从宿主消失：清标记（同一会话再有活动时正常显示）
      removeRow(id);
    }
    empty.style.display = count ? 'none' : '';
    return count;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const id of [...rows.keys()]) removeRow(id);
    el.remove();
  };

  return { el, update, dispose };
}

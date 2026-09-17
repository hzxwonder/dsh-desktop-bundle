window.__ModuleLoader__.load({
  id: "dsh-plugin-browser",
  factory: (require) => {
    var module = {exports: {}};
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, {value: "Module"});
    const React = require("react");

    const NS = "dshPluginBrowser";
    const KIND = "browser";
    const ID = "dsh-plugin-browser/sidebar";
    /** How long an Agent pointer stays on screen before it fades back. */
    const POINTER_HOLD_MS = 2600;
    const POINTER_FADE_MS = 900;
    const RIPPLE_MS = 620;
    const ANIMATE_MS = 380;
    const HOVER_PROBE_MS = 110;
    const WHEEL_FLUSH_MS = 60;
    const RESIZE_SETTLE_MS = 220;
    const POLL_MS = 900;
    const STREAM_RETRY_MS = 1500;
    const STREAM_REATTACH_POLLS = 12;
    /** How often a native surface reads the panel state: with the page on the
     * compositor there are no frame events, so the tabs, the address, the
     * loading flag and a fall back to frames all arrive on this beat. */
    const NATIVE_STATE_MS = 3000;
    /** How long the pane waits between transport reads while it has no page. */
    const TRANSPORT_RETRY_MS = 2000;
    /** How long a leaving surface waits before it takes the guest view away. */
    const NATIVE_RELEASE_MS = 250;
    /** Zoom steps a real browser offers, applied to the layout width. */
    const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
    /** Logical width of the desktop layout the pane asks the Host for. */
    const DESKTOP_WIDTH = 1280;
    /** How long a picture may stand still before the pane says so. */
    const STALE_MS = 2500;
    /** Main-area slot key: the same browser rendered into the whole window. */
    const PANEL = "browser";
    /** Visited pages the address field offers, newest first. */
    const HISTORY_LIMIT = 40;
    const COPY = {
      en: {
        "browser": "Browser",
        "address": "Address",
        "back": "Back",
        "forward": "Forward",
        "reload": "Reload",
        "go": "Go",
        "close": "Close browser",
        "emptyTitle": "No page open yet",
        "emptyHint": "Type a URL above and press Enter. The Agent's browser opens here too.",
        "loading": "Loading…",
        "live": "Live",
        "polling": "Compatibility view",
        "keyboard": "Browser keyboard",
        "page": "Browser page",
        "focused": "Focused",
        "guide": "Streamed Chromium page with pointer and focus cues",
        "err.runtime": "The browser runtime is missing. Install Chromium or configure executablePath, then retry.",
        "err.readonly": "This Session is read-only. Switch the access mode before driving the browser.",
        "err.session": "The Session is not ready. Reopen the conversation and retry.",
        "err.request": "The browser request failed. Check the address and the network, then retry.",
        "err.stale": "The page changed. Operate again from the latest frame.",
        "err.point": "That position is outside the page viewport.",
        "err.text": "The text could not be forwarded to the page.",
        "err.key": "That key is not forwarded to the page.",
        "err.scroll": "That scroll distance is out of range.",
        "err.viewport": "The Sidebar size is out of range for the page.",
        "err.input": "That interaction is not supported.",
        "err.action": "That action is not available from the Sidebar.",
        "err.invalid": "Enter a valid HTTP(S) URL, for example https://example.com.",
        "err.tab": "That tab no longer exists.",
        "agentClick": "Agent click",
        "agentFill": "Agent input",
        "agentPress": "Agent key",
        "agentScroll": "Agent scroll",
        "agentDrag": "Agent drag",
        "agentNavigate": "Agent navigation",
        "humanClick": "Your click",
        "humanDrag": "Your drag",
        "humanScroll": "Your scroll",
        "typing": "Typing",
        "tabs": "Page tabs",
        "newTab": "New tab",
        "closeTab": "Close tab",
        "tabBlank": "New tab",
        "stop": "Stop loading",
        "tools": "Browser menu",
        "zoomIn": "Zoom in",
        "zoomOut": "Zoom out",
        "zoomReset": "Reset zoom to 100%",
        "layoutDesktop": "Desktop layout (1280 wide)",
        "layoutFit": "Fit the pane width",
        "desktop": "Desktop",
        "fit": "Fit",
        "copy": "Copy",
        "paste": "Paste",
        "selectAll": "Select all",
        "copied": "Copied {n} characters",
        "copyEmpty": "Nothing is selected on the page",
        "pasteHint": "The clipboard could not be read. Press Ctrl+V in the page.",
        "stale": "Picture paused",
        "expand": "Open in the main area",
        "collapse": "Return to the Sidebar",
        "history": "Visited pages",
        "historyEmpty": "This Session has not visited a page yet",
        "dismiss": "Dismiss",
        "err.origin": "That address is outside the origins this deployment allows.",
        "err.limit": "This Session already holds its maximum tabs. Close one before opening another.",
        "err.view": "The desktop window cannot show the page right now.",
        "err.viewGone": "The page surface is gone; the tab will be reopened.",
        "err.viewDenied": "The browser refused that page operation.",
      },
      zh: {
        "browser": "浏览器",
        "address": "地址",
        "back": "后退",
        "forward": "前进",
        "reload": "刷新",
        "go": "打开",
        "close": "关闭浏览器",
        "emptyTitle": "还没有打开网页",
        "emptyHint": "在上方地址栏输入网址并回车即可浏览；Agent 调用 browser 工具时也会显示在这里。",
        "loading": "加载中…",
        "live": "实时",
        "polling": "兼容模式",
        "keyboard": "浏览器键盘",
        "page": "浏览器页面",
        "focused": "已聚焦",
        "guide": "实时串流的 Chromium 页面，带指针与聚焦提示",
        "err.runtime": "浏览器运行时未安装。请安装 Chromium 或配置 executablePath 后重试。",
        "err.readonly": "当前会话为只读模式，请切换访问模式后再操作浏览器。",
        "err.session": "会话尚未就绪，请重新打开会话后重试。",
        "err.request": "浏览器请求失败，请检查地址和网络后重试。",
        "err.stale": "页面已更新，请依据最新画面重新操作。",
        "err.point": "该位置超出了页面可视区域。",
        "err.text": "文本无法发送到页面。",
        "err.key": "该按键不会转发到页面。",
        "err.scroll": "滚动距离超出范围。",
        "err.viewport": "侧栏尺寸超出页面允许范围。",
        "err.input": "不支持该交互方式。",
        "err.action": "侧栏不支持该操作。",
        "err.invalid": "请输入有效的 HTTP(S) 网址，例如 https://example.com。",
        "err.tab": "该标签页已不存在。",
        "agentClick": "Agent 点击",
        "agentFill": "Agent 输入",
        "agentPress": "Agent 按键",
        "agentScroll": "Agent 滚动",
        "agentDrag": "Agent 拖拽",
        "agentNavigate": "Agent 打开页面",
        "humanClick": "你的点击",
        "humanDrag": "你的拖拽",
        "humanScroll": "你的滚动",
        "typing": "正在输入",
        "tabs": "标签页",
        "newTab": "新建标签页",
        "closeTab": "关闭标签页",
        "tabBlank": "新标签页",
        "stop": "停止加载",
        "tools": "浏览器菜单",
        "zoomIn": "放大",
        "zoomOut": "缩小",
        "zoomReset": "恢复 100%",
        "layoutDesktop": "桌面布局（宽 1280）",
        "layoutFit": "适配侧栏宽度",
        "desktop": "桌面",
        "fit": "适配",
        "copy": "复制",
        "paste": "粘贴",
        "selectAll": "全选",
        "copied": "已复制 {n} 个字符",
        "copyEmpty": "页面上没有选中内容",
        "pasteHint": "无法读取剪贴板，请在页面里按 Ctrl+V。",
        "stale": "画面已暂停",
        "expand": "在主页区打开",
        "collapse": "收回到侧栏",
        "history": "访问记录",
        "historyEmpty": "本会话还没有访问过页面",
        "dismiss": "关闭提示",
        "err.origin": "该地址不在本部署允许的来源内，已拒绝打开。",
        "err.limit": "本会话的标签页已达上限，请先关闭一个再新建。",
        "err.view": "桌面窗口暂时无法显示该页面。",
        "err.viewGone": "承载面已失效，将重新打开该标签页。",
        "err.viewDenied": "浏览器拒绝了该页面操作。",
      },
    };
    const ERROR_KEYS = {
      BROWSER_RUNTIME_MISSING: "err.runtime",
      BROWSER_READ_ONLY: "err.readonly",
      BROWSER_SESSION_REQUIRED: "err.session",
      BROWSER_REQUEST_FAILED: "err.request",
      BROWSER_STALE_OBSERVATION: "err.stale",
      BROWSER_INVALID_POINT: "err.point",
      BROWSER_INVALID_TEXT: "err.text",
      BROWSER_INVALID_KEY: "err.key",
      BROWSER_INVALID_SCROLL: "err.scroll",
      BROWSER_INVALID_VIEWPORT: "err.viewport",
      BROWSER_INVALID_INPUT: "err.input",
      BROWSER_INVALID_ACTION: "err.action",
      BROWSER_INVALID_URL: "err.invalid",
      BROWSER_HTTP_URL_REQUIRED: "err.invalid",
      BROWSER_UNKNOWN_TAB: "err.tab",
      BROWSER_ORIGIN_DENIED: "err.origin",
      BROWSER_TAB_LIMIT: "err.limit",
      BROWSER_VIEW_UNAVAILABLE: "err.view",
      BROWSER_VIEW_UNKNOWN: "err.viewGone",
      BROWSER_VIEW_CDP_DENIED: "err.viewDenied",
    };
    const AGENT_LABELS = {click: "agentClick", fill: "agentFill", press: "agentPress", scroll: "agentScroll", drag: "agentDrag", navigate: "agentNavigate"};
    const HUMAN_LABELS = {click: "humanClick", drag: "humanDrag", scroll: "humanScroll"};
    /** Keys the Host forwards, spelled exactly as the Host validates them. */
    const PLAIN_KEYS = ["Enter", "Tab", "Escape", "Backspace", "Delete", "Insert", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "F5"];
    const COMBO_KEYS = {a: "Ctrl+A", c: "Ctrl+C", v: "Ctrl+V", x: "Ctrl+X", z: "Ctrl+Z", f: "Ctrl+F", l: "Ctrl+L"};
    /** Input that comes from the person in front of the picture. */
    const HUMAN_INPUT = new Set(["click", "drag", "scroll", "text", "key"]);

    function httpUrl(input) {
      let url;
      try { url = new URL(input); } catch { throw new Error("invalid URL"); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("HTTP(S) URL required");
      return url.href;
    }

    /** What a tab strip calls one tab: the site, or a placeholder while blank. */
    function tabLabel(url, blank) {
      if (!url || url === "about:blank") return blank;
      try { return new URL(url).host || url; } catch { return url; }
    }

    function errorKey(error) {
      const code = /^BROWSER_[A-Z_]+/.exec(String(error?.message ?? error))?.[0];
      return ERROR_KEYS[code] ?? "err.request";
    }

    /** Whether a measured hole equals the one already reported. */
    function sameBounds(left, right) {
      if (left === right) return true;
      if (!left || !right) return false;
      return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
    }

    function decodeBase64(value) {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return bytes;
    }

    function roundedRect(context, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      context.beginPath();
      context.moveTo(x + r, y);
      context.arcTo(x + width, y, x + width, y + height, r);
      context.arcTo(x + width, y + height, x, y + height, r);
      context.arcTo(x, y + height, x, y, r);
      context.arcTo(x, y, x + width, y, r);
      context.closePath();
    }

    /** Draw a label chip clamped inside the canvas so a marker keeps its caption. */
    function drawChip(context, text, x, y, alpha, canvas) {
      if (!text || alpha <= 0) return;
      context.save();
      context.globalAlpha = alpha;
      context.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
      const padding = 6;
      const width = Math.min(context.measureText(text).width + padding * 2, canvas.width - 8);
      const height = 18;
      const left = Math.max(4, Math.min(x, canvas.width - width - 4));
      const top = Math.max(4, Math.min(y, canvas.height - height - 4));
      context.fillStyle = "rgba(17, 24, 28, 0.92)";
      roundedRect(context, left, top, width, height, 5);
      context.fill();
      context.fillStyle = "#fff";
      context.textBaseline = "middle";
      context.fillText(text, left + padding, top + height / 2 + 0.5, width - padding * 2);
      context.restore();
    }

    /** Shared mouse-cursor glyph, drawn with its outline so it reads on any page. */
    const CURSOR_ICON = "M325.632 897.024c-7.168 0-14.336-1.024-21.504-3.072a73.728 73.728 0 0 1-53.76-66.56L205.824 207.36a75.1616 75.1616 0 0 1 117.248-67.584l514.56 348.672c26.112 17.92 38.4 49.152 30.72 80.384s-32.768 53.248-64.512 56.832l-250.88 29.184c-6.656 0.512-12.288 4.096-16.384 9.728s-151.04 202.752-151.04 202.752c-14.336 19.456-36.864 30.208-59.904 30.208zM281.088 177.664c-5.632 0-10.24 2.048-12.288 3.072-3.072 1.536-12.8 8.704-11.776 22.528l44.544 620.032c1.024 15.36 13.312 20.48 17.408 21.504 4.096 1.024 16.896 3.584 26.112-8.704l151.04-202.752c12.288-16.384 31.232-27.648 51.712-29.696l250.88-29.184c15.36-2.048 19.456-14.336 20.48-17.92 1.024-4.096 3.072-16.896-9.728-25.6L294.4 182.272a23.6032 23.6032 0 0 0-13.312-4.096z";
    const CURSOR_TIP = [214, 196];
    let cursorPath = null;

    function drawCursor(context, x, y, size, alpha) {
      if (!cursorPath) cursorPath = new Path2D(CURSOR_ICON);
      const unit = size / 1024;
      context.save();
      context.globalAlpha = alpha;
      context.translate(x - CURSOR_TIP[0] * unit, y - CURSOR_TIP[1] * unit);
      context.scale(unit, unit);
      context.lineJoin = "round";
      context.shadowColor = "rgba(12, 16, 20, 0.35)";
      context.shadowBlur = 150;
      context.shadowOffsetY = 60;
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.lineWidth = 104;
      context.stroke(cursorPath);
      context.shadowColor = "transparent";
      context.fillStyle = "#bfbfbf";
      context.fill(cursorPath);
      context.strokeStyle = "rgba(23, 25, 28, 0.4)";
      context.lineWidth = 30;
      context.stroke(cursorPath);
      context.restore();
    }

    function drawRing(context, x, y, radius, alpha, width) {
      if (alpha <= 0) return;
      context.save();
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.strokeStyle = "#276ef1";
      context.lineWidth = width;
      context.stroke();
      context.restore();
    }

    function captionOf(target, fallback) {
      if (!target) return "";
      return [target.role, target.name].filter(Boolean).join(" · ") || fallback;
    }

    /** Outline one element box with its caption chip. */
    function drawOutline(context, box, scale, alpha, caption, canvas, accent) {
      if (!box || !(box.width > 0) || !(box.height > 0)) return;
      const x = box.x * scale;
      const y = box.y * scale;
      const width = Math.max(2, box.width * scale);
      const height = Math.max(2, box.height * scale);
      context.save();
      context.globalAlpha = alpha;
      context.lineWidth = 2;
      context.strokeStyle = accent;
      context.shadowColor = "rgba(39, 110, 241, 0.45)";
      context.shadowBlur = 6;
      roundedRect(context, x - 1, y - 1, width + 2, height + 2, 4);
      context.stroke();
      context.restore();
      drawChip(context, caption, x, y - 22, alpha, canvas);
    }

    /**
     * Repaint the annotation layer: Agent pointer, click ripple, focused field,
     * hovered element, drag guide and the typing echo. The layer is a separate
     * canvas so incoming page frames never erase it.
     */
    function paintOverlay(canvas, state, now) {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      const viewport = state.viewport;
      if (!(viewport.width > 0) || !(canvas.width > 0)) return;
      const scale = canvas.width / viewport.width;
      if (state.hoverLive && state.hover?.box) {
        // A hovered page root spans the whole frame; captioned instead of
        // outlined so the cue never turns into a border around everything.
        const whole = state.hover.box.width >= viewport.width * 0.98 && state.hover.box.height >= viewport.height * 0.98;
        if (whole) drawChip(context, state.caption, (state.hoverBox?.x ?? 12) * scale + 16, (state.hoverBox?.y ?? 12) * scale + 18, 0.9, canvas);
        else drawOutline(context, state.hover.box, scale, 0.8, captionOf(state.hover, state.caption), canvas, "rgba(39, 110, 241, 0.7)");
      }
      if (state.drag?.to) {
        context.save();
        context.globalAlpha = 0.8;
        context.setLineDash([6, 5]);
        context.strokeStyle = "#276ef1";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(state.drag.from.x * scale, state.drag.from.y * scale);
        context.lineTo(state.drag.to.x * scale, state.drag.to.y * scale);
        context.stroke();
        context.restore();
      }
      if (state.focus?.box) {
        drawOutline(context, state.focus.box, scale, 1, captionOf(state.focus, state.caption), canvas, "#276ef1");
        if (state.focus.editable && state.focus.box.height > 0) {
          const caretX = state.focus.box.x * scale + 3;
          const caretTop = state.focus.box.y * scale + Math.max(2, state.focus.box.height * scale * 0.22);
          const caretHeight = Math.max(8, state.focus.box.height * scale * 0.56);
          context.save();
          context.globalAlpha = (Math.sin(now / 260) + 1) / 2 * 0.85 + 0.1;
          context.fillStyle = "#276ef1";
          context.fillRect(caretX, caretTop, 2, caretHeight);
          context.restore();
        }
      }
      const pointer = state.pointer;
      if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
        const age = now - pointer.at;
        const travel = Math.min(1, Math.max(0, age / ANIMATE_MS));
        const eased = 1 - (1 - travel) ** 3;
        const x = (pointer.fromX + (pointer.x - pointer.fromX) * eased) * scale;
        const y = (pointer.fromY + (pointer.y - pointer.fromY) * eased) * scale;
        const alpha = Math.max(0.25, 1 - Math.max(0, age - POINTER_HOLD_MS) / POINTER_FADE_MS);
        drawCursor(context, x, y, Math.max(28, Math.min(46, canvas.width / 17)), alpha);
        drawChip(context, pointer.label, x + 20, y + 18, alpha, canvas);
        if (travel < 1) drawRing(context, x, y, 6 + 10 * eased, (1 - travel) * 0.5, 2);
      }
      const ripple = state.ripple;
      if (ripple) {
        const age = now - ripple.at;
        if (age <= RIPPLE_MS) {
          const progress = age / RIPPLE_MS;
          drawRing(context, ripple.x * scale, ripple.y * scale, 4 + 26 * progress, (1 - progress) * 0.85, 2.5);
          drawRing(context, ripple.x * scale, ripple.y * scale, 2 + 14 * progress, (1 - progress) * 0.5, 1.5);
        }
      }
      if (state.typing && now - state.typing.at < 2600) {
        const alpha = 1 - Math.max(0, now - state.typing.at - 1800) / 800;
        drawChip(context, `\u2328 ${state.typing.text}`.slice(0, 80), 40, canvas.height - 32, Math.max(0, alpha), canvas);
      }
    }

    /** One dictionary lookup, with the English copy as the last resort. */
    function translate(t, key, params) {
      const text = t?.(key, params) ?? COPY.en[key] ?? key;
      return params ? Object.entries(params).reduce((line, [name, value]) => line.replace(`{${name}}`, String(value)), text) : text;
    }

    /**
     * The surface that owns the guest view. A surface on its way out only takes
     * the view away while no newer surface has claimed it, so moving the page
     * between the Sidebar and the main area never leaves it hidden.
     */
    let nativeOwner = 0;
    let nativeClaim = 0;

    /**
     * The browser chrome both surfaces share. The Sidebar pane and the
     * main-area panel are the same component against one Session, so a page
     * opened in either place is the same page, with the same tabs and history.
     */
    function BrowserSurface({sessionId, t, visible, placement, onExpand, onCollapse}) {
      const copy = React.useCallback((key, params) => translate(t, key, params), [t]);
      const [address, setAddress] = React.useState("");
      const [active, setActive] = React.useState(false);
      const [loading, setLoading] = React.useState(false);
      const [mode, setMode] = React.useState("stream");
      const [error, setError] = React.useState("");
      const [size, setSize] = React.useState(undefined);
      const [tabs, setTabs] = React.useState([]);
      const [nav, setNav] = React.useState({canGoBack: false, canGoForward: false});
      const [zoom, setZoom] = React.useState(1);
      const [desktop, setDesktop] = React.useState(true);
      const [view, setView] = React.useState({width: 0, height: 0, scale: 1});
      const [menu, setMenu] = React.useState(undefined);
      const [note, setNote] = React.useState("");
      const [stale, setStale] = React.useState(false);
      const [history, setHistory] = React.useState([]);
      const [historyOpen, setHistoryOpen] = React.useState(false);
      /** The transport the Host carries this page on: `native` means the shell
       * composites a real view and the pane only places it. */
      const [transport, setTransport] = React.useState(undefined);
      const stage = React.useRef(null);
      const surface = React.useRef(null);
      const overlay = React.useRef(null);
      const keyboard = React.useRef(null);
      const addressField = React.useRef(null);
      const viewport = React.useRef({width: 1280, height: 800});
      const observation = React.useRef(0);
      const queue = React.useRef(Promise.resolve());
      const editing = React.useRef(false);
      const composing = React.useRef(false);
      const hover = React.useRef(undefined);
      const hoverLive = React.useRef(false);
      const focus = React.useRef(undefined);
      const pointer = React.useRef(undefined);
      const ripple = React.useRef(undefined);
      const typing = React.useRef(undefined);
      const drag = React.useRef(undefined);
      const swallowClick = React.useRef(false);
      const pendingFrame = React.useRef(undefined);
      const decoding = React.useRef(false);
      const hoverPoint = React.useRef(undefined);
      const hoverAt = React.useRef(0);
      const hoverBusy = React.useRef(false);
      const hoverPending = React.useRef(undefined);
      const wheelDelta = React.useRef(0);
      const wheelPoint = React.useRef(undefined);
      const wheelTimer = React.useRef(0);
      const polls = React.useRef(0);
      const beat = React.useRef({at: 0, off: 0});
      const noteTimer = React.useRef(0);
      /** The hole the guest view fills, as last measured from the stage. */
      const geometry = React.useRef(undefined);
      /** The measure pass the native reports read from, replaced every layout. */
      const remeasure = React.useRef(undefined);
      /** What the Host was last told, so an unchanged hole costs no request. */
      const reported = React.useRef({sent: false, bounds: null, zoom: 1, visible: false});
      const pendingReport = React.useRef(0);
      const layout = React.useRef({zoom: 1, desktop: true});
      layout.current = {zoom, desktop};
      const endpoint = `/api/dsh-browser?sessionId=${encodeURIComponent(sessionId)}`;
      const streamEndpoint = `/api/dsh-browser/stream?sessionId=${encodeURIComponent(sessionId)}`;
      const native = transport === "native";
      const empty = !active;
      // The guest view floats above everything the renderer paints, so the pane
      // takes it away while its own chrome covers the stage instead of leaving
      // the page floating over a menu, the visit log or an error row.
      const occluded = !visible || empty || menu !== undefined || historyOpen || Boolean(error);

      /** Show a short-lived hint inside the pane, the way a browser shows toast
       * confirmations for copying and clipboard failures. */
      const flash = React.useCallback(text => {
        setNote(text);
        clearTimeout(noteTimer.current);
        noteTimer.current = setTimeout(() => setNote(""), 2200);
      }, []);

      /** The Host picks the transport, so the pane takes it from every payload
       * it sees: a state read, an action answer or a stream event. */
      const readTransport = React.useCallback(value => {
        if (value?.transport !== "native" && value?.transport !== "screencast") return false;
        setTransport(value.transport);
        return true;
      }, []);

      /** One panel state read, without a size: a read never resizes the Host's
       * viewport, and it answers what the pane cannot see without frames. */
      const readState = React.useCallback(async () => {
        const response = await fetch(endpoint, {cache: "no-store"});
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error || "BROWSER_REQUEST_FAILED");
        return value;
      }, [endpoint]);

      /** Adopt a state read the way the stream's hello does. With the shell
       * compositing the page this is what keeps the chrome current: the address,
       * the tabs, the loading flag and the observation counter. */
      const adopt = React.useCallback(value => {
        if (value?.active === false) { setActive(false); setLoading(false); return; }
        setActive(true);
        if (value.observation) observation.current = Math.max(observation.current, value.observation);
        if (typeof value.url === "string" && !editing.current) setAddress(value.url === "about:blank" ? "" : value.url);
        if (value.tabs) setTabs(value.tabs);
        if (value.loading !== undefined) setLoading(Boolean(value.loading));
        if (value.canGoBack !== undefined) setNav({canGoBack: Boolean(value.canGoBack), canGoForward: Boolean(value.canGoForward)});
      }, []);

      const paint = React.useCallback(() => {
        if (overlay.current) {
          paintOverlay(overlay.current, {
            viewport: viewport.current, pointer: pointer.current, ripple: ripple.current, drag: drag.current,
            focus: focus.current, hover: hover.current, hoverLive: hoverLive.current, hoverBox: hoverPoint.current,
            typing: typing.current, caption: copy("focused"),
          }, performance.now());
        }
        if (surface.current) surface.current.style.cursor = hoverLive.current ? (hover.current?.cursor ?? "default") : "default";
      }, [copy]);

      // One animation clock: frames arrive on the wire, annotations repaint at
      // 30fps only while a page is on screen to annotate. A native page is
      // painted by the shell, so there is nothing to repaint here.
      React.useEffect(() => {
        if (!visible || !active || native) return undefined;
        let raf = 0;
        let last = 0;
        const tick = now => {
          raf = requestAnimationFrame(tick);
          if (now - last < 33) return;
          last = now;
          paint();
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }, [visible, active, native, paint]);

      React.useEffect(() => () => clearTimeout(wheelTimer.current), []);

      const drawFrame = React.useCallback(data => {
        pendingFrame.current = data;
        if (decoding.current) return;
        decoding.current = true;
        void (async () => {
          while (pendingFrame.current) {
            const next = pendingFrame.current;
            pendingFrame.current = undefined;
            try {
              const picture = await createImageBitmap(new Blob([decodeBase64(next)], {type: "image/jpeg"}));
              const canvas = surface.current;
              if (canvas) {
                if (canvas.width !== picture.width) canvas.width = picture.width;
                if (canvas.height !== picture.height) canvas.height = picture.height;
                canvas.getContext("2d")?.drawImage(picture, 0, 0);
                if (overlay.current && overlay.current.width !== canvas.width) {
                  overlay.current.width = canvas.width;
                  overlay.current.height = canvas.height;
                }
                paint();
              }
              picture.close?.();
            } catch { /* a torn frame is replaced by the next one */ }
          }
          decoding.current = false;
        })();
      }, [paint]);

      const handleEvent = React.useCallback(event => {
        // A Host that names the transport only on its stream is still heard.
        readTransport(event);
        // Events carry the counter they were produced with, so the pane never
        // sends input against a page that has already moved past it.
        if (event.observation) observation.current = Math.max(observation.current, event.observation);
        if (event.t === "hello") {
          if (event.viewport) viewport.current = event.viewport;
          if (event.tabs) { setTabs(event.tabs); }
          setNav({canGoBack: Boolean(event.canGoBack), canGoForward: Boolean(event.canGoForward)});
          setActive(event.active !== false);
          if (event.url && !editing.current) setAddress(event.url === "about:blank" ? "" : event.url);
          return;
        }
        if (event.t === "tabs") {
          setTabs(event.tabs ?? []);
          return;
        }
        if (event.t === "state") {
          if (event.active === false) { setActive(false); return; }
          setActive(true);
          if (event.url && !editing.current) setAddress(event.url === "about:blank" ? "" : event.url);
          if (event.tabs) setTabs(event.tabs);
          if (event.loading !== undefined) setLoading(Boolean(event.loading));
          if (event.canGoBack !== undefined) setNav({canGoBack: Boolean(event.canGoBack), canGoForward: Boolean(event.canGoForward)});
          return;
        }
        if (event.t === "tick") {
          // The Host's beat separates "nothing changed on the page" from "the
          // picture stopped coming", which are very different for a human.
          beat.current = {at: performance.now(), off: event.screencast === false ? beat.current.off + 1 : 0};
          return;
        }
        if (event.t === "frame") {
          if (event.viewport) viewport.current = event.viewport;
          beat.current = {at: performance.now(), off: 0};
          setActive(true);
          drawFrame(event.data);
          return;
        }
        if (event.t === "pointer") {
          const previous = pointer.current;
          pointer.current = {
            x: event.x, y: event.y,
            fromX: previous?.x ?? event.x, fromY: previous?.y ?? event.y,
            at: performance.now(),
            label: event.source === "human" ? copy(HUMAN_LABELS[event.kind] ?? "humanClick") : (event.label || copy(AGENT_LABELS[event.kind] ?? "agentClick")),
          };
          if (event.kind === "click") ripple.current = {x: event.x, y: event.y, at: performance.now()};
          return;
        }
        if (event.t === "focus") {
          focus.current = event.focus ?? undefined;
          return;
        }
        if (event.t === "typing") {
          typing.current = {text: event.text ?? "", at: performance.now()};
          return;
        }
        if (event.t === "error") setError(copy(ERROR_KEYS[event.code] ?? "err.request"));
      }, [copy, drawFrame, readTransport]);

      // The stream is the primary picture; polling only covers a Host without
      // the streaming route or a carrier that cannot hold a response open.
      // A native page is composited by the shell, so neither path is subscribed.
      React.useEffect(() => {
        if (transport !== "screencast" || !visible || !sessionId || mode !== "stream") return undefined;
        const controller = new AbortController();
        const connect = async () => {
          try {
            const query = size ? `&width=${size.width}&height=${size.height}` : "";
            const response = await fetch(streamEndpoint + query, {signal: controller.signal, cache: "no-store"});
            if (!response.ok || !response.body) throw new Error(response.status === 404 ? "BROWSER_SESSION_REQUIRED" : "BROWSER_REQUEST_FAILED");
            setLoading(false);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              buffer += decoder.decode(chunk.value, {stream: true});
              let index;
              while ((index = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, index);
                buffer = buffer.slice(index + 1);
                if (!line.trim()) continue;
                try { handleEvent(JSON.parse(line)); } catch { /* a torn line is rebuilt by the next frame */ }
              }
            }
            if (controller.signal.aborted) return;
            setMode("poll");
          } catch (failure) {
            if (controller.signal.aborted) return;
            if (/BROWSER_SESSION_REQUIRED/.test(String(failure?.message))) setActive(false);
            setMode("poll");
          }
        };
        void connect();
        return () => { controller.abort(); };
      }, [transport, visible, sessionId, size, mode, streamEndpoint, handleEvent]);

      // Compatibility view: the one-shot JPEG poll, used while the stream is
      // unavailable. It periodically re-attempts the stream, so a pane returns
      // to live frames as soon as the streaming route answers again.
      React.useEffect(() => {
        if (transport !== "screencast" || !visible || !sessionId || mode !== "poll") return undefined;
        const controller = new AbortController();
        let timer;
        const poll = async () => {
          try {
            const query = size ? `&width=${size.width}&height=${size.height}` : "";
            const response = await fetch(endpoint + query, {signal: controller.signal, cache: "no-store"});
            const value = await response.json();
            if (controller.signal.aborted) return;
            if (!response.ok) throw new Error(value.error || "BROWSER_REQUEST_FAILED");
            setActive(value.active);
            if (!value.active) { setLoading(false); return; }
            observation.current = Math.max(observation.current, value.observation);
            if (!editing.current) setAddress(value.url === "about:blank" ? "" : value.url);
            if (value.tabs) setTabs(value.tabs);
            if (value.loading !== undefined) setLoading(Boolean(value.loading));
            if (value.canGoBack !== undefined) setNav({canGoBack: Boolean(value.canGoBack), canGoForward: Boolean(value.canGoForward)});
            viewport.current = {width: value.width, height: value.height};
            beat.current = {at: performance.now(), off: 0};
            drawFrame(value.image);
            setLoading(false);
          } catch (failure) {
            if (!controller.signal.aborted) setError(copy(errorKey(failure)));
          } finally {
            if (controller.signal.aborted) return;
            polls.current += 1;
            if (polls.current >= STREAM_REATTACH_POLLS) { polls.current = 0; setMode("stream"); return; }
            timer = setTimeout(poll, POLL_MS);
          }
        };
        void poll();
        return () => { controller.abort(); clearTimeout(timer); };
      }, [transport, visible, sessionId, size, mode, endpoint, copy, drawFrame]);

      // Which transport carries the page is the Host's choice, made when the
      // Session's first tab is created. The pane asks before it subscribes to
      // anything, so a native Session never opens a frame stream; a Host that
      // never mentions the field is the Web one, and the pane stays exactly the
      // streaming pane it is today. A surface that is not on screen still asks
      // once, because the shell has to be told that its view is not shown.
      React.useEffect(() => {
        if (!sessionId || transport !== undefined) return undefined;
        let stopped = false;
        let timer;
        let failures = 0;
        const probe = async () => {
          let value;
          try { value = await readState(); failures = 0; } catch { failures += 1; }
          if (stopped || readTransport(value)) return;
          // A live page that says nothing about the transport is the screencast
          // one; an idle Session keeps being asked, at no cost, until it has
          // one, while an off-screen pane waits for its turn instead.
          if (failures >= 2 || value?.active === true) { setTransport("screencast"); return; }
          if (visible) timer = setTimeout(probe, TRANSPORT_RETRY_MS);
        };
        void probe();
        return () => { stopped = true; clearTimeout(timer); };
      }, [visible, sessionId, transport, readState, readTransport]);

      // The pane decides the page's logical viewport: the desktop layout keeps a
      // fixed width so sites do not reflow into a phone layout in a narrow
      // Sidebar, zoom trades layout width for readable type, and the picture is
      // scaled proportionally into whatever room the stage has.
      React.useEffect(() => {
        const element = stage.current;
        if (!element || !visible) return undefined;
        let timer;
        const measure = () => {
          const room = Math.max(240, Math.min(1920, Math.round(element.clientWidth)));
          const roomHeight = Math.max(200, Math.min(1600, Math.round(element.clientHeight)));
          if (room <= 0 || roomHeight <= 0) return;
          const {zoom: factor, desktop: wantsDesktop} = layout.current;
          const logicalWidth = Math.max(240, Math.min(1920, Math.round((wantsDesktop ? DESKTOP_WIDTH : room) / factor)));
          const scale = room / logicalWidth;
          const logicalHeight = Math.max(200, Math.min(1600, Math.round(roomHeight / scale)));
          const fitted = Math.min(room / logicalWidth, roomHeight / logicalHeight);
          const picture = {width: Math.round(logicalWidth * fitted), height: Math.round(logicalHeight * fitted)};
          // Fitting the pane width hands the page the whole stage at 100%; the
          // desktop layout keeps its logical width, so the shell zooms the view
          // until the picture it used to paint is the hole it now fills.
          const hole = native && !wantsDesktop ? {width: room, height: roomHeight} : picture;
          const rect = element.getBoundingClientRect();
          geometry.current = {
            left: rect.left, top: rect.top, room, roomHeight,
            width: hole.width, height: hole.height,
            zoom: native ? (wantsDesktop ? hole.width / logicalWidth : 1) : scale,
          };
          setView({width: hole.width, height: hole.height, scale});
          if (overlay.current && overlay.current.width === 0) {
            overlay.current.width = logicalWidth * 2;
            overlay.current.height = logicalHeight * 2;
          }
          setSize(previous => previous && previous.width === logicalWidth && previous.height === logicalHeight ? previous : {width: logicalWidth, height: logicalHeight});
        };
        remeasure.current = measure;
        const observer = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(measure, RESIZE_SETTLE_MS); });
        observer.observe(element);
        measure();
        return () => { clearTimeout(timer); remeasure.current = undefined; observer.disconnect(); };
      }, [visible, zoom, desktop, native]);

      // Native transport: the shell composites the page, so the pane's whole job
      // is the hole — where the guest view goes, how far it is zoomed and whether
      // it is on screen at all. Measuring is coalesced into one frame, and a
      // report only leaves when one of those three actually changed.
      const reportHole = React.useCallback(() => {
        const hole = geometry.current;
        const bounds = hole && hole.width >= 1 && hole.height >= 1
          ? {x: Math.round(hole.left + (hole.room - hole.width) / 2), y: Math.round(hole.top + (hole.roomHeight - hole.height) / 2), width: hole.width, height: hole.height}
          : null;
        const zoomFactor = hole?.zoom ?? 1;
        const shown = Boolean(bounds) && !occluded;
        const previous = reported.current;
        if (previous.sent && previous.visible === shown && previous.zoom === zoomFactor && sameBounds(previous.bounds, bounds)) return;
        reported.current = {sent: true, bounds, zoom: zoomFactor, visible: shown};
        void fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "viewport", bounds, zoom: zoomFactor, visible: shown})})
          .then(response => response.json().catch(() => ({})))
          .then(value => { readTransport(value); })
          // A report that did not arrive is retried by the next beat.
          .catch(() => { reported.current.sent = false; });
      }, [endpoint, occluded, readTransport]);

      const scheduleHole = React.useCallback(() => {
        if (pendingReport.current) return;
        pendingReport.current = requestAnimationFrame(() => {
          pendingReport.current = 0;
          remeasure.current?.();
          reportHole();
        });
      }, [reportHole]);

      // Everything that moves, hides or shows the stage: the window resizing,
      // the Sidebar collapsing, the terminal dock taking room, the page moving
      // between the two surfaces.
      React.useEffect(() => {
        if (!native || !visible || !sessionId) return undefined;
        const element = stage.current;
        if (!element) return undefined;
        const observer = new ResizeObserver(scheduleHole);
        observer.observe(element);
        window.addEventListener("resize", scheduleHole);
        scheduleHole();
        return () => {
          if (pendingReport.current) cancelAnimationFrame(pendingReport.current);
          pendingReport.current = 0;
          observer.disconnect();
          window.removeEventListener("resize", scheduleHole);
        };
      }, [native, visible, sessionId, scheduleHole]);

      // A menu, the visit log, an error row or a switched-away tab hides the
      // page, and every one of them is a change worth reporting at once.
      React.useEffect(() => {
        if (native) scheduleHole();
      }, [native, occluded, zoom, desktop, active, scheduleHole]);

      // Leaving the page — the Sidebar collapsing, the tab switching away, the
      // other surface taking it over — takes the guest view away. The short wait
      // keeps a surface that is only being replaced out of its heir's way.
      React.useEffect(() => {
        if (!native || !visible || !sessionId) return undefined;
        const mine = (nativeOwner = ++nativeClaim);
        return () => {
          setTimeout(() => {
            if (nativeOwner !== mine || reported.current.visible === false) return;
            nativeOwner = 0;
            reported.current = {sent: false, bounds: null, zoom: 1, visible: false};
            void fetch(endpoint, {
              method: "POST", headers: {"Content-Type": "application/json"}, keepalive: true,
              body: JSON.stringify({action: "viewport", bounds: null, zoom: 1, visible: false}),
            }).catch(() => { /* the Host hides the view with the surface */ });
          }, NATIVE_RELEASE_MS);
        };
      }, [native, visible, sessionId, endpoint]);

      // With the page on the compositor the pane has no frames to watch, so it
      // keeps its chrome current, notices a fall back to frames and retries a
      // report that failed, all from the same slow beat.
      React.useEffect(() => {
        if (!native || !visible || !sessionId) return undefined;
        let stopped = false;
        let timer;
        const beatNative = async () => {
          try {
            const value = await readState();
            if (stopped) return;
            if (!readTransport(value) || value.transport === "native") adopt(value);
          } catch { /* the next beat retries */ }
          if (stopped) return;
          scheduleHole();
          timer = setTimeout(beatNative, NATIVE_STATE_MS);
        };
        void beatNative();
        return () => { stopped = true; clearTimeout(timer); };
      }, [native, visible, sessionId, readState, readTransport, adopt, scheduleHole]);

      // A stream that goes quiet, or one the Host reports as no longer sending
      // frames, is worth saying out loud; a page that simply stopped changing
      // is not, so the Host's beat decides.
      React.useEffect(() => {
        if (!visible || !active || native) { setStale(false); return undefined; }
        const timer = setInterval(() => {
          const quiet = beat.current.at > 0 && performance.now() - beat.current.at > STALE_MS * 2;
          setStale(quiet || beat.current.off >= 3);
        }, 1000);
        return () => clearInterval(timer);
      }, [visible, active, native]);

      const post = async args => {
        const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(args)});
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error || "BROWSER_REQUEST_FAILED");
        return value;
      };
      /** The Session's own visited pages. The Host bounds the log, so the pane
       * only trims what it is willing to draw in one dropdown. */
      const loadHistory = React.useCallback(async () => {
        try {
          const value = await post({action: "_history"});
          setHistory(Array.isArray(value.history) ? value.history.slice(0, HISTORY_LIMIT) : []);
        } catch { setHistory([]); }
      }, [endpoint]);
      /** Remember a pane point as a fraction of the picture the human saw. */
      const asFraction = point => ({
        fx: point.x / Math.max(1, viewport.current.width), fy: point.y / Math.max(1, viewport.current.height),
      });
      /** Turn remembered fractions into the page coordinates of one viewport. */
      const materialize = (args, size) => {
        if (args.action !== "_input" || !size?.width || !size?.height) return args;
        const at = point => ({
          x: Math.min(size.width - 1, Math.max(0, Math.round(point.fx * size.width))),
          y: Math.min(size.height - 1, Math.max(0, Math.round(point.fy * size.height))),
        });
        if (args.kind === "click") return {...args, width: size.width, height: size.height, ...at(args.point)};
        if (args.kind === "drag") return {...args, from: at(args.from), to: at(args.to)};
        if (args.kind === "scroll" && args.point) return {...args, ...at(args.point)};
        return args;
      };
      const send = args => {
        if (args.action === "navigate") setLoading(true);
        queue.current = queue.current.catch(() => {}).then(async () => {
          // The counter is read when the request leaves, not when the human
          // pressed the key: queued keystrokes would otherwise carry a value
          // the page has already moved past.
          const request = args.observation === undefined ? args : {...args, observation: observation.current};
          let value;
          try {
            value = await post(materialize(request, viewport.current));
          } catch (failure) {
            const code = errorKey(failure);
            // The human clicks the picture in front of them, so a bookkeeping
            // mismatch is re-read and repeated once instead of being refused.
            if (code !== "err.stale" || !HUMAN_INPUT.has(args.action === "_input" ? args.kind : args.action)) { setError(copy(code)); return; }
            const fresh = await post({action: "_view"}).catch(() => undefined);
            const now = fresh?.observation ? {width: fresh.width, height: fresh.height} : undefined;
            if (!now) { setError(copy(code)); return; }
            observation.current = fresh.observation;
            viewport.current = now;
            try { value = await post(materialize({...request, observation: fresh.observation}, now)); }
            catch (again) { setError(copy(errorKey(again))); return; }
          }
          if (value.observation) observation.current = Math.max(observation.current, value.observation);
          readTransport(value);
          if (value.tabs) setTabs(value.tabs);
          if (value.loading !== undefined) setLoading(Boolean(value.loading));
          if (value.canGoBack !== undefined) setNav({canGoBack: Boolean(value.canGoBack), canGoForward: Boolean(value.canGoForward)});
          setError("");
          if (args.action === "navigate" || args.action === "_reload" || args.action === "_tabs" || args.kind === "click") polls.current = 0;
          return value;
        }).catch(failure => { setError(copy(errorKey(failure))); })
          .finally(() => { if (args.action === "navigate") setLoading(false); });
      };

      // Hover probes are pure reads: they never consume an observation and never
      // queue behind an action, so the highlight follows the mouse immediately.
      const probeHover = (x, y) => {
        const now = performance.now();
        if (now - hoverAt.current < HOVER_PROBE_MS) return;
        const last = hoverPoint.current;
        if (last && Math.abs(last.x - x) < 2 && Math.abs(last.y - y) < 2) return;
        hoverAt.current = now;
        hoverPoint.current = {x, y};
        hoverPending.current = {x, y};
        if (hoverBusy.current) return;
        hoverBusy.current = true;
        void (async () => {
          while (hoverPending.current) {
            const point = hoverPending.current;
            hoverPending.current = undefined;
            try {
              const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "_hover", x: point.x, y: point.y})});
              const value = await response.json();
              if (response.ok) { hover.current = value.hover; hoverLive.current = Boolean(value.hover); }
            } catch { /* the next move retries */ }
          }
          hoverBusy.current = false;
        })();
      };

      const iconButton = (label, glyph, action, run) => React.createElement("button", {
        type: "button", className: "dsh-browser-action", title: label, "aria-label": label,
        "data-dsh-browser-action": action, onClick: () => { setError(""); (run ?? (() => send({action})))(); },
      }, glyph);
      /** History buttons mirror a real browser: unavailable moves are disabled. */
      const navButton = (label, glyph, action, disabled) => React.createElement("button", {
        type: "button", className: "dsh-browser-action", title: label, "aria-label": label,
        "data-dsh-browser-action": action, disabled: disabled ? true : undefined,
        onClick: () => { setError(""); send({action}); },
      }, glyph);
      const menuItem = (label, onSelect, options = {}) => React.createElement("button", {
        key: options.id ?? label, type: "button", role: "menuitem", className: "dsh-browser-menu-item",
        "data-dsh-browser-menu-item": options.id, disabled: options.disabled ? true : undefined,
        onClick: event => { event.stopPropagation(); onSelect(); },
      },
        React.createElement("span", {className: "dsh-browser-menu-label"}, label),
        options.checked ? React.createElement("span", {className: "dsh-browser-menu-check", "aria-hidden": "true"}, "\u2713") : null
      );
      /** Map a pane event onto page coordinates, ignoring the letterbox area. */
      const toPagePoint = (event, element) => {
        if (!element) return undefined;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return undefined;
        const x = (event.clientX - rect.left) * viewport.current.width / rect.width;
        const y = (event.clientY - rect.top) * viewport.current.height / rect.height;
        if (x < 0 || y < 0 || x >= viewport.current.width || y >= viewport.current.height) return undefined;
        return {x, y};
      };
      const navigateTo = value => {
        try {
          const target = httpUrl(value.trim());
          editing.current = false;
          setError("");
          setAddress(target);
          polls.current = 0;
          send({action: "navigate", url: target});
        } catch { setError(copy("err.invalid")); }
      };
      const navigate = () => navigateTo(address);
      /** Copy the page's own selection into the human's clipboard. */
      const copySelection = async () => {
        setMenu(undefined);
        try {
          const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "_selection"})});
          const value = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(value.error || "BROWSER_REQUEST_FAILED");
          const text = String(value.text ?? "").trim();
          if (!text) { flash(copy("copyEmpty")); return; }
          await navigator.clipboard.writeText(text);
          flash(copy("copied", {n: text.length}));
        } catch { flash(copy("err.request")); }
      };
      const pasteClipboard = async () => {
        setMenu(undefined);
        keyboard.current?.focus({preventScroll: true});
        try {
          const text = await navigator.clipboard.readText();
          if (text) send({action: "_input", kind: "text", text, observation: observation.current});
        } catch { flash(copy("pasteHint")); }
      };
      const stepZoom = direction => {
        const index = Math.max(0, ZOOM_STEPS.indexOf(zoom));
        setZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))]);
      };
      const tabAction = (op, id) => send({action: "_tabs", op, ...(id ? {tab: id} : {})});
      const onKeyDown = event => {
        if (composing.current || event.nativeEvent?.isComposing) return;
        // Escape closes the pane's own menu first, exactly like a browser menu.
        if (event.key === "Escape" && menu) { event.preventDefault(); setMenu(undefined); return; }
        if (event.metaKey || event.ctrlKey) {
          const key = event.key;
          if (key === "+" || key === "=" || key === "-" || key === "_") { event.preventDefault(); stepZoom(key === "-" || key === "_" ? -1 : 1); return; }
          if (key === "0") { event.preventDefault(); setZoom(1); return; }
          if (key.toLowerCase() === "c") { event.preventDefault(); void copySelection(); return; }
        }
        const combo = (event.metaKey || event.ctrlKey) ? COMBO_KEYS[event.key.toLowerCase()] : undefined;
        if (combo) {
          // Paste stays local: the composition field already holds the text.
          if (combo === "Ctrl+V") return;
          event.preventDefault();
          if (combo === "Ctrl+L") { addressField.current?.focus(); addressField.current?.select(); return; }
          send({action: "_input", kind: "key", key: combo, observation: observation.current});
          return;
        }
        const name = event.shiftKey && event.key === "Tab" ? "Shift+Tab" : event.key;
        if (!PLAIN_KEYS.includes(name)) return;
        event.preventDefault();
        if (name === "F5") { send({action: "_reload"}); return; }
        send({action: "_input", kind: "key", key: name, observation: observation.current});
      };

      return React.createElement("div", {
        className: "dsh-browser-body", "data-dsh-browser": "body", "data-dsh-browser-surface": placement,
        "data-dsh-browser-transport": native ? "native" : "screencast",
      },
        React.createElement("div", {className: "dsh-browser-tabs", role: "tablist", "aria-label": copy("tabs"), "data-dsh-browser": "tabs"},
          tabs.map(entry => React.createElement("div", {
            key: entry.id, className: "dsh-browser-tab", "data-dsh-browser-tab": entry.id,
            "data-active": entry.active ? "true" : undefined, role: "tab", "aria-selected": entry.active ? "true" : "false",
          },
            React.createElement("button", {
              type: "button", className: "dsh-browser-tab-label", title: entry.url || copy("tabBlank"),
              onClick: () => { if (!entry.active) tabAction("select", entry.id); },
            }, entry.loading ? React.createElement("span", {className: "dsh-browser-tab-spin", "aria-hidden": "true"}, "\u25cc") : null, tabLabel(entry.url, copy("tabBlank"))),
            tabs.length > 1 && React.createElement("button", {
              type: "button", className: "dsh-browser-tab-close", title: copy("closeTab"), "aria-label": copy("closeTab"),
              onClick: () => tabAction("close", entry.id),
            }, "\u00d7")
          )),
          React.createElement("button", {
            type: "button", className: "dsh-browser-tab-new", title: copy("newTab"), "aria-label": copy("newTab"),
            "data-dsh-browser-action": "new-tab", onClick: () => tabAction("new"),
          }, "+")
        ),
        React.createElement("div", {className: "dsh-browser-toolbar", "data-dsh-browser": "toolbar"},
          React.createElement("div", {className: "dsh-browser-group", "data-dsh-browser-group": "nav"},
            navButton(copy("back"), "\u2190", "_back", !nav.canGoBack),
            navButton(copy("forward"), "\u2192", "_forward", !nav.canGoForward),
            loading
              ? React.createElement("button", {
                  type: "button", className: "dsh-browser-action", title: copy("stop"), "aria-label": copy("stop"),
                  "data-dsh-browser-action": "_stop", onClick: () => send({action: "_stop"}),
                }, "\u25a0")
              : iconButton(copy("reload"), "\u21bb", "_reload")
          ),
          React.createElement("div", {className: "dsh-browser-group dsh-browser-group-address", "data-dsh-browser-group": "address"},
            React.createElement("input", {
              ref: addressField, className: "dsh-browser-address", value: address,
              onChange: event => setAddress(event.target.value),
              // Focusing the field offers the pages this Session has visited,
              // the way a browser offers them, without a second control.
              onFocus: () => { editing.current = true; setHistoryOpen(true); void loadHistory(); },
              onBlur: () => { editing.current = false; setHistoryOpen(false); },
              onKeyDown: event => {
                event.stopPropagation();
                if (event.key === "Enter") { setHistoryOpen(false); navigate(); return; }
                if (event.key === "Escape" && historyOpen) { event.preventDefault(); setHistoryOpen(false); }
              },
              spellCheck: false, inputMode: "url", "aria-label": copy("address"), placeholder: "https://",
              "aria-expanded": historyOpen ? "true" : "false",
            }),
            historyOpen && React.createElement("div", {
              className: "dsh-browser-history", role: "listbox", "aria-label": copy("history"), "data-dsh-browser": "history",
            },
              history.length === 0
                ? React.createElement("p", {className: "dsh-browser-history-empty"}, copy("historyEmpty"))
                : history.map(item => React.createElement("button", {
                    key: item.url, type: "button", role: "option", className: "dsh-browser-history-item",
                    "data-dsh-browser-history": item.url, title: item.url,
                    // The field keeps focus while the human picks a row.
                    onMouseDown: event => event.preventDefault(),
                    onClick: () => { setHistoryOpen(false); navigateTo(item.url); },
                  },
                    React.createElement("span", {className: "dsh-browser-history-title"}, item.title || tabLabel(item.url, copy("tabBlank"))),
                    React.createElement("span", {className: "dsh-browser-history-url"}, item.url)
                  ))
            ),
            React.createElement("button", {type: "button", className: "dsh-browser-action", title: copy("go"), "aria-label": copy("go"), onClick: navigate}, "\u21b5")
          ),
          React.createElement("div", {className: "dsh-browser-group", "data-dsh-browser-group": "view"},
            React.createElement("button", {
              type: "button", className: "dsh-browser-action", title: copy("tools"), "aria-label": copy("tools"),
              "data-dsh-browser-action": "menu", "aria-expanded": menu?.kind === "tools" ? "true" : "false",
              onClick: event => { event.stopPropagation(); setMenu(menu?.kind === "tools" ? undefined : {kind: "tools"}); },
            }, "\u22ef"),
            !native && mode !== "stream" && React.createElement("span", {className: "dsh-browser-note", "data-dsh-browser-mode": mode}, copy("polling"))
          ),
          // The window group carries the surface the page is drawn on: the
          // Sidebar pane offers the main area, the main area offers the pane.
          React.createElement("div", {className: "dsh-browser-group dsh-browser-group-window", "data-dsh-browser-group": "window"},
            onExpand && iconButton(copy("expand"), "\u2922", "expand", onExpand),
            onCollapse && iconButton(copy("collapse"), "\u2921", "collapse", onCollapse),
            iconButton(copy("close"), "\u00d7", "close")
          )
        ),
        error && React.createElement("div", {className: "dsh-browser-error", role: "alert"},
          React.createElement("span", {className: "dsh-browser-error-text"}, error),
          React.createElement("button", {
            type: "button", className: "dsh-browser-error-dismiss", title: copy("dismiss"), "aria-label": copy("dismiss"),
            onClick: () => setError(""),
          }, "\u00d7")
        ),
        React.createElement("div", {className: "dsh-browser-stage", ref: stage, "data-dsh-browser": "stage"},
          React.createElement("div", {
            className: "dsh-browser-view", "data-dsh-browser": "view",
            style: view.width ? {width: `${view.width}px`, height: `${view.height}px`} : undefined,
          },
            native
              // The shell paints the page in a view of its own; the frame stays
              // as the empty place in the layout the hole has to match.
              ? React.createElement("div", {
                  className: "dsh-browser-frame", "data-dsh-browser": "frame",
                  "aria-label": copy("page"), style: {visibility: empty ? "hidden" : "visible"},
                })
              : React.createElement("canvas", {
                  ref: surface, className: "dsh-browser-frame", "data-dsh-browser": "frame",
                  "aria-label": copy("page"), style: {visibility: empty ? "hidden" : "visible"},
                }),
            !native && React.createElement("canvas", {ref: overlay, className: "dsh-browser-overlay", "aria-hidden": "true"})
          ),
          React.createElement("textarea", {
            ref: keyboard, className: "dsh-browser-keyboard", "aria-label": copy("keyboard"),
            "data-dsh-browser": "keyboard", autoComplete: "off", spellCheck: false,
            // A native page takes the keyboard itself, so nothing is forwarded
            // from here; the field stays as the pane's own focus target.
            ...(native ? {} : {
              onChange: event => { if (!composing.current && !event.nativeEvent.isComposing && event.target.value) { send({action: "_input", kind: "text", text: event.target.value, observation: observation.current}); event.target.value = ""; } },
              onCompositionStart: () => { composing.current = true; },
              onCompositionEnd: event => { composing.current = false; if (event.target.value) { send({action: "_input", kind: "text", text: event.target.value, observation: observation.current}); event.target.value = ""; } },
              onPaste: event => {
                const text = event.clipboardData?.getData("text");
                if (!text) return;
                event.preventDefault();
                send({action: "_input", kind: "text", text, observation: observation.current});
              },
              onKeyDown: onKeyDown,
            }),
          }),
          React.createElement("div", {
            className: "dsh-browser-hit", "data-dsh-browser": "hit", tabIndex: 0, role: "application", "aria-label": copy("page"),
            // A native page receives real pointer input from the shell, so this
            // layer only keeps the pane's own layout, menu and focus contract.
            ...(native ? {} : {
              onMouseDown: event => { event.preventDefault(); keyboard.current?.focus({preventScroll: true}); },
              onPointerDown: event => {
                if (empty) return;
                const point = toPagePoint(event, surface.current);
                if (point) drag.current = {from: asFraction(point), origin: point, to: undefined};
              },
              onMouseMove: event => {
                if (empty) return;
                const point = toPagePoint(event, surface.current);
                if (!point) { hoverLive.current = false; hover.current = undefined; hoverPoint.current = undefined; return; }
                hoverLive.current = true;
                probeHover(point.x, point.y);
                if (drag.current) drag.current.to = asFraction(point);
              },
              onMouseLeave: () => { hoverLive.current = false; hover.current = undefined; hoverPoint.current = undefined; },
              onMouseUp: event => {
                const current = drag.current;
                drag.current = undefined;
                if (!current || empty || !current.to) return;
                const point = toPagePoint(event, surface.current);
                if (!point || Math.hypot(point.x - current.origin.x, point.y - current.origin.y) < 6) return;
                // A real drag is not also a click.
                swallowClick.current = true;
                send({action: "_input", kind: "drag", from: current.from, to: current.to, observation: observation.current});
              },
              onClick: event => {
                if (menu) { setMenu(undefined); swallowClick.current = false; return; }
                if (swallowClick.current) { swallowClick.current = false; return; }
                if (empty) return;
                const point = toPagePoint(event, surface.current);
                if (!point) return;
                event.stopPropagation();
                ripple.current = {x: point.x, y: point.y, at: performance.now()};
                send({
                  action: "_input", kind: "click", point: asFraction(point),
                  clickCount: Math.max(1, Math.min(3, event.detail || 1)), observation: observation.current,
                });
              },
              onContextMenu: event => {
                event.preventDefault();
                if (empty) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setMenu({kind: "page", x: Math.max(4, event.clientX - rect.left), y: Math.max(4, event.clientY - rect.top)});
              },
              onWheel: event => {
                if (empty) return;
                const point = toPagePoint(event, surface.current);
                if (!point) return;
                wheelDelta.current += event.deltaY;
                wheelPoint.current = asFraction(point);
                if (wheelTimer.current) return;
                wheelTimer.current = window.setTimeout(() => {
                  wheelTimer.current = 0;
                  const deltaY = Math.max(-1200, Math.min(1200, Math.round(wheelDelta.current)));
                  wheelDelta.current = 0;
                  if (deltaY === 0) return;
                  send({action: "_input", kind: "scroll", deltaY, point: wheelPoint.current, observation: observation.current});
                }, WHEEL_FLUSH_MS);
              },
            }),
          }),
          menu && React.createElement("div", {
            className: "dsh-browser-menu", role: "menu", "data-dsh-browser": "menu", "data-dsh-browser-menu-kind": menu.kind,
            style: menu.kind === "page" ? {left: `${menu.x}px`, top: `${menu.y}px`} : {right: "8px", top: "34px"},
            onClick: event => event.stopPropagation(),
          }, ...(menu.kind === "page"
            ? [
                menuItem(copy("copy"), () => void copySelection(), {id: "copy"}),
                menuItem(copy("paste"), () => void pasteClipboard(), {id: "paste"}),
                menuItem(copy("selectAll"), () => { setMenu(undefined); send({action: "_input", kind: "key", key: "Ctrl+A", observation: observation.current}); }, {id: "select-all"}),
              ]
            : [
                menuItem(`${copy("zoomOut")}  ${Math.round(zoom * 100)}%`, () => { setMenu(undefined); stepZoom(-1); }, {id: "zoom-out", disabled: zoom <= ZOOM_STEPS[0]}),
                menuItem(copy("zoomIn"), () => { setMenu(undefined); stepZoom(1); }, {id: "zoom-in", disabled: zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}),
                menuItem(copy("zoomReset"), () => { setMenu(undefined); setZoom(1); }, {id: "zoom-reset", checked: zoom === 1}),
                menuItem(copy("layoutDesktop"), () => { setMenu(undefined); setDesktop(true); }, {id: "layout-desktop", checked: desktop}),
                menuItem(copy("layoutFit"), () => { setMenu(undefined); setDesktop(false); }, {id: "layout-fit", checked: !desktop}),
                menuItem(copy("newTab"), () => { setMenu(undefined); tabAction("new"); }, {id: "new-tab"}),
              ])),
          (loading || stale || note) && React.createElement("div", {className: "dsh-browser-status", "data-dsh-browser": "status"},
            loading && React.createElement("span", {className: "dsh-browser-progress", "data-dsh-browser-progress": "on", "aria-hidden": "true"}),
            stale && !loading && React.createElement("span", {className: "dsh-browser-chip", "data-dsh-browser-stale": "on"}, copy("stale")),
            note && React.createElement("span", {className: "dsh-browser-chip", "data-dsh-browser-note": "on"}, note)
          ),
          empty && React.createElement("div", {className: "dsh-browser-empty", "data-dsh-browser": "empty"},
            React.createElement("span", {className: "dsh-browser-empty-mark", "aria-hidden": "true"}, "\u25cb"),
            React.createElement("p", {className: "dsh-browser-empty-title"}, copy("emptyTitle")),
            React.createElement("p", {className: "dsh-browser-empty-hint"}, copy("emptyHint"))
          )
        ),
        React.createElement("span", {
          className: "dsh-browser-live", role: "status",
          "data-dsh-browser-state": active ? (loading ? "loading" : "live") : "idle",
        }, active ? (loading ? copy("loading") : copy("live")) : copy("emptyTitle"))
      );
    }

    /**
     * Sidebar surface: one pane per Session, mounted only while its tab is the
     * active one, so a pane nobody is looking at asks for no frames at all.
     */
    function BrowserPane({useTabInfo, sessionId, t, layout}) {
      const {tab} = useTabInfo();
      const open = React.useCallback(() => { layout?.selectPanel(PANEL); }, [layout]);
      return React.createElement(BrowserSurface, {
        sessionId, t, placement: "pane", visible: tab.visible,
        onExpand: layout ? open : undefined,
      });
    }

    /**
     * Main-area surface: the same browser given the whole window, for pages that
     * need more room than the Sidebar has. It shows the current conversation's
     * browser and stops streaming whenever another panel owns the main area.
     */
    function BrowserPage({usePanelInfo, useSessions, layout, t}) {
      const visible = typeof usePanelInfo === "function" && usePanelInfo(info => info.activePanelId === PANEL) === true;
      const sessionId = typeof useSessions === "function" ? useSessions()?.current : undefined;
      const back = React.useCallback(() => { layout?.selectPanel(null); }, [layout]);
      if (typeof sessionId !== "string" || sessionId === "") {
        return React.createElement("div", {className: "dsh-browser-body", "data-dsh-browser": "body", "data-dsh-browser-surface": "page"},
          React.createElement("div", {className: "dsh-browser-empty", "data-dsh-browser": "empty"},
            React.createElement("span", {className: "dsh-browser-empty-mark", "aria-hidden": "true"}, "\u25cb"),
            React.createElement("p", {className: "dsh-browser-empty-title"}, translate(t, "err.session"))
          )
        );
      }
      return React.createElement(BrowserSurface, {sessionId, t, placement: "page", visible, onCollapse: layout ? back : undefined});
    }

    function installStyles() {
      if (typeof document === "undefined" || document.querySelector("style[data-dsh-browser-style]") !== null) return;
      const style = document.createElement("style");
      style.dataset.dshBrowserStyle = "true";
      style.textContent = `
        .dsh-browser-body { box-sizing: border-box; display: flex; flex-direction: column; min-width: 0; height: 100%; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #17191c); }
        .dsh-browser-tabs { box-sizing: border-box; display: flex; align-items: flex-end; gap: 3px; min-width: 0; padding: 6px 6px 0; overflow-x: auto; scrollbar-width: none; }
        .dsh-browser-tabs::-webkit-scrollbar { display: none; }
        .dsh-browser-tab { display: flex; align-items: center; min-width: 0; max-width: 168px; flex: 0 1 auto; border: 1px solid transparent; border-bottom: none; border-radius: 7px 7px 0 0; background: var(--dsw-alias-bg-layer-2, rgb(0 0 0 / 4%)); }
        .dsh-browser-tab[data-active="true"] { border-color: var(--dsw-alias-border-l2, rgb(0 0 0 / 10%)); background: var(--dsw-alias-bg-layer-1, #fff); }
        .dsh-browser-tab-label { display: flex; align-items: center; gap: 5px; min-width: 0; height: 26px; border: 0; padding: 0 4px 0 9px; background: none; color: var(--dsw-alias-label-secondary, #61666b); cursor: pointer; font: inherit; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dsh-browser-tab[data-active="true"] .dsh-browser-tab-label { color: var(--dsw-alias-label-primary, #17191c); }
        .dsh-browser-tab-spin { color: var(--dsw-alias-state-business-primary, #276ef1); }
        .dsh-browser-tab-close, .dsh-browser-tab-new { flex: none; border: 0; border-radius: 5px; background: none; color: var(--dsw-alias-label-secondary, #61666b); cursor: pointer; font: inherit; }
        .dsh-browser-tab-close { width: 18px; height: 18px; margin-right: 3px; font-size: 13px; line-height: 1; }
        .dsh-browser-tab-close:hover, .dsh-browser-tab-new:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 8%)); color: var(--dsw-alias-label-primary, #17191c); }
        .dsh-browser-tab-new { width: 24px; height: 24px; margin: 0 0 2px 2px; font-size: 15px; line-height: 1; }
        .dsh-browser-toolbar { box-sizing: border-box; display: flex; align-items: center; gap: 6px; min-width: 0; padding: 6px 8px 8px; border-bottom: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 10%)); }
        .dsh-browser-group { display: flex; align-items: center; gap: 4px; min-width: 0; }
        .dsh-browser-group-address { position: relative; flex: 1; gap: 6px; }
        .dsh-browser-group-address .dsh-browser-address { flex: 1; }
        .dsh-browser-history { position: absolute; z-index: 4; left: 0; right: 30px; top: 34px; max-height: 260px; overflow-y: auto; padding: 4px; border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%)); border-radius: 9px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 10px 28px rgb(0 0 0 / 18%); }
        .dsh-browser-history-item { display: flex; flex-direction: column; gap: 2px; width: 100%; border: 0; border-radius: 6px; padding: 6px 8px; background: none; color: inherit; cursor: pointer; font: inherit; text-align: left; }
        .dsh-browser-history-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 6%)); }
        .dsh-browser-history-title { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dsh-browser-history-url { color: var(--dsw-alias-label-tertiary, #81858c); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dsh-browser-history-empty { margin: 0; padding: 10px 8px; color: var(--dsw-alias-label-tertiary, #81858c); font-size: 12px; }
        .dsh-browser-group-window { margin-left: auto; }
        .dsh-browser-address { box-sizing: border-box; min-width: 0; height: 30px; flex: 1; border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%)); border-radius: 6px; padding: 0 8px; color: inherit; background: var(--dsw-alias-bg-layer-1, #fff); font: inherit; font-size: 12px; outline: none; }
        .dsh-browser-address:focus { border-color: var(--dsw-alias-state-business-primary, #276ef1); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #276ef1) 22%, transparent); }
        .dsh-browser-action { flex: none; min-width: 30px; height: 30px; border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%)); border-radius: 6px; padding: 0 9px; color: inherit; background: var(--dsw-alias-bg-layer-1, #fff); cursor: pointer; font: inherit; font-size: 12px; }
        .dsh-browser-action:hover:enabled { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 6%)); }
        .dsh-browser-action:disabled { opacity: 0.4; cursor: default; }
        .dsh-browser-error { box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 6px 10px; color: var(--dsw-alias-state-error-primary, #b13e4a); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #b13e4a) 8%, transparent); font-size: 12px; line-height: 16px; }
        .dsh-browser-error-text { flex: 1; min-width: 0; }
        .dsh-browser-error-dismiss { flex: none; border: 0; border-radius: 5px; padding: 0 6px; background: none; color: inherit; cursor: pointer; font: inherit; font-size: 13px; line-height: 18px; }
        .dsh-browser-error-dismiss:hover { background: color-mix(in srgb, currentColor 14%, transparent); }
        .dsh-browser-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--dsw-alias-bg-layer-2, #f4f5f7); }
        .dsh-browser-view { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
        .dsh-browser-frame, .dsh-browser-overlay { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
        .dsh-browser-frame { background: #fff; }
        .dsh-browser-overlay { pointer-events: none; }
        .dsh-browser-hit { position: absolute; inset: 0; outline: none; }
        .dsh-browser-hit:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #276ef1); outline-offset: -2px; }
        .dsh-browser-keyboard { position: absolute; left: 0; top: 0; width: 1px; height: 1px; opacity: 0; padding: 0; border: 0; pointer-events: none; }
        .dsh-browser-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; text-align: center; color: var(--dsw-alias-label-secondary, #61666b); }
        .dsh-browser-empty-mark { font-size: 26px; color: var(--dsw-alias-label-tertiary, #81858c); }
        .dsh-browser-empty-title { margin: 0; font-size: 13px; }
        .dsh-browser-empty-hint { margin: 0; max-width: 320px; font-size: 12px; color: var(--dsw-alias-label-tertiary, #81858c); }
        .dsh-browser-note { flex: none; padding: 0 6px; color: var(--dsw-alias-label-tertiary, #81858c); font-size: 11px; line-height: 30px; }
        .dsh-browser-status { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 6px 8px; pointer-events: none; }
        .dsh-browser-progress { position: absolute; left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--dsw-alias-state-business-primary, #276ef1), transparent); background-size: 40% 100%; background-repeat: no-repeat; animation: dsh-browser-progress 1.1s linear infinite; }
        @keyframes dsh-browser-progress { from { background-position: -40% 0; } to { background-position: 140% 0; } }
        .dsh-browser-chip { border-radius: 999px; padding: 2px 8px; background: color-mix(in srgb, var(--dsw-alias-label-primary, #17191c) 74%, transparent); color: var(--dsw-alias-bg-base, #fff); font-size: 11px; line-height: 16px; }
        .dsh-browser-menu { position: absolute; z-index: 3; min-width: 190px; padding: 5px; border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%)); border-radius: 9px; background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 10px 28px rgb(0 0 0 / 18%); }
        .dsh-browser-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; border: 0; border-radius: 6px; padding: 7px 9px; background: none; color: inherit; cursor: pointer; font: inherit; font-size: 12px; text-align: left; }
        .dsh-browser-menu-item:hover:enabled { background: var(--dsw-alias-interactive-bg-hover, rgb(0 0 0 / 6%)); }
        .dsh-browser-menu-item:disabled { opacity: 0.45; cursor: default; }
        .dsh-browser-menu-check { color: var(--dsw-alias-state-business-primary, #276ef1); }
        .dsh-browser-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        .dsh-browser-body[data-dsh-browser-surface="page"] .dsh-browser-toolbar { padding: 8px 12px 10px; }
        .dsh-browser-body[data-dsh-browser-surface="page"] .dsh-browser-tabs { padding: 8px 10px 0; }
        .dsh-browser-body[data-dsh-browser-surface="page"] .dsh-browser-tab { max-width: 220px; }
        .dsh-browser-body[data-dsh-browser-surface="page"] .dsh-browser-address { height: 32px; font-size: 13px; }
      `;
      document.head.appendChild(style);
    }

    function callArgsRaw(block) {
      if (!block || typeof block !== "object") return "";
      const settled = Object.hasOwn(block, "kind");
      return String((settled ? block.call?.argsRaw : block.argsRaw) ?? "");
    }

    function browserCall(block) {
      const raw = callArgsRaw(block);
      try {
        const args = JSON.parse(raw);
        if (!args || typeof args !== "object" || Array.isArray(args)) return {};
        const action = typeof args.action === "string" ? args.action : "";
        let url;
        if (action === "navigate" && typeof args.url === "string") {
          try { url = httpUrl(args.url); } catch { /* the Host reports the validation error */ }
        }
        return {action, url};
      } catch {
        return {};
      }
    }

    function BrowserToolRow({sidebarRight, callId, block, sessionId}) {
      const {action, url} = browserCall(block);
      const settled = Object.hasOwn(block ?? {}, "kind");

      React.useEffect(() => {
        // Only the live call opens the pane. Replaying settled transcript rows
        // must not steal focus or overwrite a URL the user entered manually.
        if (settled || action === "close") return;
        try {
          const options = url ? {params: {url}} : {};
          if (sessionId && typeof sidebarRight?.openTabIn === "function") {
            sidebarRight.openTabIn(sessionId, KIND, options);
          } else if (typeof sidebarRight?.openTab === "function") {
            sidebarRight.openTab(KIND, options);
          }
        } catch (error) {
          // Rendering a historical tool row must remain safe when the right
          // Sidebar is not mounted (for example, during Web boot or teardown).
          console.warn("[dsh-plugin-browser] unable to open right Sidebar tab", error);
        }
      }, [sidebarRight, sessionId, callId, action, url, settled]);

      return null;
    }

    const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight", "layout", "sessions"];
    function apply(ctx) {
      installStyles();
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, COPY), "dsh-plugin-browser: dictionaries");
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: ID,
        kind: KIND,
        title: () => t("browser"),
        guide: [{
          order: 30,
          title: () => t("browser"),
          description: () => t("guide"),
        }],
      }), "dsh-plugin-browser: right Sidebar type");
      ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
        name: "sidebar.right.pane.tab",
        key: ID,
        locale: NS,
      }, props => React.createElement(BrowserPane, {...props, layout: ctx.layout}))), "dsh-plugin-browser: right Sidebar body");
      // The same browser as a main-area panel: the Sidebar pane hands the page
      // over to the whole window and takes it back, without a second page.
      const useSessions = () => React.useSyncExternalStore(ctx.sessions.list.subscribe, ctx.sessions.list.getSnapshot);
      ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
        name: "main",
        key: PANEL,
        locale: NS,
      }, props => React.createElement(BrowserPage, {...props, useSessions, layout: ctx.layout}))), "dsh-plugin-browser: main-area panel");
      ctx.effect(() => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
        name: "tool.call.toolview",
        key: "browser",
      }, props => React.createElement(BrowserToolRow, {...props, sidebarRight: ctx.sidebarRight}))), "dsh-plugin-browser: transcript row");
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-plugin-browser";
    return module.exports;
  }
});

import { chromium } from 'playwright';

export function httpUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('BROWSER_INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('BROWSER_HTTP_URL_REQUIRED');
  return url.href;
}

/** Managed tabs one session may hold; the limit is a refusal, never an eviction. */
export const TAB_LIMIT = 12;

/** Visits one session remembers; the oldest record is dropped past this bound. */
export const VISITED_LIMIT = 256;

/**
 * The origin key of one address, or undefined when it is not a web address.
 * about:blank, empty input and other schemes are plumbing rather than places a
 * top-level navigation can be judged against, so they carry no key.
 */
export function originKey(input) {
  if (typeof input !== 'string' || input === '') return undefined;
  let url;
  try { url = new URL(input); } catch { return undefined; }
  return ['http:', 'https:'].includes(url.protocol) ? url.origin : undefined;
}

/**
 * Normalize the configured origin allow list. An empty list admits every origin,
 * which is the behaviour of a deployment that configured no policy at all; a
 * malformed entry is reported at construction instead of silently never matching.
 */
export function originPolicy(entries = []) {
  if (!Array.isArray(entries)) throw new Error('BROWSER_INVALID_URL: allowedOrigins must be an array of origins');
  const origins = new Set();
  for (const entry of entries) {
    const key = originKey(entry);
    if (key === undefined) throw new Error(`BROWSER_INVALID_URL: allowedOrigins entry ${JSON.stringify(entry)} is not an http(s) origin`);
    origins.add(key);
  }
  return origins;
}

/** Whether one address passes the allow list; addresses without an origin always do. */
export function originAdmitted(origins, address) {
  if (origins.size === 0) return true;
  const key = originKey(address);
  return key === undefined || origins.has(key);
}

/** Record one visit newest-first, deduplicated by URL and bounded by VISITED_LIMIT. */
export function rememberVisit(visited, visit) {
  const known = visited.findIndex(item => item.url === visit.url);
  if (known !== -1) visited.splice(known, 1);
  visited.unshift(visit);
  if (visited.length > VISITED_LIMIT) visited.length = VISITED_LIMIT;
  return visited;
}

export function redact(input, limit = 24000) {
  return String(input).slice(0, limit)
    .replace(/\b(?:sk-[\w-]{16,}|gh[pousr]_[\w]{20,})\b/g, '[redacted]')
    .replace(/((?:authorization|cookie|password|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

export function redactValue(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  return value;
}

/** Keyboard keys the Sidebar may forward to the page. */
export const BROWSER_KEYS = Object.freeze([
  'Enter', 'Tab', 'Shift+Tab', 'Escape', 'Backspace', 'Delete', 'Insert',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'F5',
  'Ctrl+A', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+F', 'Ctrl+L',
]);

/** Normalize a pane key event into the narrow key set the Host accepts. */
export function browserKey(input) {
  if (typeof input !== 'string') return undefined;
  if (input === 'ControlOrMeta+A') return 'Ctrl+A';
  return BROWSER_KEYS.includes(input) ? input : undefined;
}

/**
 * Spell one accepted key the way Playwright presses it. `ControlOrMeta` keeps
 * the platform's own accelerator, so a macOS human and a Linux Agent each get
 * the shortcut their desktop expects.
 */
export function playwrightKey(input) {
  return typeof input === 'string' && input.startsWith('Ctrl+') ? `ControlOrMeta+${input.slice(5)}` : input;
}

/** Bound the pane's requested viewport, matching the Host's own limits. */
export function viewportBounds(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 1920 || height < 200 || height > 1600) throw new Error('BROWSER_INVALID_VIEWPORT');
  return {width, height};
}

/** The tab the pane shows and every action addresses. */
function activeTab(session) {
  return session.tabs.find(tab => tab.id === session.activeId) ?? session.tabs[0];
}

/** Pane actions that answer without waiting for the action queue. */
const CONTROL_ACTIONS = new Set(['_view', '_hover', '_selection', '_history', '_stop', 'viewport']);

const SCREENCAST_QUALITY = 62;

/**
 * The optional native backend module. A deployment without a desktop browser
 * surface never loads it, and a build that ships without native.js keeps the
 * Playwright backend instead of failing the whole import.
 */
let nativeModule;
async function nativeBackend() {
  if (nativeModule === undefined) nativeModule = await import('./native.js').catch(() => null);
  return nativeModule?.createNativeBackend;
}

/**
 * One subscriber's bounded event queue. Frames are latest-wins, so a slow
 * reader drops stale pictures instead of falling behind the page.
 */
class Subscriber {
  constructor() {
    this.items = [];
    this.waiters = [];
    this.closed = false;
  }

  push(event) {
    if (this.closed) return;
    if (event.t === 'frame') {
      const index = this.items.findIndex(item => item.t === 'frame');
      if (index === -1) this.items.push(event);
      else this.items[index] = event;
    } else {
      this.items.push(event);
    }
    this.wake();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.wake();
  }

  wake() {
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve();
  }

  async next() {
    while (this.items.length === 0 && !this.closed) await new Promise(resolve => { this.waiters.push(resolve); });
    return this.items.shift();
  }
}

export class BrowserSessions {
  constructor(config = {}) {
    this.config = config;
    this.nativeService = config.nativeService;
    // The desktop shell's plugin may be applied after this one, so the service is
    // looked up again whenever a Session picks its backend.
    this.resolveNativeService = config.resolveNativeService;
    this.logger = config.logger;
    this.allowedOrigins = originPolicy(config.allowedOrigins ?? []);
    this.sessions = new Map();
    this.queues = new Map();
    this.closed = false;
  }

  /** The desktop shell's native browser surface, when this deployment has one. */
  surface() {
    return this.resolveNativeService?.() ?? this.nativeService;
  }

  async browser() {
    if (this.closed) throw new Error('BROWSER_DISPOSED');
    this.launch ??= chromium.launch({
      // The visible browser surface is provided by the Web right Sidebar. Keep
      // the Host automation process headless unless a deployment opts in to a
      // native display explicitly.
      headless: this.config.headless ?? true,
      ...(this.config.executablePath ? {executablePath: this.config.executablePath} : {}),
      env: Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !/KEY|PASSWORD|SECRET|TOKEN|^DSH_/i.test(key))),
    }).catch(error => {
      this.launch = undefined;
      if (/executable doesn't exist/i.test(error.message)) {
        throw new Error('BROWSER_RUNTIME_MISSING: install Chromium with npm run browser:install or configure executablePath', {cause: error});
      }
      throw error;
    });
    return this.launch;
  }

  async session(id) {
    if (!id) throw new Error('BROWSER_SESSION_REQUIRED');
    if (this.sessions.has(id)) return this.sessions.get(id);
    if (this.sessions.size >= 8) throw new Error('BROWSER_SESSION_LIMIT: close an unused session browser');
    const pending = (async () => {
      // A desktop shell may provide the native browser surface. One session has
      // exactly one backend, so a native backend that cannot be created falls
      // back to Playwright instead of leaving the pane without a page.
      let session;
      let backend;
      let context;
      const surface = this.surface();
      if (surface) {
        try {
          const createNativeBackend = await nativeBackend();
          if (!createNativeBackend) throw new Error('BROWSER_VIEW_UNAVAILABLE: native backend module is missing');
          backend = await createNativeBackend({
            service: surface,
            // One Session's tabs are one owner: the shell isolates their session
            // partition from every other Session and releases them together.
            config: {...this.config, owner: id},
            logger: this.logger,
            emit: event => { if (session) this.emit(session, event); },
          });
          // The backend normally exposes the context facade itself; one that
          // only builds pages is adapted to the same shape.
          context = backend.context ?? {newPage: options => backend.newPage(options), close: () => backend.close()};
        } catch (error) {
          const log = this.logger?.error ? this.logger : console;
          log.error(`BROWSER_NATIVE_FALLBACK: ${String(error?.message ?? error)}`);
          backend = undefined;
        }
      }
      if (!context) {
        // Permissions are cleared and downloads never land: the Agent drives pages
        // it does not own, so no site may reach the camera, the microphone, the
        // location or the clipboard, and no response may write a file to disk
        // behind the operator's back. Service workers stay blocked for the same
        // reason — nothing of the site survives the tab that loaded it.
        context = await (await this.browser()).newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 2, acceptDownloads: false, serviceWorkers: 'block'});
        await context.clearPermissions();
        await context.route('**/*', route => {
          try { httpUrl(route.request().url()); return route.continue(); } catch { return route.abort(); }
        });
      }
      session = {
        context, native: backend ?? null, observation: 0, tabSeq: 0, tabs: [], activeId: undefined, visited: [],
        subscribers: new Set(), screencast: false, streamingId: undefined, pattern: 0,
        pointer: undefined, viewport: {width: 1280, height: 800},
      };
      // The pane's chrome reads the active tab for url, viewport and messages,
      // so the rest of the Host keeps addressing one page at a time.
      Object.defineProperties(session, {
        page: {get: () => activeTab(session).page},
        messages: {get: () => activeTab(session).messages},
        loading: {get: () => activeTab(session).loading},
        canGoBack: {get: () => activeTab(session).index > 0},
        canGoForward: {get: () => activeTab(session).index < activeTab(session).history.length - 1},
      });
      await this.openTab(session, await context.newPage());
      // A page the site opened by itself (target=_blank, window.open) becomes
      // a managed tab in the pane instead of an invisible extra window.
      context.on?.('page', popup => { void this.adopt(session, popup).catch(() => {}); });
      context.on?.('close', () => { session.subscribers.forEach(subscriber => subscriber.close()); });
      return session;
    })();
    this.sessions.set(id, pending);
    try { return await pending; } catch (error) { this.sessions.delete(id); throw error; }
  }

  /** Push one event to every Sidebar subscriber of this session. */
  emit(session, event) {
    for (const subscriber of session.subscribers) subscriber.push(event);
  }

  /** Tell every pane reader what the active tab is doing. */
  emitState(session) {
    this.emit(session, {
      t: 'state', active: true, tabId: session.activeId, url: session.page.url(),
      observation: session.observation, loading: session.loading,
      canGoBack: session.canGoBack, canGoForward: session.canGoForward,
      transport: session.native ? 'native' : 'screencast',
    });
  }

  emitTabs(session) {
    this.emit(session, {t: 'tabs', activeId: session.activeId, tabs: this.tabList(session)});
  }

  /** One tab's loading flag, published only while that tab is on screen. */
  markLoading(session, entry, loading) {
    if (entry.loading === loading) return;
    entry.loading = loading;
    if (session.activeId !== entry.id) return;
    this.emitState(session);
    this.emitTabs(session);
  }

  tabList(session) {
    return session.tabs.map(entry => ({
      id: entry.id, url: redact(entry.page.url(), 400),
      loading: entry.loading, active: entry.id === session.activeId,
    }));
  }

  /**
   * Register one Chromium page as a managed tab. Each tab keeps its own history
   * and console, while the pane always shows and drives the active one. A page
   * the Site opened and the pane's own new-tab button can both reach the same
   * Chromium page, so registering it twice returns the tab that already exists.
   */
  async openTab(session, page) {
    const known = session.tabs.find(tab => tab.page === page);
    if (known) return known;
    const entry = {
      id: `tab-${++session.tabSeq}`, page, cdp: undefined, messages: [],
      history: [page.url()], index: 0, loading: false, loadTimer: undefined,
    };
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);
    page.on('console', message => {
      entry.messages.push({level: message.type(), text: redact(message.text(), 2000)});
      if (entry.messages.length > 100) entry.messages.shift();
    });
    page.on('pageerror', error => {
      entry.messages.push({level: 'error', text: redact(error.message, 2000)});
      if (entry.messages.length > 100) entry.messages.shift();
    });
    page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
    // A navigation request is the earliest honest progress signal; the load
    // event closes it, and a stalled request cannot hold the bar forever.
    page.on('request', request => {
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
      this.markLoading(session, entry, true);
      clearTimeout(entry.loadTimer);
      entry.loadTimer = setTimeout(() => this.markLoading(session, entry, false), 30000);
    });
    page.on('load', () => {
      clearTimeout(entry.loadTimer);
      this.markLoading(session, entry, false);
    });
    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      const url = page.url();
      // A redirect, a meta refresh or a script the site owns leaves the allow
      // list without ever passing the navigate action. The request layer keeps
      // its scheme-only policy, so this commit is the one place a site-driven
      // navigation is judged; it is already on screen by now, so the tab is sent
      // back to the blank page instead of showing an origin the policy excluded.
      if (!originAdmitted(this.allowedOrigins, url)) {
        entry.messages.push({level: 'error', text: redact(`BROWSER_ORIGIN_DENIED: ${url}`, 2000)});
        if (entry.messages.length > 100) entry.messages.shift();
        void page.goto('about:blank').catch(() => {});
        return;
      }
      void this.visit(session, page).catch(() => {});
      // A back or forward move lands on an entry this tab already knows, so the
      // history pointer follows it instead of appending a duplicate.
      const rewind = entry.pending !== undefined && entry.history[entry.pending] === url ? entry.pending : undefined;
      entry.pending = undefined;
      if (entry.history[entry.index] !== url) {
        if (rewind === undefined) {
          entry.history = entry.history.slice(0, entry.index + 1);
          entry.history.push(url);
          if (entry.history.length > 50) entry.history.shift();
          entry.index = entry.history.length - 1;
        } else entry.index = rewind;
      }
      if (session.activeId !== entry.id) return;
      session.observation += 1;
      this.emitState(session);
    });
    page.on('close', () => { void this.dropTab(session, entry.id).catch(() => {}); });
    session.tabs.push(entry);
    session.activeId ??= entry.id;
    this.emitTabs(session);
    if (session.subscribers.size > 0) await this.viewport(session, session.viewport, {force: true});
    return entry;
  }

  /**
   * Take over one page the site opened by itself. Past the tab limit the popup is
   * closed and dropped without an error: the site opened it, so no caller is
   * waiting for an answer, and the pane keeps the tabs the operator can see
   * rather than trading one of them for a window nobody asked to show.
   */
  async adopt(session, popup) {
    if (session.tabs.some(tab => tab.page === popup)) return;
    if (session.tabs.length >= TAB_LIMIT) {
      await popup.close().catch(() => {});
      return;
    }
    const entry = await this.openTab(session, popup);
    await this.select(session, entry.id);
  }

  /** Show one tab: its page becomes the pane picture and the input target. */
  async select(session, id) {
    if (!session.tabs.some(tab => tab.id === id)) throw new Error('BROWSER_UNKNOWN_TAB');
    if (session.activeId === id) return this.tabList(session);
    session.activeId = id;
    session.observation += 1;
    this.emitTabs(session);
    if (session.subscribers.size > 0) await this.viewport(session, session.viewport, {force: true});
    this.emitState(session);
    return this.tabList(session);
  }

  /** Forget one tab, keeping the pane on a live neighbour. */
  async dropTab(session, id) {
    const index = session.tabs.findIndex(tab => tab.id === id);
    if (index === -1) return this.tabList(session);
    const [entry] = session.tabs.splice(index, 1);
    if (session.streamingId === id) {
      session.streamingId = undefined;
      await entry.cdp?.send('Page.stopScreencast').catch(() => {});
    }
    await entry.cdp?.detach().catch(() => {});
    if (session.activeId !== id) { this.emitTabs(session); return this.tabList(session); }
    const next = session.tabs[index] ?? session.tabs[index - 1];
    if (next) await this.select(session, next.id);
    else await this.openTab(session, await session.context.newPage()).then(created => this.select(session, created.id));
    return this.tabList(session);
  }

  /** Close one tab from the pane or the Agent, never leaving the pane empty. */
  async closeTab(session, id) {
    const entry = session.tabs.find(tab => tab.id === id);
    if (!entry) throw new Error('BROWSER_UNKNOWN_TAB');
    if (session.tabs.length === 1) {
      await entry.page.goto('about:blank').catch(() => {});
      entry.history = ['about:blank'];
      entry.index = 0;
      session.observation += 1;
      this.emitTabs(session);
      this.emitState(session);
      return this.tabList(session);
    }
    await entry.page.close().catch(() => {});
    await this.dropTab(session, id);
    return this.tabList(session);
  }

  /**
   * Attach one Sidebar reader to an existing session browser. The screencast
   * starts with the first reader and stops with the last, so an unwatched
   * browser costs nothing.
   */
  async subscribe(session, size, signal) {
    if (size) await this.viewport(session, size);
    const subscriber = new Subscriber();
    const browsers = this;
    session.subscribers.add(subscriber);
    signal.addEventListener('abort', () => { subscriber.close(); }, {once: true});
    await this.screencast(session, true);
    this.emitTabs(session);
    return {
      next: () => subscriber.next(),
      async release() {
        subscriber.close();
        session.subscribers.delete(subscriber);
        await browsers.screencast(session, session.subscribers.size > 0);
      },
    };
  }

  /**
   * Follow the active tab with CDP screencast frames. Switching tabs stops the
   * old page's stream and starts the new one, so pictures never mix.
   */
  async screencast(session, on) {
    // The native backend paints the page itself, so a native session has no
    // frames to produce and nothing to start or stop.
    if (session.native) return;
    const entry = on ? activeTab(session) : undefined;
    if (session.streamingId === entry?.id) return;
    const previous = session.tabs.find(tab => tab.id === session.streamingId);
    session.streamingId = undefined;
    session.screencast = Boolean(on);
    if (previous?.cdp) await previous.cdp.send('Page.stopScreencast').catch(() => {});
    if (!on) return;
    try {
      const {width, height} = session.viewport;
      await (await this.attach(session, entry)).send('Page.startScreencast', {
        format: 'jpeg',
        quality: SCREENCAST_QUALITY,
        everyNthFrame: 1,
        maxWidth: Math.min(1920, Math.round(width * 1.5)),
        maxHeight: Math.min(1600, Math.round(height * 1.5)),
      });
      session.streamingId = entry.id;
    } catch {
      // A page that is navigating away can reject either command; the next
      // subscriber or action restarts the stream.
      session.screencast = false;
    }
  }

  /** One CDP session per tab, created on first use. */
  async attach(session, entry) {
    // A native page has no CDP session here: the desktop shell owns the
    // transport of its own view, so there is nothing to attach to.
    if (session.native) return undefined;
    if (entry.cdp) return entry.cdp;
    const cdp = await session.context.newCDPSession(entry.page);
    cdp.on('Page.screencastFrame', frame => {
      void cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => {});
      if (!session.screencast || session.activeId !== entry.id) return;
      session.pattern += 1;
      this.emit(session, {t: 'frame', seq: session.pattern, data: frame.data, mediaType: 'image/jpeg', viewport: {...session.viewport}});
    });
    entry.cdp = cdp;
    return cdp;
  }

  async viewport(session, size, {force = false} = {}) {
    const next = viewportBounds(size.width, size.height);
    const current = session.viewport;
    if (!force && current.width === next.width && current.height === next.height) return current;
    const wasStreaming = session.screencast;
    if (wasStreaming) await this.screencast(session, false);
    await session.page.setViewportSize(next);
    session.viewport = next;
    session.observation++;
    this.emitState(session);
    if (wasStreaming) await this.screencast(session, true);
    return next;
  }

  /** Report the element under one viewport point for the Sidebar's hover cue. */
  async hover(session, args) {
    const {width, height} = session.viewport;
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y) || args.x < 0 || args.x >= width || args.y < 0 || args.y >= height) throw new Error('BROWSER_INVALID_POINT');
    return session.page.evaluate(point => {
      const element = document.elementFromPoint(point.x, point.y);
      if (element === null) return {cursor: 'default'};
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const text = (element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('title') || element.innerText || '').trim().replace(/\s+/g, ' ');
      return {
        cursor: style.cursor || 'default',
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        name: text.slice(0, 120),
        editable: element.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'),
        box: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
      };
    }, {x: args.x, y: args.y});
  }

  /** Report the focused element so the Sidebar can show where typing lands. */
  async focused(session) {
    return session.page.evaluate(() => {
      const element = document.activeElement;
      if (element === null || element === document.body) return null;
      const rect = element.getBoundingClientRect();
      const text = (element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || element.innerText || '').trim().replace(/\s+/g, ' ');
      return {
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        name: text.slice(0, 120),
        editable: element.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'),
        box: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
      };
    });
  }

  /** Record the last pointer position and tell the Sidebar to draw its arrow. */
  point(session, x, y, kind, label, source = 'agent') {
    if (Number.isFinite(x) && Number.isFinite(y)) session.pointer = {x, y};
    this.emit(session, {t: 'pointer', kind, source, label: redact(String(label ?? '')), x: session.pointer?.x, y: session.pointer?.y, ts: Date.now()});
  }

  /** Reject one top-level navigation the configured allow list does not admit. */
  assertAdmitted(address) {
    if (originAdmitted(this.allowedOrigins, address)) return;
    throw new Error(`BROWSER_ORIGIN_DENIED: ${redact(String(address ?? ''), 200)}`);
  }

  /**
   * Record one committed top-level address in the session's visit log. Only web
   * documents count as visits: about:blank and other schemes are plumbing, not
   * places the operator went. A denied origin never enters the log, whichever
   * layer noticed it, because the log is what the pane offers to go back to. The
   * title is read after the record exists, since the log may be asked for before
   * the page has one.
   */
  async visit(session, page) {
    const url = page.url();
    if (originKey(url) === undefined || !originAdmitted(this.allowedOrigins, url)) return;
    const record = {url: redact(url, 2000), title: '', at: Date.now()};
    rememberVisit(session.visited, record);
    const title = await page.title().catch(() => '');
    // The page may have moved on while its title was being read, and that title
    // belongs to the next address rather than to this record.
    if (page.url() === url) record.title = redact(String(title), 500);
  }

  async run(id, args, signal) {
    if (!id) throw new Error('BROWSER_SESSION_REQUIRED');
    // A denied address is refused before any context exists, so the allow list
    // costs nothing to enforce; the page-level guard repeats the test for
    // navigation the site itself starts.
    if (args.action === 'navigate') this.assertAdmitted(args.url);
    // The visit log of a session without a browser is empty, and answering that
    // directly keeps a pure read from launching Chromium just to say so.
    if (args.action === '_history' && !this.sessions.has(id)) return {history: [], historyTotal: 0};
    // A deployment without a native browser surface has no view to place, and a
    // pane resize must never launch Chromium just to be ignored.
    if (args.action === 'viewport' && !this.surface()) return {ok: true, ignored: true};
    // The pane's control plane — looking at the page, reading its selection or
    // its visit log, and stopping a load — answers while a slow navigation is
    // still in flight, exactly like a browser's own stop and reload buttons.
    if (CONTROL_ACTIONS.has(args.action)) {
      const session = await this.session(id);
      return this.operate(session, args);
    }
    const previous = this.queues.get(id) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      signal.throwIfAborted();
      if (args.action === 'close') { await this.close(id); return {closed: true}; }
      const session = await this.session(id);
      let closing;
      // Reads and the pane's own chrome never tear the browser down when the
      // caller goes away; only an interrupted page action does.
      const abort = () => { if (!CONTROL_ACTIONS.has(args.action) && args.action !== '_tabs') closing = this.close(id); };
      signal.addEventListener('abort', abort, {once: true});
      try {
        signal.throwIfAborted();
        return await this.operate(session, args);
      } finally {
        signal.removeEventListener('abort', abort);
        if (closing) await closing;
        signal.throwIfAborted();
      }
    });
    this.queues.set(id, current);
    try { return await current; } finally { if (this.queues.get(id) === current) this.queues.delete(id); }
  }

  async snapshot(session) {
    session.observation++;
    return {url: redact(session.page.url()), title: redact(await session.page.title(), 500), tab: session.activeId, tabs: this.tabList(session), observation: session.observation, snapshot: redact(await session.page.locator('body').ariaSnapshot({timeout: 10000}))};
  }

  async operate(session, args) {
    const {page} = session;
    if (args.action === 'viewport') {
      // The pane's own geometry places the desktop shell's native view; a
      // session on the Playwright backend has no view to place and ignores it.
      if (!session.native) return {ok: true, ignored: true};
      if (typeof session.native.setViewport !== 'function') throw new Error('BROWSER_VIEW_UNAVAILABLE: native backend has no setViewport');
      const bounds = args.bounds ?? null;
      const factor = Number(args.zoom);
      await session.native.setViewport({bounds, zoom: args.zoom, visible: args.visible}, page);
      // The shell zooms the view, so the page's real viewport is the hole divided
      // by that zoom: that quotient is the size every Agent coordinate is in.
      if (bounds && factor > 0) {
        const next = viewportBounds(Math.round(bounds.width / factor), Math.round(bounds.height / factor));
        if (next.width !== session.viewport.width || next.height !== session.viewport.height) {
          session.viewport = next;
          session.observation++;
          this.emitState(session);
        }
      }
      return {ok: true, transport: 'native', ...session.viewport};
    }
    if (args.action === '_view') {
      // A plain picture poll never consumes an observation: only a real
      // viewport change does, so polling cannot invalidate the Agent's counter.
      if (args.width !== undefined || args.height !== undefined) await this.viewport(session, {width: args.width, height: args.height});
      const native = Boolean(session.native);
      const state = {
        active: true, url: page.url(), title: await page.title(),
        tab: session.activeId, tabs: this.tabList(session), loading: session.loading,
        canGoBack: session.canGoBack, canGoForward: session.canGoForward,
        transport: native ? 'native' : 'screencast',
        ...session.viewport, observation: session.observation, seq: session.pattern,
      };
      // The desktop shell paints the page itself, so a native read answers the
      // pane without encoding a picture the pane will not show.
      if (native) return state;
      const data = await page.screenshot({type: 'jpeg', quality: 62, timeout: 5000});
      session.pattern += 1;
      return {...state, image: data.toString('base64'), mediaType: 'image/jpeg', seq: session.pattern};
    }
    if (args.action === '_history') {
      // A pure read of this session's own visit log: the pane shows where this
      // browser has been without consuming an observation.
      return {history: session.visited, historyTotal: session.visited.length};
    }
    if (args.action === '_tabs') {
      // Switching tabs bumps the observation, so the Agent is told to look
      // again; listing tabs is a pure read like hovering.
      if (args.op === undefined || args.op === 'list') return {tabs: this.tabList(session), activeId: session.activeId};
      if (args.op === 'new') {
        // An explicit new tab is refused at the limit instead of evicting a tab
        // the operator opened: a refusal is predictable, a vanished page is not.
        if (session.tabs.length >= TAB_LIMIT) throw new Error('BROWSER_TAB_LIMIT: close a tab before opening another');
        const entry = await this.openTab(session, await session.context.newPage());
        await this.select(session, entry.id);
        return {tabs: this.tabList(session), activeId: session.activeId, observation: session.observation};
      }
      if (args.op === 'select') { await this.select(session, args.tab); return {tabs: this.tabList(session), activeId: session.activeId, observation: session.observation}; }
      if (args.op === 'close') { await this.closeTab(session, args.tab); return {tabs: this.tabList(session), activeId: session.activeId, observation: session.observation}; }
      throw new Error('BROWSER_INVALID_ACTION');
    }
    if (args.action === '_stop') {
      // window.stop() ends the load the way the browser's own stop button does;
      // whatever has already arrived stays on screen.
      await page.evaluate(() => window.stop()).catch(() => {});
      this.markLoading(session, activeTab(session), false);
      return {observation: session.observation, stopped: true};
    }
    if (args.action === '_selection') {
      // A pure read: the pane copies the page's own selection into the human's
      // clipboard without touching the observation counter.
      const text = await page.evaluate(() => window.getSelection()?.toString() ?? '').catch(() => '');
      return {text: redact(text, 8000)};
    }
    if (args.action === '_hover') {
      // A pure read: hovering never consumes an observation, so an Agent's next
      // tool call keeps matching the counter it observed.
      return {hover: await this.hover(session, args)};
    }
    if (args.action === '_input') {
      if (args.observation !== session.observation) throw new Error('BROWSER_STALE_OBSERVATION');
      session.observation++;
      if (args.kind === 'click') {
        const {width, height} = session.viewport;
        if (args.width !== width || args.height !== height) throw new Error('BROWSER_STALE_OBSERVATION');
        if (!Number.isFinite(args.x) || !Number.isFinite(args.y) || args.x < 0 || args.x >= width || args.y < 0 || args.y >= height) throw new Error('BROWSER_INVALID_POINT');
        if (![1, 2, 3].includes(args.clickCount ?? 1)) throw new Error('BROWSER_INVALID_INPUT');
        await page.mouse.click(args.x, args.y, {clickCount: args.clickCount ?? 1});
        this.point(session, args.x, args.y, 'click', args.clickCount > 1 ? `${args.clickCount}× click` : 'click', 'human');
      } else if (args.kind === 'drag') {
        const {width, height} = session.viewport;
        const inside = point => Number.isFinite(point?.x) && Number.isFinite(point?.y) && point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
        if (!inside(args.from) || !inside(args.to)) throw new Error('BROWSER_INVALID_POINT');
        await page.mouse.move(args.from.x, args.from.y);
        await page.mouse.down();
        await page.mouse.move(args.to.x, args.to.y, {steps: 12});
        await page.mouse.up();
        this.point(session, args.to.x, args.to.y, 'drag', 'drag', 'human');
      } else if (args.kind === 'text') {
        if (typeof args.text !== 'string' || args.text.length > 10000) throw new Error('BROWSER_INVALID_TEXT');
        await page.keyboard.insertText(args.text);
        this.emit(session, {t: 'typing', text: redact(args.text, 240)});
      } else if (args.kind === 'key') {
        const key = browserKey(args.key);
        if (key === undefined) throw new Error('BROWSER_INVALID_KEY');
        await page.keyboard.press(playwrightKey(key));
      } else if (args.kind === 'scroll') {
        if (!Number.isFinite(args.deltaY) || Math.abs(args.deltaY) > 1600) throw new Error('BROWSER_INVALID_SCROLL');
        if (Number.isFinite(args.x) && Number.isFinite(args.y)) session.pointer = {x: args.x, y: args.y};
        await page.mouse.wheel(0, args.deltaY);
      } else throw new Error('BROWSER_INVALID_INPUT');
      this.emit(session, {t: 'focus', focus: await this.focused(session).catch(() => null), observation: session.observation});
      return {observation: session.observation};
    }
    if (['_back', '_forward', '_reload'].includes(args.action)) {
      session.observation++;
      const entry = activeTab(session);
      // Point the tab's history at the entry the move targets, so the pane's
      // back and forward buttons keep matching what the browser will do next.
      if (args.action === '_back' && entry.index > 0) { entry.pending = entry.index - 1; await page.goBack({waitUntil: 'domcontentloaded'}).catch(() => {}); }
      if (args.action === '_forward' && entry.index < entry.history.length - 1) { entry.pending = entry.index + 1; await page.goForward({waitUntil: 'domcontentloaded'}).catch(() => {}); }
      if (args.action === '_reload') await page.reload({waitUntil: 'domcontentloaded'}).catch(() => {});
      this.emitState(session);
      return {observation: session.observation};
    }
    if (args.action === 'navigate') {
      await page.goto(httpUrl(args.url), {waitUntil: 'domcontentloaded'});
      // Recording again after the load gives the log a filled-in title right
      // away; the frame event's own record of the same URL is deduplicated.
      await this.visit(session, page);
      await this.afterAction(session, {action: 'navigate', url: page.url()});
      return this.snapshot(session);
    }
    if (args.action === 'snapshot') return this.snapshot(session);
    if (args.action === 'console') return {messages: session.messages.slice(-Math.min(100, Math.max(1, args.limit ?? 30)))};
    if (args.action === 'screenshot') {
      const data = await page.screenshot({type: 'jpeg', quality: 70, fullPage: false, mask: [page.locator('input[type="password"],input[autocomplete="one-time-code"]')]});
      if (data.length > 4 * 1024 * 1024) throw new Error('BROWSER_SCREENSHOT_TOO_LARGE');
      return {data, url: redact(page.url()), mediaType: 'image/jpeg'};
    }
    if (args.action === 'evaluate') {
      const expressions = {
        title: () => document.title,
        visible_text: () => (document.body?.innerText ?? '').slice(0, 24000),
        links: () => Array.from(document.querySelectorAll('a[href]')).filter(a => a.getClientRects().length).slice(0, 100).map(a => ({text: a.innerText.slice(0, 200), href: a.href})),
        layout: () => ({width: innerWidth, height: innerHeight, scrollX, scrollY, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight}),
      };
      if (!Object.hasOwn(expressions, args.expression)) throw new Error('BROWSER_INSPECTION_REQUIRED');
      return {result: redactValue(await page.evaluate(expressions[args.expression]))};
    }
    if (args.observation !== session.observation || session.observation === 0) throw new Error('BROWSER_STALE_OBSERVATION: snapshot before acting');
    session.observation++;
    if (args.action === 'scroll') {
      const delta = args.deltaY ?? 600;
      if (!Number.isInteger(delta) || Math.abs(delta) > 1600) throw new Error('BROWSER_INVALID_SCROLL');
      await page.mouse.wheel(0, delta);
      const centre = session.pointer ?? {x: session.viewport.width / 2, y: session.viewport.height / 2};
      this.point(session, centre.x, centre.y, 'scroll', `scroll ${delta > 0 ? '↓' : '↑'}`);
    } else if (args.action === 'click' && Number.isFinite(args.x) && Number.isFinite(args.y)) {
      // A visual target with no usable accessible name is clicked where the
      // Agent observed it, exactly as a human would.
      const {width, height} = session.viewport;
      if (args.x < 0 || args.y < 0 || args.x >= width || args.y >= height) throw new Error('BROWSER_INVALID_POINT');
      await page.mouse.click(args.x, args.y);
      this.point(session, args.x, args.y, 'click', `click (${Math.round(args.x)}, ${Math.round(args.y)})`);
    } else {
      if (!args.role || typeof args.name !== 'string') throw new Error('BROWSER_OBSERVED_ROLE_AND_NAME_REQUIRED');
      const locator = page.getByRole(args.role, {name: args.name, exact: true});
      const box = await locator.boundingBox().catch(() => null);
      const label = `${args.role} “${redact(args.name, 80)}”`;
      if (args.action === 'click') {
        await locator.click();
        this.point(session, box ? box.x + box.width / 2 : undefined, box ? box.y + box.height / 2 : undefined, 'click', label);
      } else if (args.action === 'fill') {
        if (await locator.getAttribute('type') === 'password' || /password|one-time-code/.test(await locator.getAttribute('autocomplete') ?? '')) throw new Error('BROWSER_MANUAL_LOGIN_REQUIRED');
        if (typeof args.text !== 'string' || args.text.length > 10000 || redact(args.text) !== args.text) throw new Error('BROWSER_INVALID_TEXT');
        await locator.fill(args.text);
        this.point(session, box ? box.x + box.width / 2 : undefined, box ? box.y + box.height / 2 : undefined, 'fill', label);
        this.emit(session, {t: 'typing', text: redact(args.text, 240)});
      } else if (args.action === 'press') {
        if (browserKey(args.key) === undefined) throw new Error('BROWSER_INVALID_KEY');
        await locator.press(playwrightKey(args.key));
        this.point(session, box ? box.x + box.width / 2 : undefined, box ? box.y + box.height / 2 : undefined, 'press', `${args.key} · ${label}`);
      } else throw new Error('BROWSER_INVALID_ACTION');
    }
    await this.afterAction(session, {action: args.action, label: args.name});
    return this.snapshot(session);
  }

  /** Publish the post-action URL and focus so the Sidebar follows the Agent. */
  async afterAction(session, detail) {
    this.emitState(session);
    this.emit(session, {t: 'focus', focus: await this.focused(session).catch(() => null), observation: session.observation});
  }

  async close(id) {
    const pending = this.sessions.get(id);
    if (!pending) return;
    this.sessions.delete(id);
    const session = await pending.catch(() => undefined);
    if (!session) return;
    for (const subscriber of session.subscribers) subscriber.close();
    session.subscribers.clear();
    session.screencast = false;
    for (const tab of session.tabs) {
      clearTimeout(tab.loadTimer);
      await tab.cdp?.detach().catch(() => {});
    }
    await session.context.close();
    // A native backend owns the desktop view and its service subscription;
    // releasing it is idempotent when the context facade already did.
    await session.native?.close();
  }

  async dispose() {
    this.closed = true;
    await Promise.allSettled([...this.sessions.keys()].map(id => this.close(id)));
    const browser = await this.launch?.catch(() => undefined);
    if (browser) await browser.close();
    await Promise.allSettled(this.queues.values());
  }
}

/** Encode one Host event as a newline-delimited JSON chunk. */
export function encodeEvent(event) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Bridge one Sidebar pane into the byte stream the /api carrier sends out.
 * Frames overwrite their pending predecessor inside the queue, so a slow
 * reader shows the latest picture instead of a backlog. A pane that opens
 * before any page exists stays connected and starts streaming the moment a
 * browser session appears.
 */
export function eventStream(browsers, id, size, request) {
  let reader;
  let closed = false;
  // Cancelling the stream must also release the idle wait, so a closed pane
  // never keeps a timer (or a session browser) alive.
  const stop = new AbortController();
  const signal = typeof AbortSignal.any === 'function' ? AbortSignal.any([request.signal, stop.signal]) : request.signal;
  const wait = milliseconds => new Promise(resolve => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, {once: true});
  });
  return new ReadableStream({
    async start(controller) {
      const send = event => {
        if (closed) return;
        try { controller.enqueue(encodeEvent(event)); } catch { closed = true; }
      };
      send({t: 'hello', active: browsers.sessions.has(id), viewport: size ?? null});
      while (!closed && !browsers.sessions.has(id)) {
        // A quiet heartbeat holds the response open until a page is opened,
        // either by the Agent's tool call or from the pane's own address bar.
        await wait(5000);
        send({t: 'state', active: false});
      }
      if (closed) return;
      let session;
      try {
        session = await browsers.sessions.get(id);
        reader = await browsers.subscribe(session, size, request.signal);
      } catch (error) {
        send({t: 'error', code: /^BROWSER_[A-Z_]+/.exec(String(error.message))?.[0] ?? 'BROWSER_REQUEST_FAILED'});
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
        return;
      }
      send({
        t: 'hello', active: true, viewport: session.viewport, url: session.page.url(),
        tabId: session.activeId, tabs: browsers.tabList(session), loading: session.loading,
        canGoBack: session.canGoBack, canGoForward: session.canGoForward,
        observation: session.observation,
      });
      // Pictures are change-driven, so a quiet page is silent on purpose. This
      // beat tells the pane whether the stream is healthy and whether frames
      // are actually being produced, without inventing pictures.
      const beat = setInterval(() => send({t: 'tick', at: Date.now(), screencast: session.streamingId !== undefined}), 2000);
      try {
        while (!closed) {
          const event = await reader.next();
          if (event === undefined) break;
          send(event);
        }
      } finally { clearInterval(beat); }
      if (!closed) {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    async cancel() {
      closed = true;
      stop.abort();
      await reader?.release?.().catch(() => {});
    },
  });
}

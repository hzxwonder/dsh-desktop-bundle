/**
 * Native page backend: the plugin's browsing semantics on top of the
 * `desktopNativeBrowser` Host service, which owns a real Chromium view in the
 * Electron main process.
 *
 * Every page operation goes through `service.command(viewId, method, params)` —
 * one allowlisted Chrome DevTools Protocol command per call — and every page
 * event arrives through `service.subscribe`, either as a forwarded CDP event or
 * as one of the service's own lifecycle events. The backend owns no window and
 * no decoder: it is the same shape the Playwright path exposes, so browser.js
 * can drive either one.
 */
import { originAdmitted, originPolicy } from './browser.js';

/** CSS viewport used until the panel reports the placeholder's real rectangle. */
const DEFAULT_VIEWPORT = Object.freeze({ width: 1280, height: 800 });

/** Playwright-compatible action and navigation budgets, in milliseconds. */
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_NAVIGATION_TIMEOUT = 30000;

/** Bounds on one accessibility snapshot so a deep page cannot flood the agent. */
const AX_NODE_LIMIT = 600;
const AX_CHAR_LIMIT = 20000;

/** Opaque rectangles injected before a screenshot, and what they cover. */
const MASK_CONTAINER_ID = '__dsh_browser_mask__';
const MASK_SELECTOR = 'input[type=password],input[autocomplete=one-time-code]';

/** Chromium modifier bits used by Input.dispatchKeyEvent. */
const MODIFIER_BITS = Object.freeze({ Alt: 1, Control: 2, Meta: 4, Shift: 8 });

/** Keys the Sidebar and the agent tool send by name rather than by character. */
const KEY_TABLE = Object.freeze({
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Tab: { code: 'Tab', keyCode: 9, text: '\t' },
  Escape: { code: 'Escape', keyCode: 27 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  Delete: { code: 'Delete', keyCode: 46 },
  Insert: { code: 'Insert', keyCode: 45 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  Home: { code: 'Home', keyCode: 36 },
  End: { code: 'End', keyCode: 35 },
  PageUp: { code: 'PageUp', keyCode: 33 },
  PageDown: { code: 'PageDown', keyCode: 34 },
  Space: { code: 'Space', keyCode: 32, text: ' ' },
  Shift: { code: 'ShiftLeft', keyCode: 16 },
  Control: { code: 'ControlLeft', keyCode: 17 },
  Alt: { code: 'AltLeft', keyCode: 18 },
  Meta: { code: 'MetaLeft', keyCode: 91 },
  F5: { code: 'F5', keyCode: 116 },
});

/** Buttons the mouse can hold, as the CDP `buttons` bitmask. */
const BUTTON_BITS = Object.freeze({ left: 1, right: 2, middle: 4, back: 8, forward: 16 });

/**
 * Race one command against an action deadline, clearing the timer either way so
 * a settled command never keeps the Host's event loop alive.
 */
function withTimeout(promise, ms, message) {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Normalize a top-level navigation target, or refuse it with a policy error. */
function navigationTarget(input, origins) {
  let url;
  try { url = new URL(String(input)); } catch { throw new Error('BROWSER_INVALID_URL'); }
  const blank = url.protocol === 'about:' && url.href === 'about:blank';
  if (!blank && (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)) {
    throw new Error('BROWSER_HTTP_URL_REQUIRED');
  }
  if (!originAdmitted(origins, url.href)) throw new Error(`BROWSER_ORIGIN_DENIED: ${url.href}`);
  return url.href;
}

/** One coordinate of a pointer event: CSS pixels, whole numbers. */
function point(value, axis) {
  if (!Number.isFinite(value)) throw new Error(`BROWSER_INVALID_POINT: ${axis} is not a number`);
  return Math.round(value);
}

/** The console text of one Runtime.consoleAPICalled argument list. */
function consoleText(args = []) {
  return args.map(argument => {
    if (!argument) return '';
    if (argument.unserializableValue !== undefined) return String(argument.unserializableValue);
    if (argument.value !== undefined) return typeof argument.value === 'string' ? argument.value : JSON.stringify(argument.value);
    if (argument.description !== undefined) return String(argument.description);
    return String(argument.type ?? '');
  }).join(' ');
}

/** The message of one Runtime.exceptionThrown payload. */
function exceptionMessage(details = {}) {
  const description = details.exception?.description;
  if (typeof description === 'string' && description.trim()) return description.split('\n')[0].trim();
  return String(details.text ?? 'page error');
}

/** Unserializable CDP return values that survive `returnByValue`. */
function byValue(result) {
  if (!result || typeof result !== 'object') return undefined;
  if (result.unserializableValue === undefined) return result.value;
  switch (result.unserializableValue) {
    case 'NaN': return NaN;
    case 'Infinity': return Infinity;
    case '-Infinity': return -Infinity;
    case '-0': return -0;
    default: return result.unserializableValue;
  }
}

/** One AX name rendered inside the snapshot: single line, quotes escaped. */
function axName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/"/g, '\\"').trim();
}

/**
 * Render a CDP accessibility tree the way the Playwright snapshot reads: one
 * `- role "name"` line per node, two spaces of indent per level, text nodes as
 * `- text: ...`. Ignored nodes and nodes with neither name nor children are
 * passed through to their children; output stops at the node and character caps.
 */
function renderAxTree(nodes, rootBackendNodeId) {
  const byId = new Map(nodes.map(node => [node.nodeId, node]));
  const lines = [];
  let emitted = 0;
  let chars = 0;
  let truncated = false;

  const visit = (node, depth) => {
    if (!node || truncated || depth > 64) return;
    const children = (node.childIds ?? []).map(id => byId.get(id)).filter(Boolean);
    const ignored = node.ignored === true || ['none', 'presentation', 'Ignored'].includes(node.role?.value);
    const name = axName(node.name?.value);
    const role = String(node.role?.value ?? 'generic');
    // A node that carries nothing keeps its children, which is where the
    // structure the agent reads actually lives.
    const silent = ignored || (!name && children.length === 0);
    if (!silent) {
      const line = role === 'StaticText' && name ? `${'  '.repeat(depth)}- text: ${name}` : `${'  '.repeat(depth)}- ${role}${name ? ` "${name}"` : ''}`;
      if (emitted >= AX_NODE_LIMIT || chars + line.length > AX_CHAR_LIMIT) { truncated = true; return; }
      lines.push(line);
      emitted += 1;
      chars += line.length + 1;
    }
    for (const child of children) visit(child, silent ? depth : depth + 1);
  };

  const roots = rootBackendNodeId === undefined
    ? nodes.filter(node => !byId.has(node.parentId))
    : nodes.filter(node => node.backendDOMNodeId === rootBackendNodeId);
  for (const root of roots) visit(root, 0);
  if (truncated && chars + 18 <= AX_CHAR_LIMIT) lines.push('- ... (truncated)');
  return lines.join('\n');
}

/** The key descriptor of one `press` name, including single characters. */
function keyDescriptor(key) {
  const known = KEY_TABLE[key];
  if (known) return { key, ...known };
  if (key.length === 1) {
    const letter = /[a-z]/i.test(key);
    return { key, code: letter ? `Key${key.toUpperCase()}` : `Digit${key}`, keyCode: key.toUpperCase().charCodeAt(0), text: key };
  }
  return { key };
}

/** Split `Control+A` into a key name and a CDP modifier bitmask. */
function parsePress(input) {
  const parts = String(input).split('+').filter(Boolean);
  const key = parts.pop() ?? '';
  let modifiers = 0;
  for (const part of parts) {
    const alias = { Ctrl: 'Control', Cmd: 'Meta', Command: 'Meta', Option: 'Alt' }[part] ?? part;
    modifiers |= MODIFIER_BITS[alias] ?? 0;
  }
  return { key, modifiers };
}

/**
 * Build the page backend over one `desktopNativeBrowser` service.
 *
 * `config.allowedOrigins` is the deployment policy; a page may narrow it with
 * `newPage({allowOrigins})`, which is also what the view is created with.
 */
export function createNativeBackend({ service, config = {}, logger, emit } = {}) {
  if (!service) throw new Error('BROWSER_NATIVE_SERVICE_REQUIRED');
  const handles = new Map();
  const owners = new Set();
  const contextListeners = new Map();
  const defaultOwner = String(config.owner ?? 'browser');
  let unsubscribe;
  let sequence = 0;
  let disposed = false;
  /** The one view the panel shows; every other view of this backend stays hidden. */
  let visibleId;

  /** A native failure the panel may want to name before it falls back. */
  const report = (viewId, reason, detail) => {
    logger?.warn?.(`dsh-plugin-browser: native view ${viewId} ${reason}${detail ? `: ${detail}` : ''}`);
    try { emit?.({ t: 'native-failure', viewId, reason, detail }); } catch { /* the panel is not the authority on transport health */ }
  };

  /** One event on the context facade, for listeners that outlive any page. */
  const emitContext = (name, ...args) => {
    for (const handler of contextListeners.get(name) ?? []) {
      try { handler(...args); } catch { /* a listener cannot break the transport */ }
    }
  };

  function subscribeOnce() {
    if (unsubscribe || disposed) return;
    unsubscribe = service.subscribe(event => {
      if (!event || typeof event !== 'object') return;
      const handle = handles.get(event.id);
      if (!handle) return;
      // A window the site opened needs a view of its own before it can be a page.
      if (event.type === 'window-open') { void openPopup(handle, event.url); return; }
      handle.onServiceEvent(event);
    });
  }

  function createPage(viewId, { origins, owner, allowOrigins }) {
    let closed = false;
    let enabled;
    let currentUrl = 'about:blank';
    let cachedTitle;
    let viewport = { ...DEFAULT_VIEWPORT };
    let defaultTimeout = DEFAULT_TIMEOUT;
    let navigationTimeout = DEFAULT_NAVIGATION_TIMEOUT;
    let pointer = null;
    const held = new Set();
    const listeners = new Map();
    const loadWaiters = new Set();

    const cdp = (method, params = {}) => service.command(viewId, method, params);

    const assertOpen = () => { if (closed) throw new Error('BROWSER_PAGE_CLOSED'); };

    /** Runtime and Page are enabled once per view, before any other command. */
    const ensureEnabled = () => {
      assertOpen();
      enabled ??= (async () => {
        await cdp('Runtime.enable');
        await cdp('Page.enable');
      })().catch(error => { enabled = undefined; throw error; });
      return enabled;
    };

    const emitEvent = (name, ...args) => {
      for (const handler of listeners.get(name) ?? []) {
        try { handler(...args); } catch { /* a listener cannot break the transport */ }
      }
    };

    /** Resolve when the main frame reports its load event, or on the deadline. */
    function waitForLoad(timeout = navigationTimeout) {
      return new Promise(resolve => {
        const waiter = { resolve, timer: undefined };
        waiter.timer = setTimeout(() => {
          loadWaiters.delete(waiter);
          resolve('timeout');
        }, timeout);
        loadWaiters.add(waiter);
      });
    }

    function settleLoad() {
      for (const waiter of [...loadWaiters]) {
        clearTimeout(waiter.timer);
        loadWaiters.delete(waiter);
        waiter.resolve('load');
      }
    }

    /** Run one navigation command and wait for its main-frame load event. */
    async function navigateWith(start, timeout) {
      await ensureEnabled();
      const loaded = waitForLoad(Number.isFinite(timeout) && timeout > 0 ? timeout : undefined);
      let result;
      try {
        result = await start();
      } catch (error) {
        settleLoad();
        throw error;
      }
      // A refused navigation never loads, so its own answer is the whole story.
      if (result?.errorText) {
        settleLoad();
        throw new Error(`BROWSER_NAVIGATION_FAILED: ${result.errorText}`);
      }
      if (await loaded === 'timeout') throw new Error(`BROWSER_TIMEOUT: navigation did not load within ${navigationTimeout}ms`);
      return result ?? null;
    }

    async function evaluate(fnOrString, arg) {
      await ensureEnabled();
      const expression = typeof fnOrString === 'function'
        ? `(${fnOrString})(${JSON.stringify(arg ?? null)})`
        : String(fnOrString);
      const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result?.exceptionDetails) {
        const thrown = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
        throw new Error(`BROWSER_EVALUATE_FAILED: ${String(thrown).split('\n')[0]}`);
      }
      return byValue(result?.result);
    }

    /** The object id of one element, shared by locators and role lookups. */
    async function locatorObjectId(selector) {
      await ensureEnabled();
      const { root } = await cdp('DOM.getDocument', { depth: 0, pierce: false });
      const { nodeId } = await cdp('DOM.querySelector', { nodeId: root?.nodeId, selector });
      if (!nodeId) throw new Error(`BROWSER_UNKNOWN_SELECTOR: ${selector}`);
      const { object } = await cdp('DOM.resolveNode', { nodeId });
      if (!object?.objectId) throw new Error(`BROWSER_UNKNOWN_SELECTOR: ${selector}`);
      return object.objectId;
    }

    async function boxModel(objectId) {
      const { nodeId } = await cdp('DOM.requestNode', { objectId });
      const { model } = await cdp('DOM.getBoxModel', { nodeId });
      const quad = model?.border ?? model?.content;
      if (!quad || quad.length < 8) return null;
      const width = quad[2] - quad[0];
      const height = quad[5] - quad[1];
      if (width <= 0 || height <= 0) return null;
      return { x: quad[0], y: quad[1], width, height };
    }

    async function callOnObject(objectId, functionDeclaration, args = []) {
      const result = await withTimeout(
        cdp('Runtime.callFunctionOn', { objectId, functionDeclaration, arguments: args.map(value => ({ value })), returnByValue: true, awaitPromise: true }),
        defaultTimeout,
        `BROWSER_TIMEOUT: the element did not answer within ${defaultTimeout}ms`,
      );
      if (result?.exceptionDetails) throw new Error(`BROWSER_EVALUATE_FAILED: ${String(result.exceptionDetails.text ?? 'element call failed')}`);
      return byValue(result?.result);
    }

    /** The shared surface of `locator(selector)` and `getByRole(role, ...)`. */
    function elementSurface(resolveObjectId, label) {
      const surface = {
        async boundingBox() {
          assertOpen();
          const objectId = await resolveObjectId();
          try {
            return await withTimeout(boxModel(objectId), defaultTimeout, `BROWSER_TIMEOUT: ${label} did not answer within ${defaultTimeout}ms`);
          } catch {
            // A detached or unrendered node has no box; Playwright reports null too.
            return null;
          }
        },
        async click(options = {}) {
          assertOpen();
          const objectId = await resolveObjectId();
          // The element may sit below the fold; scroll first, then measure.
          await cdp('DOM.scrollIntoViewIfNeeded', { objectId }).catch(() => {});
          const box = await surface.boundingBox();
          if (!box) throw new Error(`BROWSER_NOT_VISIBLE: ${label} has no box to click`);
          await facade.mouse.click(box.x + box.width / 2, box.y + box.height / 2, options);
        },
        async fill(value) {
          assertOpen();
          const objectId = await resolveObjectId();
          return callOnObject(objectId, `function (value) {
            const text = value === null || value === undefined ? '' : String(value);
            this.focus?.();
            if (this.isContentEditable) this.textContent = text; else this.value = text;
            this.dispatchEvent(new Event('input', { bubbles: true }));
            this.dispatchEvent(new Event('change', { bubbles: true }));
            return this.value ?? this.textContent;
          }`, [value]);
        },
        async getAttribute(name) {
          assertOpen();
          const objectId = await resolveObjectId();
          const value = await callOnObject(objectId, 'function (name) { return this.getAttribute(name); }', [String(name)]);
          return value === undefined ? null : value;
        },
      };
      return surface;
    }

    async function ariaSnapshotFor(resolveObjectId) {
      await ensureEnabled();
      const { nodes = [] } = await cdp('Accessibility.getFullAXTree', {});
      let rootBackendNodeId;
      try {
        const { node } = await cdp('DOM.describeNode', { objectId: await resolveObjectId() });
        rootBackendNodeId = node?.backendNodeId;
      } catch {
        rootBackendNodeId = undefined;
      }
      return renderAxTree(nodes, rootBackendNodeId);
    }

    function axNodeFor(role, options) {
      return cdp('Accessibility.getFullAXTree', {}).then(({ nodes = [] }) => {
        const wanted = String(role).toLowerCase();
        const name = options.name === undefined ? undefined : String(options.name);
        return nodes.find(node => {
          if (node.ignored === true || String(node.role?.value ?? '').toLowerCase() !== wanted) return false;
          if (name === undefined) return true;
          const actual = axName(node.name?.value);
          return options.exact === true ? actual === name : actual.toLowerCase().includes(name.toLowerCase());
        });
      });
    }

    /** Mask the credential fields for the duration of one capture. */
    const maskExpression = `(() => {
      const previous = document.getElementById(${JSON.stringify(MASK_CONTAINER_ID)});
      previous?.remove();
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(MASK_SELECTOR)}));
      const layer = document.createElement('div');
      layer.id = ${JSON.stringify(MASK_CONTAINER_ID)};
      layer.setAttribute('data-dsh-browser-mask', '');
      layer.style.cssText = 'position:fixed;inset:0;margin:0;padding:0;border:0;pointer-events:none;z-index:2147483647';
      let painted = 0;
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const mask = document.createElement('div');
        mask.style.cssText = 'position:fixed;background:#000;pointer-events:none;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px';
        layer.appendChild(mask);
        painted += 1;
      }
      (document.body ?? document.documentElement).appendChild(layer);
      return painted;
    })()`;

    async function screenshot(options = {}) {
      await ensureEnabled();
      const format = options.type === 'png' ? 'png' : 'jpeg';
      const params = {
        format,
        clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 },
      };
      if (format === 'jpeg' && Number.isFinite(options.quality)) params.quality = Math.round(options.quality);
      // Masking must happen before the capture and must not survive it: a page
      // that fails to mask is a page we refuse to photograph.
      await cdp('Runtime.evaluate', { expression: maskExpression, returnByValue: true });
      try {
        const { data } = await cdp('Page.captureScreenshot', params);
        return Buffer.from(String(data ?? ''), 'base64');
      } finally {
        await cdp('Runtime.evaluate', {
          expression: `(() => { const previous = document.getElementById(${JSON.stringify(MASK_CONTAINER_ID)}); previous?.remove(); return true; })()`,
          returnByValue: true,
        }).catch(() => {});
      }
    }

    async function dispatchMouse(type, x, y, extra = {}) {
      await ensureEnabled();
      return cdp('Input.dispatchMouseEvent', {
        type,
        x: point(x, 'x'),
        y: point(y, 'y'),
        button: extra.button ?? 'none',
        buttons: extra.buttons ?? 0,
        clickCount: extra.clickCount ?? 0,
        modifiers: extra.modifiers ?? 0,
        ...(extra.deltaX === undefined ? {} : { deltaX: extra.deltaX }),
        ...(extra.deltaY === undefined ? {} : { deltaY: extra.deltaY }),
      });
    }

    async function pressKey(input) {
      await ensureEnabled();
      const { key, modifiers } = parsePress(input);
      const descriptor = keyDescriptor(key);
      const common = {
        key: descriptor.key,
        modifiers,
        ...(descriptor.code ? { code: descriptor.code } : {}),
        ...(descriptor.keyCode ? { windowsVirtualKeyCode: descriptor.keyCode, nativeVirtualKeyCode: descriptor.keyCode } : {}),
      };
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...common, ...(descriptor.text ? { text: descriptor.text } : {}) });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
    }

    const mainFrame = { url: () => currentUrl, name: () => '' };

    const facade = {
      url: () => currentUrl,
      async title() {
        if (cachedTitle !== undefined) return cachedTitle;
        try {
          const value = await evaluate('document.title');
          cachedTitle = value === undefined ? '' : String(value);
        } catch {
          cachedTitle = '';
        }
        return cachedTitle;
      },
      async goto(url, options = {}) {
        const target = navigationTarget(url, origins);
        return navigateWith(() => cdp('Page.navigate', { url: target }), options.timeout);
      },
      async reload(options = {}) {
        return navigateWith(() => cdp('Page.reload', {}), options.timeout);
      },
      async goBack() { return historyStep(-1); },
      async goForward() { return historyStep(1); },
      async close() {
        if (closed) return;
        closed = true;
        settleLoad();
        handles.delete(viewId);
        await service.close(viewId);
        emitEvent('close', facade);
      },
      evaluate,
      screenshot,
      mainFrame: () => mainFrame,
      mouse: {
        async click(x, y, options = {}) {
          const button = options.button ?? 'left';
          const clickCount = options.clickCount ?? 1;
          const bits = BUTTON_BITS[button] ?? 1;
          await dispatchMouse('mouseMoved', x, y, { buttons: 0, modifiers: options.modifiers });
          await dispatchMouse('mousePressed', x, y, { button, buttons: bits, clickCount, modifiers: options.modifiers });
          await dispatchMouse('mouseReleased', x, y, { button, buttons: 0, clickCount, modifiers: options.modifiers });
          pointer = { x: point(x, 'x'), y: point(y, 'y') };
        },
        async move(x, y) {
          pointer = { x: point(x, 'x'), y: point(y, 'y') };
          await dispatchMouse('mouseMoved', x, y, { buttons: heldBits() });
        },
        async down(options = {}) {
          const button = options.button ?? 'left';
          held.add(button);
          const at = pointer ?? { x: viewport.width / 2, y: viewport.height / 2 };
          await dispatchMouse('mousePressed', at.x, at.y, { button, buttons: heldBits(), clickCount: 1, modifiers: options.modifiers });
        },
        async up(options = {}) {
          const button = options.button ?? 'left';
          const at = pointer ?? { x: viewport.width / 2, y: viewport.height / 2 };
          held.delete(button);
          await dispatchMouse('mouseReleased', at.x, at.y, { button, buttons: heldBits(), clickCount: 1, modifiers: options.modifiers });
        },
        async wheel(deltaX, deltaY) {
          const at = pointer ?? { x: viewport.width / 2, y: viewport.height / 2 };
          await dispatchMouse('mouseWheel', at.x, at.y, { buttons: heldBits(), deltaX: deltaX ?? 0, deltaY: deltaY ?? 0 });
        },
      },
      keyboard: {
        async insertText(text) {
          await ensureEnabled();
          await cdp('Input.insertText', { text: String(text ?? '') });
        },
        press: pressKey,
      },
      locator(selector) {
        const resolve = () => locatorObjectId(selector);
        const surface = elementSurface(resolve, `selector ${selector}`);
        return {
          ...surface,
          selector,
          ariaSnapshot: () => ariaSnapshotFor(resolve),
        };
      },
      getByRole(role, options = {}) {
        const label = `role ${role}${options.name === undefined ? '' : ` name ${options.name}`}`;
        const resolve = async () => {
          await ensureEnabled();
          const node = await axNodeFor(role, options);
          if (!node?.backendDOMNodeId) throw new Error(`BROWSER_UNKNOWN_ROLE: ${label}`);
          const { object } = await cdp('DOM.resolveNode', { backendNodeId: node.backendDOMNodeId });
          if (!object?.objectId) throw new Error(`BROWSER_UNKNOWN_ROLE: ${label}`);
          return object.objectId;
        };
        return elementSurface(resolve, label);
      },
      setViewportSize(size = {}) {
        viewport = { width: point(size.width ?? viewport.width, 'width'), height: point(size.height ?? viewport.height, 'height') };
        return { ...viewport };
      },
      setDefaultTimeout(ms) { if (Number.isFinite(ms) && ms > 0) defaultTimeout = ms; },
      setDefaultNavigationTimeout(ms) { if (Number.isFinite(ms) && ms > 0) navigationTimeout = ms; },
      on(event, handler) {
        const set = listeners.get(event) ?? new Set();
        set.add(handler);
        listeners.set(event, set);
        return facade;
      },
    };

    const heldBits = () => [...held].reduce((bits, button) => bits | (BUTTON_BITS[button] ?? 0), 0);

    /** Walk the session history one step; a missing entry answers null. */
    async function historyStep(delta) {
      await ensureEnabled();
      const history = await cdp('Page.getNavigationHistory', {});
      const entries = history?.entries ?? [];
      const index = history?.currentIndex ?? 0;
      const entry = entries[index + delta];
      if (!entry) return null;
      return navigateWith(() => cdp('Page.navigateToHistoryEntry', { entryId: entry.id }));
    }

    /** Route one service event into this page's state, CDP handlers and listeners. */
    function onServiceEvent(event) {
      switch (event.type) {
        case 'navigated':
          currentUrl = event.url;
          cachedTitle = undefined;
          return;
        case 'title':
          cachedTitle = event.title;
          return;
        case 'closed':
          if (!closed) {
            closed = true;
            settleLoad();
            handles.delete(viewId);
            emitEvent('close', facade);
            if (event.reason === 'crashed') report(viewId, 'crashed', currentUrl);
          }
          return;
        case 'failed':
          report(viewId, 'failed to load', `${event.url} ${event.error}`);
          emitEvent('pageerror', new Error(`BROWSER_NAVIGATION_FAILED: ${event.url} ${event.error}`));
          return;
        case 'loading':
          // The panel's progress bar keys off a navigation request; the shell's
          // loading flag is the native equivalent of one.
          if (event.loading === true) {
            emitEvent('request', { isNavigationRequest: () => true, frame: () => mainFrame, url: () => currentUrl, resourceType: () => 'document' });
          }
          return;
        case 'cdp':
          return onCdpEvent(event);
        default:
      }
    }

    function onCdpEvent({ method, params = {} }) {
      switch (method) {
        case 'Runtime.consoleAPICalled': {
          const text = consoleText(params.args);
          emitEvent('console', {
            type: () => String(params.type ?? 'log'),
            text: () => text,
            args: () => params.args ?? [],
            location: () => ({}),
          });
          return;
        }
        case 'Runtime.exceptionThrown':
          emitEvent('pageerror', new Error(exceptionMessage(params.exceptionDetails)));
          return;
        case 'Page.frameNavigated': {
          const frame = params.frame ?? {};
          if (frame.parentId !== undefined) return;
          if (!originAdmitted(origins, frame.url)) {
            report(viewId, 'left the allow list', frame.url);
            void cdp('Page.navigate', { url: 'about:blank' }).catch(() => {});
            return;
          }
          currentUrl = String(frame.url ?? currentUrl);
          cachedTitle = undefined;
          emitEvent('framenavigated', mainFrame);
          return;
        }
        case 'Page.loadEventFired':
          settleLoad();
          emitEvent('load', facade);
          return;
        case 'Page.javascriptDialogOpening':
          // Nothing in the tool or the panel can answer a dialog, so the page is
          // never left blocked behind one.
          void cdp('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
          emitEvent('dialog', { type: params.type, message: params.message, dismiss: async () => {} });
          return;
        default:
      }
    }

    return { facade, onServiceEvent, owner, allowOrigins };
  }

  /** Create one guest view and the facade that drives it. */
  async function openPage(options = {}) {
    if (disposed) throw new Error('BROWSER_DISPOSED');
    const owner = String(options.owner ?? defaultOwner);
    const listed = options.allowOrigins ?? config.allowedOrigins ?? [];
    const origins = originPolicy(listed);
    const viewId = String(options.id ?? `native-${++sequence}`);
    // Subscribe before the view exists: a view created with a URL starts
    // loading at once, and its first events are the ones we cannot replay.
    subscribeOnce();
    // A view always starts on a document: the debugger domains this backend
    // enables need a live renderer, and a view that never loaded anything has
    // none, so its first command would wait for one that never arrives.
    const created = await service.createView({ id: viewId, owner, url: options.url ?? 'about:blank', allowOrigins: listed });
    const id = String(created?.id ?? viewId);
    owners.add(owner);
    const handle = createPage(id, { origins, owner, allowOrigins: listed });
    handles.set(id, handle);
    return handle.facade;
  }

  /** A window the site opened gets its own view under the same owner. */
  async function openPopup(opener, url) {
    if (disposed) return;
    try {
      emitContext('page', await openPage({ owner: opener.owner, allowOrigins: opener.allowOrigins, url }));
    } catch (error) {
      report(opener.owner, 'could not open a popup view', error?.message);
    }
  }

  /** Release every view of this backend's owners and drop the subscription. */
  async function release() {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unsubscribe = undefined;
    handles.clear();
    const closing = [...owners].map(owner => service.closeOwner(owner).catch(error => {
      report(owner, 'closeOwner failed', error?.message);
    }));
    owners.clear();
    await Promise.all(closing);
    emitContext('close');
  }

  /**
   * The Playwright BrowserContext surface browser.js already drives. One
   * Session's tabs are the views of one owner, so `close` releases them all.
   */
  const context = {
    async newPage(options = {}) { return openPage(options); },
    on(event, handler) {
      const set = contextListeners.get(event) ?? new Set();
      set.add(handler);
      contextListeners.set(event, set);
      return context;
    },
    close: release,
    // The shell owns permissions and request interception; the origin policy is
    // enforced by the checks before every navigation.
    async clearPermissions() {},
    async route() {},
    /** A native view streams no frames, so there is nothing to attach to. */
    async newCDPSession() { throw new Error('BROWSER_SCREENCAST_UNAVAILABLE'); },
  };

  /**
   * Place the view the panel is showing: the rectangle it measured, the zoom that
   * turns that hole into the logical viewport the Agent drives, and whether the
   * panel can see it at all. Every other view of this backend stays hidden, so
   * switching tabs never leaves the previous page floating over the new one.
   */
  async function setViewport(request = {}, page) {
    if (disposed) return;
    let target;
    for (const [id, entry] of handles) {
      if (entry.facade === page) { target = id; break; }
    }
    if (target === undefined) return;
    const bounds = request.bounds ?? null;
    const zoom = Number(request.zoom);
    if (request.visible === false || !bounds || !(bounds.width > 0) || !(bounds.height > 0)) {
      await service.setVisible(target, false).catch(() => {});
      if (visibleId === target) visibleId = undefined;
      return;
    }
    if (visibleId !== undefined && visibleId !== target) {
      await service.setVisible(visibleId, false).catch(() => {});
    }
    await service.setBounds(target, bounds).catch(error => report(target, 'could not place the view', error?.message));
    if (Number.isFinite(zoom) && zoom > 0) {
      await service.setZoom(target, zoom).catch(error => report(target, 'could not zoom the view', error?.message));
    }
    await service.setVisible(target, true).catch(error => report(target, 'could not show the view', error?.message));
    visibleId = target;
  }

  return { context, close: release, setViewport };
}

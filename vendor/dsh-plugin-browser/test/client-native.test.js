// The client half of the desktop native transport: with `transport: 'native'`
// the shell composites the page, so the pane stops streaming and instead keeps
// the Host told where the guest view goes, how far it is zoomed and whether it
// is on screen. This suite renders the real client against a small stub of the
// plugin API — the shape the loader hands it — and asserts the requests it
// makes and the DOM contract it keeps.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

/** A host element: only what the client actually touches. Its metrics read the
 * live stage, the way a real node does when the layout around it changes. */
function host(tag, props, stage) {
  const isStage = props["data-dsh-browser"] === "stage";
  return {
    tag, props, style: {}, dataset: {}, width: 0, height: 0, value: "",
    get clientWidth() { return isStage ? stage.width : 0; },
    get clientHeight() { return isStage ? stage.height : 0; },
    getBoundingClientRect: () => ({...stage, right: stage.left + stage.width, bottom: stage.top + stage.height}),
    getContext: () => null, focus() {}, select() {}, appendChild() {},
  };
}

/** A positional renderer with the hooks the client uses. It is not React: it
 * holds hook state per component instance and runs an effect again when its
 * dependency list changed. */
function createRenderer(stage) {
  let rendering = null;
  let hookIndex = 0;
  let hosts = [];
  const dirty = new Set();
  const roots = [];
  const same = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, at) => Object.is(value, right[at]));
  const hook = () => {
    const slot = rendering.hooks[hookIndex] ?? (rendering.hooks[hookIndex] = {});
    slot.instance = rendering;
    hookIndex += 1;
    return slot;
  };
  const React = {
    createElement: (type, props, ...children) => ({type, props: props ?? {}, children: children.flat(Infinity)}),
    useState(initial) {
      const slot = hook();
      if (!Object.hasOwn(slot, "value")) slot.value = typeof initial === "function" ? initial() : initial;
      return [slot.value, next => {
        const value = typeof next === "function" ? next(slot.value) : next;
        if (Object.is(value, slot.value)) return;
        slot.value = value;
        dirty.add(slot.instance);
      }];
    },
    useRef(initial) { const slot = hook(); if (!Object.hasOwn(slot, "value")) slot.value = {current: initial}; return slot.value; },
    useCallback(callback, deps) { const slot = hook(); if (!same(slot.deps, deps)) { slot.value = callback; slot.deps = deps; } return slot.value; },
    useEffect(callback, deps) { const slot = hook(); slot.effect = callback; slot.effectDeps = deps; },
    useLayoutEffect(callback, deps) { const slot = hook(); slot.effect = callback; slot.effectDeps = deps; },
  };

  function mount(parent, element) {
    if (element === null || element === undefined || typeof element === "boolean") return;
    if (Array.isArray(element)) { for (const child of element) mount(parent, child); return; }
    if (typeof element !== "object") return;
    const {type, props} = element;
    if (typeof type === "function") {
      const at = parent.cursor;
      parent.cursor += 1;
      const instance = parent.children[at] ?? (parent.children[at] = {hooks: [], runs: [], children: [], cursor: 0, props: {}, parent});
      instance.type = type;
      instance.props = props;
      instance.parent = parent;
      render(instance);
      return;
    }
    const node = host(type, props, stage);
    hosts.push(node);
    if (props.ref) props.ref.current = node;
    for (const child of element.children) mount(parent, child);
  }

  function render(instance) {
    rendering = instance;
    hookIndex = 0;
    instance.children.forEach(child => { child.cursor = 0; });
    const element = instance.type(instance.props);
    const declared = instance.hooks.slice(0, hookIndex);
    rendering = null;
    mount(instance, element);
    instance.pending = declared.map((slot, at) => ({at, effect: slot.effect, deps: slot.effectDeps})).filter(entry => entry.effect);
    instance.hooks = declared;
  }

  function runEffects(instance) {
    const next = [];
    const live = new Set();
    for (const entry of instance.pending) {
      const previous = instance.runs.find(run => run.at === entry.at);
      if (previous) live.add(previous);
      if (previous && same(previous.deps, entry.deps)) { next.push(previous); continue; }
      previous?.cleanup?.();
      next.push({at: entry.at, deps: entry.deps, cleanup: entry.effect()});
    }
    // Only an effect this render no longer declares gives up its cleanup here;
    // one that merely re-ran has already been torn down above.
    for (const run of instance.runs) if (!live.has(run)) run.cleanup?.();
    instance.runs = next;
    instance.pending = [];
  }

  const walk = (instance, visit) => { visit(instance); instance.children.forEach(child => walk(child, visit)); };
  const topOf = instance => instance.parent === null ? instance : topOf(instance.parent);

  /** One full commit: render every root, then run the effects it produced. */
  function pass() {
    hosts = [];
    for (let round = 0; round < 40; round += 1) {
      const pending = round === 0 ? roots : [...dirty];
      dirty.clear();
      for (const instance of pending) {
        const top = topOf(instance);
        top.cursor = 0;
        render(top);
      }
      if (pending.length === 0) break;
    }
    for (const root of roots) walk(root, runEffects);
    return hosts;
  }

  return {
    React,
    pass,
    find: predicate => hosts.find(node => predicate(node.props)),
    mountRoot(type, props) {
      roots.push({type, props, hooks: [], runs: [], children: [], cursor: 0, parent: null});
    },
  };
}

/** Mount the Sidebar pane the way the loader does, and hand back the harness. */
async function harness({state, visible = true, stage = {left: 100, top: 60, width: 600, height: 400}}) {
  const requests = [];
  const frames = [];
  const observers = [];
  let seq = 0;
  let shown = visible;
  let viewportAnswer = {ok: true};
  const panelState = {
    active: true, url: "https://example.com/", loading: false, canGoBack: false, canGoForward: false,
    observation: 3, width: 1280, height: 800, tabs: [{id: "t1", url: "https://example.com/", active: true, loading: false}],
    ...state,
  };

  globalThis.window = {
    __ModuleLoader__: {load: config => { globalThis.__captured = config; }},
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.requestAnimationFrame = callback => { const id = ++seq; frames.push({id, callback}); return id; };
  globalThis.cancelAnimationFrame = id => { const at = frames.findIndex(entry => entry.id === id); if (at >= 0) frames.splice(at, 1); };
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; this.live = true; observers.push(this); } observe() {} disconnect() { this.live = false; } };
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({href, method, body});
    if (href.includes("/stream")) return {ok: false, status: 404, body: null, json: async () => ({error: "BROWSER_SESSION_REQUIRED"})};
    if (method === "POST") {
      if (body?.action === "viewport") return {ok: true, status: 200, json: async () => viewportAnswer};
      return {ok: true, status: 200, json: async () => ({ok: true, observation: 4, tabs: panelState.tabs})};
    }
    return {ok: true, status: 200, json: async () => panelState};
  };
  // A clock the test drives: the pane's beats and settle timers are real
  // behaviour, but a suite that leaves them running would never exit.
  let clock = 0;
  let timerSeq = 0;
  const timers = [];
  globalThis.setTimeout = (callback, delay = 0) => { const id = ++timerSeq; timers.push({id, at: clock + delay, callback, every: 0}); return id; };
  globalThis.setInterval = (callback, delay = 0) => { const id = ++timerSeq; timers.push({id, at: clock + Math.max(1, delay), callback, every: Math.max(1, delay)}); return id; };
  const clearTimer = id => { const at = timers.findIndex(entry => entry.id === id); if (at >= 0) timers.splice(at, 1); };
  globalThis.clearTimeout = clearTimer;
  globalThis.clearInterval = clearTimer;

  const renderer = createRenderer(stage);
  const source = await readFile(new URL("../client.js", import.meta.url), "utf8");
  new Function("window", source)(globalThis.window);
  const client = globalThis.__captured.factory(name => {
    if (name === "react") return renderer.React;
    throw new Error(`unexpected require: ${name}`);
  });
  const registered = [];
  client.apply({
    effect: setup => { setup(); return () => {}; },
    locale: {bind: () => key => key, register: () => () => {}},
    sidebarRightTabs: {register: spec => registered.push(spec)},
    slots: {
      inject: (name, setup) => { registered.push({name, component: setup()}); return () => {}; },
      register: (spec, component) => component,
      entriesOfSlot: () => [],
    },
    layout: {selectPanel() {}, selectTab() {}},
    sessions: {list: {subscribe: () => () => {}, getSnapshot: () => ({current: "session-1"})}},
    sidebarRight: {},
  });
  const pane = registered.find(entry => entry.name === "sidebar.right.pane.tab").component;
  renderer.mountRoot(pane, {useTabInfo: () => ({tab: {visible: shown}}), sessionId: "session-1", t: key => key});

  const settle = async (rounds = 4) => { for (let at = 0; at < rounds; at += 1) await new Promise(resolve => setImmediate(resolve)); };
  /** Commit, run the frame the pane asked for, and let its requests resolve. */
  const tick = async (rounds = 2) => {
    for (let at = 0; at < rounds; at += 1) {
      renderer.pass();
      for (const entry of frames.splice(0, frames.length)) entry.callback(1000);
      await settle();
    }
    renderer.pass();
  };
  /** Let the pane's own clock move on, one due timer at a time. */
  const advance = async milliseconds => {
    const target = clock + milliseconds;
    for (;;) {
      const due = timers.filter(entry => entry.at <= target).sort((left, right) => left.at - right.at)[0];
      if (!due) break;
      clock = due.at;
      if (due.every) due.at = clock + due.every;
      else timers.splice(timers.indexOf(due), 1);
      due.callback();
      await settle(1);
    }
    clock = target;
    await tick();
  };
  /** The window resized: the pane's observer fires and it re-measures. */
  const fireResize = async () => {
    for (const observer of observers.filter(entry => entry.live)) observer.callback([]);
    await tick();
  };
  /** Keep committing until the pane stops talking to the Host. */
  const quiet = async () => {
    for (let at = 0; at < 8; at += 1) {
      const before = requests.length;
      await tick();
      if (requests.length === before) break;
    }
  };

  await quiet();
  return {
    requests, stage, tick, fireResize, advance, quiet, find: renderer.find,
    posted: () => requests.filter(entry => entry.body?.action === "viewport").map(entry => entry.body),
    streams: () => requests.filter(entry => entry.href.includes("/stream")),
    setViewportAnswer: answer => { viewportAnswer = answer; },
    /** The Sidebar collapses or its tab is switched away, then comes back. */
    setVisible: async next => { shown = next; await quiet(); },
  };
}

test('a native pane reports the hole of the desktop layout instead of streaming', async () => {
  const bench = await harness({state: {transport: "native"}});
  assert.deepEqual(bench.streams(), [], "no frame stream is opened");
  assert.equal(bench.find(props => props["data-dsh-browser"] === "frame").tag, "div");
  assert.equal(bench.find(props => props["data-dsh-browser"] === "body").props["data-dsh-browser-transport"], "native");
  const report = bench.posted().at(-1);
  assert.equal(report.action, "viewport");
  assert.equal(report.visible, true);
  // The desktop layout keeps its logical width: the hole is the picture the
  // pane used to scale into the stage, and the zoom is the hole over 1280.
  assert.equal(report.zoom, 600 / 1280);
  assert.equal(report.bounds.width, 600);
  assert.equal(report.bounds.x, bench.stage.left);
  assert.equal(report.bounds.y, bench.stage.top + Math.round((bench.stage.height - report.bounds.height) / 2));
  // Every DOM contract the panel tests and the Host rely on is still rendered.
  for (const marker of ["body", "frame", "view", "hit", "keyboard", "stage", "tabs", "toolbar"]) {
    assert.ok(bench.find(props => props["data-dsh-browser"] === marker), `${marker} is still rendered`);
  }
});

test('fitting the pane width hands the page the whole stage at 100%', async () => {
  const bench = await harness({state: {transport: "native"}});
  bench.find(props => props["data-dsh-browser-action"] === "menu").props.onClick({stopPropagation() {}});
  await bench.quiet();
  const fit = bench.find(props => props["data-dsh-browser-menu-item"] === "layout-fit");
  assert.ok(fit, "the tools menu offers the fit step");
  fit.props.onClick({stopPropagation() {}});
  await bench.quiet();
  const report = bench.posted().at(-1);
  assert.equal(report.zoom, 1);
  assert.deepEqual(report.bounds, {x: bench.stage.left, y: bench.stage.top, width: bench.stage.width, height: bench.stage.height});
});

test('a menu and the visit log take the view away and give it back', async () => {
  const bench = await harness({state: {transport: "native"}});
  assert.equal(bench.posted().at(-1).visible, true);
  bench.find(props => props["data-dsh-browser-action"] === "menu").props.onClick({stopPropagation() {}});
  await bench.quiet();
  assert.equal(bench.posted().at(-1).visible, false, "the tools menu covers the page");
  bench.find(props => props["data-dsh-browser-action"] === "menu").props.onClick({stopPropagation() {}});
  await bench.quiet();
  assert.equal(bench.posted().at(-1).visible, true);
  bench.find(props => props["aria-label"] === "address").props.onFocus();
  await bench.quiet();
  assert.equal(bench.posted().at(-1).visible, false, "the visit log covers the page");
  bench.find(props => props["aria-label"] === "address").props.onBlur();
  await bench.quiet();
  assert.equal(bench.posted().at(-1).visible, true);
});

test('a pane nobody is looking at reports no hole at all', async () => {
  const bench = await harness({state: {transport: "native"}, visible: false});
  const report = bench.posted().at(-1);
  assert.equal(report.visible, false);
  assert.equal(report.bounds, null);
  assert.equal(report.zoom, 1);
});

test('a collapsed Sidebar takes the view away and gives it back where it was', async () => {
  const bench = await harness({state: {transport: "native"}});
  assert.equal(bench.posted().at(-1).visible, true);
  await bench.setVisible(false);
  const hidden = bench.posted().at(-1);
  assert.equal(hidden.visible, false, "the page is off screen");
  assert.ok(hidden.bounds, "the hole is remembered, so the view returns to its place");
  await bench.setVisible(true);
  assert.equal(bench.posted().at(-1).visible, true);
});

test('a moved stage is re-measured, and an unchanged one is not repeated', async () => {
  const bench = await harness({state: {transport: "native"}});
  const before = bench.posted().length;
  await bench.quiet();
  assert.equal(bench.posted().length, before, "an unchanged hole costs no request");
  bench.stage.left = 240;
  bench.stage.width = 700;
  await bench.fireResize();
  const report = bench.posted().at(-1);
  assert.equal(report.bounds.x, 240);
  assert.equal(report.zoom, 700 / 1280);
});

test('a fall back to frames brings the canvas and the stream back', async () => {
  const bench = await harness({state: {transport: "native"}});
  assert.deepEqual(bench.streams(), []);
  // The Host answers the next geometry report by naming the screencast transport.
  bench.setViewportAnswer({ok: true, transport: "screencast"});
  bench.stage.width = 610;
  await bench.fireResize();
  await bench.quiet();
  assert.equal(bench.streams().length, 1, "the pane subscribes to frames again");
  assert.equal(bench.find(props => props["data-dsh-browser"] === "frame").tag, "canvas");
  assert.equal(bench.find(props => props["data-dsh-browser"] === "body").props["data-dsh-browser-transport"], "screencast");
  assert.ok(bench.find(props => props.className === "dsh-browser-overlay"), "the annotation canvas is back");
});

test('a Host that never names a transport keeps the streaming pane it is today', async () => {
  const bench = await harness({state: {}});
  assert.equal(bench.streams().length, 1, "an unlabelled page streams frames");
  assert.equal(bench.find(props => props["data-dsh-browser"] === "frame").tag, "canvas");
  assert.deepEqual(bench.posted(), [], "nothing is reported to a Host that paints the page itself");
});

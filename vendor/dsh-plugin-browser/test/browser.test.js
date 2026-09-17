import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {BrowserSessions, browserKey, encodeEvent, eventStream, httpUrl, originAdmitted, originKey, originPolicy, playwrightKey, redact, redactValue, rememberVisit, TAB_LIMIT, viewportBounds, VISITED_LIMIT} from '../browser.js';
import {readFile} from 'node:fs/promises';
import {apply} from '../index.js';

/** Await one stream event matching a predicate, bounded by a timeout. */
async function nextEvent(reader, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('timed out waiting for a stream event');
    let timer;
    const event = await Promise.race([
      reader.next(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out waiting for a stream event')), remaining); }),
    ]).finally(() => clearTimeout(timer));
    if (event === undefined) throw new Error('the stream ended early');
    if (predicate(event)) return event;
  }
}

/** A page-shaped object with no Chromium behind it, for Host bookkeeping tests. */
function stubPage(url = 'about:blank') {
  return {url: () => url, title: async () => '', close: async () => {}, setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, on() {}};
}

function stubTab(index, page = stubPage()) {
  return {id: `tab-${index}`, page, messages: [], history: [page.url()], index: 0, loading: false};
}

/** A session-shaped object holding the tab bookkeeping the Host reads. */
function stubSession(tabs = []) {
  const session = {tabs, subscribers: new Set(), tabSeq: tabs.length, activeId: tabs.at(-1)?.id, observation: 0, visited: [], viewport: {width: 1280, height: 800}, context: {newPage: async () => stubPage()}};
  Object.defineProperties(session, {
    page: {get: () => session.tabs.find(tab => tab.id === session.activeId)?.page},
    loading: {get: () => false}, canGoBack: {get: () => false}, canGoForward: {get: () => false},
  });
  return session;
}

test('package declares the official right Sidebar client bundle', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  assert.equal(packageJson.exports['./client'], './client.js');
  assert.equal(packageJson.dsh.client.platform, 'web');
  assert.deepEqual(packageJson.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-sidebar-right']);
  assert.match(client, /window\.__ModuleLoader__\.load/);
  assert.match(client, /sidebar\.right\.pane\.tab/);
  assert.match(client, /sidebarRightTabs\.register/);
  assert.match(client, /sidebarRight\.openTabIn/);
  assert.match(client, /tool\.call\.toolview/);
  assert.match(client, /key: "browser"/);
  assert.match(client, /Only the live call opens the pane/);
  assert.match(client, /\/api\/dsh-browser\/stream/);
  assert.match(client, /createImageBitmap/);
  assert.match(client, /dsh-browser-overlay/);
  assert.match(client, /action: "_hover"/);
  assert.doesNotMatch(client, /createElement\("iframe"|window\.open\(/);
});

test('Host browser automation is headless by default', async () => {
  const browsers = new BrowserSessions({});
  assert.equal(browsers.config.headless ?? true, true);
  await browsers.dispose();
});

test('navigation admits credential-free HTTP(S) only', () => {
  assert.equal(httpUrl('http://127.0.0.1:3080'), 'http://127.0.0.1:3080/');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'https://user:pass@example.com', 'data:text/html,test']) assert.throws(() => httpUrl(url));
  assert.equal(redact('token=abcdefghi'), 'token=[redacted]');
});

test('viewport bounds and forwarded keys stay inside the Host contract', () => {
  assert.deepEqual(viewportBounds(420, 600), {width: 420, height: 600});
  assert.throws(() => viewportBounds(100000, 600), /BROWSER_INVALID_VIEWPORT/);
  assert.throws(() => viewportBounds(120, 600), /BROWSER_INVALID_VIEWPORT/);
  assert.equal(browserKey('ControlOrMeta+A'), 'Ctrl+A');
  assert.equal(browserKey('Shift+Tab'), 'Shift+Tab');
  assert.equal(browserKey('PageDown'), 'PageDown');
  assert.equal(browserKey('Meta+Q'), undefined);
  assert.equal(browserKey('ControlOrMeta+Shift+Z'), undefined);
  assert.equal(playwrightKey('Ctrl+A'), 'ControlOrMeta+A');
  assert.equal(playwrightKey('Ctrl+Shift+Z'), 'ControlOrMeta+Shift+Z');
  assert.equal(playwrightKey('Shift+Tab'), 'Shift+Tab');
});

test('stream events are newline-delimited JSON', () => {
  assert.equal(new TextDecoder().decode(encodeEvent({t: 'frame', seq: 3})), '{"t":"frame","seq":3}\n');
});

test('an idle Sidebar stream reports no active page and releases on cancel', async () => {
  const browsers = new BrowserSessions({executablePath: '/nonexistent/dsh-browser/chrome'});
  const controller = new AbortController();
  const stream = eventStream(browsers, 'idle-session', undefined, new Request('http://127.0.0.1/api/dsh-browser/stream', {signal: controller.signal}));
  const reader = stream.getReader();
  const first = await reader.read();
  assert.deepEqual(JSON.parse(new TextDecoder().decode(first.value)), {t: 'hello', active: false, viewport: null});
  await reader.cancel();
  controller.abort();
  await browsers.dispose();
});

test('redaction preserves structured values and long strings', () => {
  assert.deepEqual(redactValue([{href: 'https://example.com/?token=abc', text: 'a'.repeat(100000)}, {width: 1280}]), [{href: 'https://example.com/?token=[redacted]', text: 'a'.repeat(24000)}, {width: 1280}]);
});

test('missing runtime reports an actionable error and permits launch retry', async () => {
  const browsers = new BrowserSessions({executablePath: '/nonexistent/dsh-browser/chrome'});
  try {
    await assert.rejects(browsers.run('retry', {action: 'navigate', url: 'http://127.0.0.1'}, new AbortController().signal), /BROWSER_RUNTIME_MISSING/);
    assert.equal(browsers.sessions.size, 0);
    assert.equal(browsers.launch, undefined);
    await assert.rejects(browsers.browser(), /BROWSER_RUNTIME_MISSING/);
  } finally { await browsers.dispose(); }
});

test('Sidebar API reports missing runtime and retains a usable inactive session', async () => {
  const routes = new Map();
  let dispose;
  apply({
    effect: setup => { dispose = setup(); },
    on() {},
    tools: {register() {}},
    inject: (_services, setup) => setup({
      connection: {fetch: {register: route => { routes.set(route.path, route.fetch); }}},
      sessions: {get: id => id === 'sidebar-test' ? {id} : undefined},
      get: () => undefined,
    }),
  }, {executablePath: '/nonexistent/dsh-browser/chrome'});
  const endpoint = routes.get('/api/dsh-browser');
  const stream = routes.get('/api/dsh-browser/stream');
  const url = 'http://127.0.0.1/api/dsh-browser?sessionId=sidebar-test';
  try {
    const failed = await endpoint(new Request(url, {method: 'POST', body: JSON.stringify({action: 'navigate', url: 'http://127.0.0.1'})}));
    assert.equal(failed.status, 400);
    assert.deepEqual(await failed.json(), {error: 'BROWSER_RUNTIME_MISSING'});
    const view = await endpoint(new Request(url));
    assert.equal(view.status, 200);
    assert.deepEqual(await view.json(), {active: false});
    const unknown = await stream(new Request('http://127.0.0.1/api/dsh-browser/stream?sessionId=elsewhere'));
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), {error: 'BROWSER_SESSION_REQUIRED'});
    const oversized = await stream(new Request('http://127.0.0.1/api/dsh-browser/stream?sessionId=sidebar-test&width=99999&height=600'));
    assert.equal(oversized.status, 400);
    assert.deepEqual(await oversized.json(), {error: 'BROWSER_INVALID_VIEWPORT'});
  } finally { await dispose(); }
});

test('the tab action and the pane clipboard stay inside the published contract', async () => {
  const routes = new Map();
  const tools = [];
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  let dispose;
  apply({
    effect: setup => { dispose = setup(); },
    on() {},
    tools: {register: tool => tools.push(tool)},
    inject: (_services, setup) => setup({
      connection: {fetch: {register: route => { routes.set(route.path, route.fetch); }}},
      sessions: {get: id => id === 'tabs-test' ? {id} : undefined},
      // A read-only Session may look at the tabs and the selection, never move them.
      get: name => name === 'sandboxPolicy' ? {resolve: () => ({mode: 'read-only'})} : undefined,
    }),
  }, {executablePath: '/nonexistent/dsh-browser/chrome'});
  try {
    const tool = tools.find(entry => entry.name === 'browser');
    assert.equal(tool.parameters.properties.action.enum.includes('tabs'), true);
    assert.deepEqual(tool.parameters.properties.op.enum, ['list', 'new', 'select', 'close']);
    assert.match(tool.description, /manage the browser tabs/);
    // The pane's own chrome speaks the same contract as the tool.
    assert.match(client, /data-dsh-browser": "tabs"/);
    assert.match(client, /data-dsh-browser-tab/);
    assert.match(client, /action: "_tabs"/);
    assert.match(client, /action: "_stop"/);
    assert.match(client, /action: "_selection"/);
    assert.match(client, /navigator\.clipboard\.writeText/);
    assert.match(client, /Desktop layout|layoutDesktop/);
    assert.match(client, /event\.t === "tick"/);
    const endpoint = routes.get('/api/dsh-browser');
    const post = args => endpoint(new Request('http://127.0.0.1/api/dsh-browser?sessionId=tabs-test', {method: 'POST', body: JSON.stringify(args)}));
    assert.deepEqual(await (await post({action: '_unknown'})).json(), {error: 'BROWSER_INVALID_ACTION'});
    assert.deepEqual(await (await post({action: '_view'})).json(), {error: 'BROWSER_INVALID_ACTION'});
    // Allowed reads reach the runtime, which is deliberately missing here.
    assert.deepEqual(await (await post({action: '_tabs', op: 'list'})).json(), {error: 'BROWSER_RUNTIME_MISSING'});
    assert.deepEqual(await (await post({action: '_selection'})).json(), {error: 'BROWSER_RUNTIME_MISSING'});
    assert.deepEqual(await (await post({action: '_tabs', op: 'new'})).json(), {error: 'BROWSER_READ_ONLY'});
    assert.deepEqual(await (await post({action: '_stop'})).json(), {error: 'BROWSER_RUNTIME_MISSING'});
    assert.deepEqual(await (await post({action: '_input', kind: 'click', x: 4, y: 4})).json(), {error: 'BROWSER_READ_ONLY'});
  } finally { await dispose(); }
});

test('the origin allow list is optional, normalized and exact', () => {
  assert.equal(originAdmitted(originPolicy([]), 'https://example.com/anywhere'), true);
  const origins = originPolicy(['https://Example.com:443/login?next=1']);
  assert.equal(originAdmitted(origins, 'https://example.com/deep/path'), true);
  assert.equal(originAdmitted(origins, 'https://example.com.evil.test/'), false);
  assert.equal(originAdmitted(origins, 'http://example.com/'), false);
  assert.equal(originAdmitted(origins, 'https://example.com:8443/'), false);
  assert.equal(originKey('data:text/html,x'), undefined);
  // about:blank and an empty address never navigate, so the list cannot block them.
  assert.equal(originAdmitted(origins, 'about:blank'), true);
  assert.equal(originAdmitted(origins, ''), true);
  assert.throws(() => originPolicy(['file:///etc/passwd']), /BROWSER_INVALID_URL/);
  assert.throws(() => originPolicy('https://example.com'), /BROWSER_INVALID_URL/);
});

test('an off-list navigation is refused before a browser exists', async () => {
  const browsers = new BrowserSessions({allowedOrigins: ['https://example.com/login'], executablePath: '/nonexistent/dsh-browser/chrome'});
  const signal = new AbortController().signal;
  try {
    await assert.rejects(browsers.run('origin-session', {action: 'navigate', url: 'https://example.com.evil.test/'}, signal), /BROWSER_ORIGIN_DENIED/);
    await assert.rejects(browsers.run('origin-session', {action: 'navigate', url: 'http://example.com/'}, signal), /BROWSER_ORIGIN_DENIED/);
    assert.equal(browsers.sessions.size, 0);
    // An admitted origin still reaches the runtime, which is deliberately missing here.
    await assert.rejects(browsers.run('origin-session', {action: 'navigate', url: 'https://example.com/deep/link'}, signal), /BROWSER_RUNTIME_MISSING/);
    // Without a list nothing is refused: the same address only fails on the runtime.
    const open = new BrowserSessions({executablePath: '/nonexistent/dsh-browser/chrome'});
    try {
      await assert.rejects(open.run('open-session', {action: 'navigate', url: 'https://example.com.evil.test/'}, signal), /BROWSER_RUNTIME_MISSING/);
    } finally { await open.dispose(); }
  } finally { await browsers.dispose(); }
});

test('the visit log keeps web addresses only, newest first and deduplicated', async () => {
  const browsers = new BrowserSessions({});
  const session = {visited: []};
  let current = 'about:blank';
  const page = {url: () => current, title: async () => 'Fixture'};
  await browsers.visit(session, page);
  assert.deepEqual(session.visited, []);
  current = 'https://example.com/one?token=abcdefghi';
  await browsers.visit(session, page);
  assert.deepEqual(session.visited.map(item => item.url), ['https://example.com/one?token=[redacted]']);
  assert.deepEqual(Object.keys(session.visited[0]).sort(), ['at', 'title', 'url']);
  assert.equal(session.visited[0].title, 'Fixture');
  assert.equal(typeof session.visited[0].at, 'number');
  current = 'https://example.com/two';
  await browsers.visit(session, page);
  await browsers.visit(session, page);
  assert.deepEqual(session.visited.map(item => item.url), ['https://example.com/two', 'https://example.com/one?token=[redacted]']);
  // A title read while the page moves on belongs to the next address, not this record.
  let raced = 'https://example.com/three';
  await browsers.visit(session, {url: () => raced, title: async () => { raced = 'https://example.com/four'; return 'Three'; }});
  assert.equal(session.visited[0].url, 'https://example.com/three');
  assert.equal(session.visited[0].title, '');
});

test('a denied origin never enters the visit log', async () => {
  const browsers = new BrowserSessions({allowedOrigins: ['https://example.com']});
  const session = {visited: []};
  await browsers.visit(session, {url: () => 'https://example.com/one', title: async () => 'One'});
  await browsers.visit(session, {url: () => 'https://off-list.test/two', title: async () => 'Two'});
  assert.deepEqual(session.visited.map(item => item.url), ['https://example.com/one']);
});

test('the visit log drops its oldest records at the cap', () => {
  const visited = [];
  for (let index = 0; index < VISITED_LIMIT + 20; index++) rememberVisit(visited, {url: `https://example.com/${index}`, title: '', at: index});
  assert.equal(visited.length, VISITED_LIMIT);
  assert.equal(visited[0].url, `https://example.com/${VISITED_LIMIT + 19}`);
  assert.equal(visited.at(-1).url, 'https://example.com/20');
  // Re-visiting a known address moves that one record to the front instead of adding another.
  rememberVisit(visited, {url: 'https://example.com/20', title: 'again', at: 999});
  assert.equal(visited.length, VISITED_LIMIT);
  assert.equal(visited[0].title, 'again');
  assert.equal(visited.filter(item => item.url === 'https://example.com/20').length, 1);
});

test('the visit log answers a pure read without starting a browser', async () => {
  const browsers = new BrowserSessions({executablePath: '/nonexistent/dsh-browser/chrome'});
  try {
    assert.deepEqual(await browsers.run('quiet-session', {action: '_history'}, new AbortController().signal), {history: [], historyTotal: 0});
    assert.equal(browsers.sessions.size, 0);
    const session = {visited: [{url: 'https://example.com/', title: 'Example', at: 1}]};
    assert.deepEqual(await browsers.operate(session, {action: '_history'}), {history: session.visited, historyTotal: 1});
  } finally { await browsers.dispose(); }
});

test('the tab limit refuses an explicit new tab without evicting an open one', async () => {
  const browsers = new BrowserSessions({});
  const full = stubSession(Array.from({length: TAB_LIMIT}, (_, index) => stubTab(index + 1)));
  await assert.rejects(browsers.operate(full, {action: '_tabs', op: 'new'}), /BROWSER_TAB_LIMIT/);
  assert.equal(full.tabs.length, TAB_LIMIT);
  assert.equal(full.tabs[0].id, 'tab-1');
  const room = stubSession(Array.from({length: TAB_LIMIT - 1}, (_, index) => stubTab(index + 1)));
  const created = await browsers.operate(room, {action: '_tabs', op: 'new'});
  assert.equal(created.tabs.length, TAB_LIMIT);
  assert.equal(created.activeId, created.tabs.at(-1).id);
});

test('a popup past the tab limit is closed instead of becoming a tab', async () => {
  const browsers = new BrowserSessions({});
  let closed = 0;
  const popup = {...stubPage('http://127.0.0.1/popup'), close: async () => { closed += 1; }};
  const full = stubSession(Array.from({length: TAB_LIMIT}, (_, index) => stubTab(index + 1)));
  await browsers.adopt(full, popup);
  assert.equal(closed, 1);
  assert.equal(full.tabs.length, TAB_LIMIT);
  // Below the limit the very same page becomes the tab the pane shows.
  const room = stubSession(Array.from({length: TAB_LIMIT - 1}, (_, index) => stubTab(index + 1)));
  await browsers.adopt(room, popup);
  assert.equal(room.tabs.length, TAB_LIMIT);
  assert.equal(room.tabs.at(-1).page, popup);
  assert.equal(room.activeId, room.tabs.at(-1).id);
});

test('the pane reads the visit log through the read-only channel', async () => {
  const routes = new Map();
  let dispose;
  apply({
    effect: setup => { dispose = setup(); },
    on() {},
    tools: {register() {}},
    inject: (_services, setup) => setup({
      connection: {fetch: {register: route => { routes.set(route.path, route.fetch); }}},
      sessions: {get: id => id === 'history-test' ? {id} : undefined},
      get: name => name === 'sandboxPolicy' ? {resolve: () => ({mode: 'read-only'})} : undefined,
    }),
  }, {executablePath: '/nonexistent/dsh-browser/chrome'});
  try {
    const post = args => routes.get('/api/dsh-browser')(new Request('http://127.0.0.1/api/dsh-browser?sessionId=history-test', {method: 'POST', body: JSON.stringify(args)}));
    const empty = await post({action: '_history'});
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), {ok: true, history: [], historyTotal: 0});
    // The visit log is a read, so a read-only Session may still ask for it while
    // opening a tab stays denied.
    assert.deepEqual(await (await post({action: '_tabs', op: 'new'})).json(), {error: 'BROWSER_READ_ONLY'});
  } finally { await dispose(); }
});

const configuredBrowser = process.env.BROWSER_TEST_EXECUTABLE;
const managedBrowser = chromium.executablePath();
const chromiumUnavailable = !configuredBrowser && !existsSync(managedBrowser);

test('real Chromium navigates, fills, clicks, streams, isolates and closes', {skip: chromiumUnavailable ? `Chromium executable is unavailable at ${managedBrowser}; set BROWSER_TEST_EXECUTABLE to run this integration test` : false}, async () => {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><title>Browser fixture</title><h1>Browser fixture</h1><label>Message<input aria-label="Message"></label><button onclick='document.querySelector("output").textContent=document.querySelector("input").value;console.log("updated")'>Apply</button><output></output>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browsers = new BrowserSessions({headless: true, ...(configuredBrowser ? {executablePath: configuredBrowser} : {})});
  const signal = new AbortController().signal;
  const run = args => browsers.run('test-session', args, signal);
  const controller = new AbortController();
  try {
    const first = await run({action: 'navigate', url: `http://127.0.0.1:${server.address().port}`});
    assert.match(first.snapshot, /Browser fixture/);
    const second = await run({action: 'fill', role: 'textbox', name: 'Message', text: 'verified', observation: first.observation});
    await assert.rejects(run({action: 'click', role: 'button', name: 'Apply', observation: first.observation}), /STALE/);
    const third = await run({action: 'click', role: 'button', name: 'Apply', observation: second.observation});
    assert.match(third.snapshot, /verified/);
    assert.match((await run({action: 'evaluate', expression: 'visible_text'})).result, /verified/);
    const shot = await run({action: 'screenshot'});
    assert(shot.data.length > 2000);
    assert.equal(shot.data[0], 0xff);
    assert((await run({action: 'console'})).messages.some(message => message.text === 'updated'));
    await assert.rejects(run({action: 'evaluate', expression: 'document.cookie'}), /INSPECTION/);
    assert.equal((await run({action: 'evaluate', expression: 'title'})).result, 'Browser fixture');
    const view = await run({action: '_view'});
    assert.equal(view.url, third.url);
    assert.equal(view.mediaType, 'image/jpeg');
    const jpeg = Buffer.from(view.image, 'base64');
    assert.equal(jpeg[0], 0xff);
    assert.equal(jpeg[1], 0xd8);
    assert(jpeg.length > 2000);
    await run({action: '_input', kind: 'key', key: 'Tab', observation: view.observation});
    await assert.rejects(run({action: 'click', role: 'button', name: 'Apply', observation: third.observation}), /STALE/);
    const narrow = await run({action: '_view', width: 420, height: 600});
    assert.equal(narrow.mediaType, 'image/jpeg');
    assert.equal(narrow.width, 420);
    assert.equal(narrow.height, 600);
    assert.deepEqual((await run({action: 'evaluate', expression: 'layout'})).result.width, 420);
    const live = await browsers.session('test-session');
    const box = await live.page.getByRole('textbox', {name: 'Message'}).boundingBox();
    const point = {action: '_input', kind: 'click', width: 420, height: 600, x: box.x + box.width / 2, y: box.y + box.height / 2};
    await run({...point, observation: narrow.observation});
    const manual = args => run({action: '_input', ...args, observation: live.observation});
    await manual({kind: 'key', key: 'ControlOrMeta+A'});
    await manual({kind: 'text', text: 'Sidebar \u4e2d\u6587'});
    await manual({kind: 'key', key: 'Tab'});
    await manual({kind: 'key', key: 'Enter'});
    assert.equal(await live.page.locator('output').textContent(), 'Sidebar \u4e2d\u6587');
    await assert.rejects(manual({kind: 'key', key: 'Meta+Q'}), /BROWSER_INVALID_KEY/);
    await run({action: '_view', width: 700, height: 500});
    await assert.rejects(run({...point, observation: live.observation}), /STALE/);
    await assert.rejects(run({action: '_view', width: 100000, height: 600}), /INVALID_VIEWPORT/);
    await live.page.locator('body').evaluate(body => { body.style.height = '2400px'; });
    await manual({kind: 'scroll', deltaY: 500});
    await live.page.waitForFunction(() => scrollY > 0);

    // The Sidebar channel carries live JPEG frames plus the Agent's pointer,
    // focus and typing cues, so the pane can annotate what is being browsed.
    const reader = await browsers.subscribe(live, {width: 640, height: 480}, controller.signal);
    const frame = await nextEvent(reader, event => event.t === 'frame');
    assert.equal(frame.mediaType, 'image/jpeg');
    assert(frame.data.length > 1000);
    assert.deepEqual(frame.viewport, {width: 640, height: 480});
    await live.page.evaluate(() => scrollTo(0, 0));
    const inputBox = await live.page.getByRole('textbox', {name: 'Message'}).boundingBox();
    const clickAt = {kind: 'click', width: 640, height: 480, x: inputBox.x + 6, y: inputBox.y + 6};
    const seen = [];
    const collect = (async () => {
      for (let index = 0; index < 30; index++) {
        const event = await nextEvent(reader, () => true);
        seen.push(event);
        if (seen.some(item => item.t === 'pointer' && item.kind === 'click') && seen.some(item => item.t === 'focus' && item.focus)) return;
      }
    })();
    await manual(clickAt);
    await collect;
    const pointer = seen.find(item => item.t === 'pointer' && item.kind === 'click');
    const focus = seen.find(item => item.t === 'focus' && item.focus);
    assert(Math.abs(pointer.x - clickAt.x) < 1 && Math.abs(pointer.y - clickAt.y) < 1);
    assert.equal(pointer.source, 'human');
    assert.equal(focus.focus.editable, true);
    assert(focus.focus.box.width > 0);
    const hover = await run({action: '_hover', x: inputBox.x + 6, y: inputBox.y + 6});
    assert.equal(hover.hover.editable, true);
    assert.equal(hover.hover.cursor, 'text');
    const dragged = await Promise.all([
      nextEvent(reader, event => event.t === 'pointer' && event.kind === 'drag'),
      manual({kind: 'drag', from: {x: inputBox.x + 6, y: inputBox.y + 6}, to: {x: inputBox.x + 60, y: inputBox.y + 6}}),
    ]);
    assert.equal(dragged[0].label, 'drag');
    await assert.rejects(run({action: '_hover', x: 9999, y: 6}), /BROWSER_INVALID_POINT/);
    await reader.release();

    const other = await browsers.session('other-session');
    assert.equal(other.page.url(), 'about:blank');
    await run({action: 'close'});
    assert.equal(browsers.sessions.has('test-session'), false);
  } finally { controller.abort(); await browsers.dispose(); await new Promise(resolve => server.close(resolve)); }
});

test('tabs, history and the pane selection stay in sync', {skip: chromiumUnavailable ? `Chromium executable is unavailable at ${managedBrowser}; set BROWSER_TEST_EXECUTABLE to run this integration test` : false}, async () => {
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    const page = (title, body) => { response.setHeader('Content-Type', 'text/html'); response.end(`<!doctype html><title>${title}</title>${body}`); };
    if (path === '/slow') { setTimeout(() => page('Slow', '<h1>Slow page</h1>'), 2500); return; }
    if (path === '/next') { page('Second', '<h1>Second page</h1>'); return; }
    page('First', '<h1>First page</h1><p id="line">Selectable line</p><a href="/next">Next page</a><a href="/next" target="_blank">Popup page</a>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browsers = new BrowserSessions({headless: true, ...(configuredBrowser ? {executablePath: configuredBrowser} : {})});
  const signal = new AbortController().signal;
  const run = args => browsers.run('tab-session', args, signal);
  const settle = async (attempts = 25) => {
    let list = await run({action: '_tabs'});
    for (let attempt = 0; attempt < attempts && list.tabs.length < 2; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      list = await run({action: '_tabs'});
    }
    return list;
  };
  try {
    const first = await run({action: 'navigate', url: base});
    assert.equal(first.tabs.length, 1);
    assert.equal(first.tabs[0].id, first.tab);
    assert.match(first.snapshot, /First page/);

    // A page the site opens by itself becomes a managed tab, and the pane
    // follows it the way a foreground browser tab does.
    await run({action: 'click', role: 'link', name: 'Popup page', observation: first.observation});
    const opened = await settle();
    assert.equal(opened.tabs.length, 2);
    const popup = opened.tabs.find(tab => tab.id !== first.tab);
    assert.equal(opened.activeId, popup.id);
    assert.match(popup.url, /\/next$/);
    const live = await browsers.session('tab-session');
    await live.tabs.find(tab => tab.id === popup.id).page.waitForLoadState('domcontentloaded').catch(() => {});
    assert.equal((await run({action: 'snapshot'})).url, `${base}/next`);

    // Switching tabs re-points the pane and invalidates the older observation.
    const switched = await run({action: '_tabs', op: 'select', tab: first.tab});
    assert.equal(switched.activeId, first.tab);
    assert.equal((await run({action: 'evaluate', expression: 'title'})).result, 'First');
    await assert.rejects(run({action: '_tabs', op: 'select', tab: 'tab-404'}), /BROWSER_UNKNOWN_TAB/);
    await assert.rejects(run({action: 'click', role: 'link', name: 'Next page', observation: first.observation}), /STALE/);

    // Each tab keeps its own history, so back and forward report what is left.
    await run({action: 'navigate', url: `${base}/next`});
    const arrived = await run({action: '_view'});
    assert.equal(arrived.canGoBack, true);
    assert.equal(arrived.canGoForward, false);
    await run({action: '_back'});
    const rewound = await run({action: '_view'});
    assert.equal(rewound.url, `${base}/`);
    assert.equal(rewound.canGoForward, true);
    await run({action: '_forward'});
    const replayed = await run({action: '_view'});
    assert.equal(replayed.url, `${base}/next`);
    assert.equal(replayed.canGoForward, false);

    // Closing a tab leaves the pane on its neighbour.
    const closed = await run({action: '_tabs', op: 'close', tab: first.tab});
    assert.equal(closed.tabs.length, 1);
    assert.equal(closed.activeId, popup.id);

    // Stop answers while a slow load is still in flight, the way a browser's
    // own stop button does, and reports the load as finished.
    const slow = run({action: 'navigate', url: `${base}/slow`}).catch(error => error);
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal((await run({action: '_stop'})).stopped, true);
    assert.equal((await run({action: '_view'})).loading, false);
    await slow;

    // Copying from the pane reads the page's own selection.
    await run({action: 'navigate', url: base});
    await live.page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#line'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    assert.equal((await run({action: '_selection'})).text, 'Selectable line');

    // A brand new tab is blank and becomes the tab the pane shows.
    const created = await run({action: '_tabs', op: 'new'});
    assert.equal(created.tabs.length, 2);
    assert.equal(created.activeId, created.tabs[created.tabs.length - 1].id);
    assert.equal((await run({action: '_view'})).url, 'about:blank');
  } finally { await browsers.dispose(); await new Promise(resolve => server.close(resolve)); }
});

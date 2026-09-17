import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeBackend} from '../native.js';

/** Let queued microtasks and one macrotask of a command settle. */
const tick = () => new Promise(resolve => setImmediate(resolve));

/**
 * A `desktopNativeBrowser` stand-in: one view table, recorded CDP commands with
 * scripted answers, and a dispatch hook for the events the shell would emit.
 */
function fakeService() {
  const calls = [];
  const views = new Map();
  const listeners = new Set();
  const replies = new Map();
  const closedOwners = [];
  const service = {
    version: 1,
    calls,
    closedOwners,
    get events() { return listeners.size; },
    /** Script what one method answers; a function receives the params. */
    reply(method, value) { replies.set(method, value); return service; },
    last(method) { return [...calls].reverse().find(call => call.method === method); },
    all(method) { return calls.filter(call => call.method === method); },
    async createView(options) {
      views.set(options.id, {...options});
      calls.push({method: 'createView', id: options.id, params: options});
      return {id: options.id};
    },
    async setBounds(id, bounds) { calls.push({method: 'setBounds', id, params: bounds}); },
    async setZoom(id, factor) { calls.push({method: 'setZoom', id, params: {factor}}); },
    async setVisible(id, visible) { calls.push({method: 'setVisible', id, params: {visible}}); },
    async focus(id) { calls.push({method: 'focus', id}); },
    async navigate(id, url) { calls.push({method: 'navigate', id, params: {url}}); },
    async close(id) { calls.push({method: 'close', id}); views.delete(id); },
    async closeOwner(owner) { calls.push({method: 'closeOwner', id: undefined, params: {owner}}); closedOwners.push(owner); },
    async command(id, method, params = {}) {
      calls.push({method, id, params});
      const scripted = replies.get(method);
      if (typeof scripted === 'function') return scripted(params);
      return scripted === undefined ? {} : structuredClone(scripted);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(event) { for (const listener of [...listeners]) listener(event); },
  };
  return service;
}

/** One backend over a fresh fake service, plus its first page. */
async function openPage(config = {}, options = {}) {
  const service = fakeService();
  const backend = createNativeBackend({service, config: {owner: 'session-1', ...config}});
  const page = await backend.context.newPage(options);
  const viewId = service.last('createView').id;
  const cdp = (method, params = {}) => service.dispatch({type: 'cdp', id: viewId, method, params});
  return {service, backend, context: backend.context, page, viewId, cdp};
}

/** The load event the shell forwards once a navigation really finished. */
const loaded = cdp => cdp('Page.loadEventFired', {timestamp: 1});

test('goto, reload and the history walk drive CDP and wait for the load event', async () => {
  const {service, page, cdp} = await openPage();

  let settled = false;
  const navigating = page.goto('https://example.test/a').then(() => { settled = true; });
  await tick();
  assert.deepEqual(service.calls.filter(call => call.id && call.method !== 'createView').slice(0, 2).map(call => call.method), ['Runtime.enable', 'Page.enable'], 'the domains are enabled before the first command that needs them');
  assert.deepEqual(service.last('Page.navigate').params, {url: 'https://example.test/a'});
  assert.equal(settled, false, 'goto waits for the main-frame load event');
  loaded(cdp);
  await navigating;
  assert.equal(settled, true);
  assert.equal(service.all('Runtime.enable').length, 1, 'domains are enabled once per view');

  service.reply('Page.getNavigationHistory', {
    currentIndex: 1,
    entries: [{id: 1, url: 'https://example.test/a'}, {id: 2, url: 'https://example.test/b'}, {id: 3, url: 'https://example.test/c'}],
  });
  const back = page.goBack();
  await tick();
  assert.deepEqual(service.last('Page.navigateToHistoryEntry').params, {entryId: 1});
  loaded(cdp);
  await back;

  const forward = page.goForward();
  await tick();
  assert.deepEqual(service.last('Page.navigateToHistoryEntry').params, {entryId: 3});
  loaded(cdp);
  await forward;

  service.reply('Page.getNavigationHistory', {currentIndex: 0, entries: [{id: 1, url: 'https://example.test/a'}]});
  assert.equal(await page.goBack(), null, 'the oldest entry has nowhere to go');
  assert.equal(service.all('Page.navigateToHistoryEntry').length, 2);

  const reloading = page.reload();
  await tick();
  assert.ok(service.last('Page.reload'));
  loaded(cdp);
  await reloading;
});

test('a navigation that never loads fails on the navigation deadline', async () => {
  const {page, cdp} = await openPage();
  page.setDefaultNavigationTimeout(30);
  await assert.rejects(page.goto('https://example.test/slow'), /BROWSER_TIMEOUT/);
  assert.ok(cdp);
});

test('a refused Page.navigate surfaces its error text', async () => {
  const {service, page} = await openPage();
  service.reply('Page.navigate', {frameId: 'F1', errorText: 'net::ERR_NAME_NOT_RESOLVED'});
  await assert.rejects(page.goto('https://missing.test/'), /BROWSER_NAVIGATION_FAILED: net::ERR_NAME_NOT_RESOLVED/);
});

test('evaluate serializes a function with its argument and reports page exceptions', async () => {
  const {service, page} = await openPage();
  service.reply('Runtime.evaluate', {result: {type: 'number', value: 42}});
  assert.equal(await page.evaluate(x => x * 2, 21), 42);
  assert.deepEqual(service.last('Runtime.evaluate').params, {
    expression: '(x => x * 2)(21)', awaitPromise: true, returnByValue: true,
  });

  await page.evaluate('document.title');
  assert.equal(service.last('Runtime.evaluate').params.expression, 'document.title');
  await page.evaluate(x => x, undefined);
  assert.equal(service.last('Runtime.evaluate').params.expression, '(x => x)(null)', 'a missing argument is null');

  service.reply('Runtime.evaluate', {result: {type: 'number', unserializableValue: 'NaN'}});
  assert.ok(Number.isNaN(await page.evaluate('NaN')));

  service.reply('Runtime.evaluate', {exceptionDetails: {text: 'Uncaught', exception: {description: 'Error: boom\n    at <anonymous>:1:1'}}});
  await assert.rejects(page.evaluate('throw new Error("boom")'), /BROWSER_EVALUATE_FAILED: Error: boom/);
});

test('ariaSnapshot renders roles, names, text and passes ignored nodes through', async () => {
  const {service, page} = await openPage();
  service.reply('DOM.getDocument', {root: {nodeId: 1}});
  service.reply('DOM.querySelector', {nodeId: 5});
  service.reply('DOM.resolveNode', {object: {objectId: 'obj-body'}});
  service.reply('DOM.describeNode', {node: {backendNodeId: 10}});
  service.reply('Accessibility.getFullAXTree', {
    nodes: [
      {nodeId: '1', role: {value: 'RootWebArea'}, name: {value: 'Example'}, childIds: ['2', '3'], backendDOMNodeId: 10},
      {nodeId: '2', ignored: true, role: {value: 'none'}, name: {value: ''}, childIds: ['4'], parentId: '1'},
      {nodeId: '3', role: {value: 'StaticText'}, name: {value: 'Hello world'}, childIds: [], parentId: '1'},
      {nodeId: '4', role: {value: 'button'}, name: {value: 'Sign "in"'}, childIds: [], parentId: '2'},
      {nodeId: '6', role: {value: 'generic'}, name: {value: '   '}, childIds: [], parentId: '1'},
    ],
  });
  assert.equal(await page.locator('body').ariaSnapshot(), [
    '- RootWebArea "Example"',
    '  - button "Sign \\"in\\""',
    '  - text: Hello world',
  ].join('\n'), 'depth-first order, ignored nodes passed through');
});

test('ariaSnapshot stops at the node and character caps', async () => {
  const {service, page} = await openPage();
  service.reply('DOM.getDocument', {root: {nodeId: 1}});
  service.reply('DOM.querySelector', {nodeId: 5});
  service.reply('DOM.resolveNode', {object: {objectId: 'obj-body'}});
  service.reply('DOM.describeNode', {node: {backendNodeId: 10}});
  const many = Array.from({length: 900}, (_, index) => ({nodeId: `n${index}`, role: {value: 'button'}, name: {value: `b${index}`}, childIds: [], parentId: 'root'}));
  service.reply('Accessibility.getFullAXTree', {
    nodes: [{nodeId: 'root', role: {value: 'RootWebArea'}, name: {value: 'big'}, childIds: many.map(node => node.nodeId), backendDOMNodeId: 10}, ...many],
  });
  const long = await page.locator('body').ariaSnapshot();
  const lines = long.split('\n');
  assert.equal(lines.length, 601, '600 nodes plus the truncation marker');
  assert.equal(lines.at(-1), '- ... (truncated)');

  const wide = Array.from({length: 40}, (_, index) => ({nodeId: `w${index}`, role: {value: 'button'}, name: {value: 'x'.repeat(900)}, childIds: [], parentId: 'root'}));
  service.reply('Accessibility.getFullAXTree', {
    nodes: [{nodeId: 'root', role: {value: 'RootWebArea'}, name: {value: 'wide'}, childIds: wide.map(node => node.nodeId), backendDOMNodeId: 10}, ...wide],
  });
  const chars = await page.locator('body').ariaSnapshot();
  assert.ok(chars.length <= 20000, `snapshot stayed under the character cap (${chars.length})`);
  assert.match(chars, /\(truncated\)$/);
});

test('screenshot masks credentials, clips to the CSS viewport and always unmasks', async () => {
  const {service, page} = await openPage();
  service.reply('Page.captureScreenshot', {data: Buffer.from('jpeg-bytes').toString('base64')});
  const shot = await page.screenshot({type: 'jpeg', quality: 62.4});
  assert.ok(Buffer.isBuffer(shot));
  assert.equal(shot.toString(), 'jpeg-bytes');

  const capture = service.last('Page.captureScreenshot');
  assert.equal(capture.params.format, 'jpeg');
  assert.equal(capture.params.quality, 62);
  assert.deepEqual(capture.params.clip, {x: 0, y: 0, width: 1280, height: 800, scale: 1}, 'the default CSS viewport');

  await page.setViewportSize({width: 900.6, height: 640});
  assert.deepEqual(page.setViewportSize({width: 900, height: 640}), {width: 900, height: 640});
  await page.screenshot({type: 'png'});
  const png = service.last('Page.captureScreenshot');
  assert.equal(png.params.format, 'png');
  assert.equal('quality' in png.params, false, 'PNG has no quality');
  assert.deepEqual(png.params.clip, {x: 0, y: 0, width: 900, height: 640, scale: 1});

  const order = service.calls.map(call => call.method);
  const inject = service.all('Runtime.evaluate')[0];
  assert.match(inject.params.expression, /__dsh_browser_mask__/);
  assert.match(inject.params.expression, /input\[type=password\],input\[autocomplete=one-time-code\]/);
  assert.match(inject.params.expression, /background:#000/);
  assert.ok(order.indexOf('Runtime.evaluate') < order.indexOf('Page.captureScreenshot'), 'masking precedes the capture');
  assert.ok(order.lastIndexOf('Runtime.evaluate') > order.indexOf('Page.captureScreenshot'), 'the mask is removed afterwards');
  assert.match(service.all('Runtime.evaluate').at(-1).params.expression, /remove\(\)/);

  service.reply('Page.captureScreenshot', () => { throw new Error('BROWSER_VIEW_CDP_DENIED'); });
  await assert.rejects(page.screenshot(), /BROWSER_VIEW_CDP_DENIED/);
  assert.match(service.all('Runtime.evaluate').at(-1).params.expression, /remove\(\)/, 'a failed capture still unmasks');
});

test('mouse and keyboard are dispatched as CSS-pixel CDP input events', async () => {
  const {service, page} = await openPage();
  await page.mouse.click(10.4, 20.6);
  assert.deepEqual(service.all('Input.dispatchMouseEvent').map(call => call.params.type), ['mouseMoved', 'mousePressed', 'mouseReleased']);
  for (const call of service.all('Input.dispatchMouseEvent')) {
    assert.ok(Number.isInteger(call.params.x) && Number.isInteger(call.params.y), 'coordinates are whole CSS pixels');
  }
  assert.deepEqual(service.last('Input.dispatchMouseEvent').params, {
    type: 'mouseReleased', x: 10, y: 21, button: 'left', buttons: 0, clickCount: 1, modifiers: 0,
  });

  await page.mouse.move(5, 6);
  await page.mouse.down();
  assert.equal(service.last('Input.dispatchMouseEvent').params.buttons, 1);
  await page.mouse.up();
  assert.equal(service.last('Input.dispatchMouseEvent').params.buttons, 0);

  await page.mouse.wheel(0, 120);
  assert.deepEqual(service.last('Input.dispatchMouseEvent').params, {
    type: 'mouseWheel', x: 5, y: 6, button: 'none', buttons: 0, clickCount: 0, modifiers: 0, deltaX: 0, deltaY: 120,
  });
  await assert.rejects(page.mouse.click(Number.NaN, 1), /BROWSER_INVALID_POINT/);

  await page.keyboard.insertText('héllo');
  assert.deepEqual(service.last('Input.insertText').params, {text: 'héllo'});
  await page.keyboard.press('Enter');
  assert.deepEqual(service.last('Input.dispatchKeyEvent').params, {
    type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 0,
  });
  const enter = service.all('Input.dispatchKeyEvent').find(call => call.params.type === 'keyDown');
  assert.deepEqual(enter.params, {
    type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 0, text: '\r',
  });
  await page.keyboard.press('Control+A');
  assert.deepEqual(service.last('Input.dispatchKeyEvent').params, {
    type: 'keyUp', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2,
  });
  await page.keyboard.press('PageDown');
  assert.equal(service.last('Input.dispatchKeyEvent').params.windowsVirtualKeyCode, 34);
});

test('console, page errors and dialogs reach the page listeners', async () => {
  const {service, page, cdp} = await openPage();
  const messages = [];
  const errors = [];
  const dialogs = [];
  page.on('console', message => messages.push(message));
  page.on('pageerror', error => errors.push(error));
  page.on('dialog', dialog => dialogs.push(dialog));

  cdp('Runtime.consoleAPICalled', {type: 'warning', args: [{type: 'string', value: 'careful'}, {type: 'number', value: 3}]});
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type(), 'warning');
  assert.equal(messages[0].text(), 'careful 3');

  cdp('Runtime.exceptionThrown', {exceptionDetails: {text: 'Uncaught', exception: {description: 'Error: boom\n    at <anonymous>:1:1'}}});
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Error: boom');

  cdp('Page.javascriptDialogOpening', {type: 'alert', message: 'hi'});
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].message, 'hi');
  assert.deepEqual(service.last('Page.handleJavaScriptDialog').params, {accept: false}, 'a dialog never blocks the page');

  service.dispatch({type: 'cdp', id: 'someone-else', method: 'Runtime.consoleAPICalled', params: {type: 'log', args: []}});
  assert.equal(messages.length, 1, 'another view never leaks into this page');
});

test('frames, titles, load and lifecycle events map onto the page surface', async () => {
  const {service, page, cdp, viewId} = await openPage();
  const frames = [];
  const loads = [];
  const closes = [];
  page.on('framenavigated', frame => frames.push(frame));
  page.on('load', () => loads.push(true));
  page.on('close', () => closes.push(true));

  cdp('Page.frameNavigated', {frame: {id: 'F2', url: 'https://advert.test/', parentId: 'F1'}});
  assert.equal(frames.length, 0, 'a subframe is not the page');
  cdp('Page.frameNavigated', {frame: {id: 'F1', url: 'https://example.test/x'}});
  assert.equal(frames.length, 1);
  assert.equal(frames[0], page.mainFrame(), 'the callback carries the stable main-frame object');
  assert.equal(page.url(), 'https://example.test/x');

  service.reply('Runtime.evaluate', {result: {type: 'string', value: 'from the DOM'}});
  assert.equal(await page.title(), 'from the DOM');
  service.dispatch({type: 'navigated', id: viewId, url: 'https://example.test/y'});
  assert.equal(page.url(), 'https://example.test/y');
  service.dispatch({type: 'title', id: viewId, title: 'Example'});
  assert.equal(await page.title(), 'Example');

  cdp('Page.loadEventFired', {timestamp: 2});
  assert.equal(loads.length, 1);
  cdp('Page.frameNavigated', {frame: {id: 'F1', url: 'https://example.test/z'}});
  assert.equal(frames.length, 2);

  service.dispatch({type: 'closed', id: viewId, reason: 'closed'});
  assert.deepEqual(closes, [true]);
  cdp('Page.loadEventFired', {timestamp: 3});
  service.dispatch({type: 'navigated', id: viewId, url: 'https://example.test/late'});
  assert.equal(loads.length, 1, 'a closed view reports nothing more');
  await assert.rejects(page.evaluate('1 + 1'), /BROWSER_PAGE_CLOSED/);
});

test('the origin policy refuses everything outside http(s) and the allow list', async () => {
  const {service, page, cdp} = await openPage({allowedOrigins: ['https://allowed.test']});
  assert.deepEqual(service.last('createView').params, {
    id: service.last('createView').id, owner: 'session-1', url: 'about:blank', allowOrigins: ['https://allowed.test'],
  });
  await assert.rejects(page.goto('file:///etc/passwd'), /BROWSER_HTTP_URL_REQUIRED/);
  await assert.rejects(page.goto('javascript:alert(1)'), /BROWSER_HTTP_URL_REQUIRED/);
  await assert.rejects(page.goto('https://other.test/'), /BROWSER_ORIGIN_DENIED/);
  assert.equal(service.all('Page.navigate').length, 0, 'a refused address never reaches the view');

  const blank = page.goto('about:blank');
  await tick();
  assert.deepEqual(service.last('Page.navigate').params, {url: 'about:blank'});
  loaded(cdp);
  await blank;

  const {page: free, service: freeService, cdp: freeCdp} = await openPage();
  const allowed = free.goto('https://anything.test/');
  await tick();
  assert.deepEqual(freeService.last('Page.navigate').params, {url: 'https://anything.test/'});
  loaded(freeCdp);
  await allowed;
});

test('locators and role lookups share one element surface', async () => {
  const {service, page, cdp} = await openPage();
  service.reply('DOM.getDocument', {root: {nodeId: 1}});
  service.reply('DOM.querySelector', {nodeId: 42});
  service.reply('DOM.resolveNode', {object: {objectId: 'obj-42'}});
  service.reply('DOM.requestNode', {nodeId: 42});
  service.reply('DOM.getBoxModel', {model: {border: [10, 20, 110, 20, 110, 60, 10, 60]}});
  service.reply('Runtime.callFunctionOn', {result: {type: 'string', value: 'answer'}});

  const locator = page.locator('#name');
  assert.deepEqual(await locator.boundingBox(), {x: 10, y: 20, width: 100, height: 40});
  await locator.click();
  const pressed = service.all('Input.dispatchMouseEvent').find(call => call.params.type === 'mousePressed');
  assert.deepEqual({x: pressed.params.x, y: pressed.params.y}, {x: 60, y: 40}, 'the click lands on the box centre');
  assert.ok(service.all('DOM.scrollIntoViewIfNeeded').length >= 1);

  await locator.fill('typed');
  const call = service.last('Runtime.callFunctionOn');
  assert.deepEqual(call.params.arguments, [{value: 'typed'}]);
  assert.match(call.params.functionDeclaration, /new Event\('input'/);
  assert.equal(call.params.returnByValue, true);
  assert.equal(await locator.getAttribute('data-x'), 'answer');

  service.reply('DOM.getBoxModel', {});
  assert.equal(await locator.boundingBox(), null, 'an unrendered element has no box');

  service.reply('Accessibility.getFullAXTree', {
    nodes: [
      {nodeId: '1', role: {value: 'RootWebArea'}, name: {value: 'Page'}, childIds: ['2'], backendDOMNodeId: 10},
      {nodeId: '2', role: {value: 'button'}, name: {value: 'Sign in'}, childIds: [], parentId: '1', backendDOMNodeId: 77},
    ],
  });
  service.reply('DOM.getBoxModel', {model: {border: [0, 0, 20, 0, 20, 10, 0, 10]}});
  await page.getByRole('button', {name: 'sign in'}).click();
  assert.deepEqual(service.last('DOM.resolveNode').params, {backendNodeId: 77});
  const roleClick = service.all('Input.dispatchMouseEvent').at(-1);
  assert.deepEqual({x: roleClick.params.x, y: roleClick.params.y}, {x: 10, y: 5});
  await assert.rejects(page.getByRole('link', {name: 'Sign in'}).boundingBox(), /BROWSER_UNKNOWN_ROLE/);

  void cdp;
});

test('the context surface owns popups, policy no-ops and teardown', async () => {
  const service = fakeService();
  const backend = createNativeBackend({service, config: {owner: 'session-7'}});
  const {context} = backend;
  const popups = [];
  const contextCloses = [];
  context.on('page', popup => popups.push(popup));
  context.on('close', () => contextCloses.push(true));

  const page = await context.newPage();
  const viewId = service.last('createView').id;
  assert.equal(service.events, 1, 'one subscription serves every view');

  await context.clearPermissions();
  await context.route('**/*', () => {});
  await assert.rejects(context.newCDPSession(page), /BROWSER_SCREENCAST_UNAVAILABLE/);

  service.dispatch({type: 'window-open', id: viewId, url: 'https://example.test/popup'});
  await tick();
  assert.equal(popups.length, 1, 'a window the site opened becomes a page of this context');
  assert.equal(service.last('createView').params.url, 'https://example.test/popup');
  assert.equal(service.last('createView').params.owner, 'session-7');
  assert.equal(popups[0].url(), 'about:blank');

  const pageCloses = [];
  page.on('close', () => pageCloses.push(true));
  await page.close();
  assert.deepEqual(pageCloses, [true]);
  assert.equal(service.last('close').id, viewId);

  await context.close();
  assert.deepEqual(service.closedOwners, ['session-7']);
  assert.equal(service.events, 0, 'the backend releases its subscription');
  assert.deepEqual(contextCloses, [true]);
  await backend.close();
  assert.deepEqual(service.closedOwners, ['session-7'], 'teardown is idempotent');
  await assert.rejects(context.newPage(), /BROWSER_DISPOSED/);
});

test('a crashed view reports its reason and still closes the page', async () => {
  const events = [];
  const service = fakeService();
  const backend = createNativeBackend({service, config: {owner: 'session-9'}, emit: event => events.push(event)});
  const page = await backend.context.newPage();
  const closes = [];
  page.on('close', () => closes.push(true));
  service.dispatch({type: 'closed', id: service.last('createView').id, reason: 'crashed'});
  assert.deepEqual(closes, [true]);
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, 'crashed');
  assert.equal(events[0].viewId, service.last('createView').id);
  await backend.close();
});

test('the backend places the view the pane shows and hides every other view', async () => {
  const {service, backend, context, page, viewId} = await openPage();
  const second = await context.newPage();
  const secondId = service.last('createView').id;
  assert.notEqual(secondId, viewId, 'each tab is its own guest view');
  const bounds = {x: 704, y: 70, width: 576, height: 458};

  await backend.setViewport({bounds, zoom: 576 / 1280, visible: true}, page);
  assert.deepEqual(service.last('setBounds').params, bounds);
  assert.deepEqual(service.last('setZoom').params, {factor: 576 / 1280});
  assert.deepEqual(service.last('setVisible').params, {visible: true});
  assert.equal(service.last('setVisible').id, viewId);

  // A tab switch moves the one visible view, and the previous page goes first
  // so a stale page can never stay on top of the new one.
  await backend.setViewport({bounds, zoom: 1, visible: true}, second);
  assert.deepEqual(service.all('setVisible').map(call => [call.id, call.params.visible]), [[viewId, true], [viewId, false], [secondId, true]]);

  await backend.setViewport({bounds, zoom: 1, visible: false}, second);
  assert.deepEqual(service.last('setVisible').params, {visible: false});

  // A page this backend never created places nothing at all.
  await backend.setViewport({bounds, zoom: 1, visible: true}, {});
  assert.equal(service.all('setBounds').length, 2, 'an unknown page is ignored');
  await backend.close();
});

# DSH Browser Plugin

`dsh-plugin-browser` provides a Session-isolated Chromium browser for the DeepSeek Harness Web app, with the same page rendered in the right Sidebar:

- The `browser` tool runs Playwright Chromium in a Session-scoped context for automation, accessibility snapshots, and screenshots.
- The `Browser` page in the Web right Sidebar uses the official Sidebar extension API to stream that same page live and forward pointer, keyboard, navigation, and scroll input.
- The pane is organized like a real browser: a tab strip, Back and Forward, Stop, an address bar, a tools menu, and a context menu, with tab count and load state following the Agent's actions.
- The same page moves between the Sidebar tab and a whole-window panel in the main area through the toolbar's window group, which offers `Open in the main area` and `Return to the Sidebar`; both surfaces share tabs, the visit log, and the picture, while each keeps its own zoom and layout choice.
- Focusing the address field opens `Visited pages`, listing the pages this Session has visited, newest first; a row returns to that page, and an empty log shows a placeholder.
- The stream carries operation cues: Agent actions leave a mouse pointer with a caption, hovering outlines the element with its role and name, a focused field shows an outline and caret, and typed text echoes briefly.
- Layout switches between a desktop viewport and the Sidebar width, with zoom steps. Click, drag, scroll, double-click to select, paste, use an IME, and press Tab, arrows, or paging keys directly on the frame.
- On a host that owns its window through an Electron main process, such as DSH Desktop, the pane instead reports where the page goes, how far it is zoomed and whether it is on screen, and a native view carries the real page: no encoding, no frame stream, text at native resolution, and pointer and keyboard input that reaches the page directly. Any failure falls back to the streaming pane.

The tool and Sidebar share cookies, storage, login state, and page history. Host automation remains headless by default while the Sidebar provides the visible surface. Enter passwords and MFA codes manually in the Sidebar; the tool never exports credentials.

## Host support

- Both hosts use one package, `dsh-plugin-browser`; there is no desktop-only package.
- Web: the right Sidebar `Browser` page streams the Session-isolated Chromium page over a CDP screencast.
- Desktop: when the host provides the `desktopNativeBrowser` service, the same pane instead reports the page's position, zoom, and visibility to the host, and a native view in the Electron main process carries the page — no encoded stream, native resolution, pointer and keyboard input reaching the page directly. A missing service or a failure falls back to the streaming pane.
- The desktop-only capability is probed at runtime with `ctx.get?.('desktopNativeBrowser')` and stays out of the top-level `inject`, so an ordinary Web host loads the plugin as usual; this follows the ["Compatible with Desktop and plain DSH"](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md) pattern of the anywhere-labs/dsh-desktop plugin guide.
- Verification: the desktop side is measured on a live DSH Desktop instance (2026-09-15: the agent's `browser` tool opening a page and reading back its title and accessibility snapshot, the geometry and zoom of both the Sidebar and main-area surfaces, and the visibility while the pane menu is open); on the Web side 42 of 44 acceptance checks pass, and the other two need `BROWSER_TEST_EXECUTABLE` pointing at a local Chrome.
- The desktop side keeps no separate repository; one implementation in this repository serves both hosts.

## Feature screenshot

![Browser page in the right Sidebar](docs/screenshots/right-sidebar-browser.png)

Figure: validation capture of a local fixture page inside the DSH Web right Sidebar, showing the focus outline, element caption, typed-text echo, and mouse pointer; see [`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md) for provenance and validation boundaries.

![Tab strip and tools menu of the right Sidebar browser](docs/screenshots/right-sidebar-browser-tabs.png)

Figure: the same pane with its tab strip, Back and Forward state, address bar, and the tools menu carrying the zoom steps and the `Fit Sidebar width` option.

## Install

Node.js 22.19 or later and Chromium runtime dependencies are required. Use the same `DSH_HOME` when installing and starting Harness.

```sh
git clone https://github.com/hzxwonder-dsh-plugins/dsh-plugin-browser.git
cd dsh-plugin-browser
npm ci
npm run browser:install
dsh plugin --profile migration add "file:$PWD"
```

Keep the `file:` prefix so pnpm installs the package's declared dependencies. A
bare path is treated as `link:` and only links the plugin directory.

Restart Harness after changing the plugin configuration. Host automation is headless by default; an existing Chrome binary can be selected:

```yaml
- id: dsh-plugin-browser
  config:
    executablePath: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
    headless: true
```

Keep `headless: true` and use `Browser` in the right Sidebar for inspection or manual password/MFA entry. Each Session receives an ephemeral BrowserContext, with at most eight Sessions at once. Login state is cleared by `close` or Harness shutdown.

`allowedOrigins` limits the sites the browser may reach; an omitted or empty list leaves every origin reachable:

```yaml
- id: dsh-plugin-browser
  config:
    allowedOrigins:
      - https://example.com
      - https://intranet.example.com:8443
```

Entries match the normalized origin exactly (scheme, host, and port; a path or query is ignored), and an entry that is not an HTTP(S) address — or a value that is not a list — fails at plugin load.

## Right Sidebar browser

After the Web client extension is installed, the right Sidebar registers a `Browser` page:

1. Open the Harness Web right Sidebar and select `Browser`. A tool navigation opens it automatically.
2. Enter an HTTP(S) address in the address bar and press Enter; a tool navigation drives the same page. Focusing the address field opens `Visited pages`, newest first; a row returns to a page this Session has visited, and an empty log shows a placeholder.
3. The toolbar is grouped into navigation, address, view, and window: Back, Forward, and Reload or Stop in the navigation group; the address field with its Enter `Go` in the address group; the `⋯` tools menu with the `Compatibility view` note in the view group; and the move between the two surfaces with `Close browser` in the window group. The error row is its own line with a `×` to dismiss it.
4. `Open in the main area` in the window group lays the same page out as a panel in the main area, and `Return to the Sidebar` on that panel puts it back into the Sidebar tab: both surfaces are the same page of one Session and share tabs, the visit log, and the picture, while each keeps its own zoom and layout choice.
5. Manage pages in the tab strip: `+` opens a tab, a tab click switches, and `×` closes. A window the site opens becomes a managed tab instead of being lost; a Session holds at most 12 tabs, so `+` is refused at that limit and a page the site opens past it is closed.
6. Back and Forward enable or disable from the active tab's history; while a page loads the reload button becomes Stop, which ends a slow load. Click the frame to operate the page: the clicked point shows a ripple and pointer, and a focused field shows its outline and caret.
7. Typing reaches the focused element; paste, drag, and scroll work the same way. `Ctrl/Cmd+C` copies the page selection into the system clipboard, and the context menu offers Copy, Paste, and Select All. While the Agent acts, the frame shows where it clicked or typed and labels the operation.
8. The `⋯` menu switches between `Desktop layout (1280 wide)` and `Fit Sidebar width` and offers Zoom In, Zoom Out, and Reset to 100%. Desktop layout keeps the page as a wide screen renders it; fitting the Sidebar uses the Sidebar width as the page width, which suits reading in a narrow pane.

The page accepts credential-free HTTP(S) addresses and streams Chromium through the authenticated Host interface, including sites that deny iframe embedding; the Sidebar tab and the main-area panel are the same page, and only the visible one requests frames. Frames arrive as CDP events, so a still page costs no traffic and actions update immediately; a two-second heartbeat reports whether frames are still produced, and the pane marks the picture paused once they stop. When the stream is unavailable the pane falls back to one-shot captures, marks the toolbar `Compatibility view`, and keeps retrying. Human input is stored as a fraction of the picture, so a layout or zoom change never moves a click elsewhere. User input invalidates the tool observation; take another snapshot before tool input. Audio/video streaming, downloads, and credential export are unavailable.

## Desktop native surface

On a host that owns its window through an Electron main process, such as DSH Desktop, the same page can be carried by a native view and drawn by the window compositor. The host picks the transport when the Session's first tab is created and reports it to the client as `transport` in the panel state:

- `native` — the picture comes from the compositor: no encoding, no frame stream, no canvas. Text is drawn at native resolution, pointer and keyboard input reach the page directly, and the pane forwards no input of its own.
- `screencast` — the streaming pane of today. The Web GUI, a remote Host, a read-only Session, and any native failure stay on, or fall back to, this one.

Under native transport the pane owns only the hole: it measures the rectangle the native view should fill (CSS pixels, relative to the renderer viewport), the zoom factor, and whether the page is on screen, coalesces those measurements through `ResizeObserver` and `requestAnimationFrame`, and reports them only when one of them changed. `Fit Sidebar width` hands the whole stage to the page at 100%; `Desktop layout (1280 wide)` reports the rectangle of the picture the pane used to scale into the stage, with the zoom as the hole's width over the logical width, so the zoom steps keep working. A window resize, a collapsing Sidebar, a bottom panel opening or closing, a Session or tab switch, and a move between the Sidebar tab and the main-area panel are all measured again. A tab that is not visible, a surface that has been switched away, a collapsed Sidebar, an open `⋯` tools menu, visit log, or context menu, and an expanded error row are all reported as not visible, so the host takes the native view away instead of leaving the page floating over the pane's own chrome. Any failure tears the native view down and falls back to the stream: the panel never shows two pictures of one page, and tabs, visit log, and page state stay the same page on both surfaces.

## The `browser` tool

Supported actions are `navigate`, `snapshot`, `screenshot`, `click`, `fill`, `press`, `scroll`, `tabs`, `console`, `evaluate`, and `close`. `tabs` takes an `op` of `list`, `new`, `select`, or `close` plus a `tab` id; `list` is a pure read, while switching or closing a tab invalidates the older observation.

Navigate or take a snapshot first, then pass the latest `observation` plus the exact accessible `role` and `name` to an input action. Re-observe after a page change. A purely visual target with no accessible name can be clicked at its observed coordinates:

```json
{"action":"click","x":420,"y":180,"observation":5}
```

`press` forwards a fixed key set (Enter, Tab, Shift+Tab, Esc, Backspace, Delete, Insert, arrows, Home, End, PageUp, PageDown, F5, and Ctrl/Cmd combinations); use `fill` for printable text. `evaluate` accepts only fixed inspections: `title`, `visible_text`, `links`, and `layout`; it does not run arbitrary JavaScript.

Example:

```json
{"action":"navigate","url":"http://127.0.0.1:3000"}
```

```json
{"action":"snapshot"}
```

```json
{"action":"fill","role":"textbox","name":"Project name","text":"demo","observation":3}
```

`screenshot` returns a Harness attachment and masks password and one-time-code fields. Output receives limited redaction for token, cookie, and authorization fields; this is not a complete data-loss-prevention system.

## Authority and data boundaries

- Navigation is limited to HTTP(S), including localhost; `file:`, `data:`, `javascript:`, and credential-bearing URLs are rejected.
- With `allowedOrigins` configured, only top-level navigation to a listed origin is admitted: `navigate` fails with `BROWSER_ORIGIN_DENIED`, and a site-driven redirect or script is caught when it commits and sent back to a blank page, while sub-resources keep the HTTP(S) scheme policy.
- A `read-only` sandbox permits observation but rejects `click`, `fill`, and `press`; hover cues and reading the visit log stay available.
- Passwords and MFA codes are entered manually by the user in a visible browser; the plugin has no credential-export action.
- Page text, URLs, console output, and screenshots can contain private data and enter Session records or model context. Treat page content as untrusted task data.
- The visit log lives in memory per Session, records HTTP(S) pages only, is deduplicated by URL with the newest first, and holds at most 256 records.
- Downloads, Service Workers, arbitrary script execution, and cross-Session reuse are not exposed. Permission requests from a page are refused.
- A Session holds at most 12 tabs: an explicit new tab past that limit fails with `BROWSER_TAB_LIMIT` instead of evicting an open tab, and a page the site opens past it is closed.

The browser process uses the host's network authority. A signed-in click can change an external system, so confirm the target and authorization before acting.

## Verify

```sh
npm test
# Optional: use an existing Chrome binary
BROWSER_TEST_EXECUTABLE=/path/to/chrome npm test
```

The tests start a local HTTP fixture and cover navigation, form input, stale-observation rejection, console output, screenshots, fixed inspections, Session isolation, and the Sidebar stream with its frame, pointer, focus, drag, and coordinate-click events. The same suite covers opening, switching, and closing tabs, a site popup becoming a tab, history state for Back and Forward, stopping a slow load, and reading the page selection. Normalizing and enforcing `allowedOrigins`, recording the visit log with its deduplication and bound, and the tab limit with an over-limit popup are covered as well. `test/client-native.test.js` renders the real client against a stub of the plugin API and covers the geometry, zoom, and visibility it reports under native transport, plus the return to streaming, without needing a host. Harness Web Sidebar activation and native attachment rendering are separate integration checks; see [`docs/e2e.md`](docs/e2e.md).

## Development docs

- [`docs/spec.md`](docs/spec.md): tool and right-Sidebar page contract.
- [`docs/e2e.md`](docs/e2e.md): browser-engine and Web integration scenarios.
- [`README.md`](README.md): 中文主文档。

## License and provenance

LGPL-3.0-only. The implementation uses the official DeepSeek Harness client extension APIs and follows the PI-Desktop browser interaction contract. Attribution is recorded in [`NOTICE`](NOTICE); dependencies retain their own licenses.

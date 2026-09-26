window.__ModuleLoader__.load({
	id: "dsh-claude-code-relay",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } = react;
		//#region src/client/ClaudeCodeRelaySettings.js
		/** Plugin-owned "Claude Code" page inside the dsh Settings shell: fills the relay endpoint,
		 *  key and behavior fields into the plugin's settings namespace. Writes go through the shared
		 *  settingsScope service, so a save lands in dsh's user settings document and the host-side
		 *  namespace watcher adopts it live — no restart, no config-file editing. */
		const NS = "settings.claude-code-relay";
		const NAMESPACE = "claude-code-relay";
		// The host's same-origin route that reports the relay's model list. Must match MODELS_PATH
		// in src/index.js.
		const MODELS_PATH = "/dsh-claude-code-relay/models";
		// The host's approval bridge. Must match APPROVALS_PATH in src/index.js.
		const APPROVALS_PATH = "/dsh-claude-code-relay/approvals";
		/** How often the page asks the bridge for pending tool calls. A tool call blocks the CLI
		 *  until it is answered, so this stays short; it is a local HTTP request, not a model call. */
		const APPROVAL_POLL_MS = 1000;

		const zh = {
			nav: "Claude Code",
			title: "Claude Code 中转站",
			subtitle: "通过 base_url + api_key 驱动 Claude Code CLI，模型流量走你的中转站。保存后即时生效，无需重启 dsh。",
			connection: "连接",
			behavior: "运行",
			advanced: "高级",
			baseUrl: "中转站地址 (base_url)",
			baseUrlHint: "Claude Code 会请求 <base_url>/v1/messages，例如 https://relay.example.com",
			baseUrlPlaceholder: "https://relay.example.com",
			apiKey: "API Key",
			apiKeyHint: "仅写入 dsh 的用户设置并脱敏存储，页面不会回显已保存的值",
			apiKeyPlaceholderSet: "已配置 — 输入新值可覆盖，留空保持不变",
			apiKeyPlaceholderUnset: "sk-...",
			apiKeySave: "保存 Key",
			apiKeyClear: "清除 Key",
			authHeader: "鉴权方式",
			authToken: "Bearer (auth-token)",
			apiKeyHeader: "x-api-key (api-key)",
			authHeaderHint: "大多数 new-api / one-api 中转站用 Bearer；遇 401 再试 x-api-key",
			autoModels: "自动获取模型列表",
			autoModelsHint: "从中转站的 /v1/models 读取模型；取不到时使用下方手填列表",
			models: "模型列表（备用）",
			modelsHint: "每行一个：模型id | 显示名 | 上下文窗口 | 压缩触发窗口（后三列可省略；数字列按 token 计），# 开头的行为注释",
			modelsPlaceholder: "claude-sonnet-4-5 | Claude Sonnet 4.5 | 200000 | 140000",
			command: "CLI 命令",
			commandHint: "Claude Code 可执行文件：PATH 上的名字或绝对路径",
			configDir: "CLAUDE_CONFIG_DIR",
			configDirHint: "留空用默认 ~/.claude；设置后本插件的 Claude 会话与你自己的隔离",
			permissionMode: "权限模式",
			permissionModeHint: "dsh 表示跟随会话的访问盾：只读会话放行读取类工具、拒绝写入类，工作区写入→acceptEdits，完全访问→bypassPermissions",
			resume: "会话续接",
			resumeHint: "每个 dsh 会话对应一个 Claude Code 会话，上下文跨轮次保留",
			resident: "常驻进程",
			residentHint: "每个会话复用一个常驻 CLI 进程，跨轮次免去每次启动；关闭后每轮独立启动一次",
			toolActivity: "显示工具活动",
			toolActivityHint: "把 Claude Code 的工具调用与结果以推理行显示在聊天里",
			systemPrompt: "转发辅助系统提示",
			systemPromptHint: "会话标题等辅助调用通过 --append-system-prompt 携带提示",
			debug: "调试日志",
			debugHint: "在日志里记录每次 spawn 的参数（不含提示词）",
			contextWindow: "上下文窗口",
			idleTimeoutMs: "空闲超时 (毫秒)",
			maxTurns: "最大轮数 (0 = CLI 默认)",
			extraEnv: "额外环境变量",
			extraEnvHint: "每行一个 KEY=VALUE，覆盖内置值（如 API_TIMEOUT_MS）",
			extraArgs: "额外 CLI 参数",
			extraArgsHint: "每行一个参数，追加到每次 claude -p",
			invalidModels: "模型列表格式有误：每行应为 模型id | 显示名",
			invalidEnv: "环境变量格式有误：每行应为 KEY=VALUE",
			invalidNumber: "数字格式有误，未保存",
			saved: "已保存",
			readOnly: "当前连接下设置不可写",
			notReady: "设置服务尚未就绪",
			picker: "主页显示的模型",
			pickerHint: "勾选要出现在 dsh 模型选择器里的模型；不勾任何一项表示全部显示。未勾选的模型仍可直接调用，只是不出现在选择器里。",
			pickerAll: "当前显示中转站提供的全部模型",
			pickerUnset: "勾选后仅显示所选模型",
			pickerEmpty: "尚未取得模型列表：填写中转站地址与 Key 后保存，再打开本页即可勾选。",
			pickerFailed: "无法从设置页读取模型列表，可直接在下方手填模型列表。",
			approvalSection: "工具审批",
			approvalPending: "等待你的决定",
			approvalBridge: "接管 Claude Code 的工具权限询问",
			approvalBridgeHint: "Claude Code 按自己的规则拦截工具调用；无头运行时没人能回答它，工具就会静默失败。开启后由本插件接管，按下方策略给出决定。",
			approvalMode: "决策方式",
			approvalModeAuto: "跟随访问盾（自动）",
			approvalModeAsk: "每次询问我",
			approvalModeHint: "自动：会话访问盾允许的放行、不允许的拒绝，不打断你。询问：每个被拦截的调用都等待你在下方决定。",
			approvalTimeout: "等待答复上限 (毫秒)",
			approvalTimeoutHint: "「询问」模式下超时未答复即拒绝；不能让它无限期阻塞 Claude Code。",
			approvalAllow: "允许一次",
			approvalDeny: "拒绝",
			approvalNone: "当前没有待决定的工具调用",
			approvalFailed: "答复未能送达，请重试",
			save: "保存",
			discard: "放弃修改",
			unsaved: "有未保存的修改",
			saving: "正在保存…",
		};

		const en = {
			nav: "Claude Code",
			title: "Claude Code Relay",
			subtitle: "Drive the Claude Code CLI with base_url + api_key against your relay station. Saves apply live — no dsh restart needed.",
			connection: "Connection",
			behavior: "Behavior",
			advanced: "Advanced",
			baseUrl: "Relay base URL",
			baseUrlHint: "Claude Code requests <base_url>/v1/messages, e.g. https://relay.example.com",
			baseUrlPlaceholder: "https://relay.example.com",
			apiKey: "API key",
			apiKeyHint: "Stored redacted in dsh's user settings; the page never echoes the saved value",
			apiKeyPlaceholderSet: "Configured — type to replace, leave empty to keep",
			apiKeyPlaceholderUnset: "sk-...",
			apiKeySave: "Save key",
			apiKeyClear: "Clear key",
			authHeader: "Auth style",
			authToken: "Bearer (auth-token)",
			apiKeyHeader: "x-api-key (api-key)",
			authHeaderHint: "Most new-api / one-api relays take Bearer; try x-api-key on 401",
			autoModels: "Fetch model list from the relay",
			autoModelsHint: "Reads the relay's /v1/models; the manual list below is the fallback",
			models: "Model list (fallback)",
			modelsHint: "One per line: model-id | display name (name optional); lines starting with # are comments",
			modelsPlaceholder: "claude-sonnet-4-5 | Claude Sonnet 4.5 | 200000 | 140000",
			command: "CLI command",
			commandHint: "Claude Code binary: a name on PATH or an absolute path",
			configDir: "CLAUDE_CONFIG_DIR",
			configDirHint: "Empty = default ~/.claude; set it to isolate the relay's Claude sessions from your own",
			permissionMode: "Permission mode",
			permissionModeHint: "'dsh' follows the session's access shield: a read-only session allows inspection tools and refuses mutating ones, workspace-write → acceptEdits, full access → bypassPermissions",
			resume: "Session resume",
			resumeHint: "One Claude Code session per dsh session, so context carries across turns",
			resident: "Resident process",
			residentHint: "One long-lived CLI per session, so turns skip the CLI startup; off spawns a fresh CLI per turn",
			toolActivity: "Show tool activity",
			toolActivityHint: "Render Claude Code's tool calls and results as reasoning lines in the chat",
			systemPrompt: "Forward auxiliary system prompts",
			systemPromptHint: "Auxiliary calls such as session titles carry their prompt via --append-system-prompt",
			debug: "Debug logging",
			debugHint: "Log every spawn's arguments (prompt excluded)",
			contextWindow: "Context window",
			idleTimeoutMs: "Idle timeout (ms)",
			maxTurns: "Max turns (0 = CLI default)",
			extraEnv: "Extra environment variables",
			extraEnvHint: "One KEY=VALUE per line; beats built-in values (e.g. API_TIMEOUT_MS)",
			extraArgs: "Extra CLI arguments",
			extraArgsHint: "One argument per line, appended to every claude -p",
			invalidModels: "Malformed model list: expected model-id | display name per line",
			invalidEnv: "Malformed environment: expected KEY=VALUE per line",
			invalidNumber: "Not a valid number; nothing saved",
			saved: "Saved",
			readOnly: "Settings are read-only on this connection",
			notReady: "Settings service is not ready",
			picker: "Models shown at home",
			pickerHint: "Tick the models that should appear in dsh's model picker. Ticking none shows every model. An unticked model stays callable — it is only hidden from the picker.",
			pickerAll: "Showing every model the relay offers",
			pickerUnset: "Only the ticked models will be shown",
			pickerEmpty: "No model list yet: fill in the relay URL and key, save, then reopen this page to tick models.",
			pickerFailed: "The model list could not be read from this page; use the manual model list below.",
			approvalSection: "Tool approval",
			approvalPending: "Waiting for your decision",
			approvalBridge: "Take over Claude Code's tool-permission prompts",
			approvalBridgeHint: "Claude Code gates its own tool calls; a headless run has nobody to answer, so the tool just fails. With this on, the plugin answers instead, using the policy below.",
			approvalMode: "Decision",
			approvalModeAuto: "Follow the access shield (automatic)",
			approvalModeAsk: "Ask me every time",
			approvalModeHint: "Automatic: allow what the session's shield allows, refuse the rest, no interruption. Ask: every gated call waits for your decision below.",
			approvalTimeout: "Answer timeout (ms)",
			approvalTimeoutHint: "In 'ask' mode an unanswered call is denied once this elapses; it must never block Claude Code indefinitely.",
			approvalAllow: "Allow once",
			approvalDeny: "Deny",
			approvalNone: "No tool call is waiting for a decision",
			approvalFailed: "The answer could not be delivered; try again",
			save: "Save",
			discard: "Discard changes",
			unsaved: "Unsaved changes",
			saving: "Saving…",
		};

		const pageStyle = { display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 };
		const sectionStyle = {
			display: "flex", flexDirection: "column", gap: 12,
			border: "1px solid var(--dsh-border, #e5e5e5)", borderRadius: 10, padding: "14px 16px",
		};
		const sectionTitleStyle = { margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.75 };
		const fieldStyle = { display: "flex", flexDirection: "column", gap: 4 };
		const labelStyle = { fontSize: 13, fontWeight: 600 };
		const hintStyle = { fontSize: 12, opacity: 0.6, lineHeight: 1.5 };
		const inputStyle = {
			padding: "7px 10px", borderRadius: 8, fontSize: 13,
			border: "1px solid var(--dsh-border, #d4d4d4)", background: "transparent", color: "inherit",
		};
		const areaStyle = { ...inputStyle, minHeight: 64, resize: "vertical", fontFamily: "inherit" };
		const rowStyle = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
		const checkRowStyle = { display: "flex", alignItems: "flex-start", gap: 8 };
		const buttonStyle = {
			boxSizing: "border-box", minHeight: 34, padding: "6px 14px", borderRadius: 18, fontSize: 14,
			border: "1px solid var(--dsw-alias-border-l2, var(--dsh-border, #d4d4d4))",
			background: "var(--dsw-alias-bg-layer-1, transparent)",
			color: "var(--dsw-alias-label-primary, inherit)",
			font: "inherit", cursor: "pointer",
		};
		const segmentActiveStyle = {
			...buttonStyle,
			borderColor: "var(--dsw-alias-button-primary-fill, var(--dsh-fg, #171717))",
			background: "var(--dsw-alias-button-primary-fill, var(--dsh-fg, #171717))",
			color: "var(--dsw-alias-label-primary-foreground, var(--dsh-bg, #ffffff))",
		};
		const primaryButtonStyle = { ...segmentActiveStyle, fontWeight: 600 };
		/** One waiting tool call: visually separated, because it is blocking something right now. */
		const pendingStyle = {
			display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 8,
			border: "1px solid var(--dsh-border, #e5e5e5)", borderLeft: "3px solid #d97706",
			background: "color-mix(in oklab, #d97706 6%, transparent)",
		};
		// Last block on the page, under every section including tool approval.
		const footerStyle = {
			display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
			paddingTop: 16, marginTop: 4,
			borderTop: "1px solid var(--dsw-alias-border-l2, var(--dsh-border, #e5e5e5))",
		};
		const statusStyle = { fontSize: 12, minHeight: 16 };
		const okStyle = { ...statusStyle, color: "#1a7f37" };
		const errorStyle = { ...statusStyle, color: "#c62828" };

		const h = react.createElement;

		/** One labeled field with an optional hint line under the control. */
		function Field(props) {
			const { label, hint, children } = props;
			return h("div", { style: fieldStyle },
				h("label", { style: labelStyle }, label),
				children,
				hint ? h("div", { style: hintStyle }, hint) : null,
			);
		}

		/** A boolean field rendered as a checkbox with label and hint beside it. */
		function CheckField(props) {
			const { label, hint, checked, disabled, onChange } = props;
			return h("div", { style: checkRowStyle },
				h("input", {
					type: "checkbox", checked: checked === true, disabled,
					onChange: (event) => onChange(event.target.checked),
					style: { marginTop: 2 },
				}),
				h("div", { style: fieldStyle },
					h("label", { style: labelStyle }, label),
					hint ? h("div", { style: hintStyle }, hint) : null,
				),
			);
		}

		/** "id | display name | context | compact" per line (name and the two numbers optional),
		 *  `#` comments skipped; anything without an id, or with a non-positive number, rejects. */
		function parseModels(text) {
			const out = [];
			for (const raw of String(text ?? "").split("\n")) {
				const line = raw.trim();
				if (line === "" || line.startsWith("#")) continue;
				const parts = line.split("|").map((p) => p.trim());
				const id = parts[0];
				if (id === "") return undefined;
				const entry = { id };
				if (parts[1]) entry.name = parts[1];
				const num = (v) => {
					if (v === undefined || v === "") return undefined;
					const n = Number(v);
					return Number.isFinite(n) && n > 0 ? n : NaN;
				};
				const context = num(parts[2]);
				const compact = num(parts[3]);
				if (Number.isNaN(context) || Number.isNaN(compact)) return undefined;
				if (context !== undefined) entry.context = context;
				if (compact !== undefined) entry.compact = compact;
				out.push(entry);
			}
			return out;
		}

		/** KEY=VALUE per line into an object; a line without `=` rejects the whole draft. */
		function parseEnv(text) {
			const out = {};
			for (const raw of String(text ?? "").split("\n")) {
				const line = raw.trim();
				if (line === "") continue;
				const at = line.indexOf("=");
				if (at <= 0) return undefined;
				out[line.slice(0, at).trim()] = line.slice(at + 1);
			}
			return out;
		}

		/** The string view of a resolved settings value, used as the form's draft. */
		function draftsOf(value) {
			const v = value ?? {};
			return {
				baseUrl: v.baseUrl ?? "",
				authHeader: v.authHeader ?? "auth-token",
				autoModels: v.autoModels !== false,
				models: (v.models ?? []).map((m) => {
					const cols = [m?.id ?? "", m?.name ?? "", m?.context ?? "", m?.compact ?? ""];
					while (cols.length > 1 && String(cols[cols.length - 1]) === "") cols.pop();
					return cols.join(" | ");
				}).join("\n"),
				visibleModels: (v.visibleModels ?? []).join("\n"),
				command: v.command ?? "claude",
				configDir: v.configDir ?? "",
				contextWindow: String(v.contextWindow ?? 200000),
				permissionMode: v.permissionMode ?? "dsh",
				resume: v.resume !== false,
				resident: v.resident !== false,
				maxTurns: String(v.maxTurns ?? 0),
				idleTimeoutMs: String(v.idleTimeoutMs ?? 1800000),
				toolActivity: v.toolActivity !== false,
				approvalBridge: v.approvalBridge !== false,
				approvalMode: v.approvalMode ?? "auto",
				approvalTimeoutMs: String(v.approvalTimeoutMs ?? 120000),
				systemPrompt: v.systemPrompt !== false,
				extraEnv: Object.entries(v.extraEnv ?? {}).map(([k, val]) => `${k}=${val}`).join("\n"),
				extraArgs: (v.extraArgs ?? []).join("\n"),
				debug: v.debug === true,
			};
		}

		/** Every draft field the bottom Save button commits, as [draftKey, settingsKey, coerce].
		 *  Fields absent here are written by their own control (the API key), derived at commit
		 *  time (the model list), or edited elsewhere in dsh. */
		const SAVED_FIELDS = [
			["baseUrl", "baseUrl", (raw) => raw],
			["authHeader", "authHeader", (raw) => raw],
			["autoModels", "autoModels", (raw) => raw === true],
			["command", "command", (raw) => raw],
			["configDir", "configDir", (raw) => raw],
			["permissionMode", "permissionMode", (raw) => raw],
			["resume", "resume", (raw) => raw === true],
			["resident", "resident", (raw) => raw === true],
			["toolActivity", "toolActivity", (raw) => raw === true],
			["approvalBridge", "approvalBridge", (raw) => raw === true],
			["approvalMode", "approvalMode", (raw) => raw],
			["systemPrompt", "systemPrompt", (raw) => raw === true],
			["debug", "debug", (raw) => raw === true],
		];

		/** Numeric draft fields: committed as integers, and an unparseable value rejects the whole
		 *  save rather than silently writing a default. */
		const NUMBER_FIELDS = [
			["contextWindow", "contextWindow"],
			["idleTimeoutMs", "idleTimeoutMs"],
			["maxTurns", "maxTurns"],
			["approvalTimeoutMs", "approvalTimeoutMs"],
		];

		/** Draft text and a saved list compared as sets: picker order follows the relay's own list,
		 *  so ticking the same models in a different order is not a change worth writing. */
		function sameSet(draftText, saved) {
			const draft = String(draftText ?? "")
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line !== "");
			const have = new Set(saved ?? []);
			if (draft.length !== have.size) return false;
			return draft.every((id) => have.has(id));
		}

		function RelaySettings(props) {
			const { t, scope, mirror } = props;
			const snap = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
			const ready = snap?.status === "ready";
			const writable = snap?.writable === true;
			const resolved = snap?.value;

			const [draft, setDraft] = useState(() => draftsOf(undefined));
			const [error, setError] = useState("");
			const [savedAt, setSavedAt] = useState(0);
			const [busy, setBusy] = useState(false);
			const [apiKeyDraft, setApiKeyDraft] = useState("");
			const [apiKeySet, setApiKeySet] = useState(null);
			// The relay's own model list, read once per page open. The checkboxes have to offer the
			// models that are currently hidden too, so this cannot come from the filtered picker list.
			const [pickerRows, setPickerRows] = useState(null);
			const [pickerError, setPickerError] = useState("");

			// The saved mark fades on its own so the status line stays honest about the last write.
			useEffect(() => {
				if (savedAt === 0) return;
				const timer = setTimeout(() => setSavedAt(0), 2500);
				return () => clearTimeout(timer);
			}, [savedAt]);

			// Adopt pushed settings commits into the draft — but never over the field the user is
			// editing, so an in-flight keystroke survives the write's own echo.
			useEffect(() => {
				if (!ready) return;
				setDraft((current) => {
					const next = draftsOf(resolved);
					// Reached through globalThis: a bare `document.identifier` throws in a
					// non-browser renderer, and optional chaining does not guard an undeclared name.
					const active = globalThis.document?.activeElement?.id;
					if (active && active in next && current[active] !== undefined) next[active] = current[active];
					return next;
				});
			}, [ready, resolved]);

			// Secret positions never ride the wire; the redaction record says whether a key exists.
			useEffect(() => {
				let alive = true;
				Promise.resolve()
					.then(() => mirror.getSnapshot().view)
					.then((view) => {
						if (!alive) return;
						const own = view?.namespaces?.find((candidate) => candidate?.ns === NAMESPACE);
						const entry = own?.secrets?.find((s) => Array.isArray(s?.path) && s.path.join(".") === "apiKey");
						setApiKeySet(entry ? entry.set === true : null);
					})
					.catch(() => { if (alive) setApiKeySet(null); });
				return () => { alive = false; };
			}, [mirror, snap?.revision]);

			/** Commit one field write and surface the outcome in the status line. */
			const commit = useCallback(async (field, value) => {
				setError("");
				try {
					await (value === undefined ? scope.unset(field) : scope.set(field, value));
					setSavedAt(Date.now());
					return true;
				} catch (cause) {
					setError(String(cause?.message ?? cause));
					return false;
				}
			}, [scope]);

			// The revision the current draft was opened at. It fences the eventual write, so a
			// change made in another window is refused instead of overwritten; it is re-read after
			// every successful save and every discard.
			const openedRevision = useRef(null);
			useEffect(() => {
				if (ready && openedRevision.current === null) openedRevision.current = snap?.revision ?? null;
			}, [ready, snap?.revision]);

			/** Every difference between the draft and the saved namespace, as path operations. Built
			 *  as operations rather than a rebuilt section on purpose: this page only ever sees the
			 *  redacted document, so writing the section wholesale would delete the API key the wire
			 *  never returned. `unset` is how a cleared field goes back to its composition default. */
			const pendingOps = useCallback(() => {
				const ops = [];
				// Every comparison below normalizes BOTH sides the same way. Comparing a parsed draft
				// against the raw saved value would report a difference for any field the user never
				// touched — a boolean that is simply absent from the document, or a number the wire
				// holds as a number while the draft holds as a string — and the page would claim
				// unsaved changes on open, then write its own defaults back.
				// The snapshot's `value` is the fully resolved namespace (schema defaults, then the
				// composition base, then the user layer), so a field is only "changed" when it differs
				// from that. `base` is the fallback for a host that reports a partial value.
				const saved = { ...(snap?.base ?? {}), ...(resolved ?? {}) };
				for (const [field, key, coerce] of SAVED_FIELDS) {
					const next = coerce(draft[field]);
					const current = saved[key];
					const emptied = typeof next === "string" && next === "";
					if (emptied) {
						if (current !== undefined && current !== "") ops.push({ op: "unset", path: [key] });
						continue;
					}
					// A flag whose saved value is absent is off, whatever the composition default says.
					const currentTyped = typeof next === "boolean" ? current === true : current;
					if (next !== currentTyped) ops.push({ op: "set", path: [key], value: next });
				}
				for (const [field, key] of NUMBER_FIELDS) {
					const raw = String(draft[field] ?? "").trim();
					const current = saved[key];
					if (raw === "") {
						if (current !== undefined) ops.push({ op: "unset", path: [key] });
						continue;
					}
					const value = Math.round(Number(raw));
					if (!Number.isFinite(value)) return { error: t("invalidNumber") };
					if (value !== (typeof current === "number" ? current : undefined)) {
						ops.push({ op: "set", path: [key], value });
					}
				}
				const parsed = parseModels(draft.models);
				if (parsed === undefined) return { error: t("invalidModels") };
				if (JSON.stringify(parsed) !== JSON.stringify(saved.models ?? [])) {
					ops.push(
						parsed.length === 0
							? { op: "unset", path: ["models"] }
							: { op: "set", path: ["models"], value: parsed },
					);
				}
				if (!sameSet(draft.visibleModels, saved.visibleModels ?? [])) {
					const shown = String(draft.visibleModels ?? "")
						.split("\n")
						.map((line) => line.trim())
						.filter((line) => line !== "");
					ops.push(
						shown.length === 0
							? { op: "unset", path: ["visibleModels"] }
							: { op: "set", path: ["visibleModels"], value: shown },
					);
				}
				const env = parseEnv(draft.extraEnv);
				if (env === undefined) return { error: t("invalidEnv") };
				if (JSON.stringify(env) !== JSON.stringify(saved.extraEnv ?? {})) {
					ops.push(
						Object.keys(env).length === 0
							? { op: "unset", path: ["extraEnv"] }
							: { op: "set", path: ["extraEnv"], value: env },
					);
				}
				const args = String(draft.extraArgs ?? "")
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line !== "");
				if (JSON.stringify(args) !== JSON.stringify(saved.extraArgs ?? [])) {
					ops.push(
						args.length === 0
							? { op: "unset", path: ["extraArgs"] }
							: { op: "set", path: ["extraArgs"], value: args },
					);
				}
				return { ops };
			}, [draft, resolved, snap, t]);

			/** One atomic write for the whole page: every field shares a revision fence, a
			 *  validation pass and a recovery read, so a half-applied save is not a state this page
			 *  can produce. */
			const save = useCallback(async () => {
				if (busy) return;
				const { ops, error: invalid } = pendingOps();
				if (invalid) { setError(invalid); setSavedAt(0); return; }
				if (ops.length === 0) { setSavedAt(Date.now()); return; }
				setBusy(true);
				setError("");
				try {
					await scope.mutate(ops, openedRevision.current ?? undefined);
					openedRevision.current = null;
					setSavedAt(Date.now());
				} catch (cause) {
					setError(String(cause?.message ?? cause));
				} finally {
					setBusy(false);
				}
			}, [busy, pendingOps, scope]);

			/** Throw the draft away and re-read the namespace, fence included. */
			const discard = useCallback(() => {
				setError("");
				setSavedAt(0);
				openedRevision.current = null;
				setDraft(draftsOf(resolved));
			}, [resolved]);

			const dirty = useMemo(() => {
				const { ops } = pendingOps();
				return (ops?.length ?? 0) > 0;
			}, [pendingOps]);

			/** Text fields hand their value to the draft; the page writes on Save, never on blur. */
			/** Read the relay's model list through the host's same-origin route. The credential never
			 *  reaches this page — the host asks the relay and answers with ids and names only. */
			const loadPicker = useCallback(() => {
				let alive = true;
				fetch(MODELS_PATH, { method: "GET" })
					.then((res) => res.json())
					.then((body) => {
						if (!alive) return;
						if (body?.ok !== true || !Array.isArray(body.models)) {
							setPickerError(body?.error ? String(body.error) : t("pickerFailed"));
							setPickerRows(null);
							return;
						}
						setPickerError("");
						setPickerRows(body.models);
					})
					.catch(() => {
						if (!alive) return;
						setPickerRows(null);
						setPickerError(t("pickerFailed"));
					});
				return () => { alive = false; };
			}, [t]);

			// Re-read whenever the endpoint or credential changes, which is what a saved connection
			// means; the page itself stays mounted across the save. A relay that is unreachable
			// leaves the rows empty and the page says so rather than showing nothing.
			useEffect(() => {
				if (!ready) return undefined;
				return loadPicker();
			}, [ready, loadPicker, resolved?.baseUrl, snap?.revision]);

			/** What the picker section lists: the relay's models when they were read, otherwise the
			 *  configured list, so an offline relay still lets a model be ticked. */
			const modelRows = useMemo(() => {
				if (pickerRows && pickerRows.length > 0) return pickerRows;
				return parseModels(draft.models) ?? [];
			}, [pickerRows, draft.models]);

			/** The ticked set, or null while nothing has been ticked (which means "show everything"). */
			const picked = useMemo(() => {
				const raw = String(draft.visibleModels ?? "")
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line !== "");
				return raw.length === 0 ? null : new Set(raw);
			}, [draft.visibleModels]);

			/** Tick or untick one model. Unticking the last one clears the list, which restores the
			 *  show-everything default rather than hiding the whole provider. */
			const toggleModel = (id, on) => {
				const next = new Set(picked ?? (pickerRows ?? []).map((m) => m.id));
				if (on) next.add(id);
				else next.delete(id);
				setField("visibleModels")([...next].join("\n"));
			};

			/** Poll the bridge for tool calls waiting on a decision. The CLI is blocked while one is
			 *  pending, so this runs whenever the page is open; the request is to the local host. */
			const [pending, setPending] = useState([]);
			const [approvalError, setApprovalError] = useState("");
			const [answering, setAnswering] = useState("");

			useEffect(() => {
				let alive = true;
				let timer = null;
				const tick = async () => {
					try {
						const res = await fetch(APPROVALS_PATH, { method: "GET" });
						const body = await res.json();
						if (!alive) return;
						if (body?.ok === true && Array.isArray(body.pending)) {
							// Compared before storing: every poll returns a fresh array, and a needless
							// state change would re-render the whole page once a second.
							setPending((current) =>
								JSON.stringify(current) === JSON.stringify(body.pending) ? current : body.pending,
							);
							setApprovalError("");
						}
					} catch {
						// A host without the route, or a page being unloaded: leave the list as it was.
					} finally {
						if (alive) {
							timer = setTimeout(tick, APPROVAL_POLL_MS);
							// Browser timers have no unref; where it exists it keeps this poll from
							// holding a process open without changing what the page does.
							timer?.unref?.();
						}
					}
				};
				tick();
				return () => {
					alive = false;
					if (timer) clearTimeout(timer);
				};
			}, []);

			/** Send one verdict. The bridge drops the call from its list either way, so a refusal is
			 *  as final as an approval. */
			const answerCall = useCallback(async (id, decision) => {
				setAnswering(id);
				setApprovalError("");
				try {
					const res = await fetch(APPROVALS_PATH, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ id, decision }),
					});
					const body = await res.json();
					if (body?.ok === true && Array.isArray(body.pending)) setPending(body.pending);
					else if (body?.ok !== true) setApprovalError(String(body?.error ?? t("approvalFailed")));
				} catch (cause) {
					setApprovalError(String(cause?.message ?? cause));
				} finally {
					setAnswering("");
				}
			}, [t]);

			/** One draft field. Nothing reaches the namespace until Save, so typing is free. */
			const setField = (field) => (value) => setDraft((d) => ({ ...d, [field]: value }));

			if (!ready) {
				return h("div", { style: pageStyle }, h("div", { style: hintStyle }, t("notReady")));
			}

			const disabled = !writable;

			return h("div", { style: pageStyle },
				h("h2", { style: { margin: 0 } }, t("title")),
				h("div", { style: hintStyle }, t("subtitle")),

				h("div", { style: sectionStyle },
					h("h3", { style: sectionTitleStyle }, t("connection")),
					h(Field, { label: t("baseUrl"), hint: t("baseUrlHint") },
						h("input", {
							id: "baseUrl", style: inputStyle, disabled,
							value: draft.baseUrl, placeholder: t("baseUrlPlaceholder"),
							onChange: (e) => setField("baseUrl")(e.target.value),
						}),
					),
					h(Field, { label: t("apiKey"), hint: t("apiKeyHint") },
						h("div", { style: rowStyle },
							h("input", {
								id: "apiKeyDraft", type: "password", style: { ...inputStyle, flex: 1, minWidth: 220 },
								value: apiKeyDraft, disabled,
								placeholder: apiKeySet === true ? t("apiKeyPlaceholderSet") : t("apiKeyPlaceholderUnset"),
								onChange: (e) => setApiKeyDraft(e.target.value),
							}),
							h("button", {
								style: buttonStyle, disabled: disabled || apiKeyDraft === "",
								onClick: async () => {
									if (await commit("apiKey", apiKeyDraft)) setApiKeyDraft("");
								},
							}, t("apiKeySave")),
							h("button", {
								style: buttonStyle, disabled: disabled || apiKeySet === false,
								onClick: async () => { if (await commit("apiKey", undefined)) setApiKeyDraft(""); },
							}, t("apiKeyClear")),
						),
					),
					h(Field, { label: t("authHeader"), hint: t("authHeaderHint") },
						h("div", { style: rowStyle },
							["auth-token", "api-key"].map((mode) => h("button", {
								key: mode,
								style: draft.authHeader === mode ? segmentActiveStyle : buttonStyle,
								disabled,
								onClick: () => setField("authHeader")(mode),
							}, mode === "auth-token" ? t("authToken") : t("apiKeyHeader"))),
						),
					),
					h(CheckField, {
						label: t("autoModels"), hint: t("autoModelsHint"), disabled,
						checked: draft.autoModels,
						onChange: setField("autoModels"),
					}),
					h(Field, { label: t("models"), hint: t("modelsHint") },
						h("textarea", {
							id: "models", style: areaStyle, disabled, placeholder: t("modelsPlaceholder"),
							value: draft.models,
							onChange: (e) => setField("models")(e.target.value),
						}),
					),
				),

				// Which of the relay's models reach dsh's picker. Ticking writes the visibleModels
				// list the host filters on; leaving every box clear shows everything, so a fresh
				// configuration is never left with an empty selector.
				h("div", { style: sectionStyle },
					h("h3", { style: sectionTitleStyle }, t("picker")),
					h("div", { style: hintStyle }, t("pickerHint")),
					modelRows.length === 0
						? h("div", { style: hintStyle }, pickerError || t("pickerEmpty"))
						: modelRows.map((row) =>
								h("div", { key: row.id, style: checkRowStyle },
									h("input", {
										type: "checkbox", disabled,
										checked: picked ? picked.has(row.id) : true,
										onChange: (event) => toggleModel(row.id, event.target.checked),
									}),
									h("div", { style: fieldStyle },
										h("label", { style: labelStyle }, row.name && row.name !== row.id ? `${row.name} · ${row.id}` : row.id),
										row.description ? h("div", { style: hintStyle }, row.description) : null,
									),
								),
							),
					h("div", { style: hintStyle }, picked ? t("pickerUnset") : t("pickerAll")),
				),

				h("div", { style: sectionStyle },
					h("h3", { style: sectionTitleStyle }, t("behavior")),
					h(Field, { label: t("command"), hint: t("commandHint") },
						h("input", {
							id: "command", style: inputStyle, disabled, value: draft.command,
							onChange: (e) => setDraft((d) => ({ ...d, command: e.target.value })),
						}),
					),
					h(Field, { label: t("configDir"), hint: t("configDirHint") },
						h("input", {
							id: "configDir", style: inputStyle, disabled, value: draft.configDir,
							onChange: (e) => setDraft((d) => ({ ...d, configDir: e.target.value })),
						}),
					),
					h(Field, { label: t("permissionMode"), hint: t("permissionModeHint") },
						h("select", {
							id: "permissionMode", style: inputStyle, disabled, value: draft.permissionMode,
							onChange: (e) => setField("permissionMode")(e.target.value),
						}, ["dsh", "plan", "acceptEdits", "bypassPermissions", "dontAsk"].map((mode) =>
							h("option", { key: mode, value: mode }, mode))),
					),
					h(CheckField, {
						label: t("resume"), hint: t("resumeHint"), disabled,
						checked: draft.resume,
						onChange: setField("resume"),
					}),
					h(CheckField, {
						label: t("resident"), hint: t("residentHint"), disabled,
						checked: draft.resident,
						onChange: setField("resident"),
					}),
					h(CheckField, {
						label: t("toolActivity"), hint: t("toolActivityHint"), disabled,
						checked: draft.toolActivity,
						onChange: setField("toolActivity"),
					}),
					h(CheckField, {
						label: t("approvalBridge"), hint: t("approvalBridgeHint"), disabled,
						checked: draft.approvalBridge,
						onChange: setField("approvalBridge"),
					}),
					h(Field, { label: t("approvalMode"), hint: t("approvalModeHint") },
						h("select", {
							id: "approvalMode", style: inputStyle, disabled, value: draft.approvalMode,
							onChange: (e) => setField("approvalMode")(e.target.value),
						}, [
							h("option", { key: "auto", value: "auto" }, t("approvalModeAuto")),
							h("option", { key: "ask", value: "ask" }, t("approvalModeAsk")),
						]),
					),
					h(Field, { label: t("approvalTimeout"), hint: t("approvalTimeoutHint") },
						h("input", {
							id: "approvalTimeoutMs", type: "number", style: { ...inputStyle, width: 160 }, disabled,
							value: draft.approvalTimeoutMs,
							onChange: (e) => setField("approvalTimeoutMs")(e.target.value),
						}),
					),
					h(CheckField, {
						label: t("systemPrompt"), hint: t("systemPromptHint"), disabled,
						checked: draft.systemPrompt,
						onChange: setField("systemPrompt"),
					}),
					h(CheckField, {
						label: t("debug"), hint: t("debugHint"), disabled,
						checked: draft.debug,
						onChange: setField("debug"),
					}),
					h("div", { style: rowStyle },
						h(Field, { label: t("contextWindow") },
							h("input", {
								id: "contextWindow", type: "number", style: { ...inputStyle, width: 160 }, disabled,
								value: draft.contextWindow,
								onChange: (e) => setDraft((d) => ({ ...d, contextWindow: e.target.value })),
								}),
						),
						h(Field, { label: t("idleTimeoutMs") },
							h("input", {
								id: "idleTimeoutMs", type: "number", style: { ...inputStyle, width: 160 }, disabled,
								value: draft.idleTimeoutMs,
								onChange: (e) => setDraft((d) => ({ ...d, idleTimeoutMs: e.target.value })),
								}),
						),
						h(Field, { label: t("maxTurns") },
							h("input", {
								id: "maxTurns", type: "number", style: { ...inputStyle, width: 160 }, disabled,
								value: draft.maxTurns,
								onChange: (e) => setDraft((d) => ({ ...d, maxTurns: e.target.value })),
								}),
						),
					),
				),

				h("div", { style: sectionStyle },
					h("h3", { style: sectionTitleStyle }, t("advanced")),
					h(Field, { label: t("extraEnv"), hint: t("extraEnvHint") },
						h("textarea", {
							id: "extraEnv", style: areaStyle, disabled, value: draft.extraEnv,
							onChange: (e) => setDraft((d) => ({ ...d, extraEnv: e.target.value })),
							onBlur: () => {
								const parsed = parseEnv(draft.extraEnv);
								if (parsed === undefined) { setError(t("invalidEnv")); return; }
								const same = JSON.stringify(parsed) === JSON.stringify(resolved?.extraEnv ?? {});
								if (!same) commit("extraEnv", Object.keys(parsed).length === 0 ? undefined : parsed);
							},
						}),
					),
					h(Field, { label: t("extraArgs"), hint: t("extraArgsHint") },
						h("textarea", {
							id: "extraArgs", style: areaStyle, disabled, value: draft.extraArgs,
							onChange: (e) => setDraft((d) => ({ ...d, extraArgs: e.target.value })),
							onBlur: () => {
								const parsed = String(draft.extraArgs ?? "").split("\n").map((s) => s.trim()).filter((s) => s !== "");
								const same = JSON.stringify(parsed) === JSON.stringify(resolved?.extraArgs ?? []);
								if (!same) commit("extraArgs", parsed.length === 0 ? undefined : parsed);
							},
						}),
					),
				),

				// Tool calls the CLI is blocked on right now. This is the only place a decision can
				// be given while it matters — the call is waiting, not queued for later.
				h("div", { style: sectionStyle },
					h("h3", { style: sectionTitleStyle }, t("approvalSection")),
					h("div", { style: hintStyle }, t("approvalNone")),
					...pending.map((call) =>
						h("div", { key: call.id, style: pendingStyle },
							h("div", { style: { ...labelStyle, display: "flex", gap: 8, alignItems: "baseline" } },
								h("span", null, call.toolName),
								h("span", { style: hintStyle }, t("approvalPending")),
							),
							h("div", { style: { ...hintStyle, wordBreak: "break-all", fontFamily: "ui-monospace, monospace" } }, call.toolInput),
							call.cwd ? h("div", { style: hintStyle }, call.cwd) : null,
							h("div", { style: rowStyle },
								h("button", {
									style: primaryButtonStyle,
									disabled: answering === call.id,
									onClick: () => answerCall(call.id, "allow"),
								}, t("approvalAllow")),
								h("button", {
									style: buttonStyle,
									disabled: answering === call.id,
									onClick: () => answerCall(call.id, "deny"),
								}, t("approvalDeny")),
							),
						),
					),
					approvalError ? h("div", { style: errorStyle }, approvalError) : null,
				),

				// The page's one commit point, after every section so it is the last thing on the page.
				h("div", { style: footerStyle },
					h("button", {
						style: { ...primaryButtonStyle, opacity: busy || !dirty ? 0.5 : 1 },
						disabled: disabled || busy || !dirty,
						onClick: save,
					}, busy ? t("saving") : t("save")),
					h("button", {
						style: buttonStyle, disabled: disabled || busy || !dirty,
						onClick: discard,
					}, t("discard")),
					h("div", { style: error ? errorStyle : savedAt > 0 ? okStyle : statusStyle },
						error ||
							(savedAt > 0
								? `${t("saved")} ✓`
								: disabled
									? t("readOnly")
									: dirty
										? t("unsaved")
										: "")),
				),
			);
		}

		const inject = ["slots", "locale", "settingsScope"];

		/** Register settings copy and the Claude Code section page. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-claude-code-relay: settings copy");
			const t = ctx.locale.bind(NS);

			// One scope for the page's lifetime: reads ride the shared describe mirror, writes go to
			// the host namespace. Stable method wrappers keep React's store hook from resubscribing.
			const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
			const boundScope = {
				getSnapshot: () => scope.getSnapshot(),
				subscribe: (listener) => scope.subscribe(listener),
				set: (field, value) => scope.set(field, value),
				unset: (field) => scope.unset(field),
				// The whole page commits through one atomic mutate: every field shares a revision
				// fence, so a concurrent write is refused instead of half-merged.
				mutate: (ops, expectedRevision) => scope.mutate(ops, expectedRevision),
			};
			const mirror = {
				getSnapshot: () => ctx.settingsScope.describe().getSnapshot(),
			};

			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "claude-code-relay",
				order: 16,
				label: () => t("nav"),
				inject: () => ({ t, scope: boundScope, mirror }),
			}, RelaySettings));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = "dsh-claude-code-relay";
		return module.exports;
	}
});

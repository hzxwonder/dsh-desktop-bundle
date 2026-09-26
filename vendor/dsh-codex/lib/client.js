window.__ModuleLoader__.load({
	id: "dsh-codex",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/client/OpenAICodexSettings.tsx
		/** Plugin-owned OpenAI Codex account page inside the dsh Settings shell. */
		const STATUS_PATH = "/plugins/dsh-openai-codex/auth/status";
		const LOGIN_PATH = "/plugins/dsh-openai-codex/auth/login";
		const LOGOUT_PATH = "/plugins/dsh-openai-codex/auth/logout";
		const IMAGE_TOOLS_PATH = "/plugins/dsh-openai-codex/image-tools";
		const RESPONSE_API_PATH = "/plugins/dsh-openai-codex/response-api";
		const MODEL_CATALOG_PATH = "/plugins/dsh-openai-codex/models";
		const CONTEXT_WINDOW_PATH = "/plugins/dsh-openai-codex/context-window";
		const FAST_MODE_SETTINGS_PATH = "/plugins/dsh-openai-codex/fast-mode-default";
		const PROXY_PATH = "/plugins/dsh-openai-codex/proxy";
		const POLL_INTERVAL_MS = 1e3;
		const USAGE_POLL_INTERVAL_MS$1 = 6e4;
		const pageStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 18,
			maxWidth: 720
		};
		const titleStyle$1 = {
			margin: 0,
			fontSize: 20,
			lineHeight: "28px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const bodyStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const cardStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			padding: "18px 20px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-module-platform)"
		};
		const rowStyle$1 = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: 12
		};
		const statusStyle = {
			display: "flex",
			alignItems: "center",
			gap: 9,
			fontSize: 15,
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const buttonStyle = {
			boxSizing: "border-box",
			minHeight: 34,
			padding: "6px 14px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 14,
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			...buttonStyle,
			borderColor: "var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		const errorStyle = {
			...bodyStyle,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const quotaListStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 18,
			paddingTop: 2
		};
		const quotaGroupStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10
		};
		const quotaTitleStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const quotaLabelStyle = {
			display: "flex",
			justifyContent: "space-between",
			gap: 12,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const progressTrackStyle = {
			height: 8,
			overflow: "hidden",
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.08))"
		};
		const toggleRowStyle = {
			...rowStyle$1,
			flexWrap: "nowrap",
			alignItems: "flex-start"
		};
		const toggleCopyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 3
		};
		const toggleTrackStyle = {
			position: "relative",
			width: 40,
			height: 22,
			flex: "0 0 auto",
			marginTop: 1,
			padding: 0,
			border: 0,
			borderRadius: 999,
			cursor: "pointer",
			transition: "background 120ms ease"
		};
		const modelListStyle = {
			display: "grid",
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			gap: 10
		};
		const modelCardStyle = {
			display: "flex",
			minWidth: 0,
			flexDirection: "column",
			gap: 12,
			padding: 12,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 10,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)"
		};
		const modelCardHeaderStyle = {
			display: "flex",
			minWidth: 0,
			alignItems: "flex-start",
			justifyContent: "space-between",
			gap: 12
		};
		const modelMetadataStyle = {
			display: "flex",
			minWidth: 0,
			flexDirection: "column",
			gap: 5
		};
		const modelFieldStyle = {
			display: "flex",
			minWidth: 0,
			alignItems: "baseline",
			gap: 5
		};
		const modelFieldLabelStyle = {
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		const modelNameStyle = {
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600
		};
		const modelIdStyle = {
			overflowWrap: "anywhere",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const modelWindowStyle = {
			fontSize: 13,
			lineHeight: "18px",
			whiteSpace: "nowrap"
		};
		const modelEnableStyle = {
			display: "flex",
			flex: "0 0 auto",
			alignItems: "center",
			gap: 7,
			cursor: "pointer"
		};
		const numberInputStyle = {
			boxSizing: "border-box",
			width: 180,
			minHeight: 36,
			padding: "7px 10px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 14
		};
		const proxyModeStyle = {
			display: "grid",
			gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
		};
		const proxyModeButtonStyle = {
			boxSizing: "border-box",
			minWidth: 0,
			minHeight: 40,
			padding: "8px 12px",
			border: 0,
			borderRadius: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 13,
			fontWeight: 600,
			cursor: "pointer",
			transition: "background 140ms ease, color 140ms ease"
		};
		const proxyInputStyle = {
			...numberInputStyle,
			width: "auto",
			flex: "1 1 320px",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: 13
		};
		const commandStyle = {
			margin: 0,
			padding: "10px 12px",
			overflowX: "auto",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.06))",
			color: "var(--dsw-alias-label-primary)",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: 13,
			lineHeight: "20px",
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere"
		};
		function PreferenceToggle({ checked, disabled, label, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				role: "switch",
				"aria-checked": checked,
				"aria-label": label,
				disabled,
				style: {
					...toggleTrackStyle,
					opacity: disabled ? .55 : 1,
					background: checked ? "var(--dsw-alias-button-primary-fill)" : "var(--dsw-alias-bg-layer-2, #c8ccd2)"
				},
				onClick: () => {
					onChange(!checked);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
					position: "absolute",
					top: 3,
					left: checked ? 21 : 3,
					width: 16,
					height: 16,
					borderRadius: "50%",
					background: "var(--dsw-alias-label-primary-foreground)",
					boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
					transition: "left 120ms ease"
				} })
			});
		}
		function ProxyModeControl({ value, disabled, onChange, t }) {
			const options = [
				{
					value: "off",
					label: "proxyModeOff"
				},
				{
					value: "scoped",
					label: "proxyModeScoped"
				},
				{
					value: "global",
					label: "proxyModeGlobal"
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: proxyModeStyle,
				role: "radiogroup",
				"aria-label": t("proxyMode"),
				onKeyDown: (event) => {
					if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
					event.preventDefault();
					const nextIndex = (options.findIndex((option) => option.value === value) + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
					const nextOption = options[nextIndex];
					if (nextOption === void 0) return;
					onChange(nextOption.value);
					event.currentTarget.querySelectorAll("button").item(nextIndex).focus();
				},
				children: options.map((option, index) => {
					const selected = value === option.value;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "radio",
						"aria-checked": selected,
						disabled,
						style: {
							...proxyModeButtonStyle,
							opacity: disabled ? .55 : 1,
							...index === 0 ? {} : { borderLeft: "1px solid var(--dsw-alias-border-l2)" },
							...selected ? {
								background: "var(--dsw-alias-button-primary-fill)",
								color: "var(--dsw-alias-label-primary-foreground)"
							} : {}
						},
						onClick: () => {
							onChange(option.value);
						},
						children: t(option.label)
					}, option.value);
				})
			});
		}
		function progressFillStyle(percent) {
			return {
				width: `${Math.max(0, Math.min(100, percent))}%`,
				height: "100%",
				borderRadius: "inherit",
				background: "var(--dsw-alias-brand-primary, #1677ff)"
			};
		}
		function windowLabel(seconds, t) {
			if (seconds === 18e3) return t("fiveHourLimit");
			if (seconds === 604800) return t("weeklyLimit");
			const hours = seconds / 3600;
			return Number.isInteger(hours) ? t("hourLimit", { count: hours }) : t("usageWindow");
		}
		function formatPercent$1(percent) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(percent);
		}
		function contextWindowDraft(contextWindow) {
			return contextWindow === null ? "" : String(contextWindow / 1e3);
		}
		function contextWindowTokens(draft) {
			const trimmed = draft.trim();
			if (trimmed.length === 0) return null;
			const match = /^(\d+)(?:\.(\d{1,3}))?$/u.exec(trimmed);
			if (match === null) return void 0;
			const tokens = Number(match[1]) * 1e3 + Number((match[2] ?? "").padEnd(3, "0"));
			return Number.isSafeInteger(tokens) && tokens > 0 ? tokens : void 0;
		}
		function formatContextWindow(tokens) {
			return `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 3 }).format(tokens / 1e3)}K`;
		}
		/** Self-contained model selector card with four explicit fields. */
		function ModelCheckbox({ model, checked, disabled, onChange, t }) {
			const contextWindow = formatContextWindow(model.contextWindow);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					...modelCardStyle,
					opacity: disabled ? .55 : 1
				},
				role: "group",
				"aria-label": model.name,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: modelCardHeaderStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: modelFieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelFieldLabelStyle,
							children: t("modelFieldName")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelNameStyle,
							children: model.name
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: modelEnableStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelFieldLabelStyle,
							children: t("modelFieldEnabled")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
							checked,
							disabled,
							label: t("modelEnableLabel", { name: model.name }),
							onChange
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: modelMetadataStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: modelFieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelFieldLabelStyle,
							children: t("modelFieldId")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelIdStyle,
							children: model.id
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: modelFieldStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelFieldLabelStyle,
							children: t("modelFieldDefaultWindow")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelWindowStyle,
							children: t("modelContextWindowValue", { value: contextWindow })
						})]
					})]
				})]
			});
		}
		/** Format a provider-declared Unix-second reset in the user's local timezone. */
		function formatOpenAICodexResetAt(resetAt) {
			if (resetAt === void 0 || !Number.isSafeInteger(resetAt) || resetAt <= 0) return void 0;
			const date = /* @__PURE__ */ new Date(resetAt * 1e3);
			if (!Number.isFinite(date.getTime())) return void 0;
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(date);
		}
		function QuotaBar({ label, percent, detail, t }) {
			const display = formatPercent$1(percent);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaGroupStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: quotaLabelStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("percentRemaining", { percent: display }) })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: progressTrackStyle,
						role: "progressbar",
						"aria-label": label,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": percent,
						"aria-valuetext": t("percentRemaining", { percent: display }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: progressFillStyle(percent) })
					}),
					detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: detail
					})
				]
			});
		}
		function UsageLimits({ usage, quotaError, t }) {
			const hasData = usage.rateLimits.length > 0 || usage.credits !== void 0 || usage.individualLimit !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaListStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: quotaTitleStyle,
						children: t("usageLimits")
					}),
					usage.rateLimits.map((limit) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: quotaGroupStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
							style: quotaTitleStyle,
							children: limit.name ?? limit.id
						}), limit.windows.map((window) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaBar, {
							label: windowLabel(window.windowSeconds, t),
							percent: window.remainingPercent,
							detail: t("resetAt", { time: formatOpenAICodexResetAt(window.resetAt) ?? t("resetUnavailable") }),
							t
						}, window.windowSeconds))]
					}, limit.id)),
					usage.individualLimit === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaBar, {
						label: t("monthlyLimit"),
						percent: usage.individualLimit.remainingPercent,
						detail: t("exactRemaining", {
							remaining: usage.individualLimit.remaining,
							limit: usage.individualLimit.limit
						}),
						t
					}),
					usage.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: quotaLabelStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("credits") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: usage.credits.unlimited ? t("unlimited") : usage.credits.balance === void 0 ? t("available") : usage.credits.balance })]
					}),
					!hasData && quotaError === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: t("quotaUnavailable")
					}) : null,
					quotaError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle,
						children: t("quotaUnavailable")
					})
				]
			});
		}
		function dotStyle(status) {
			return {
				width: 9,
				height: 9,
				borderRadius: "50%",
				flex: "0 0 auto",
				background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" || status === "reauth-required" || status === "remote-web-origin-not-trusted" ? "var(--dsw-alias-state-error-primary, #d92d20)" : status === "signing-in" || status === "loading" ? "var(--dsw-alias-brand-primary, #1677ff)" : "var(--dsw-alias-label-dimmed, #9aa0a6)"
			};
		}
		var AccountRequestError = class extends Error {
			code;
			constructor(code) {
				super(code);
				this.code = code;
				this.name = "AccountRequestError";
			}
		};
		async function jsonRequest(path, method = "GET", body) {
			const response = await fetch(path, {
				method,
				headers: {
					accept: "application/json",
					...body === void 0 ? {} : { "content-type": "application/json" }
				},
				credentials: "same-origin",
				...body === void 0 ? {} : { body: JSON.stringify(body) }
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) throw new AccountRequestError(typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
			return value;
		}
		/** OpenAI Codex account status and OAuth actions. */
		function OpenAICodexSettings({ t }) {
			if (t === void 0) throw new Error("OpenAI Codex settings requires its translation function");
			const [status, setStatus] = (0, react.useState)({ status: "loading" });
			const [busy, setBusy] = (0, react.useState)(false);
			const [copied, setCopied] = (0, react.useState)(false);
			const [copyFailed, setCopyFailed] = (0, react.useState)(false);
			const [imageTools, setImageTools] = (0, react.useState)();
			const [imageToolsBusy, setImageToolsBusy] = (0, react.useState)(false);
			const [imageToolsError, setImageToolsError] = (0, react.useState)();
			const [responseApi, setResponseApi] = (0, react.useState)();
			const [responseApiBusy, setResponseApiBusy] = (0, react.useState)(false);
			const [responseApiError, setResponseApiError] = (0, react.useState)();
			const [modelCatalog, setModelCatalog] = (0, react.useState)();
			const [modelCatalogBusy, setModelCatalogBusy] = (0, react.useState)(false);
			const [modelCatalogError, setModelCatalogError] = (0, react.useState)();
			const [contextWindow, setContextWindow] = (0, react.useState)();
			const [contextWindowDraftValue, setContextWindowDraftValue] = (0, react.useState)("");
			const [contextWindowBusy, setContextWindowBusy] = (0, react.useState)(false);
			const [contextWindowError, setContextWindowError] = (0, react.useState)();
			const [fastMode, setFastMode] = (0, react.useState)();
			const [fastModeBusy, setFastModeBusy] = (0, react.useState)(false);
			const [fastModeError, setFastModeError] = (0, react.useState)();
			const [proxy, setProxy] = (0, react.useState)();
			const [proxyDraft, setProxyDraft] = (0, react.useState)("");
			const [proxyBusy, setProxyBusy] = (0, react.useState)(false);
			const [proxyError, setProxyError] = (0, react.useState)();
			const [proxySaved, setProxySaved] = (0, react.useState)(false);
			const trustedOriginCommand = `dsh plugin --profile web exec dsh-codex trust-origin ${window.location.origin}`;
			const refresh = (0, react.useCallback)(async () => {
				try {
					setStatus(await jsonRequest(STATUS_PATH));
				} catch (error) {
					setStatus(error instanceof AccountRequestError && error.code === "remote-web-origin-not-trusted" ? { status: "remote-web-origin-not-trusted" } : {
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				}
			}, [t]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				jsonRequest(IMAGE_TOOLS_PATH).then((value) => {
					setImageTools(value);
					setImageToolsError(void 0);
				}, () => {
					setImageToolsError(t("imageToolSettingsFailed"));
				});
			}, [t]);
			(0, react.useEffect)(() => {
				jsonRequest(RESPONSE_API_PATH).then((value) => {
					setResponseApi(value);
					setResponseApiError(void 0);
				}, () => {
					setResponseApiError(t("responseApiSettingsFailed"));
				});
			}, [t]);
			(0, react.useEffect)(() => {
				jsonRequest(MODEL_CATALOG_PATH).then((value) => {
					setModelCatalog(value);
					setModelCatalogError(void 0);
				}, () => {
					setModelCatalogError(t("modelCatalogSettingsFailed"));
				});
			}, [t]);
			(0, react.useEffect)(() => {
				jsonRequest(CONTEXT_WINDOW_PATH).then((value) => {
					setContextWindow(value);
					setContextWindowDraftValue(contextWindowDraft(value.contextWindow));
					setContextWindowError(void 0);
				}, () => {
					setContextWindowError(t("contextWindowSettingsFailed"));
				});
			}, [t]);
			(0, react.useEffect)(() => {
				jsonRequest(FAST_MODE_SETTINGS_PATH).then((value) => {
					setFastMode(value);
					setFastModeError(void 0);
				}, () => {
					setFastModeError(t("fastModeSettingsFailed"));
				});
			}, [t]);
			(0, react.useEffect)(() => {
				jsonRequest(PROXY_PATH).then((value) => {
					setProxy(value);
					setProxyDraft(value.proxyUrl);
					setProxyError(void 0);
				}, () => {
					setProxyError(t("proxySettingsFailed"));
				});
			}, [t]);
			(0, react.useEffect)(() => {
				const interval = status.status === "signing-in" ? POLL_INTERVAL_MS : status.status === "signed-in" ? USAGE_POLL_INTERVAL_MS$1 : void 0;
				if (interval === void 0) return;
				const timer = window.setInterval(() => {
					refresh();
				}, interval);
				return () => {
					window.clearInterval(timer);
				};
			}, [refresh, status.status]);
			const signIn = async () => {
				const popup = window.open("about:blank", "_blank");
				if (popup !== null) popup.opener = null;
				setBusy(true);
				setStatus({ status: "signing-in" });
				try {
					const challenge = await jsonRequest(LOGIN_PATH, "POST");
					if (popup === null) {
						setStatus({
							status: "error",
							message: t("popupBlocked")
						});
						return;
					}
					popup.location.replace(challenge.url);
				} catch (error) {
					popup?.close();
					setStatus(error instanceof AccountRequestError && error.code === "remote-web-origin-not-trusted" ? { status: "remote-web-origin-not-trusted" } : {
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				} finally {
					setBusy(false);
				}
			};
			const signOut = async () => {
				setBusy(true);
				try {
					await jsonRequest(LOGOUT_PATH, "POST");
					setStatus({ status: "signed-out" });
				} catch (error) {
					setStatus({
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				} finally {
					setBusy(false);
				}
			};
			const updateImageTool = async (patch) => {
				setImageToolsBusy(true);
				setImageToolsError(void 0);
				try {
					setImageTools(await jsonRequest(IMAGE_TOOLS_PATH, "POST", patch));
				} catch {
					setImageToolsError(t("imageToolSettingsFailed"));
				} finally {
					setImageToolsBusy(false);
				}
			};
			const updateResponseApi = async (patch) => {
				setResponseApiBusy(true);
				setResponseApiError(void 0);
				try {
					setResponseApi(await jsonRequest(RESPONSE_API_PATH, "POST", patch));
				} catch {
					setResponseApiError(t("responseApiSettingsFailed"));
				} finally {
					setResponseApiBusy(false);
				}
			};
			const updateVisibleModel = async (modelId, checked) => {
				if (modelCatalog === void 0) return;
				const selected = new Set(modelCatalog.models);
				if (checked) selected.add(modelId);
				else selected.delete(modelId);
				const models = modelCatalog.availableModels.filter((model) => selected.has(model.id)).map((model) => model.id);
				setModelCatalogBusy(true);
				setModelCatalogError(void 0);
				try {
					setModelCatalog(await jsonRequest(MODEL_CATALOG_PATH, "POST", { models }));
				} catch {
					setModelCatalogError(t("modelCatalogSettingsFailed"));
				} finally {
					setModelCatalogBusy(false);
				}
			};
			const updateContextWindow = async () => {
				const parsed = contextWindowTokens(contextWindowDraftValue);
				if (parsed === void 0) {
					setContextWindowError(t("contextWindowInvalid"));
					return;
				}
				setContextWindowBusy(true);
				setContextWindowError(void 0);
				try {
					const saved = await jsonRequest(CONTEXT_WINDOW_PATH, "POST", { contextWindow: parsed });
					setContextWindow(saved);
					setContextWindowDraftValue(contextWindowDraft(saved.contextWindow));
				} catch {
					setContextWindowError(t("contextWindowSettingsFailed"));
				} finally {
					setContextWindowBusy(false);
				}
			};
			const updateSparkContextWindowOverride = async (checked) => {
				setContextWindowBusy(true);
				setContextWindowError(void 0);
				try {
					setContextWindow(await jsonRequest(CONTEXT_WINDOW_PATH, "POST", { overrideSparkContextWindow: checked }));
				} catch {
					setContextWindowError(t("contextWindowSettingsFailed"));
				} finally {
					setContextWindowBusy(false);
				}
			};
			const updateProxy = async (patch) => {
				setProxyBusy(true);
				setProxyError(void 0);
				setProxySaved(false);
				try {
					const saved = await jsonRequest(PROXY_PATH, "POST", patch);
					setProxy(saved);
					if (patch.proxyUrl !== void 0) setProxyDraft(saved.proxyUrl);
					setProxySaved(true);
				} catch (error) {
					setProxyError(error instanceof Error ? error.message : t("proxySettingsFailed"));
				} finally {
					setProxyBusy(false);
				}
			};
			const updateFastMode = async (patch) => {
				setFastModeBusy(true);
				setFastModeError(void 0);
				try {
					setFastMode(await jsonRequest(FAST_MODE_SETTINGS_PATH, "POST", patch));
				} catch {
					setFastModeError(t("fastModeSettingsFailed"));
				} finally {
					setFastModeBusy(false);
				}
			};
			const copyTrustedOriginCommand = async () => {
				setCopyFailed(false);
				try {
					if (navigator.clipboard?.writeText === void 0) throw new Error("clipboard unavailable");
					await navigator.clipboard.writeText(trustedOriginCommand);
					setCopied(true);
				} catch {
					setCopyFailed(true);
				}
			};
			const label = status.status === "signed-in" ? t("signedIn") : status.status === "loading" ? t("loadingAccount") : status.status === "signing-in" ? t("signingIn") : status.status === "reauth-required" ? t("reauthRequired") : status.status === "remote-web-origin-not-trusted" ? t("remoteOriginTitle") : status.status === "error" ? t("requestFailed") : t("signedOut");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: pageStyle,
				"aria-labelledby": "openai-codex-settings-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						id: "openai-codex-settings-title",
						style: titleStyle$1,
						children: t("title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...bodyStyle,
							marginTop: 6
						},
						children: t("intro")
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle$1,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: statusStyle,
									role: "status",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										style: dotStyle(status.status)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
								}), status.status === "loading" || status.status === "remote-web-origin-not-trusted" ? null : status.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle,
									disabled: busy,
									onClick: () => {
										signOut();
									},
									children: busy ? t("working") : t("logout")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: primaryButtonStyle,
									disabled: busy,
									onClick: () => {
										signIn();
									},
									children: busy ? t("working") : status.status === "error" || status.status === "reauth-required" ? t("loginAgain") : t("login")
								})]
							}),
							status.status === "error" || status.status === "reauth-required" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: status.message
							}) : null,
							status.status === "remote-web-origin-not-trusted" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 10
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: errorStyle,
										children: t("remoteOriginDescription")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: bodyStyle,
										children: t("remoteOriginCommandHelp")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
										style: commandStyle,
										children: trustedOriginCommand
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: rowStyle$1,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											style: buttonStyle,
											onClick: () => {
												copyTrustedOriginCommand();
											},
											children: copied ? t("remoteOriginCopied") : t("remoteOriginCopy")
										}), copyFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: errorStyle,
											children: t("remoteOriginCopyFailed")
										}) : null]
									})
								]
							}) : null,
							status.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageLimits, {
								usage: status.usage,
								...status.quotaError === void 0 ? {} : { quotaError: status.quotaError },
								t
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: quotaTitleStyle,
								children: t("proxy")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									...bodyStyle,
									marginTop: 5
								},
								children: t("proxyIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProxyModeControl, {
								value: proxy?.proxyMode ?? "off",
								disabled: proxy === void 0 || proxyBusy,
								onChange: (proxyMode) => {
									updateProxy({ proxyMode });
								},
								t
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t(proxy?.proxyMode === "scoped" ? "proxyModeScopedHint" : proxy?.proxyMode === "global" ? "proxyModeGlobalHint" : "proxyModeOffHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									...rowStyle$1,
									justifyContent: "flex-start"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										htmlFor: "openai-codex-proxy-url",
										style: statusStyle,
										children: t("proxyUrl")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "openai-codex-proxy-url",
										type: "url",
										inputMode: "url",
										spellCheck: false,
										placeholder: t("proxyUrlPlaceholder"),
										value: proxyDraft,
										disabled: proxy === void 0 || proxyBusy,
										style: proxyInputStyle,
										onChange: (event) => {
											setProxyDraft(event.currentTarget.value);
											setProxySaved(false);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: primaryButtonStyle,
										disabled: proxy === void 0 || proxyBusy,
										onClick: () => {
											updateProxy({ proxyUrl: proxyDraft });
										},
										children: proxyBusy ? t("working") : t("proxySave")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("proxyUrlHint")
							}),
							proxyError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: proxyError
							}),
							proxySaved ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("proxySaved")
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: quotaTitleStyle,
								children: t("modelCatalog")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									...bodyStyle,
									marginTop: 5
								},
								children: t("modelCatalogIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: modelListStyle,
								role: "group",
								"aria-label": t("modelCatalog"),
								children: modelCatalog?.availableModels.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelCheckbox, {
									model,
									checked: modelCatalog.models.includes(model.id),
									disabled: modelCatalogBusy,
									onChange: (checked) => {
										updateVisibleModel(model.id, checked);
									},
									t
								}, model.id))
							}),
							modelCatalogError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: modelCatalogError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: quotaTitleStyle,
								children: t("contextWindow")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									...bodyStyle,
									marginTop: 5
								},
								children: t("contextWindowIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									...rowStyle$1,
									justifyContent: "flex-start"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										htmlFor: "openai-codex-context-window",
										style: statusStyle,
										children: t("contextWindowInput")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "openai-codex-context-window",
										type: "number",
										inputMode: "decimal",
										min: "0.001",
										step: "0.001",
										placeholder: t("contextWindowPlaceholder"),
										value: contextWindowDraftValue,
										disabled: contextWindow === void 0 || contextWindowBusy,
										style: numberInputStyle,
										onChange: (event) => {
											setContextWindowDraftValue(event.currentTarget.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: primaryButtonStyle,
										disabled: contextWindow === void 0 || contextWindowBusy,
										onClick: () => {
											updateContextWindow();
										},
										children: contextWindowBusy ? t("working") : t("contextWindowSave")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: toggleRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: toggleCopyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: statusStyle,
										children: t("overrideSparkContextWindow")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("overrideSparkContextWindowHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
									label: t("overrideSparkContextWindow"),
									disabled: contextWindow === void 0 || contextWindowBusy,
									checked: contextWindow?.overrideSparkContextWindow ?? false,
									onChange: (checked) => {
										updateSparkContextWindowOverride(checked);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("contextWindowHint")
							}),
							contextWindowError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: contextWindowError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: quotaTitleStyle,
								children: t("imageTools")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									...bodyStyle,
									marginTop: 5
								},
								children: t("imageToolsIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: toggleRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: toggleCopyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: statusStyle,
										children: t("modifyReadImage")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("modifyReadImageHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
									label: t("modifyReadImage"),
									disabled: imageTools === void 0 || imageToolsBusy,
									checked: imageTools?.modifyReadImage ?? false,
									onChange: (checked) => {
										updateImageTool({ modifyReadImage: checked });
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: toggleRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: toggleCopyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: statusStyle,
										children: t("shareImagegen")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("shareImagegenHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
									label: t("shareImagegen"),
									disabled: imageTools === void 0 || imageToolsBusy,
									checked: imageTools?.shareImagegenWithOtherModels ?? false,
									onChange: (checked) => {
										updateImageTool({ shareImagegenWithOtherModels: checked });
									}
								})]
							}),
							imageToolsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: imageToolsError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: quotaTitleStyle,
								children: t("responseApi")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									...bodyStyle,
									marginTop: 5
								},
								children: t("responseApiIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: toggleRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: toggleCopyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: statusStyle,
										children: t("webSocketContextReuse")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("webSocketContextReuseHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
									label: t("webSocketContextReuse"),
									disabled: responseApi === void 0 || responseApiBusy,
									checked: responseApi?.useWebSocketContextReuse ?? false,
									onChange: (checked) => {
										updateResponseApi({ useWebSocketContextReuse: checked });
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: toggleRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: toggleCopyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: statusStyle,
										children: t("nativeCompaction")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("nativeCompactionHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
									label: t("nativeCompaction"),
									disabled: responseApi === void 0 || responseApiBusy,
									checked: responseApi?.useNativeCompaction ?? false,
									onChange: (checked) => {
										updateResponseApi({ useNativeCompaction: checked });
									}
								})]
							}),
							responseApiError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: responseApiError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: quotaTitleStyle,
								children: t("fastMode")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									...bodyStyle,
									marginTop: 5
								},
								children: t("fastModeIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: toggleRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: toggleCopyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: statusStyle,
										children: t("fastModeDefault")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("fastModeDefaultHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreferenceToggle, {
									label: t("fastModeDefault"),
									disabled: fastMode === void 0 || fastModeBusy,
									checked: fastMode?.fastModeDefault ?? false,
									onChange: (checked) => {
										updateFastMode({ fastModeDefault: checked });
									}
								})]
							}),
							fastModeError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: fastModeError
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/ImagegenToolView.tsx
		/** Inline presentation for imagegen results in the conversation tool stream. */
		const rootStyle = {
			display: "flex",
			flexDirection: "column"
		};
		const rowStyle = {
			display: "flex",
			width: "100%",
			alignItems: "center",
			minHeight: 24,
			padding: 0,
			border: 0,
			background: "transparent",
			font: "inherit",
			fontSize: 14,
			lineHeight: "24px",
			textAlign: "left",
			cursor: "pointer"
		};
		const iconStyle = {
			width: 16,
			flex: "0 0 16px",
			color: "var(--dsw-alias-label-secondary)",
			textAlign: "center",
			transition: "transform 100ms ease"
		};
		const titleStyle = {
			marginLeft: 6,
			color: "var(--dsw-alias-label-primary)",
			whiteSpace: "nowrap"
		};
		const separatorStyle = {
			width: 2,
			height: 2,
			flex: "0 0 2px",
			margin: "0 8px",
			borderRadius: 1,
			background: "var(--dsw-alias-label-caption)"
		};
		const summaryStyle = {
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const imageWrapStyle = { margin: "6px 0 5px 22px" };
		const ioCardStyle = {
			display: "flex",
			flexDirection: "column",
			margin: "4px 0 4px 22px",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: 12,
			background: "var(--dsw-alias-markdown-code-block)"
		};
		const ioSectionStyle = {
			display: "grid",
			gridTemplateColumns: "max-content minmax(0, 1fr)",
			columnGap: 14,
			alignItems: "start",
			maxHeight: 180,
			padding: "12px 16px",
			overflow: "auto",
			font: "var(--dsw-font-markdown-code-block-small)"
		};
		const ioLabelStyle = {
			position: "sticky",
			top: 0,
			color: "var(--dsw-alias-label-caption)"
		};
		const ioTextStyle = {
			minWidth: 0,
			margin: 0,
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit"
		};
		const dividerStyle = {
			height: 1,
			background: "var(--dsw-alias-border-l2)"
		};
		const savedRowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			margin: "2px 0 4px 22px",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const savedButtonStyle = {
			padding: 0,
			border: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			textDecoration: "underline",
			textUnderlineOffset: 3,
			cursor: "pointer"
		};
		const inspectButtonStyle = {
			alignSelf: "flex-start",
			margin: "2px 0 2px 22px",
			padding: "2px 8px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 999,
			background: "var(--dsw-alias-bg-base)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 11,
			lineHeight: "16px",
			cursor: "pointer"
		};
		const imageButtonStyle = {
			display: "block",
			padding: 0,
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-1)",
			cursor: "zoom-in"
		};
		const imageStyle = {
			display: "block",
			maxWidth: 240,
			maxHeight: 240,
			objectFit: "contain"
		};
		const placeholderStyle = {
			display: "grid",
			placeItems: "center",
			width: 180,
			height: 120,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 13
		};
		const backdropStyle = {
			position: "fixed",
			inset: 0,
			zIndex: 1e4,
			display: "grid",
			placeItems: "center",
			padding: 32,
			background: "rgba(0, 0, 0, 0.78)"
		};
		const previewStyle = {
			display: "block",
			maxWidth: "calc(100vw - 64px)",
			maxHeight: "calc(100vh - 64px)",
			objectFit: "contain"
		};
		const closeStyle = {
			position: "fixed",
			top: 18,
			right: 18,
			width: 36,
			height: 36,
			border: 0,
			borderRadius: 18,
			background: "rgba(30, 30, 30, 0.75)",
			color: "white",
			fontSize: 24,
			lineHeight: "34px",
			cursor: "pointer"
		};
		function resultParts(block) {
			if (!("kind" in block) || block.kind !== "tool-result") return {
				running: true,
				failed: false,
				writeFailed: false,
				resultText: ""
			};
			let image;
			let text = "";
			for (const item of block.content) if (item.type === "image" && image === void 0) image = item.attachment;
			else if (item.type === "text") text += item.text;
			const path = text.match(/<output_path\s+operation="(?:create|update)">([^<]+)<\/output_path>/u)?.[1];
			return {
				running: false,
				failed: block.isError,
				...image === void 0 ? {} : { image },
				...path === void 0 ? {} : { path },
				writeFailed: text.includes("<output_error>"),
				resultText: text
			};
		}
		function argsRaw(block) {
			return "kind" in block ? block.call?.argsRaw ?? "{}" : block.argsRaw;
		}
		function prettyJson(raw) {
			try {
				return JSON.stringify(JSON.parse(raw), null, 2);
			} catch {
				return raw;
			}
		}
		function promptSummary(raw) {
			try {
				const value = JSON.parse(raw);
				if (typeof value === "object" && value !== null && "prompt" in value && typeof value.prompt === "string") return value.prompt;
			} catch {}
			return raw;
		}
		function resultOutput(result) {
			if (result.image === void 0) return result.resultText;
			return JSON.stringify({
				attachment: result.image,
				...result.path === void 0 ? {} : { outputPath: result.path },
				...result.writeFailed ? { workspaceSave: "failed" } : {}
			}, null, 2);
		}
		function GeneratedImage({ attachment, load, t }) {
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [src, setSrc] = (0, react.useState)();
			const [failed, setFailed] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const opener = (0, react.useRef)(null);
			const close = (0, react.useCallback)(() => {
				setOpen(false);
			}, []);
			(0, react.useEffect)(() => {
				let live = true;
				setSrc(void 0);
				setFailed(false);
				load(attachment).then((value) => {
					if (live) setSrc(value);
				}, () => {
					if (live) setFailed(true);
				});
				return () => {
					live = false;
				};
			}, [
				attachment,
				attempt,
				load
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const keydown = (event) => {
					if (event.key === "Escape") close();
				};
				window.addEventListener("keydown", keydown);
				return () => {
					window.removeEventListener("keydown", keydown);
					opener.current?.focus();
				};
			}, [close, open]);
			const name = attachment.name ?? t("generatedImage");
			if (failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				style: {
					...imageButtonStyle,
					...placeholderStyle,
					cursor: "pointer"
				},
				onClick: () => {
					setAttempt((value) => value + 1);
				},
				children: t("imageLoadFailed")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				ref: opener,
				type: "button",
				style: imageButtonStyle,
				title: t("imageOpen"),
				"aria-label": t("imageOpenNamed", { name }),
				onClick: () => {
					if (src !== void 0) setOpen(true);
				},
				children: src === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: placeholderStyle,
					children: t("imageLoading")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src,
					alt: name,
					style: imageStyle
				})
			}), open && src !== void 0 ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "dialog",
				"aria-modal": "true",
				"aria-label": t("imagePreview"),
				style: backdropStyle,
				onMouseDown: close,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src,
					alt: name,
					style: previewStyle,
					onMouseDown: (event) => {
						event.stopPropagation();
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": t("imageClose"),
					style: closeStyle,
					onClick: close,
					children: "×"
				})]
			}), document.body) : null] });
		}
		/** A visible imagegen row: its generated attachment stays in the transcript and opens at original size. */
		function ImagegenToolView({ block, toolName, openFile, inspect, loadImage, t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const result = resultParts(block);
			const input = argsRaw(block);
			const summary = promptSummary(input);
			const output = resultOutput(result);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rootStyle,
				"data-tool": "imagegen",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						style: rowStyle,
						"aria-expanded": expanded,
						onClick: () => {
							setExpanded((value) => !value);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: {
									...iconStyle,
									transform: expanded ? "rotate(90deg)" : void 0
								},
								children: "›"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: titleStyle,
								children: t("toolCallTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: separatorStyle
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									...summaryStyle,
									flex: "0 0 auto",
									maxWidth: "28%"
								},
								children: toolName
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: separatorStyle
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									...summaryStyle,
									...result.failed ? { color: "var(--dsw-alias-state-error-primary)" } : {}
								},
								children: result.failed ? t("imageGenerationFailed") : result.running && summary === "" ? t("imageGenerating") : summary
							})
						]
					}),
					expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: ioCardStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: ioSectionStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: ioLabelStyle,
								children: "IN"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								style: ioTextStyle,
								children: prettyJson(input)
							})]
						}), output !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							style: dividerStyle
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: ioSectionStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: ioLabelStyle,
								children: "OUT"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								style: {
									...ioTextStyle,
									...result.failed ? { color: "var(--dsw-alias-state-error-primary)" } : {}
								},
								children: output
							})]
						})] }) : null]
					}), inspect === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: inspectButtonStyle,
						onClick: inspect,
						children: t("inspectToolCall")
					})] }) : null,
					result.image === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: imageWrapStyle,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GeneratedImage, {
							attachment: result.image,
							load: loadImage,
							t
						})
					}),
					result.path === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: savedRowStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("imageSavedAs") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: savedButtonStyle,
							title: result.path,
							onClick: () => {
								openFile(result.path);
							},
							children: result.path
						})]
					}),
					!result.running && result.path === void 0 && result.writeFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: savedRowStyle,
						children: t("imageGeneratedAttachmentOnly")
					}) : null
				]
			});
		}
		//#endregion
		//#region src/fast-mode-paths.ts
		/** Node-free Fast Mode route constants shared by Host and browser halves. */
		/** GET/POST endpoint for one conversation's process-local Fast Mode state. */
		const OPENAI_CODEX_FAST_MODE_PATH = "/plugins/dsh-openai-codex/fast-mode";
		//#endregion
		//#region src/client/OpenAICodexFastModeToggle.tsx
		/** Per-conversation OpenAI Codex Fast Mode control for the Composer row. */
		const CODEX_PROVIDER$1 = "openai-codex";
		const FAST_MODE_ACTIVE_COLOR = "#f97316";
		function isRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function readEnabled(value) {
			if (!isRecord$1(value) || typeof value["enabled"] !== "boolean") return void 0;
			return value["enabled"];
		}
		function isEligible(state) {
			const current = state.current;
			return state.status === "ready" && current?.provider === CODEX_PROVIDER$1 && typeof current.model === "string" && current.model.startsWith("gpt-");
		}
		function subscribeDirectory$1(directory, listener) {
			return directory.subscribe(listener);
		}
		function requestUrl(sessionId) {
			return `${OPENAI_CODEX_FAST_MODE_PATH}?sessionId=${encodeURIComponent(sessionId)}`;
		}
		/**
		* Render a real SVG lightning button only for GPT models on the exact Codex
		* provider.  Host state is read and written through the session-addressed
		* route; no global model slot or persistent settings are changed.
		*/
		function OpenAICodexFastModeToggle({ directory, sessionId, t }) {
			const eligible = isEligible((0, react.useSyncExternalStore)((listener) => subscribeDirectory$1(directory, listener), () => directory.getSnapshot(), () => directory.getSnapshot()));
			const [state, setState] = (0, react.useState)({
				status: "loading",
				enabled: false
			});
			const [tooltipVisible, setTooltipVisible] = (0, react.useState)(false);
			const controllerRef = (0, react.useRef)(void 0);
			const tooltipId = (0, react.useId)();
			(0, react.useEffect)(() => () => {
				controllerRef.current?.abort();
			}, []);
			(0, react.useEffect)(() => {
				controllerRef.current?.abort();
				controllerRef.current = void 0;
				if (!eligible) {
					setState({
						status: "loading",
						enabled: false
					});
					return;
				}
				const controller = new AbortController();
				controllerRef.current = controller;
				let disposed = false;
				setState({
					status: "loading",
					enabled: false
				});
				(async () => {
					try {
						const response = await fetch(requestUrl(sessionId), {
							method: "GET",
							credentials: "same-origin",
							headers: { accept: "application/json" },
							signal: controller.signal
						});
						const enabled = response.ok ? readEnabled(await response.json().catch(() => void 0)) : void 0;
						if (!disposed && !controller.signal.aborted) setState(enabled === void 0 ? {
							status: "error",
							enabled: false
						} : {
							status: "ready",
							enabled
						});
					} catch {
						if (!disposed && !controller.signal.aborted) setState({
							status: "error",
							enabled: false
						});
					} finally {
						if (controllerRef.current === controller) controllerRef.current = void 0;
					}
				})();
				return () => {
					disposed = true;
					controller.abort();
					if (controllerRef.current === controller) controllerRef.current = void 0;
				};
			}, [eligible, sessionId]);
			if (!eligible) return null;
			const busy = state.status !== "ready";
			const title = state.status === "loading" ? t("fastModeLoadingTitle") : state.status === "error" ? t("fastModeUnavailableTitle") : state.enabled ? t("fastModeEnabledTitle") : t("fastModeDisabledTitle");
			const toggle = () => {
				if (state.status !== "ready" || busy) return;
				controllerRef.current?.abort();
				const controller = new AbortController();
				controllerRef.current = controller;
				const next = !state.enabled;
				setState((current) => ({
					...current,
					status: "loading"
				}));
				(async () => {
					try {
						const response = await fetch(OPENAI_CODEX_FAST_MODE_PATH, {
							method: "POST",
							credentials: "same-origin",
							headers: {
								accept: "application/json",
								"content-type": "application/json"
							},
							body: JSON.stringify({
								sessionId,
								enabled: next
							}),
							signal: controller.signal
						});
						const enabled = response.ok ? readEnabled(await response.json().catch(() => void 0)) : void 0;
						if (!controller.signal.aborted) setState(enabled === void 0 ? {
							status: "error",
							enabled: state.enabled
						} : {
							status: "ready",
							enabled
						});
					} catch {
						if (!controller.signal.aborted) setState({
							status: "error",
							enabled: state.enabled
						});
					} finally {
						if (controllerRef.current === controller) controllerRef.current = void 0;
					}
				})();
			};
			const active = state.enabled;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				onMouseEnter: () => {
					setTooltipVisible(true);
				},
				onMouseLeave: () => {
					setTooltipVisible(false);
				},
				onFocus: () => {
					setTooltipVisible(true);
				},
				onBlur: () => {
					setTooltipVisible(false);
				},
				style: {
					display: "inline-flex",
					position: "relative",
					width: 30,
					height: 30
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"data-openai-codex-fast-mode": active ? "on" : "off",
					"aria-label": title,
					"aria-describedby": tooltipVisible ? tooltipId : void 0,
					"aria-pressed": active,
					"aria-busy": busy,
					disabled: busy,
					onClick: toggle,
					style: {
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						width: 30,
						height: 30,
						padding: 0,
						border: 0,
						borderRadius: 8,
						background: "transparent",
						color: active ? FAST_MODE_ACTIVE_COLOR : "var(--dsw-alias-label-secondary)",
						cursor: busy ? "default" : "pointer",
						opacity: busy ? .6 : 1
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "16",
						height: "16",
						viewBox: "0 0 24 24",
						"aria-hidden": "true",
						focusable: "false",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							"data-openai-codex-fast-mode-bolt": active ? "filled" : "outline",
							d: "M13.1 2.75 5.35 13.1h5.8l-.95 8.15 8.45-11.2h-5.9l.35-7.3Z",
							fill: active ? "currentColor" : "none",
							stroke: "currentColor",
							strokeWidth: "1.8",
							strokeLinejoin: "round"
						})
					})
				}), tooltipVisible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					id: tooltipId,
					role: "tooltip",
					style: {
						position: "absolute",
						left: "50%",
						bottom: "calc(100% + 8px)",
						zIndex: 1e3,
						transform: "translateX(-50%)",
						padding: "4px 8px",
						borderRadius: 6,
						background: "var(--dsw-specific-tip, #1f2329)",
						boxShadow: "var(--dsw-shadow-lv2)",
						color: "var(--dsw-alias-label-primary, #fff)",
						fontSize: 12,
						lineHeight: "18px",
						whiteSpace: "nowrap",
						pointerEvents: "none"
					},
					children: title
				})]
			});
		}
		//#endregion
		//#region src/auth-paths.ts
		/** Node-free route constants shared by the Host and browser plugin halves. */
		/** Plugin-owned status endpoint consumed by its browser half. */
		const OPENAI_CODEX_AUTH_STATUS_PATH = "/plugins/dsh-openai-codex/auth/status";
		//#endregion
		//#region src/client/OpenAICodexQuotaIndicator.tsx
		/** Compact weekly Codex quota indicator for the Composer tool row. */
		const WEEK_SECONDS = 604800;
		const USAGE_POLL_INTERVAL_MS = 6e4;
		const CODEX_PROVIDER = "openai-codex";
		const SPARK_MODEL = "gpt-5.3-codex-spark";
		const SPARK_QUOTA_ID = "codex_bengalfox";
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function isWindow(value) {
			if (!isRecord(value)) return false;
			const remainingPercent = value["remainingPercent"];
			const windowSeconds = value["windowSeconds"];
			const resetAt = value["resetAt"];
			return typeof remainingPercent === "number" && Number.isFinite(remainingPercent) && remainingPercent >= 0 && remainingPercent <= 100 && typeof windowSeconds === "number" && Number.isSafeInteger(windowSeconds) && windowSeconds > 0 && (resetAt === void 0 || typeof resetAt === "number" && Number.isSafeInteger(resetAt) && resetAt > 0 && Number.isFinite((/* @__PURE__ */ new Date(resetAt * 1e3)).getTime()));
		}
		function usageFromStatus(value) {
			if (!isRecord(value) || value["status"] !== "signed-in") return void 0;
			const usage = value["usage"];
			if (!isRecord(usage) || !Array.isArray(usage["rateLimits"])) return void 0;
			const rateLimits = usage["rateLimits"];
			for (const limit of rateLimits) {
				if (!isRecord(limit) || typeof limit["id"] !== "string" || !Array.isArray(limit["windows"])) return void 0;
				if (!limit["windows"].every(isWindow)) return void 0;
			}
			return usage;
		}
		function weeklyQuotaOf(usage, model) {
			const quotaId = model === SPARK_MODEL ? SPARK_QUOTA_ID : "codex";
			return usage.rateLimits.find((limit) => limit.id === quotaId)?.windows.find((window) => window.windowSeconds === WEEK_SECONDS);
		}
		function isGptModel(state) {
			const current = state.current;
			return state.status === "ready" && current?.provider === CODEX_PROVIDER && typeof current.model === "string" && current.model.toLowerCase().startsWith("gpt-");
		}
		function formatPercent(percent) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(percent);
		}
		const QUOTA_PROGRESS_WIDTH_PX = 48;
		const QUOTA_PROGRESS_TRACK_HEIGHT_PX = 6;
		function boundedQuotaPercent(remainingPercent) {
			return Math.min(100, Math.max(0, remainingPercent));
		}
		function quotaProgressColor(remainingPercent) {
			const bounded = boundedQuotaPercent(remainingPercent);
			if (bounded >= 60) return {
				name: "green",
				value: "var(--dsw-alias-state-success-primary, #22c55e)"
			};
			if (bounded >= 40) return {
				name: "yellow",
				value: "var(--dsw-alias-state-warn-primary, #eab308)"
			};
			if (bounded >= 20) return {
				name: "orange",
				value: "#f97316"
			};
			return {
				name: "red",
				value: "var(--dsw-alias-state-error-primary, #ef4444)"
			};
		}
		function subscribeDirectory(directory, listener) {
			return directory.subscribe(listener);
		}
		/** Render nothing until an eligible GPT Codex session has a usable weekly quota. */
		function OpenAICodexQuotaIndicator({ directory, t }) {
			const directoryState = (0, react.useSyncExternalStore)((listener) => subscribeDirectory(directory, listener), () => directory.getSnapshot(), () => directory.getSnapshot());
			const eligible = isGptModel(directoryState);
			const [request, setRequest] = (0, react.useState)({ status: "loading" });
			const [isHovered, setIsHovered] = (0, react.useState)(false);
			const [isFocused, setIsFocused] = (0, react.useState)(false);
			const tooltipId = (0, react.useId)();
			(0, react.useEffect)(() => {
				if (!eligible) {
					setRequest({ status: "hidden" });
					return;
				}
				const controller = new AbortController();
				let inFlight = false;
				let disposed = false;
				const refresh = async () => {
					if (inFlight || disposed) return;
					inFlight = true;
					try {
						const response = await fetch(OPENAI_CODEX_AUTH_STATUS_PATH, {
							method: "GET",
							credentials: "same-origin",
							headers: { accept: "application/json" },
							signal: controller.signal
						});
						const value = await response.json().catch(() => void 0);
						const usage = response.ok ? usageFromStatus(value) : void 0;
						if (!disposed && !controller.signal.aborted) setRequest(usage === void 0 ? { status: "hidden" } : {
							status: "ready",
							usage
						});
					} catch {
						if (!disposed && !controller.signal.aborted) setRequest({ status: "hidden" });
					} finally {
						inFlight = false;
					}
				};
				setRequest({ status: "loading" });
				refresh();
				const timer = window.setInterval(() => {
					refresh();
				}, USAGE_POLL_INTERVAL_MS);
				return () => {
					disposed = true;
					window.clearInterval(timer);
					controller.abort();
				};
			}, [eligible]);
			if (!eligible || request.status !== "ready" || request.usage === void 0) return null;
			const weekly = weeklyQuotaOf(request.usage, directoryState.current?.model);
			if (weekly === void 0) return null;
			const summary = t("composerWeeklyQuotaSummary", {
				percent: formatPercent(weekly.remainingPercent),
				time: formatOpenAICodexResetAt(weekly.resetAt) ?? t("resetUnavailable")
			});
			const boundedPercent = boundedQuotaPercent(weekly.remainingPercent);
			const progressColor = quotaProgressColor(weekly.remainingPercent);
			const tooltipVisible = isHovered || isFocused;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				role: "status",
				"data-openai-codex-quota": "weekly",
				"aria-label": summary,
				"aria-describedby": tooltipVisible ? tooltipId : void 0,
				tabIndex: 0,
				onMouseEnter: () => {
					setIsHovered(true);
				},
				onMouseLeave: () => {
					setIsHovered(false);
				},
				onFocus: () => {
					setIsFocused(true);
				},
				onBlur: () => {
					setIsFocused(false);
				},
				style: {
					display: "inline-flex",
					width: `${QUOTA_PROGRESS_WIDTH_PX}px`,
					height: "28px",
					position: "relative",
					alignItems: "center",
					justifyContent: "center"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": "true",
					"data-openai-codex-quota-track": "weekly",
					style: {
						display: "block",
						width: `${QUOTA_PROGRESS_WIDTH_PX}px`,
						height: `${QUOTA_PROGRESS_TRACK_HEIGHT_PX}px`,
						borderRadius: "999px",
						backgroundColor: "var(--dsw-alias-border-l2)",
						overflow: "hidden"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						"data-openai-codex-quota-progress": "weekly",
						"data-openai-codex-quota-color": progressColor.name,
						style: {
							display: "block",
							width: `${boundedPercent}%`,
							height: "100%",
							borderRadius: "inherit",
							backgroundColor: progressColor.value
						}
					})
				}), tooltipVisible ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					id: tooltipId,
					role: "tooltip",
					"data-openai-codex-quota-tooltip": "weekly",
					style: {
						position: "absolute",
						bottom: "calc(100% + 6px)",
						left: "50%",
						transform: "translateX(-50%)",
						zIndex: 1e3,
						whiteSpace: "nowrap",
						pointerEvents: "none",
						padding: "4px 8px",
						borderRadius: "6px",
						backgroundColor: "var(--dsw-specific-tip, #1f2329)",
						color: "var(--dsw-alias-label-primary, #ffffff)",
						boxShadow: "var(--dsw-shadow-lv2, 0 4px 12px rgb(0 0 0 / 12%))",
						fontSize: "12px",
						lineHeight: "18px"
					},
					children: summary
				}) : null]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** English copy for the OpenAI Codex settings page. */
		const en = {
			nav: "OpenAI Codex",
			title: "OpenAI Codex",
			intro: "Use your ChatGPT subscription in dsh without an API key.",
			loadingAccount: "Loading account…",
			signedOut: "Not signed in",
			signingIn: "Waiting for browser authorization…",
			signedIn: "Signed in",
			reauthRequired: "Sign in again",
			login: "Sign in with ChatGPT",
			loginAgain: "Sign in again",
			logout: "Sign out",
			working: "Working…",
			retry: "Retry",
			popupBlocked: "The browser blocked the sign-in window. Allow pop-ups for this dsh page and retry.",
			usageLimits: "Usage limits",
			fiveHourLimit: "5-hour limit",
			weeklyLimit: "Weekly limit",
			hourLimit: "{count}-hour limit",
			usageWindow: "Usage window",
			percentRemaining: "{percent}% remaining",
			monthlyLimit: "Monthly credit limit",
			exactRemaining: "{remaining} of {limit} credits remaining",
			credits: "Credits",
			unlimited: "Unlimited",
			available: "Available",
			quotaUnavailable: "Usage limits are temporarily unavailable.",
			resetAt: "Resets {time}",
			resetUnavailable: "Reset time unavailable",
			composerWeeklyQuota: "Codex weekly quota",
			composerWeeklyQuotaSummary: "Codex weekly quota: {percent}% remaining; resets {time}",
			fastModeLoadingTitle: "Fast Mode state is loading for this conversation.",
			fastModeUnavailableTitle: "Fast Mode is unavailable for this conversation.",
			fastModeEnabledTitle: "Current: 1.5× speed, with faster quota consumption. Click to switch to Standard speed.",
			fastModeDisabledTitle: "Current: Standard speed. Click to enable 1.5× speed.",
			fastMode: "Fast Mode",
			fastModeIntro: "Speed up Codex requests with the provider's priority service tier.",
			fastModeDefault: "Force 1.5× speed by default",
			fastModeDefaultHint: "When enabled, every conversation uses 1.5× speed with faster quota consumption, without toggling the per-conversation ⚡ switch.",
			fastModeSettingsFailed: "Fast Mode settings could not be saved.",
			requestFailed: "The OpenAI Codex account request failed.",
			remoteOriginTitle: "Browser origin is not trusted",
			remoteOriginDescription: "OpenAI Codex accepts browser OAuth requests only from local pages or origins explicitly approved on the device running dsh.",
			remoteOriginCommandHelp: "Run this command on the dsh host, then retry:",
			remoteOriginCopy: "Copy command",
			remoteOriginCopied: "Copied",
			remoteOriginCopyFailed: "Could not copy the command.",
			proxy: "Network proxy",
			proxyIntro: "Choose how this plugin applies a proxy. Changes take effect without restarting dsh.",
			proxyMode: "Proxy scope",
			proxyModeOff: "Follow dsh",
			proxyModeScoped: "Codex only",
			proxyModeGlobal: "All dsh",
			proxyModeOffHint: "The plugin does not override networking. Codex still follows any process-wide proxy configured when dsh started.",
			proxyModeScopedHint: "Codex HTTP requests and OAuth token refresh use this proxy. Initial login and WebSocket transport continue to follow dsh networking.",
			proxyModeGlobalHint: "Applies this proxy to the whole dsh process, including OAuth. Requests from other plugins are affected too.",
			proxyUrl: "Proxy URL",
			proxyUrlPlaceholder: "Use proxy environment variables",
			proxyUrlHint: "Use an HTTP(S) proxy URL. Leave blank to use DSH_CODEX_PROXY or the standard HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, and NO_PROXY environment variables.",
			proxySave: "Save proxy",
			proxySaved: "Proxy settings saved.",
			proxySettingsFailed: "Proxy settings could not be saved.",
			modelCatalog: "Models shown in the selector",
			modelCatalogIntro: "Choose which Codex models appear in model selectors. Existing conversations can continue using a hidden model.",
			modelCatalogSettingsFailed: "Model selector settings could not be saved.",
			modelFieldName: "Name:",
			modelFieldId: "ID:",
			modelFieldDefaultWindow: "Default window:",
			modelFieldEnabled: "Enable:",
			modelEnableLabel: "Show {name} in model selectors",
			modelContextWindowValue: "{value} tokens",
			contextWindow: "Context window",
			contextWindowIntro: "Override the client-side capacity that dsh uses for the token meter, overflow detection, and automatic compaction on the next model request.",
			contextWindowInput: "Capacity (K tokens)",
			contextWindowPlaceholder: "Provider default",
			contextWindowHint: "Provider defaults are shown in the model list above. Leave blank to use them. The override applies to Codex models except Spark unless enabled below; an open conversation’s meter refreshes after its next request. This does not increase the backend’s actual capacity, so an unsupported value can still overflow.",
			overrideSparkContextWindow: "Override GPT-5.3 Codex Spark",
			overrideSparkContextWindowHint: "Off by default to keep Spark at its provider-declared 128K window. Enable only if Spark supports the configured override.",
			contextWindowSave: "Save capacity",
			contextWindowInvalid: "Enter a positive capacity in K tokens, or leave the field blank.",
			contextWindowSettingsFailed: "Context-window settings could not be saved.",
			imageTools: "Image tools",
			imageToolsIntro: "Extend Harness image reading and choose whether other vision models can use image generation.",
			modifyReadImage: "Enhance read_image",
			modifyReadImageHint: "Adds HTTP(S) URL input to Harness read_image. Local paths keep using its existing filesystem implementation.",
			shareImagegen: "Image generation for other models",
			shareImagegenHint: "Lets non-Codex vision models generate or edit images with your ChatGPT Codex login.",
			imageToolSettingsFailed: "Image tool settings could not be saved.",
			responseApi: "Responses API experiments",
			responseApiIntro: "These switches affect OpenAI Codex requests only. Existing conversations remain readable when either switch is turned off.",
			webSocketContextReuse: "WebSocket context reuse",
			webSocketContextReuseHint: "Keeps store disabled and reuses matching context with previous_response_id on the same Codex WebSocket connection.",
			nativeCompaction: "Native Responses compaction",
			nativeCompactionHint: "Uses Codex V2 compaction through /responses with a compaction_trigger item, then carries the encrypted compaction item into later requests. Falls back to Harness compaction when V2 is unavailable.",
			responseApiSettingsFailed: "Responses API settings could not be saved.",
			toolCallTitle: "Tool call",
			imageGenerating: "Generating…",
			imageGenerationFailed: "Generation failed",
			imageGeneratedAttachmentOnly: "Generated; workspace save failed",
			generatedImage: "Generated image",
			imageOpen: "Open original image",
			imageOpenNamed: "Open {name}",
			imageLoading: "Loading image…",
			imageLoadFailed: "Could not load image. Click to retry.",
			imagePreview: "Image preview",
			imageClose: "Close image preview",
			inspectToolCall: "Inspect",
			imageSavedAs: "Saved as"
		};
		/** Chinese copy for the OpenAI Codex settings page. */
		const zh = {
			nav: "OpenAI Codex",
			title: "OpenAI Codex",
			intro: "使用 ChatGPT 订阅在 dsh 中调用模型，无需 API Key。",
			loadingAccount: "正在加载账户信息…",
			signedOut: "尚未登录",
			signingIn: "正在等待浏览器授权…",
			signedIn: "已登录",
			reauthRequired: "需要重新登录",
			login: "使用 ChatGPT 登录",
			loginAgain: "重新登录",
			logout: "退出登录",
			working: "处理中…",
			retry: "重试",
			popupBlocked: "浏览器阻止了登录窗口。请允许此 dsh 页面弹出窗口后重试。",
			usageLimits: "使用额度",
			fiveHourLimit: "5 小时额度",
			weeklyLimit: "每周额度",
			hourLimit: "{count} 小时额度",
			usageWindow: "使用额度",
			percentRemaining: "剩余 {percent}%",
			monthlyLimit: "每月信用额度",
			exactRemaining: "剩余 {remaining} / {limit} credits",
			credits: "Credits",
			unlimited: "无限",
			available: "可用",
			quotaUnavailable: "暂时无法获取使用额度。",
			resetAt: "重置时间：{time}",
			resetUnavailable: "无法获取重置时间",
			composerWeeklyQuota: "Codex 周额度",
			composerWeeklyQuotaSummary: "Codex 周额度：剩余 {percent}%；重置时间 {time}",
			fastModeLoadingTitle: "正在加载此对话的 Fast Mode 状态。",
			fastModeUnavailableTitle: "此对话暂时无法使用 Fast Mode。",
			fastModeEnabledTitle: "当前：1.5 倍速度，额度消耗更快。点击切换到标准速度",
			fastModeDisabledTitle: "当前：标准速度。点击开启 1.5 倍速度",
			fastMode: "Fast Mode",
			fastModeIntro: "通过提供方的 priority service tier 加速 Codex 请求。",
			fastModeDefault: "默认强制开启 1.5 倍速",
			fastModeDefaultHint: "开启后所有会话默认使用 1.5 倍速，额度消耗更快，无需逐会话点击 ⚡ 开关。",
			fastModeSettingsFailed: "无法保存 Fast Mode 设置。",
			requestFailed: "OpenAI Codex 账户请求失败。",
			remoteOriginTitle: "浏览器来源尚未受信任",
			remoteOriginDescription: "OpenAI Codex 仅接受本机页面，或已在运行 dsh 的设备上明确授权的浏览器来源发起 OAuth 请求。",
			remoteOriginCommandHelp: "请在 dsh 主机上运行以下命令，然后重试：",
			remoteOriginCopy: "复制命令",
			remoteOriginCopied: "已复制",
			remoteOriginCopyFailed: "无法复制命令。",
			proxy: "网络代理",
			proxyIntro: "选择插件应用代理的范围；修改后无需重启 dsh。",
			proxyMode: "代理范围",
			proxyModeOff: "跟随 dsh",
			proxyModeScoped: "仅 Codex",
			proxyModeGlobal: "整个 dsh",
			proxyModeOffHint: "插件不覆盖网络设置；如果 dsh 启动时已配置进程级代理，Codex 仍会遵循该策略。",
			proxyModeScopedHint: "Codex HTTP 请求与 OAuth Token 刷新使用此代理；首次登录和 WebSocket 仍遵循 dsh 的网络策略。",
			proxyModeGlobalHint: "把此代理应用到整个 dsh 进程，并覆盖 OAuth；其他插件的请求也会受到影响。",
			proxyUrl: "代理 URL",
			proxyUrlPlaceholder: "使用代理环境变量",
			proxyUrlHint: "请输入 HTTP(S) 代理 URL；留空时读取 DSH_CODEX_PROXY，或标准的 HTTP_PROXY、HTTPS_PROXY、ALL_PROXY 与 NO_PROXY 环境变量。",
			proxySave: "保存代理",
			proxySaved: "代理设置已保存。",
			proxySettingsFailed: "无法保存代理设置。",
			modelCatalog: "模型选择器中显示的模型",
			modelCatalogIntro: "选择要在模型选择器中显示的 Codex 模型；隐藏模型后，已有会话仍可继续使用。",
			modelCatalogSettingsFailed: "无法保存模型选择器设置。",
			modelFieldName: "名称：",
			modelFieldId: "ID：",
			modelFieldDefaultWindow: "默认窗口：",
			modelFieldEnabled: "启用：",
			modelEnableLabel: "在模型选择器中显示 {name}",
			modelContextWindowValue: "{value} tokens",
			contextWindow: "上下文窗口",
			contextWindowIntro: "覆盖 dsh 在下一次模型请求中用于上下文用量显示、溢出判断和自动压缩的客户端容量。",
			contextWindowInput: "容量（K tokens）",
			contextWindowPlaceholder: "提供方默认值",
			contextWindowHint: "各模型的提供方默认值显示在上方模型列表中；留空会使用这些默认值。覆盖值默认应用于 Spark 之外的 Codex 模型，已打开会话的用量显示会在下一次请求后刷新。该设置不会提高后端的真实容量，超过模型能力时请求仍可能溢出。",
			overrideSparkContextWindow: "同时覆盖 GPT-5.3 Codex Spark",
			overrideSparkContextWindowHint: "默认关闭，使 Spark 保持提供方声明的 128K 窗口；仅在确认 Spark 支持所设覆盖值时启用。",
			contextWindowSave: "保存容量",
			contextWindowInvalid: "请输入以 K tokens 为单位的正数，或留空恢复默认值。",
			contextWindowSettingsFailed: "无法保存上下文窗口设置。",
			imageTools: "图片工具",
			imageToolsIntro: "扩展 Harness 的图片读取能力，并选择其他视觉模型能否使用生图。",
			modifyReadImage: "增强 read_image",
			modifyReadImageHint: "为 Harness 自带的 read_image 增加 HTTP(S) URL 输入；本地路径继续使用原有文件系统实现。",
			shareImagegen: "允许其他模型使用生图",
			shareImagegenHint: "允许非 Codex 视觉模型通过你的 ChatGPT Codex 登录生成或编辑图片。",
			imageToolSettingsFailed: "无法保存图片工具设置。",
			responseApi: "Responses API 实验功能",
			responseApiIntro: "这些开关只影响 OpenAI Codex 请求。关闭开关后，已有会话仍可继续使用。",
			webSocketContextReuse: "WebSocket 上下文复用",
			webSocketContextReuseHint: "保持 store 关闭；同一 Codex WebSocket 连接内上下文严格衔接时，通过 previous_response_id 发送增量。",
			nativeCompaction: "原生 Responses 压缩",
			nativeCompactionHint: "通过 /responses 发送 compaction_trigger，调用 Codex V2 压缩，并把返回的加密 compaction item 带入后续请求；V2 不可用时自动回退到 Harness 压缩。",
			responseApiSettingsFailed: "无法保存 Responses API 设置。",
			toolCallTitle: "工具调用",
			imageGenerating: "正在生成…",
			imageGenerationFailed: "生成失败",
			imageGeneratedAttachmentOnly: "图片已生成，但保存到工作区失败",
			generatedImage: "生成的图片",
			imageOpen: "查看原图",
			imageOpenNamed: "查看原图：{name}",
			imageLoading: "正在加载图片…",
			imageLoadFailed: "图片加载失败，点击重试。",
			imagePreview: "图片预览",
			imageClose: "关闭图片预览",
			inspectToolCall: "检查",
			imageSavedAs: "已保存到"
		};
		//#endregion
		//#region src/client/index.tsx
		/** Stable browser-plugin name. */
		const name = "dsh-codex-client";
		/** Client services required by the settings contribution. */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"remote",
			"remote.session"
		];
		/** Register account copy and the OpenAI Codex settings page. */
		function apply(ctx) {
			const namespace = "settings.openai-codex";
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "dsh-openai-codex: settings copy");
			const t = ctx.locale.bind(namespace);
			const imageUrls = /* @__PURE__ */ new Map();
			const createdUrls = /* @__PURE__ */ new Set();
			const loadImage = (sessionId, attachment) => {
				const key = `${sessionId}:${attachment.attachmentId}`;
				const cached = imageUrls.get(key);
				if (cached !== void 0) return cached;
				const session = ctx.sessions.binding(sessionId)?.session;
				if (session === void 0) return Promise.reject(/* @__PURE__ */ new Error(`unknown session ${sessionId}`));
				const pending = session.readAttachment(attachment.attachmentId).then((result) => {
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
					const bytes = Uint8Array.from(result.value.data);
					const url = URL.createObjectURL(new Blob([bytes.buffer], { type: result.value.attachment.mediaType }));
					createdUrls.add(url);
					return url;
				}).catch((error) => {
					imageUrls.delete(key);
					throw error;
				});
				imageUrls.set(key, pending);
				return pending;
			};
			ctx.effect(() => () => {
				for (const url of createdUrls) URL.revokeObjectURL(url);
				createdUrls.clear();
				imageUrls.clear();
			}, "dsh-openai-codex: release image URLs");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "openai-codex",
				order: 15,
				label: () => t("nav"),
				inject: () => ({ t })
			}, OpenAICodexSettings));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "imagegen",
				inject: (sessionId) => ({
					loadImage: (attachment) => loadImage(sessionId, attachment),
					t
				})
			}, ImagegenToolView));
			ctx.inject([
				"slots",
				"modelDirectories",
				"remote",
				"remote.session"
			], (scope) => {
				scope.slots.inject("conversation.input.right", () => scope.slots.register({
					name: "conversation.input.right",
					id: "openai-codex-fast-mode",
					order: 10,
					locale: namespace,
					inject: (sessionId) => ({ directory: scope.modelDirectories.directoryFor(sessionId).store })
				}, OpenAICodexFastModeToggle));
				scope.slots.inject("conversation.input.right", () => scope.slots.register({
					name: "conversation.input.right",
					id: "openai-codex-quota",
					order: 20,
					locale: namespace,
					inject: (sessionId) => ({ directory: scope.modelDirectories.directoryFor(sessionId).store })
				}, OpenAICodexQuotaIndicator));
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

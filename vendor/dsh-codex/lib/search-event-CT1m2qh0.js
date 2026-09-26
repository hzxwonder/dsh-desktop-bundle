import { createModels } from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { lstat, mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { WebError } from "@deepseek-ai/dsh-web";
import { KNOWN_SESSION_EVENT_TYPES } from "@deepseek-ai/dsh-session";
//#region src/oauth-provider.ts
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
function claims$1(token) {
	try {
		const value = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
		if (value && typeof value === "object" && !Array.isArray(value)) return value;
	} catch {}
	return {};
}
/** Full token response, unlike pi-ai's projection which discards id_token. */
async function refreshOpenAICodexCredential(credential, signal, requestFetch = globalThis.fetch) {
	signal.throwIfAborted();
	const response = await requestFetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: credential.refresh,
			client_id: CLIENT_ID
		}),
		redirect: "error",
		signal
	});
	if (!response.ok) throw new Error(`OpenAI Codex token refresh failed (${response.status})`);
	let raw;
	try {
		raw = await response.json();
	} catch {
		throw new Error("OpenAI Codex token refresh returned invalid JSON");
	}
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("OpenAI Codex token refresh returned invalid fields");
	const data = raw;
	for (const key of [
		"access_token",
		"refresh_token",
		"id_token"
	]) if (typeof data[key] !== "string" || !data[key]) throw new Error(`OpenAI Codex token refresh missing ${key}`);
	if (typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("OpenAI Codex token refresh returned invalid expiry");
	const access = data.access_token;
	const idToken = data.id_token;
	const identity = claims$1(access)["https://api.openai.com/auth"];
	const accountId = identity && typeof identity === "object" ? identity.chatgpt_account_id : void 0;
	const idClaims = claims$1(idToken);
	const idAuth = idClaims["https://api.openai.com/auth"];
	const idAccount = idAuth && typeof idAuth === "object" ? idAuth.chatgpt_account_id : void 0;
	if (typeof accountId !== "string" || !accountId || idAccount !== void 0 && idAccount !== accountId) throw new Error("OpenAI Codex token refresh returned inconsistent account identity");
	return {
		type: "oauth",
		access,
		refresh: data.refresh_token,
		expires: Date.now() + data.expires_in * 1e3,
		accountId,
		idToken,
		...typeof idClaims.email === "string" ? { email: idClaims.email } : {}
	};
}
/** Provider-local OAuth override: no global fetch hook or dependency mutation. */
function openaiCodexProvider$1(requestFetch) {
	const provider = openaiCodexProvider();
	const oauth = provider.auth.oauth;
	return {
		...provider,
		auth: {
			...provider.auth,
			oauth: {
				...oauth,
				refresh: (credential, signal) => refreshOpenAICodexCredential(credential, signal, requestFetch),
				async login(interaction) {
					return refreshOpenAICodexCredential(await oauth.login(interaction), AbortSignal.any([interaction.signal, AbortSignal.timeout(15e3)]), requestFetch);
				}
			}
		}
	};
}
//#endregion
//#region src/credential-document.ts
function object(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function claims(token) {
	if (typeof token !== "string") return {};
	try {
		const value = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
		return object(value) ? value : {};
	} catch {
		return {};
	}
}
/** Recognize supported schemas, never arbitrary token-looking fields. */
function decodeCredentialDocument(text) {
	let parsed;
	try {
		parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
	} catch {
		throw new Error("openai-codex: credential file is not valid JSON");
	}
	if (!object(parsed)) throw new Error("openai-codex: credential file must contain an object");
	const root = parsed;
	const matches = [];
	if (root.version === 1 && object(root.credential)) matches.push({
		kind: "dsh",
		key: "credential",
		value: root.credential
	});
	if (object(root.tokens) && ("refresh_token" in root.tokens || root.auth_mode === "chatgpt")) matches.push({
		kind: "codex",
		key: "tokens",
		value: root.tokens
	});
	if (root.type === "codex") matches.push({
		kind: "cpa",
		value: root
	});
	if (root.type === "oauth") matches.push({
		kind: "oauth",
		value: root
	});
	for (const key of ["openai-codex", "openai"]) {
		const value = root[key];
		if (object(value) && value.type === "oauth") matches.push({
			kind: "oauth",
			key,
			value
		});
	}
	if (matches.length !== 1) throw new Error("openai-codex: unsupported or ambiguous credential JSON format");
	const match = matches[0];
	const snake = match.kind === "codex" || match.kind === "cpa";
	const value = match.value;
	const allowed = match.kind === "codex" ? [
		"access_token",
		"refresh_token",
		"account_id",
		"id_token"
	] : match.kind === "cpa" ? [
		"type",
		"access_token",
		"refresh_token",
		"account_id",
		"id_token",
		"expired",
		"last_refresh",
		"email",
		"disabled",
		"proxy_url",
		"prefix"
	] : [
		"type",
		"access",
		"refresh",
		"expires",
		"accountId",
		"idToken",
		"email",
		"enterpriseUrl"
	];
	const rejectUnknown = (fields, names) => {
		const unknown = Object.keys(fields).find((key) => !names.includes(key));
		if (unknown !== void 0) throw new Error(`openai-codex: unsupported credential field ${JSON.stringify(unknown)}`);
	};
	rejectUnknown(value, allowed);
	if (match.kind === "codex") rejectUnknown(root, [
		"auth_mode",
		"OPENAI_API_KEY",
		"tokens",
		"last_refresh"
	]);
	if (match.kind === "dsh") rejectUnknown(root, ["version", "credential"]);
	for (const key of [
		"id_token",
		"idToken",
		"email",
		"enterpriseUrl",
		"proxy_url",
		"prefix",
		"last_refresh",
		"expired"
	]) if (key in value && typeof value[key] !== "string") throw new Error(`openai-codex: invalid credential field ${key}`);
	if ("disabled" in value && typeof value.disabled !== "boolean") throw new Error("openai-codex: invalid credential field disabled");
	if (!snake && value.type !== "oauth") throw new Error("openai-codex: credential type must be oauth");
	const access = value[snake ? "access_token" : "access"];
	const refresh = value[snake ? "refresh_token" : "refresh"];
	const jwt = claims(access);
	const auth = jwt["https://api.openai.com/auth"];
	const accountId = value[snake ? "account_id" : "accountId"] ?? (object(auth) ? auth.chatgpt_account_id : void 0);
	const expires = match.kind === "codex" ? typeof jwt.exp === "number" ? jwt.exp * 1e3 : NaN : match.kind === "cpa" ? Date.parse(String(value.expired)) : value.expires;
	let credential;
	if (!(access === "" && refresh === "")) {
		if (typeof access !== "string" || !access) throw new Error("openai-codex: invalid credential access token");
		if (typeof refresh !== "string" || !refresh) throw new Error("openai-codex: invalid credential refresh token");
		if (typeof accountId !== "string" || !accountId) throw new Error("openai-codex: missing credential accountId");
		if (typeof expires !== "number" || !Number.isFinite(expires) || expires < 0) throw new Error("openai-codex: invalid credential expiry");
		credential = {
			type: "oauth",
			access,
			refresh,
			expires,
			accountId
		};
		const idToken = value[snake ? "id_token" : "idToken"];
		if (typeof idToken === "string" && idToken) credential.idToken = idToken;
		if (typeof value.email === "string" && value.email) credential.email = value.email;
	}
	return {
		credential,
		update(next) {
			if (next && credential && credential.idToken && !next.idToken && next.accountId !== credential.accountId) throw new Error("openai-codex: account change requires a new ID token");
			const updated = { ...value };
			if (snake) {
				updated.access_token = next?.access ?? "";
				updated.refresh_token = next?.refresh ?? "";
				updated.account_id = next?.accountId ?? "";
				if (next?.idToken) updated.id_token = next.idToken;
				else if (!next) updated.id_token = "";
				if ("email" in updated) updated.email = next?.email ?? (next?.accountId === credential?.accountId ? updated.email : "");
				if (match.kind === "cpa") {
					updated.expired = new Date(next?.expires ?? 0).toISOString();
					updated.last_refresh = (/* @__PURE__ */ new Date()).toISOString();
				}
			} else {
				Object.assign(updated, {
					type: "oauth",
					access: next?.access ?? "",
					refresh: next?.refresh ?? "",
					expires: next?.expires ?? 0,
					accountId: next?.accountId ?? ""
				});
				if (next?.idToken) updated.idToken = next.idToken;
				else if (!next) delete updated.idToken;
				if (next?.email) updated.email = next.email;
				else if (!next || next.accountId !== credential?.accountId) delete updated.email;
			}
			const result = match.key ? {
				...root,
				[match.key]: updated
			} : updated;
			if (match.kind === "codex") result.last_refresh = (/* @__PURE__ */ new Date()).toISOString();
			return result;
		}
	};
}
//#endregion
//#region src/store.ts
/**
* Owner-only persistent OAuth credential storage for the OpenAI Codex bundle.
* @module dsh-codex/store
*/
/** Provider route and pi-ai provider id owned by this bundle. */
const OPENAI_CODEX_PROVIDER = "openai-codex";
/** Basename of the OAuth document inside the Harness home. */
const OPENAI_CODEX_AUTH_FILENAME = ".openai-codex-auth.json";
/** Current on-disk format; pre-release readers reject every other version. */
const AUTH_FORMAT_VERSION = 1;
const pendingWrites = /* @__PURE__ */ new Map();
async function serialize(filename, operation) {
	const next = (pendingWrites.get(filename) ?? Promise.resolve()).catch(() => {}).then(operation);
	pendingWrites.set(filename, next);
	try {
		return await next;
	} finally {
		if (pendingWrites.get(filename) === next) pendingWrites.delete(filename);
	}
}
/** Whether a filesystem error reports an absent path. */
function isENOENT(error) {
	return error?.code === "ENOENT";
}
/** Reject a credential document readable by another POSIX user. */
async function assertOwnerOnly(filename) {
	let mode;
	try {
		mode = (await stat(filename)).mode;
	} catch (error) {
		if (isENOENT(error)) return;
		throw error;
	}
	/* v8 ignore next -- native Windows coverage takes the mode-less branch */
	if (process.platform === "win32") return;
	/* v8 ignore start -- POSIX tests cover this branch; Windows cannot express it */
	if ((mode & 63) !== 0) throw new Error(`openai-codex: ${filename} is readable beyond its owner (mode ${(mode & 511).toString(8)}); run "chmod 600 ${filename}" before starting again`);
	/* v8 ignore stop */
}
/** Validate the strict JSON document without quoting token-bearing input. */
function parseDocument(text, filename) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error(`openai-codex: ${filename} is not valid JSON`);
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`openai-codex: ${filename} must contain an object`);
	const document = value;
	if (document["version"] !== AUTH_FORMAT_VERSION) throw new Error(`openai-codex: ${filename} has unsupported auth format version ${String(document["version"])}`);
	if (Object.keys(document).some((key) => key !== "version" && key !== "credential")) throw new Error(`openai-codex: ${filename} contains an unknown top-level field`);
	const raw = document["credential"];
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`openai-codex: ${filename} credential must be an object`);
	const credential = raw;
	if (Object.keys(credential).some((key) => ![
		"type",
		"access",
		"refresh",
		"expires",
		"accountId",
		"idToken",
		"email"
	].includes(key))) throw new Error(`openai-codex: ${filename} credential contains an unknown field`);
	if (credential["type"] !== "oauth") throw new Error(`openai-codex: ${filename} credential type must be oauth`);
	for (const key of [
		"access",
		"refresh",
		"accountId"
	]) if (typeof credential[key] !== "string" || credential[key].length === 0) throw new Error(`openai-codex: ${filename} credential ${key} must be a non-empty string`);
	if (typeof credential["expires"] !== "number" || !Number.isFinite(credential["expires"]) || credential["expires"] <= 0) throw new Error(`openai-codex: ${filename} credential expires must be a positive finite number`);
	for (const key of ["idToken", "email"]) if (credential[key] !== void 0 && (typeof credential[key] !== "string" || !credential[key])) throw new Error(`openai-codex: invalid credential ${key}`);
	return {
		version: AUTH_FORMAT_VERSION,
		credential
	};
}
/** Detach a credential from callers that may mutate provider-owned extras. */
function cloneCredential(credential) {
	return structuredClone(credential);
}
/**
* Resolve the default OAuth document path.
* @param dshHome - optional Harness-home override.
* @returns the absolute owner-only document path.
*/
function openAICodexAuthPath(dshHome) {
	return resolve(join(resolveDshHome(dshHome), OPENAI_CODEX_AUTH_FILENAME));
}
/** File-backed pi-ai store scoped to the single OpenAI Codex provider. */
var OpenAICodexCredentialStore = class {
	/** Absolute credential document path. */
	filename;
	/**
	* @param filename - explicit document path, defaulting under `$DSH_HOME`.
	*/
	shared;
	constructor(filename) {
		this.shared = filename !== void 0;
		if (filename !== void 0 && !isAbsolute(filename)) throw new Error("openai-codex: credentialFile must be an absolute path");
		this.filename = resolve(filename ?? openAICodexAuthPath());
	}
	/** Read and validate the current document without acquiring the writer lock. */
	async readCurrent() {
		if (this.shared) try {
			const info = await lstat(this.filename);
			if (!info.isFile() || info.nlink !== 1) throw new Error("openai-codex: shared credential must be a single-link regular file");
		} catch (error) {
			if (!isENOENT(error)) throw error;
		}
		await assertOwnerOnly(this.filename);
		let text;
		try {
			text = await readFile(this.filename, "utf8");
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		return this.shared ? decodeCredentialDocument(text).credential : cloneCredential(parseDocument(text, this.filename).credential);
	}
	/** @inheritdoc */
	async read(providerId) {
		return providerId === "openai-codex" ? this.readCurrent() : void 0;
	}
	/** @inheritdoc */
	async list() {
		return await this.readCurrent() === void 0 ? [] : [{
			providerId: OPENAI_CODEX_PROVIDER,
			type: "oauth"
		}];
	}
	/** @inheritdoc */
	async modify(providerId, fn) {
		if (providerId !== "openai-codex") throw new Error(`openai-codex: credential store does not own provider "${providerId}"`);
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		return (this.shared ? serialize : withFileLock)(this.filename, async () => {
			const current = await this.readCurrent();
			const candidate = await fn(current === void 0 ? void 0 : cloneCredential(current));
			if (candidate === void 0) return current;
			const document = parseDocument(JSON.stringify({
				version: AUTH_FORMAT_VERSION,
				credential: candidate
			}), this.filename);
			let output = document;
			if (this.shared) {
				await assertOwnerOnly(this.filename);
				try {
					const source = decodeCredentialDocument(await readFile(this.filename, "utf8"));
					if (JSON.stringify(source.credential) !== JSON.stringify(current)) throw new Error("openai-codex: credential changed during update; reload before retrying");
					output = source.update(document.credential);
					decodeCredentialDocument(JSON.stringify(output));
				} catch (error) {
					if (!isENOENT(error)) throw error;
					if (current !== void 0) throw new Error("openai-codex: credential file was removed during update");
				}
			}
			await writeFileAtomic(this.filename, `${JSON.stringify(output, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
			return cloneCredential(document.credential);
		});
	}
	/** @inheritdoc */
	async delete(providerId) {
		if (providerId !== "openai-codex") return;
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		if (!this.shared) {
			await withFileLock(this.filename, () => rm(this.filename, { force: true }));
			return;
		}
		await serialize(this.filename, async () => {
			await this.readCurrent();
			let text;
			try {
				text = await readFile(this.filename, "utf8");
			} catch (error) {
				if (isENOENT(error)) return;
				throw error;
			}
			const document = decodeCredentialDocument(text);
			await writeFileAtomic(this.filename, `${JSON.stringify(document.update(void 0), null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
		});
	}
};
//#endregion
//#region src/search.ts
/**
* OpenAI Codex standalone web search over the dsh web provider seam.
* @module dsh-codex/search
*/
/** Stable dsh web-provider id selected by the bundle patch. */
const OPENAI_CODEX_SEARCH_PROVIDER = OPENAI_CODEX_PROVIDER;
/** Trusted first-party Codex base; OAuth credentials never cross to a configured origin. */
const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
/** Standalone search endpoint used by the official Codex client. */
const OPENAI_CODEX_SEARCH_URL = `${OPENAI_CODEX_BASE_URL}/alpha/search`;
/** Default model used by the standalone search endpoint. */
const DEFAULT_OPENAI_CODEX_SEARCH_MODEL = "gpt-5.6-sol";
/** Default search mode, matching the official local Codex client. */
const DEFAULT_OPENAI_CODEX_SEARCH_MODE = "cached";
/** Default provider search-context size. */
const DEFAULT_OPENAI_CODEX_SEARCH_CONTEXT_SIZE = "medium";
/** Default output budget for the standalone search response. */
const DEFAULT_OPENAI_CODEX_SEARCH_MAX_OUTPUT_TOKENS = 1e4;
/** Convert the configured mode to the official endpoint field. */
function externalWebAccess(mode) {
	switch (mode) {
		case "cached": return false;
		case "indexed": return "indexed";
		case "live": return true;
	}
}
/** Extract the account id paired with one OAuth access token. */
function accountIdFromToken(access) {
	try {
		const parts = access.split(".");
		if (parts.length !== 3 || parts[1] === void 0) throw new Error("invalid JWT");
		const auth = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))["https://api.openai.com/auth"];
		if (typeof auth !== "object" || auth === null || Array.isArray(auth)) throw new Error("missing auth claim");
		const accountId = auth["chatgpt_account_id"];
		if (typeof accountId !== "string" || accountId.length === 0) throw new Error("missing account id");
		return accountId;
	} catch (error) {
		throw new WebError("OpenAI Codex search credential has no usable account id; run \"dsh openai-codex login\" again", "WEB_PROVIDER_CREDENTIAL_MISSING", { cause: error });
	}
}
/** Whether an opaque value is a non-array record. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Read an optional non-empty string field. */
function optionalString(record, key) {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/** Accept only citeable HTTP(S) URLs from opaque result DTOs. */
function citeableUrl(value) {
	if (typeof value !== "string") return void 0;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? value : void 0;
	} catch {
		return;
	}
}
/**
* Map the standalone endpoint's forward-compatible result DTOs into the dsh
* web result. Unknown DTO types and fields are ignored; malformed envelope
* fields fail at the network boundary.
* @param value - parsed response JSON.
* @returns normalized answer and citeable sources.
*/
function mapOpenAICodexSearchResponse(value) {
	if (!isRecord(value) || typeof value["output"] !== "string") throw new WebError("OpenAI Codex returned a search response without string output", "WEB_PROVIDER_ERROR");
	const output = value["output"];
	const rawResults = value["results"];
	if (rawResults !== void 0 && !Array.isArray(rawResults)) throw new WebError("OpenAI Codex returned a search response with non-array results", "WEB_PROVIDER_ERROR");
	const sources = [];
	const seen = /* @__PURE__ */ new Set();
	for (const item of rawResults ?? []) {
		if (!isRecord(item) || item["type"] !== "text_result") continue;
		const url = citeableUrl(item["url"]);
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const title = optionalString(item, "title");
		const snippet = optionalString(item, "snippet");
		sources.push({
			url,
			...title === void 0 ? {} : { title },
			...snippet === void 0 ? {} : { snippet }
		});
	}
	return {
		...output.length === 0 ? {} : { content: output },
		sources,
		truncated: false
	};
}
/** Stable cancellation error for every provider phase. */
function searchAborted(signal, fallback) {
	return new WebError("OpenAI Codex search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}
/** Throw the provider's stable cancellation error when the caller already aborted. */
function throwIfSearchAborted(signal) {
	if (signal?.aborted === true) throw searchAborted(signal);
}
/** True for native fetch cancellation. */
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
/** Race an asynchronous auth refresh against caller cancellation. */
function abortable(operation, signal) {
	if (signal === void 0) return operation;
	if (signal.aborted) return Promise.reject(searchAborted(signal));
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			reject(searchAborted(signal));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		operation.then((value) => {
			signal.removeEventListener("abort", onAbort);
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", onAbort);
			reject(error);
		});
	});
}
/** Keep provider diagnostics bounded and remove JWT-like material. */
function providerMessage(value) {
	if (!isRecord(value)) return void 0;
	const error = value["error"];
	return (typeof error === "string" ? error : isRecord(error) && typeof error["message"] === "string" ? error["message"] : typeof value["message"] === "string" ? value["message"] : void 0)?.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[REDACTED]").slice(0, 1e3);
}
/** OpenAI Codex standalone-search provider using the same refreshable OAuth store as the LLM route. */
var OpenAICodexSearchProvider = class {
	options;
	id = OPENAI_CODEX_SEARCH_PROVIDER;
	models;
	/**
	* @param options - fixed trusted endpoint policy and deployment tunables.
	*/
	constructor(options) {
		this.options = options;
		const models = createModels({ credentials: options.credentials });
		models.setProvider(openaiCodexProvider$1(options.fetch));
		this.models = models;
	}
	/** The local configuration is usable; credential presence is resolved per request. */
	available() {
		return this.options.model.length > 0 && Number.isInteger(this.options.maxOutputTokens) && this.options.maxOutputTokens > 0;
	}
	/** @inheritdoc */
	async search(request, signal) {
		throwIfSearchAborted(signal);
		let auth;
		try {
			auth = await abortable(this.models.getAuth(OPENAI_CODEX_PROVIDER), signal);
		} catch (error) {
			throwIfSearchAborted(signal);
			if (isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError("OpenAI Codex search credential resolution failed", "WEB_PROVIDER_ERROR", { cause: error });
		}
		const access = auth?.auth.apiKey;
		if (access === void 0 || access.length === 0) throw new WebError("OpenAI Codex search is signed out; run \"dsh openai-codex login\"", "WEB_PROVIDER_CREDENTIAL_MISSING");
		const accountId = accountIdFromToken(access);
		throwIfSearchAborted(signal);
		const body = {
			id: this.options.resolveRequestId(),
			model: this.options.model,
			input: [{
				type: "message",
				role: "user",
				content: [{
					type: "input_text",
					text: request.query
				}]
			}],
			commands: { search_query: [{ q: request.query }] },
			settings: {
				search_context_size: this.options.contextSize,
				allowed_callers: ["direct"],
				external_web_access: externalWebAccess(this.options.mode)
			},
			max_output_tokens: this.options.maxOutputTokens
		};
		this.options.recordRequest?.({
			endpoint: OPENAI_CODEX_SEARCH_URL,
			body
		});
		throwIfSearchAborted(signal);
		let response;
		try {
			response = await (this.options.fetch ?? globalThis.fetch)(OPENAI_CODEX_SEARCH_URL, {
				method: "POST",
				redirect: "error",
				headers: {
					authorization: `Bearer ${access}`,
					"chatgpt-account-id": accountId,
					"content-type": "application/json",
					accept: "application/json",
					originator: "deepseek-harness"
				},
				body: JSON.stringify(body),
				...signal === void 0 ? {} : { signal }
			});
		} catch (error) {
			throwIfSearchAborted(signal);
			if (isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError("OpenAI Codex search request failed", "WEB_PROVIDER_ERROR", { cause: error });
		}
		let payload;
		try {
			payload = await response.json();
		} catch (error) {
			throwIfSearchAborted(signal);
			if (isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError(`OpenAI Codex returned an unprocessable search response (HTTP ${response.status})`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			const detail = providerMessage(payload);
			const message = detail === void 0 ? `OpenAI Codex search failed (HTTP ${response.status})` : `OpenAI Codex search failed (HTTP ${response.status}): ${detail}`;
			throw new WebError(response.status === 401 || response.status === 403 ? `${message}; run "dsh openai-codex login" again` : message, response.status === 401 || response.status === 403 ? "WEB_PROVIDER_CREDENTIAL_MISSING" : "WEB_PROVIDER_ERROR");
		}
		return mapOpenAICodexSearchResponse(payload);
	}
};
//#endregion
//#region src/search-event.ts
/** Same-generation read compatibility for the retired Codex search Session event. */
/** Retired log event written by dsh-codex versions before 0.3.0. */
const OPENAI_CODEX_SEARCH_MODEL_REQUEST_EVENT = "web/openai-codex-search-llm-request";
/**
* Register the plugin-owned event in the running Harness vocabulary. The
* public DSH build exports its known-event collection as read-only because
* core code must not mutate it accidentally; the runtime value is the Set
* consulted by current-format reads. Historical formats require the explicit
* `repair-session` command because their build-static migration runs first.
*/
function installOpenAICodexSearchEvent() {
	if (!(KNOWN_SESSION_EVENT_TYPES instanceof Set)) throw new Error("dsh-openai-codex: this Harness build does not expose an extensible session event vocabulary");
	KNOWN_SESSION_EVENT_TYPES.add(OPENAI_CODEX_SEARCH_MODEL_REQUEST_EVENT);
}
//#endregion
export { DEFAULT_OPENAI_CODEX_SEARCH_MODE as a, OPENAI_CODEX_SEARCH_PROVIDER as c, mapOpenAICodexSearchResponse as d, OPENAI_CODEX_AUTH_FILENAME as f, openaiCodexProvider$1 as g, openAICodexAuthPath as h, DEFAULT_OPENAI_CODEX_SEARCH_MAX_OUTPUT_TOKENS as i, OPENAI_CODEX_SEARCH_URL as l, OpenAICodexCredentialStore as m, installOpenAICodexSearchEvent as n, DEFAULT_OPENAI_CODEX_SEARCH_MODEL as o, OPENAI_CODEX_PROVIDER as p, DEFAULT_OPENAI_CODEX_SEARCH_CONTEXT_SIZE as r, OPENAI_CODEX_BASE_URL as s, OPENAI_CODEX_SEARCH_MODEL_REQUEST_EVENT as t, OpenAICodexSearchProvider as u };

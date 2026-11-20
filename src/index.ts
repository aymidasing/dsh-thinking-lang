/**
 * Host entry: the settings namespace, the prompt section, and the language line.
 * 宿主入口：设置命名空间、提示词段、以及每步注入的语言行。
 *
 * Injection shape (see README for the reasoning):
 * 注入形态（设计理由见 README）：
 *
 *   section  order  1  →  the authoritative rule, once per session
 *   pre-step step 1  →  a short reminder at the head of the batch, at most once per turn
 *                        (interval configurable, default 30 min)
 *   pre-step step 1  →  the closing rule, folded into the skill catalogue or sent
 *                        as its own message when extra injection is on
 *
 *   section  order  1  →  权威规则，每会话组装一次
 *   pre-step step 1  →  批次开头的短提醒，每轮最多一次（间隔可配置，默认 30 分钟）
 *   pre-step step 1  →  收尾规则，额外注入开启时折进技能目录，或独立发送
 *
 * The host context is described by a local structural interface rather than the
 * `@deepseek-ai/cordis` type, so this package carries no DSH type dependency.
 * 宿主上下文用本文件内的结构化接口描述，而不引用 `@deepseek-ai/cordis` 的类型，
 * 因此本包不依赖任何 DSH 类型包。
 */
import { randomUUID } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import {
	AUTO,
	DEFAULT_REMINDER_MINUTES,
	DEFAULTS,
	FIELD_EXTRA,
	FIELD_LANGUAGE,
	FIELD_REMINDER,
	REMINDER_OFF,
	SELECTABLE_TAGS,
	SETTINGS_NAMESPACE,
	type Reader,
	type ThinkingSettings,
	effectiveCode,
	nativeNameFor,
	normalizeSettings,
	reminderDelayMs,
	reminderText,
	tailText,
	sectionText
} from "./core.js";

/** Stable Cordis plugin name. / 稳定的 Cordis 插件名。 */
export const name = "ay-dsh-tk-lang";

/** Plugin-level service requirements; services are acquired per branch below. / 插件级服务声明；服务在下方逐分支获取。 */
export const inject: string[] = [];

/**
 * Section order. The host's own table (dsh-system-prompt) puts the harness
 * identity at -1000, the deployment persona prefix at 0 and the first policy
 * section at 500, so 1 lands immediately after the persona line.
 * 段的顺序。宿主自己的分段表（dsh-system-prompt）把身份声明放在 -1000、部署
 * persona 前缀放在 0、第一个策略段放在 500，因此取 1 就紧跟在 persona 那行之后。
 */
const SECTION_ORDER = 1;

/** Settings namespace holding the desktop UI locale. / 保存桌面 UI 语言的设置命名空间。 */
const LOCALE_NAMESPACE = "locale";

/** Field of {@link LOCALE_NAMESPACE} holding the UI locale. / {@link LOCALE_NAMESPACE} 中保存 UI 语言的字段。 */
const LOCALE_FIELD = "preference";

/** How long one settings read is reused; prompt assembly reads it every step. / 一次设置读取的复用时长；提示词组装每步都会读。 */
const SETTINGS_TTL_MS = 1000;

/** The shape a schemastery node must expose for {@link live} to mark it. / {@link live} 标记节点时，该节点需要暴露的形状。 */
interface LiveCapable {
	volatile?: () => unknown;
	extra?: (key: string, value: boolean) => unknown;
}

/**
 * The two spellings schemastery accepts for the "live field" flag.
 * schemastery 接受「实时字段」标记的两种写法。
 *
 * Each probe returns nothing when the node does not implement that spelling, so
 * {@link live} can simply try them in turn.
 * 节点未实现某种写法时，对应的探测返回空，{@link live} 因此可以按顺序逐个尝试。
 */
const LIVE_MARKERS: ReadonlyArray<(field: LiveCapable) => unknown> = [
	(field) => (typeof field.volatile === "function" ? field.volatile() : undefined),
	(field) => (typeof field.extra === "function" ? field.extra("volatile", true) : undefined)
];

/**
 * Declare a schema field live, so the settings service accepts writes to it.
 * 把 schema 字段声明为「可实时修改」，使设置服务接受对它的写入。
 *
 * A namespace whose fields carry neither marker is refused as having no volatile
 * fields at all, which would leave the whole namespace read-only.
 * 字段两种标记都不带的命名空间会被以「没有可实时修改的字段」为由拒绝，导致整个
 * 命名空间变成只读。
 */
function live<T>(field: z<T>): z<T> {
	const probe = field as unknown as LiveCapable;
	for (const mark of LIVE_MARKERS) {
		const marked = mark(probe);
		if (marked !== undefined && marked !== null) return marked as z<T>;
	}
	return field;
}

/**
 * Attach a picker label to a schema node, when the node takes descriptions.
 * 在 schema 节点接受描述时，为它挂上选择器标签。
 */
function labelled<T>(node: z<T>, label: string | undefined): z<T> {
	const probe = node as unknown as { description?: (text: string) => z<T> };
	const describe = probe.description;
	if (label === undefined || typeof describe !== "function") return node;
	return describe.call(node, label);
}

/**
 * Build the durable settings schema for the single language field.
 * 为唯一的语言字段构建持久化设置 schema。
 *
 * Language options carry the native name as their schema description, so the
 * picker can be rendered from the registered schema instead of a second copy.
 * 语言选项把本族语名作为 schema 描述携带，使选择器可以依据已注册的 schema 渲染，
 * 而不必再维护一份副本。
 */
function buildSchema(): z<ThinkingSettings> {
	const choices = [AUTO, ...SELECTABLE_TAGS].map((value) => labelled(z.const(value), nativeNameFor(value)));
	return z.object({
		[FIELD_LANGUAGE]: live(z.union(choices).default(AUTO)),
		[FIELD_REMINDER]: live(z.number().default(DEFAULT_REMINDER_MINUTES)),
		[FIELD_EXTRA]: live(z.boolean().default(DEFAULTS.extraInjection))
	});
}

/** Durable settings schema; the field defaults to {@link AUTO}. / 持久化设置 schema；字段默认为 {@link AUTO}。 */
export const Config = buildSchema();

/** The slice of the host settings service this plugin uses. / 本插件用到的宿主设置服务切片。 */
interface HostSettings {
	describe(options: { redactSecrets: boolean }): unknown;
}

/** One read of the settings document, reusable until its TTL elapses. / 一次设置文档读取，在缓存有效期内可复用。 */
interface SettingsSnapshot {
	readonly service: HostSettings;
	readonly takenAt: number;
	readonly sections: Map<string, Record<string, unknown>>;
}

/** Handed back while the settings service is unavailable or unreadable. / 设置服务不可用或读不出时交回的空表。 */
const NO_SECTIONS: ReadonlyMap<string, Record<string, unknown>> = new Map();

/**
 * Call `describe()` without letting a throwing host escape.
 * 调用 `describe()`，不让抛异常的宿主逃逸出去。
 */
function described(settings: HostSettings): unknown {
	try {
		return settings.describe({ redactSecrets: true });
	} catch {
		return undefined;
	}
}

/**
 * Coerce an untrusted value into a settings section, or nothing.
 * 把不可信的值强制转换为设置段；不是段则为空。
 *
 * A section is a plain object keyed by field name. Arrays and primitives are
 * refused rather than coerced, so a malformed document reads as "no settings"
 * instead of producing nonsense.
 * 设置段就是以字段名为键的普通对象。数组与原始值一律拒绝而不做转换，使格式错误的
 * 文档读作「没有设置」，而不是产生无意义的结果。
 */
function asSection(value: unknown): Record<string, unknown> | undefined {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
	return value as Record<string, unknown>;
}

function collect(settings: HostSettings): Map<string, Record<string, unknown>> | undefined {
	const listed = described(settings);
	if (!Array.isArray(listed)) return undefined;
	const found = new Map<string, Record<string, unknown>>();
	for (const item of listed) {
		const entry = asSection(item);
		const ns = entry?.ns;
		if (ns !== SETTINGS_NAMESPACE && ns !== LOCALE_NAMESPACE) continue;
		const section = asSection(entry?.value);
		if (section !== undefined) found.set(ns, section);
	}
	return found;
}

/**
 * Adapt the settings service to the `get()`-style handle the core reads from.
 * 把设置服务适配成核心代码所用的 `get()` 风格句柄。
 */
function settingsReader(sections: ReadonlyMap<string, Record<string, unknown>>): Reader {
	return {
		get: (ns = SETTINGS_NAMESPACE) => sections.get(ns)
	};
}

/**
 * Read one namespace section, or undefined when it is absent or malformed.
 * 读取一个命名空间的段；缺失或格式不对时返回 undefined。
 */
function sectionOf(reader: Reader, ns: string): Record<string, unknown> | undefined {
	return asSection(reader.get(ns));
}

/**
 * Cached operating-system locale; the wrapper distinguishes "not probed yet"
 * from "probed, and the runtime had nothing to report".
 * 缓存的操作系统语言；用包装对象区分「尚未探测」与「已探测但运行时拿不到」。
 */
let osLocaleCache: { value: string | undefined } | undefined;

/**
 * Read the operating-system locale, preferring the POSIX environment variables.
 * 读取操作系统语言，优先使用 POSIX 环境变量。
 *
 * The environment wins where it is set (Linux/macOS). On Windows it is normally
 * absent, so `Intl` — which follows the OS regional settings there — stands in.
 * The result is cached because prompt assembly asks on every model step.
 * 在设置了环境变量的平台（Linux/macOS）环境变量优先；Windows 上通常没有，改由
 * `Intl` 顶上（它会跟随系统的区域设置）。结果会被缓存，因为提示词组装每一步都问。
 */
function osLocale(): string | undefined {
	if (osLocaleCache) return osLocaleCache.value;
	let value: string | undefined;
	const env = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG;
	if (typeof env === "string" && env !== "") {
		value = env;
	} else {
		try {
			const resolved = new Intl.DateTimeFormat().resolvedOptions().locale;
			if (typeof resolved === "string" && resolved !== "") value = resolved;
		} catch {
			/* Intl is unavailable in this runtime */
		}
	}
	osLocaleCache = { value };
	return value;
}

/**
 * Resolve the configuration in effect for one prompt build.
 * 为一次提示词构建解析出当前生效的配置。
 */
function currentSettings(reader: Reader): ThinkingSettings {
	const settings = normalizeSettings(sectionOf(reader, SETTINGS_NAMESPACE));
	const desktop = sectionOf(reader, LOCALE_NAMESPACE)?.[LOCALE_FIELD];
	return {
		...settings,
		language: effectiveCode(settings, osLocale(), typeof desktop === "string" ? desktop : undefined)
	};
}

/** One pre-step payload slice this entry reads. / 本入口读取的 pre-step 载荷切片。 */
interface PreStepPayload {
	agent: { session: { id: string } };
	turn: number;
	step: number;
	signal: AbortSignal;
}

/** The pre-step decision this entry appends a reminder to. / 本入口追加提醒的 pre-step 决策。 */
interface PreStepDecision {
	kind: "enter" | "reject";
	messages: Array<Record<string, unknown>>;
}

/** The host plugin context shape this entry relies on. / 本入口依赖的宿主插件上下文形状。 */
interface HostContext {
	get(name: string): unknown;
	inject(names: string[], callback: (ctx: HostContext) => void): unknown;
	on(
		event: "agent/pre-step",
		listener: (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>,
		options?: { prepend?: boolean }
	): unknown;
	on(event: "agent/created", listener: (payload: unknown) => unknown): unknown;
	on(event: "settings/document-updated", listener: (namespace: string) => void): unknown;
	systemPrompt: {
		section(section: { name: string; order?: number; text: () => string }): unknown;
	};
}

/**
 * Build the durable user message carrying one reminder.
 * 生成携带一条提醒的持久用户消息。
 *
 * The message keeps the plugin as its source, so the session log can attribute
 * the injection and the host restores it like any other user message.
 * 消息以本插件为来源，会话日志因此能归属这次注入，宿主也像普通用户消息一样恢复它。
 */
function reminderMessage(text: string): Record<string, unknown> {
	return {
		id: randomUUID(),
		role: "user",
		content: [{ type: "text", text }],
		source: { kind: name, form: "snapshot", sections: [{ name, text }] }
	};
}

/**
 * Put the rule in front of the text a message already carries.
 * 把规则放到消息已有文本的前面。
 */
function prefixPrompt(message: Record<string, unknown>, text: string): Record<string, unknown> {
	const content = Array.isArray(message.content) ? (message.content as Array<Record<string, unknown>>) : [];
	const head = content[0];
	if (head && head.type === "text" && typeof head.text === "string" && head.text.startsWith(text)) return message;
	return { ...message, content: [{ type: "text", text: `${text}\n` }, ...content] };
}

/**
 * Attach the rule to this batch's skill catalogue, or append a plugin-owned message last.
 * 把规则加到当前批次的技能目录；没有目录时在批次末尾追加一条本插件来源的消息。
 *
 * The fallback lands after every other injected message, so the closing rule stays
 * the last thing the model reads even when no catalogue was sent.
 * 回退的那条落在全部注入消息之后，因此没有技能目录时，收尾规则仍是模型最后读到的一句。
 */
function withClosingReminder(messages: Array<Record<string, unknown>>, text: string): Array<Record<string, unknown>> {
	const index = messages.findIndex((message) => asSection(message.source)?.kind === "skill-catalog");
	if (index < 0) return [...messages, reminderMessage(text)];
	const next = [...messages];
	next[index] = prefixPrompt(messages[index], text);
	return next;
}

/**
 * Register the settings consumer, the prompt section, and the per-turn reminder.
 * 注册设置消费方、提示词段，以及每轮一次的提醒。
 */
export function apply(ctx: HostContext): void {
	/** Latest reminder time per session, in process memory. / 每个会话最近一次提醒时间，存于进程内存。 */
	const lastReminderAt = new Map<string, number>();

	ctx.inject(["systemPrompt", "settings"], (promptCtx) => {
		// A settings write emits this event before acknowledgement. The TTL also
		// refreshes reads when a host change produced no notification.
		// 设置写入在应答前发出此事件。TTL 也会刷新未收到通知的变动。
		let snapshot: SettingsSnapshot | undefined;
		promptCtx.on("settings/document-updated", (namespace) => {
			if (namespace === SETTINGS_NAMESPACE || namespace === LOCALE_NAMESPACE) snapshot = undefined;
		});
		const reader = (): Reader => {
			const service = promptCtx.get("settings") as HostSettings | undefined;
			if (!service || typeof service.describe !== "function") return settingsReader(NO_SECTIONS);
			const now = Date.now();
			if (snapshot?.service === service && now >= snapshot.takenAt && now - snapshot.takenAt < SETTINGS_TTL_MS) {
				return settingsReader(snapshot.sections);
			}
			const sections = collect(service);
			snapshot = sections === undefined ? undefined : { service, takenAt: now, sections };
			return settingsReader(sections ?? NO_SECTIONS);
		};

		// The text thunk is re-evaluated per assembly, so the section always
		// reflects the newest setting without re-registering anything.
		// 文本 thunk 每次组装都会重新求值，因此该段始终反映最新设置，无需重新注册。
		promptCtx.systemPrompt.section({
			name: "app:tk-lang",
			order: SECTION_ORDER,
			text: () => sectionText(currentSettings(reader()).language)
		});

		/**
		 * Wrap the batch in two reminders: one before the prompt, one after every injection.
		 * 用两条提醒夹住批次：一条在提问之前，一条在全部注入之后。
		 */
		const rewrite = async (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => {
			const decision = await next();
			if (decision.kind !== "enter" || payload.signal.aborted || payload.step !== 1 || decision.messages.length === 0) return decision;
			const settings = currentSettings(reader());
			const delay = reminderDelayMs(settings.reminderMinutes);
			if (delay === REMINDER_OFF) return decision;
			const now = Date.now();
			const previous = lastReminderAt.get(payload.agent.session.id);
			if (delay > 0 && previous !== undefined && now - previous < delay) return decision;
			const head = reminderText(settings.language);
			if (head === "") return decision;
			lastReminderAt.set(payload.agent.session.id, now);
			// The closing rule rides on the same switch as the reminder: turning the
			// reminder off skips this whole listener, so both injections stop together.
			// 收尾规则与提醒共用一个开关：提醒关闭时本段不执行，两处注入一起停。
			const tail = settings.extraInjection ? tailText(settings.language) : "";
			const messages = tail === "" ? decision.messages : withClosingReminder(decision.messages, tail);
			return { ...decision, messages: [reminderMessage(head), ...messages] };
		};

		/**
		 * `prepend` unshifts, so the listener prepended last runs first and returns last:
		 * only it sees every message the other pre-step listeners appended, including the
		 * trailing `time-context` batch.
		 * `prepend` 是 unshift：最后 prepend 的监听器最先执行、最后返回，只有它能看见其它
		 * pre-step 监听器追加的全部消息，包括压在最后的 `time-context`。
		 */
		let disposeStep: (() => void) | undefined;
		const bindOutermost = (): void => {
			disposeStep?.();
			disposeStep = promptCtx.on("agent/pre-step", rewrite, { prepend: true }) as () => void;
		};
		bindOutermost();
		promptCtx.on("agent/created", () => {
			bindOutermost();
		});
	});
}

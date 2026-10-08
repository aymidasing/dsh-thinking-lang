/**
 * Language catalogue, settings normalization, and the two halves of the prompt.
 * 语言目录、设置归一化，以及提示词的两个半边。
 *
 * Both halves name the selected language; what separates them is WHEN they are
 * evaluated:
 * 两半都会指名所选语言；区别在于**求值时机**：
 *
 *   - {@link sectionText} goes in as a `systemPrompt.section` and is assembled
 *     once per session, so its language name holds until the next session.
 *   - {@link contextText} goes in as a `systemPrompt.context` and is re-evaluated
 *     on every model call, so a language switch lands on the next turn.
 *
 *   - {@link sectionText} 作为 `systemPrompt.section` 注入，每会话组装一次，
 *     其中的语言名要到下一个会话才会更新。
 *   - {@link contextText} 作为 `systemPrompt.context` 注入，每次模型调用重新求值，
 *     切换语言在下一轮即生效。
 *
 * Locale resolution is delegated to the platform's own `Intl.Locale` rather than
 * to a hand-rolled BCP-47 parser: the runtime already knows how to split a tag
 * into language, script and region, and CLDR already knows which script a region
 * implies. Neither the tag grammar nor the Simplified/Traditional split needs a
 * table of its own here.
 * 语言解析交给平台自带的 `Intl.Locale`，而不是自己写 BCP-47 解析器：运行时本来就
 * 会把标签拆成语言、文字、地区，CLDR 本来就知道某个地区隐含哪种文字。因此这里既
 * 不需要标签文法，也不需要简繁对照表。
 */

/** One selectable reasoning language. / 一种可选的推理语言。 */
export interface Language {
	/** BCP-47 tag; also the value persisted in settings. / BCP-47 标签；同时也是存入设置的值。 */
	tag: string;
	/** English name written into the prompt text. / 写进提示词文本的英文名。 */
	promptName: string;
	/** Native name shown in the settings picker. / 设置选择器里显示的本族语名。 */
	nativeName: string;
}

/**
 * The catalogue, in picker order.
 * 语言目录，按选择器顺序排列。
 *
 * A tag that carries no region (`en`) is reachable through its bare primary
 * subtag as well; one that does carry a region (`zh-CN`, `zh-TW`) is not. That
 * asymmetry is what the resolution order in {@link tagForLocale} relies on, so
 * it needs no extra flag on the entries.
 * 不含地区的标签（`en`）也可以由裸主语言标签命中，含地区的（`zh-CN`、`zh-TW`）则
 * 不能。{@link tagForLocale} 的解析顺序正是建立在这一不对称之上，因此条目本身不必
 * 额外带标记。
 */
export const CATALOGUE: readonly Language[] = [
	{ tag: "zh-CN", promptName: "Simplified Chinese", nativeName: "简体中文" },
	{ tag: "zh-TW", promptName: "Traditional Chinese", nativeName: "繁體中文" },
	{ tag: "en", promptName: "English", nativeName: "English" }
];

/** The marker the per-step context line starts with. / 每步上下文行的起始标记。 */
const MARKER = "[RL]";

/** The sentinel meaning "follow the host locale". / 表示「跟随宿主语言」的哨兵值。 */
export const AUTO = "auto";

/** Language used when no other source resolves. / 其它来源都解析不出时的兜底语言。 */
const FALLBACK_TAG = "zh-CN";

/** Settings namespace owned by this plugin. / 本插件拥有的设置命名空间。 */
export const SETTINGS_NAMESPACE = "ay-dsh-tk-lang";

/** The one field this plugin stores. / 本插件唯一保存的字段。 */
export const FIELD_LANGUAGE = "language";

/** Every value the picker offers besides {@link AUTO}. / 选择器在 {@link AUTO} 之外提供的全部取值。 */
export const SELECTABLE_TAGS: readonly string[] = CATALOGUE.map((language) => language.tag);

/** The resolved configuration this plugin acts on. / 本插件实际作用的已解析配置。 */
export interface ThinkingSettings {
	/** Selected language tag, or {@link AUTO}. / 所选语言标签，或 {@link AUTO}。 */
	language: string;
}

/** Configuration applied when the field is absent. / 字段缺失时采用的配置。 */
export const DEFAULTS: ThinkingSettings = { language: AUTO };

/** A minimal read handle over the host settings service. / 宿主设置服务的最小读取句柄。 */
export interface Reader {
	get(ns?: string): unknown;
}

/** Catalogue lookup keyed by lower-cased tag. / 以小写标签为键的目录索引。 */
const BY_TAG = new Map<string, Language>(CATALOGUE.map((language) => [language.tag.toLowerCase(), language]));

/**
 * The two Chinese tags, which the script — not the region — decides between.
 * 两个中文标签；区分它们的是文字，而不是地区。
 */
const CHINESE = { simplified: "zh-CN", traditional: "zh-TW" } as const;

/**
 * Look up a catalogue entry by language tag.
 * 按语言标签查找目录条目。
 */
function languageOf(tag: string): Language | undefined {
	if (tag === "" || tag === AUTO) return undefined;
	return BY_TAG.get(tag.toLowerCase());
}

/**
 * Return the native name of a language tag, for display in the picker.
 * 返回语言标签的本族语名，用于选择器展示。
 */
export function nativeNameFor(tag: string): string | undefined {
	return languageOf(tag)?.nativeName;
}

/**
 * Parse an untrusted string into a modern `Intl.Locale`, or nothing.
 * 把不可信的字符串解析成现代 `Intl.Locale`；解析不出则为空。
 *
 * POSIX spellings such as `zh_CN.UTF-8` or `sr_RS@latin` are not BCP-47, so the
 * encoding and modifier halves are dropped and the separator is normalized
 * before the tag reaches `Intl`. A tag `Intl` rejects is not an error here: the
 * caller simply moves on to the next locale source.
 * POSIX 写法（如 `zh_CN.UTF-8`、`sr_RS@latin`）不是 BCP-47，因此先去掉了编码与修饰
 * 符部分、归一化分隔符，再把标签交给 `Intl`。被 `Intl` 拒绝的标签在这里不算错误，
 * 调用方继续尝试下一个语言来源即可。
 */
function parseLocale(raw: unknown): Intl.Locale | undefined {
	if (typeof raw !== "string") return undefined;
	const tag = raw.trim().split(/[.@]/)[0]?.replace(/_/g, "-") ?? "";
	if (tag === "") return undefined;
	try {
		return new Intl.Locale(tag);
	} catch {
		return undefined;
	}
}

/**
 * List the tags worth looking up for one parsed locale, most specific first.
 * 为一个已解析的语言环境列出值得查找的标签，从最具体开始。
 *
 * `zh-Hant-TW` yields `zh-Hant-TW`, `zh-Hant`, `zh-TW`, `zh`; `en-US` yields
 * `en-US`, `en`.
 * `zh-Hant-TW` 会得到 `zh-Hant-TW`、`zh-Hant`、`zh-TW`、`zh`；`en-US` 会得到
 * `en-US`、`en`。
 */
function candidatesOf(locale: Intl.Locale): string[] {
	const { language, script, region } = locale;
	const candidates: string[] = [];
	if (script !== undefined && region !== undefined) candidates.push(`${language}-${script}-${region}`);
	if (script !== undefined) candidates.push(`${language}-${script}`);
	if (region !== undefined) candidates.push(`${language}-${region}`);
	candidates.push(language);
	return candidates;
}

/**
 * Decide which Chinese tag a script-ambiguous locale means.
 * 判定一个文字不明确的中文语言环境对应哪个标签。
 *
 * `zh`, `zh-SG` and `zh-Hans` all mean Simplified, while `zh-TW`, `zh-HK` and
 * `zh-Hant` mean Traditional. CLDR already encodes that mapping, so `maximize()`
 * supplies the script a short tag omitted instead of a hand-written region table.
 * `zh`、`zh-SG`、`zh-Hans` 都指简体，而 `zh-TW`、`zh-HK`、`zh-Hant` 都指繁体。
 * CLDR 已经把这个映射编码好了，因此用 `maximize()` 补全短标签省略的文字，而不必
 * 手写地区对照表。
 */
function chineseTag(locale: Intl.Locale): string {
	const maximized = typeof locale.maximize === "function" ? locale.maximize() : undefined;
	return maximized?.script === "Hant" ? CHINESE.traditional : CHINESE.simplified;
}

/**
 * Map a locale onto a catalogue language tag.
 * 把语言环境映射到目录里的语言标签。
 */
function tagForLocale(raw: unknown): string | undefined {
	const locale = parseLocale(raw);
	if (locale === undefined) return undefined;
	for (const candidate of candidatesOf(locale)) {
		const match = BY_TAG.get(candidate.toLowerCase());
		if (match !== undefined) return match.tag;
	}
	return locale.language === "zh" ? chineseTag(locale) : undefined;
}

/**
 * Coerce an untrusted settings section into a complete configuration.
 * 把不可信的设置段强制转换为完整配置。
 */
export function normalizeSettings(raw: unknown): ThinkingSettings {
	const isSection = raw !== null && typeof raw === "object" && !Array.isArray(raw);
	const stored = isSection ? (raw as Record<string, unknown>)[FIELD_LANGUAGE] : undefined;
	return { language: typeof stored === "string" && stored !== "" ? stored : DEFAULTS.language };
}

/**
 * Resolve the effective language for `auto`, most authoritative source first.
 * 解析 `auto` 下的生效语言，来源按权威性排序。
 *
 * Sources are tried in order: the operating-system locale, then the desktop UI
 * locale, then the fallback. The first one that maps onto the catalogue wins, so
 * a machine whose system language is Chinese keeps the agent thinking in Chinese
 * even when the DSH interface itself is English.
 * 来源按顺序尝试：操作系统语言 → 桌面界面语言 → 兜底。第一个能映射到语言目录的胜出
 * ——因此系统语言为中文时，即使 DSH 界面是英文，智能体仍会用中文思考。
 *
 * Returns an empty string when the stored tag is neither `auto` nor known, which
 * callers read as "inject nothing".
 * 当存储的标签既不是 `auto` 也不是已知语言时返回空串，调用方据此判定「不注入」。
 */
export function effectiveCode(settings: ThinkingSettings, osLocale?: string, desktopLocale?: string): string {
	if (settings.language !== AUTO) return languageOf(settings.language)?.tag ?? "";
	for (const source of [osLocale, desktopLocale, FALLBACK_TAG]) {
		const resolved = tagForLocale(source);
		if (resolved !== undefined) return resolved;
	}
	return FALLBACK_TAG;
}

/**
 * Build the system-prompt section, naming the selected language directly.
 * 生成系统提示词段，直接指名所选语言。
 *
 * This text therefore varies with the selection — one variant per language.
 * 因此本段文本随所选语言变化，每种语言一个版本。
 */
export function sectionText(code: string): string {
	const language = languageOf(code);
	if (language === undefined) return "";
	return `Reasoning rules (apply to every response):Think, reason, and plan MUST use ${language.promptName}. Reply to the user in their own language.`;
}

/**
 * Build the per-step context line that names the reasoning language.
 * 生成每一步的上下文行，指名推理的思考语言。
 */
export function contextText(code: string): string {
	const language = languageOf(code);
	if (language === undefined) return "";
	return `${MARKER} ${language.promptName} MUST be used to think, reason, and plan.`;
}

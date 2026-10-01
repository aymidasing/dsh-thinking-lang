/**
 * Settings-row copy, in every language the plugin can think in.
 * 设置行文案，覆盖本插件支持的每一种思考语言。
 *
 * Two indexes point at the same dictionaries, and they answer different
 * questions:
 * 两份索引指向同一批字典，各自回答不同的问题：
 *
 *   - {@link dictionaries} is keyed by UI locale and handed to the host locale
 *     service. The host resolves it against the *interface* language.
 *   - {@link DICTIONARIES} is keyed by thinking-language tag and read by the row
 *     itself, so the copy can follow the *thinking* language instead.
 *
 *   - {@link dictionaries} 以界面语言为键，交给宿主的 locale 服务，由宿主按
 *     **界面语言**解析。
 *   - {@link DICTIONARIES} 以思考语言标签为键，由设置行自己读取，使文案可以跟随
 *     **思考语言**。
 */

/** One dictionary of settings-row copy. / 一份设置行文案字典。 */
export interface Dict {
	/** Row heading. / 行标题。 */
	heading: string;
	/** Row description, rendered under the heading. / 行说明，渲染在标题下方。 */
	description: string;
	/** Label of the "follow the host locale" option. / 「跟随宿主语言」选项的标签。 */
	autoLabel: string;
}

/** Simplified Chinese copy. / 简体中文文案。 */
export const zh: Dict = {
	heading: "思考语言",
	description: "内部推理与规划使用的语言。「自动」优先跟随操作系统语言，其次是界面语言。",
	autoLabel: "自动"
};

/** Traditional Chinese copy. / 繁體中文文案。 */
const zhTW: Dict = {
	heading: "思考語言",
	description: "內部推理與規劃使用的語言。「自動」優先跟隨作業系統語言，其次是介面語言。",
	autoLabel: "自動"
};

/** English copy. / 英文文案。 */
export const en: Dict = {
	heading: "Thinking language",
	description:
		"Language used for internal reasoning and planning. Automatic follows the operating-system language first, then the UI language.",
	autoLabel: "Automatic"
};

/**
 * Whether the row copy follows the thinking language instead of the UI language.
 * 行文案是否跟随思考语言，而不是界面语言。
 *
 * Reserved and currently OFF: the whole mechanism is implemented and wired up,
 * but this stays `false` so the row keeps following the interface language.
 * Flip it to `true` to switch the behaviour on — no other file needs to change.
 * 预留中，当前关闭：整套机制已实现并接线完毕，但此处保持 `false`，使设置行继续
 * 跟随界面语言。改为 `true` 即可启用，无需改动任何其它文件。
 */
export const COPY_FOLLOWS_THINKING_LANGUAGE = false;

/** Dictionaries keyed by thinking-language tag, read by the row. / 以思考语言标签为键、由设置行读取的字典。 */
const DICTIONARIES: Record<string, Dict> = {
	"zh-CN": zh,
	"zh-TW": zhTW,
	en
};

/**
 * Pick the dictionary the row should use, honouring the feature flag.
 * 依据功能开关，挑选设置行应当使用的字典。
 *
 * Returns `undefined` whenever the host dictionary should win: the flag is off,
 * or the language is `auto` and is therefore resolved by the host against the
 * interface language.
 * 返回 `undefined` 表示应当采用宿主字典：开关关闭，或语言为 `auto`（此时由宿主按
 * 界面语言解析）。
 */
export function dictionaryFor(language: string, autoValue: string): Dict | undefined {
	if (!COPY_FOLLOWS_THINKING_LANGUAGE) return undefined;
	if (language === autoValue) return undefined;
	return DICTIONARIES[language];
}

/** Dictionaries keyed by UI locale, handed to the host locale service. / 以界面语言为键、交给宿主 locale 服务的字典。 */
export const dictionaries: Record<string, Dict> = { zh, en };

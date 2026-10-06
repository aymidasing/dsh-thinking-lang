Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
//#region src/core.ts
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
const CATALOGUE = [
	{
		tag: "zh-CN",
		promptName: "Simplified Chinese",
		nativeName: "简体中文"
	},
	{
		tag: "zh-TW",
		promptName: "Traditional Chinese",
		nativeName: "繁體中文"
	},
	{
		tag: "en",
		promptName: "English",
		nativeName: "English"
	}
];
/** The sentinel meaning "follow the host locale". / 表示「跟随宿主语言」的哨兵值。 */
const AUTO = "auto";
/** Settings namespace owned by this plugin. / 本插件拥有的设置命名空间。 */
const SETTINGS_NAMESPACE = "thinking-language";
/** The one field this plugin stores. / 本插件唯一保存的字段。 */
const FIELD_LANGUAGE = "language";
CATALOGUE.map((language) => language.tag);
/** Configuration applied when the field is absent. / 字段缺失时采用的配置。 */
const DEFAULTS = { language: AUTO };
/** Catalogue lookup keyed by lower-cased tag. / 以小写标签为键的目录索引。 */
const BY_TAG = new Map(CATALOGUE.map((language) => [language.tag.toLowerCase(), language]));
/**
* Look up a catalogue entry by language tag.
* 按语言标签查找目录条目。
*/
function languageOf(tag) {
	if (tag === "" || tag === "auto") return void 0;
	return BY_TAG.get(tag.toLowerCase());
}
/**
* Return the native name of a language tag, for display in the picker.
* 返回语言标签的本族语名，用于选择器展示。
*/
function nativeNameFor(tag) {
	return languageOf(tag)?.nativeName;
}
/**
* Coerce an untrusted settings section into a complete configuration.
* 把不可信的设置段强制转换为完整配置。
*/
function normalizeSettings(raw) {
	const stored = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw[FIELD_LANGUAGE] : void 0;
	return { language: typeof stored === "string" && stored !== "" ? stored : DEFAULTS.language };
}
/** Dictionaries keyed by UI locale, handed to the host locale service. / 以界面语言为键、交给宿主 locale 服务的字典。 */
const dictionaries = {
	zh: {
		heading: "思考语言",
		description: "内部推理与规划使用的语言。「自动」优先跟随操作系统语言，其次是界面语言。",
		autoLabel: "自动"
	},
	en: {
		heading: "Thinking language",
		description: "Language used for internal reasoning and planning. Automatic follows the operating-system language first, then the UI language.",
		autoLabel: "Automatic"
	}
};
//#endregion
//#region src/client/panel.ts
/**
* The settings row: one language picker bound to the plugin's settings document.
* 设置行：一个绑定到本插件设置文档的语言选择器。
*
* It is registered into the General settings page (see `./index.ts`) rather than
* as a section of its own, so it sits directly under the host's language row.
* 它注册进「通用」设置页（见 `./index.ts`）而不是自成菜单，因此紧邻宿主自身的
* 语言设置项下方。
*
* The row owns no state of its own: it reads the host's settings document,
* subscribes to it, and writes the single field back.
* 本行不持有自己的状态：它读取宿主的设置文档、订阅其变化，并回写那唯一一个字段。
*/
/**
* Read and normalize the current settings, falling back to defaults on refusal.
* 读取并归一化当前设置；被拒绝时回退到默认值。
*/
function readSettings(doc) {
	try {
		return normalizeSettings(doc.getSnapshot()?.value);
	} catch {
		return DEFAULTS;
	}
}
/**
* Write one field back, swallowing a refusal so a read-only host cannot break the row.
* 回写单个字段，并吞掉拒绝异常，使只读宿主不会让这一行崩溃。
*
* A host may return a promise instead of a value; an unhandled rejection from a
* read-only document is not worth surfacing, so it is discarded here.
* 宿主可能返回 promise 而不是值；只读文档产生的未处理拒绝不值得上抛，因此在此丢弃。
*/
function writeField(doc, field, value) {
	try {
		const outcome = doc.set(field, value);
		if (typeof outcome?.then === "function") outcome.then(void 0, () => {});
	} catch {}
}
/**
* Build the row component bound to the host's UI primitives.
* 构建绑定到宿主 UI 原语的行组件。
*/
function createRow(primitives) {
	const Menu = primitives?.Menu;
	const Chevron = primitives?.IconChevronDownOutlineRegular ?? primitives?.IconChevronDownOutline14 ?? primitives?.IconChevronDownOutlineMedium;
	return function ThinkingLanguageRow(props) {
		const { doc, t: hostT } = props;
		const [settings, setSettings] = (0, react.useState)(() => readSettings(doc));
		const [open, setOpen] = (0, react.useState)(false);
		settings.language;
		const t = (key) => hostT(key);
		(0, react.useEffect)(() => {
			const sync = () => setSettings(readSettings(doc));
			sync();
			return doc.subscribe(sync);
		}, [doc]);
		const items = [{
			id: AUTO,
			label: t("autoLabel")
		}, ...CATALOGUE.map((language) => ({
			id: language.tag,
			label: language.nativeName
		}))];
		const activeLabel = settings.language === "auto" ? t("autoLabel") : nativeNameFor(settings.language) ?? settings.language;
		const close = () => setOpen(false);
		const toggle = () => setOpen((value) => !value);
		const choose = (id) => {
			writeField(doc, FIELD_LANGUAGE, id);
			close();
		};
		const picker = (0, react.createElement)("button", {
			type: "button",
			className: "dsh_desk_lang_picker",
			"aria-haspopup": "menu",
			"aria-expanded": open,
			onClick: toggle
		}, activeLabel, Chevron === void 0 ? null : (0, react.createElement)(Chevron, { className: "dsh_desk_lang_chevron" }));
		const control = Menu ? (0, react.createElement)(Menu, {
			open,
			anchor: picker,
			items,
			selectedId: settings.language,
			align: "end",
			portal: true,
			onClose: close,
			onSelect: choose
		}) : picker;
		return (0, react.createElement)("div", { className: "dsh_desk_lang_row" }, (0, react.createElement)("div", { className: "dsh_desk_lang_text" }, (0, react.createElement)("div", { className: "dsh_desk_lang_title" }, t("heading")), (0, react.createElement)("div", { className: "dsh_desk_lang_desc" }, t("description"))), control);
	};
}
const rowCss = [
	".dsh_desk_lang_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}",
	".dsh_desk_lang_text{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}",
	".dsh_desk_lang_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}",
	".dsh_desk_lang_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}",
	".dsh_desk_lang_picker{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex;flex:none}",
	".dsh_desk_lang_picker:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".dsh_desk_lang_chevron{flex:none}"
].join("\n");
/** Marks the injected stylesheet, so a second mount can detect the first. / 标记已注入的样式表，使第二次挂载能发现第一次。 */
const STYLE_MARKER = "dsh-thinking-lang";
/**
* Inject the row stylesheet once per document, replacing a stale one.
* 每份文档只注入一次行样式表，已过期的那张会被替换。
*
* The guard reads the document rather than a module-level flag: a client plugin
* can be mounted more than once against the same page, and only the DOM knows
* whether this sheet is already there. Content is compared as well, because a
* hot-reloaded bundle keeps its marker while its CSS changes; skipping on the
* marker alone would leave the row styled by class names that no longer exist.
* 判重依据是文档本身而不是模块级标志：客户端插件可能被重复挂载到同一页面，只有 DOM
* 知道这张样式表是否已经存在。同时比对内容：热重载的 bundle 标记不变而 CSS 已变，
* 只看标记就跳过会让这一行按已不存在的类名取样式。
*/
function mountRowStyles() {
	if (typeof document === "undefined") return;
	const existing = document.head.querySelector(`style[data-plugin=${JSON.stringify(STYLE_MARKER)}]`);
	if (existing !== null) {
		if (existing.textContent === rowCss) return;
		existing.remove();
	}
	const style = document.createElement("style");
	style.dataset.plugin = STYLE_MARKER;
	style.dataset.pluginCss = `${STYLE_MARKER}/row.css`;
	style.textContent = rowCss;
	document.head.append(style);
}
//#endregion
//#region src/client/index.ts
/**
* Client entry: registers the thinking-language row in General settings.
* 客户端入口：在「通用」设置页注册思考语言行。
*
* The row is registered through the `settings.general.item` slot, which the
* settings shell renders as one item on the General page — directly under the
* host's own language row.
* 该行通过 `settings.general.item` 插槽注册；设置外壳把它渲染成「通用」页上的
* 一个条目——紧邻宿主自身的语言设置项下方。
*/
/** Stable Cordis plugin name. / 稳定的 Cordis 插件名。 */
const name = "thinking-language";
/** The one client service this plugin requires. / 本插件唯一需要的客户端服务。 */
const inject = ["slots"];
/** Locale namespace holding the row copy. / 保存行文案的 locale 命名空间。 */
const LOCALE_NS = "thinking-language";
/**
* Position on the General page, sorted ascending. The host's own language row
* registers at `order: 0` (dsh-client-locale) and the next known row — chat's
* "link opening" — sits at 17, so 1 lands directly beneath the language row.
* 在「通用」页中的位置，按 order 升序排列。宿主自己的语言行注册在 `order: 0`
* （dsh-client-locale），下一个已知项——对话的「链接打开方式」——是 17，因此取
* 1 即可紧贴在语言行下方。
*/
const ROW_ORDER = 1;
/**
* Require one of several module ids, returning the first that resolves.
* 依次尝试 require 若干模块 id，返回第一个成功解析的结果。
*
* The host decides which optional modules exist, so a miss is expected rather
* than exceptional and simply moves on to the next candidate.
* 可选模块是否存在由宿主决定，因此未命中属于预期情况而非异常，直接尝试下一个即可。
*/
function tryRequire(...names) {
	for (const name of names) try {
		const mod = require(name);
		if (mod != null) return mod;
	} catch {}
}
/**
* Report a client-side problem through the host logger when one exists.
* 在宿主提供 logger 时，通过它报告客户端问题。
*/
function report(ctx, message, error) {
	const logger = ctx.get("logger");
	const line = `dsh-thinking-lang: ${message}`;
	(typeof logger?.warn === "function" ? logger.warn.bind(logger) : console.warn)(line, ...error === void 0 ? [] : [error]);
}
/**
* Register the dictionaries, the settings document binding, and the General row.
* 注册字典、绑定设置文档，并登记「通用」页上的设置行。
*/
function apply(ctx) {
	ctx.inject(["configForms", "locale"], (uiCtx) => {
		const forms = uiCtx.get("configForms");
		const locale = uiCtx.get("locale");
		if (!forms || typeof forms.get !== "function") {
			report(uiCtx, "configForms service unavailable; settings row disabled");
			return;
		}
		if (!locale || typeof locale.register !== "function" || typeof locale.bind !== "function") {
			report(uiCtx, "locale service unavailable; settings row disabled");
			return;
		}
		uiCtx.effect(() => locale.register(LOCALE_NS, dictionaries), "dsh-thinking-lang: dictionaries");
		const t = locale.bind(LOCALE_NS);
		const doc = forms.get(SETTINGS_NAMESPACE);
		const primitives = tryRequire("@deepseek-ai/dsh-client-ui-primitives");
		mountRowStyles();
		const Row = createRow(primitives);
		uiCtx.slots.inject("settings.general.item", function* registerRow() {
			yield uiCtx.slots.register({
				name: "settings.general.item",
				id: "thinking-language",
				order: ROW_ORDER,
				locale: LOCALE_NS,
				inject: () => ({
					doc,
					t
				})
			}, Row);
		});
	});
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

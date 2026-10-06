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
import { createElement as h, useEffect, useState } from "react";
import {
	AUTO,
	CATALOGUE,
	DEFAULTS,
	FIELD_LANGUAGE,
	type ThinkingSettings,
	nativeNameFor,
	normalizeSettings
} from "../core.js";
import { dictionaryFor, type Dict } from "./locales.js";

/** The settings document handle the host hands to a client plugin. / 宿主交给客户端插件的设置文档句柄。 */
export interface SettingsDoc {
	getSnapshot(): { value?: unknown; revision?: number };
	subscribe(listener: () => void): () => void;
	set(field: string, value: unknown): unknown;
	unset(field: string): unknown;
}

/** UI primitives this row can use when the host provides them. / 宿主提供时本行可用的 UI 原语。 */
export interface UiPrimitives {
	Menu?: unknown;
	IconChevronDownOutlineRegular?: unknown;
	IconChevronDownOutline14?: unknown;
	[key: string]: unknown;
}

/** What the slot hands to the row component. / 插槽交给行组件的东西。 */
interface RowBinding {
	/** Live settings document for the plugin namespace. / 插件命名空间的实时设置文档。 */
	doc: SettingsDoc;
	/** Bound translator for the host locale namespace (the UI language). / 绑定到宿主 locale 命名空间（界面语言）的翻译函数。 */
	t: (key: keyof Dict) => string;
}

/**
 * Read and normalize the current settings, falling back to defaults on refusal.
 * 读取并归一化当前设置；被拒绝时回退到默认值。
 */
function readSettings(doc: SettingsDoc): ThinkingSettings {
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
function writeField(doc: SettingsDoc, field: string, value: unknown): void {
	try {
		const outcome = doc.set(field, value) as { then?: unknown } | null | undefined;
		if (typeof outcome?.then === "function") {
			void (outcome as Promise<unknown>).then(undefined, () => {});
		}
	} catch {
		/* a read-only settings document is not an error worth surfacing here */
	}
}

/**
 * Build the row component bound to the host's UI primitives.
 * 构建绑定到宿主 UI 原语的行组件。
 */
export function createRow(primitives: UiPrimitives | undefined): (props: RowBinding) => unknown {
	const Menu = primitives?.Menu;
	const Chevron =
		primitives?.IconChevronDownOutlineRegular ??
		primitives?.IconChevronDownOutline14 ??
		primitives?.IconChevronDownOutlineMedium;

	return function ThinkingLanguageRow(props: RowBinding): unknown {
		const { doc, t: hostT } = props;
		const [settings, setSettings] = useState<ThinkingSettings>(() => readSettings(doc));
		const [open, setOpen] = useState<boolean>(false);

		// Copy follows the THINKING language only while the feature flag is on;
		// otherwise the host dictionary — resolved against the interface language —
		// is used throughout. `auto` always defers to the host.
		// 只有功能开关打开时，文案才跟随**思考语言**；否则一律使用宿主字典（按界面
		// 语言解析）。`auto` 始终交给宿主。
		const dict = dictionaryFor(settings.language, AUTO);
		const t = (key: keyof Dict): string => (dict ? dict[key] : hostT(key));

		// Re-read on every document revision; the initial call covers the gap
		// between the first render and the subscription.
		// 每次文档修订都重新读取；首次调用用于覆盖「首次渲染」到「订阅生效」之间的空档。
		useEffect(() => {
			const sync = () => setSettings(readSettings(doc));
			sync();
			return doc.subscribe(sync);
		}, [doc]);

		const items = [
			{ id: AUTO, label: t("autoLabel") },
			...CATALOGUE.map((language) => ({ id: language.tag, label: language.nativeName }))
		];
		const activeLabel =
			settings.language === AUTO ? t("autoLabel") : nativeNameFor(settings.language) ?? settings.language;

		const close = (): void => setOpen(false);
		const toggle = (): void => setOpen((value: boolean) => !value);
		const choose = (id: string): void => {
			writeField(doc, FIELD_LANGUAGE, id);
			close();
		};

		const picker = h(
			"button",
			{
				type: "button",
				className: "dsh_desk_lang_picker",
				"aria-haspopup": "menu",
				"aria-expanded": open,
				onClick: toggle
			},
			activeLabel,
			Chevron === undefined ? null : h(Chevron, { className: "dsh_desk_lang_chevron" })
		);

		const control = Menu
			? h(Menu, {
					open,
					anchor: picker,
					items,
					selectedId: settings.language,
					align: "end",
					portal: true,
					onClose: close,
					onSelect: choose
				})
			: picker;

		return h(
			"div",
			{ className: "dsh_desk_lang_row" },
			h(
				"div",
				{ className: "dsh_desk_lang_text" },
				h("div", { className: "dsh_desk_lang_title" }, t("heading")),
				h("div", { className: "dsh_desk_lang_desc" }, t("description"))
			),
			control
		);
	};
}

// Declaration order follows the host's own PreferenceRow verbatim —
// packages/client/ui-chat/src/client/settings/PreferenceRow.module.css, MIT,
// Copyright (c) 2026 DeepSeek — because that is the row this one sits beside, so
// the two can be diffed property by property whenever the host styles move.
// Class names differ (the host's are CSS-Modules hashes) and the picker carries a
// trailing `flex:none` the host does not need; every other character matches.
// 声明顺序逐字照宿主自己的 PreferenceRow——
// packages/client/ui-chat/src/client/settings/PreferenceRow.module.css，MIT，
// Copyright (c) 2026 DeepSeek——因为那就是本行紧邻的邻居，宿主样式变动时可以逐属性
// 对照。类名不同（宿主的是 CSS Modules 哈希），且选择器末尾多一个宿主不需要的
// `flex:none`；除此之外逐字符一致。
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
export function mountRowStyles(): void {
	if (typeof document === "undefined") return;
	const existing = document.head.querySelector<HTMLStyleElement>(`style[data-plugin=${JSON.stringify(STYLE_MARKER)}]`);
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

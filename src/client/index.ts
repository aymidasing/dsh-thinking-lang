/**
 * Client entry: registers the plugin's settings row in General settings.
 * 客户端入口：在「通用」设置页注册本插件的设置行。
 *
 * The row is registered through the `settings.general.item` slot, which the
 * settings shell renders as one item on the General page — directly under the
 * host's own language row.
 * 该行通过 `settings.general.item` 插槽注册；设置外壳把它渲染成「通用」页上的
 * 一个条目——紧邻宿主自身的语言设置项下方。
 */
import { SETTINGS_NAMESPACE } from "../core.js";
import { dictionaries, type Dict } from "./locales.js";
import { createRow, mountRowStyles, type SettingsDoc, type UiPrimitives } from "./panel.js";

/** Stable Cordis plugin name. / 稳定的 Cordis 插件名。 */
export const name = "ay-dsh-tk-lang";

/** The one client service this plugin requires. / 本插件唯一需要的客户端服务。 */
export const inject = ["slots"];

/** Locale namespace holding the row copy. / 保存行文案的 locale 命名空间。 */
const LOCALE_NS = "ay-dsh-tk-lang";

/**
 * Position on the General page, sorted ascending. The host's own language row
 * registers at `order: 0` (dsh-client-locale) and the next known row — chat's
 * "link opening" — sits at 17, so 1 lands directly beneath the language row.
 * 在「通用」页中的位置，按 order 升序排列。宿主自己的语言行注册在 `order: 0`
 * （dsh-client-locale），下一个已知项——对话的「链接打开方式」——是 17，因此取
 * 1 即可紧贴在语言行下方。
 */
const ROW_ORDER = 1;

declare const require: (specifier: string) => unknown;

/** The slice of the config-forms service used to reach the settings document. / 用于取得设置文档的 config-forms 服务切片。 */
interface ConfigFormsService {
	get(ns: string): SettingsDoc;
}

/** The slice of the locale service used for row copy. / 用于行文案的 locale 服务切片。 */
interface LocaleService {
	register(ns: string, dictionaries: Record<string, unknown>): void | (() => void);
	bind(ns: string): (key: keyof Dict) => string;
}

/** The client plugin context shapes this entry relies on. / 本入口依赖的客户端插件上下文形状。 */
interface UiContext {
	get(name: string): unknown;
	effect(fn: () => (() => void) | void, label?: string): unknown;
	inject(names: string[], callback: (ctx: UiContext) => void): unknown;
	slots: {
		inject(name: string, callback: () => unknown): () => void;
		register(options: Record<string, unknown>, component: unknown): () => void;
	};
}

/**
 * Require one of several module ids, returning the first that resolves.
 * 依次尝试 require 若干模块 id，返回第一个成功解析的结果。
 *
 * The host decides which optional modules exist, so a miss is expected rather
 * than exceptional and simply moves on to the next candidate.
 * 可选模块是否存在由宿主决定，因此未命中属于预期情况而非异常，直接尝试下一个即可。
 */
function tryRequire(...names: string[]): unknown {
	for (const name of names) {
		try {
			const mod = require(name);
			if (mod != null) return mod;
		} catch {
			/* not exposed by this host; fall through to the next candidate */
		}
	}
	return undefined;
}

/**
 * Report a client-side problem through the host logger when one exists.
 * 在宿主提供 logger 时，通过它报告客户端问题。
 */
function report(ctx: UiContext, message: string, error?: unknown): void {
	const logger = ctx.get("logger") as { warn?: (...args: unknown[]) => unknown } | undefined;
	const line = `dsh-thinking-lang: ${message}`;
	const write = typeof logger?.warn === "function" ? logger.warn.bind(logger) : console.warn;
	write(line, ...(error === undefined ? [] : [error]));
}

/**
 * Register the dictionaries, the settings document binding, and the General row.
 * 注册字典、绑定设置文档，并登记「通用」页上的设置行。
 */
export function apply(ctx: UiContext): void {
	ctx.inject(["configForms", "locale"], (uiCtx) => {
		const forms = uiCtx.get("configForms") as ConfigFormsService | undefined;
		const locale = uiCtx.get("locale") as LocaleService | undefined;
		if (!forms || typeof forms.get !== "function") {
			report(uiCtx, "configForms service unavailable; settings row disabled");
			return;
		}
		if (!locale || typeof locale.register !== "function" || typeof locale.bind !== "function") {
			report(uiCtx, "locale service unavailable; settings row disabled");
			return;
		}

		// The dictionary registration is owned by an effect, so a plugin reload
		// or removal takes the copy with it.
		// 字典注册由 effect 持有，因此插件重载或卸载时会一并回收文案。
		uiCtx.effect(() => locale.register(LOCALE_NS, dictionaries), "dsh-thinking-lang: dictionaries");
		const t = locale.bind(LOCALE_NS);

		const doc = forms.get(SETTINGS_NAMESPACE);
		const primitives = tryRequire("@deepseek-ai/dsh-client-ui-primitives") as UiPrimitives | undefined;
		mountRowStyles();
		const Row = createRow(primitives);

		uiCtx.slots.inject("settings.general.item", function* registerRow() {
			yield uiCtx.slots.register(
				{
					name: "settings.general.item",
					id: "ay-dsh-tk-lang",
					order: ROW_ORDER,
					locale: LOCALE_NS,
					inject: () => ({ doc, t })
				},
				Row
			);
		});
	});
}

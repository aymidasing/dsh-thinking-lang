/**
 * Settings UI: the General row and the plugin's configuration card.
 * 设置界面：「通用」页的设置行，以及插件详情页的配置卡片。
 *
 * Both surfaces bind to the same host settings document, so a change in either
 * place is visible in the other. / 两个入口绑定同一份宿主设置文档，任一处修改
 * 另一处都会看到。
 *
 * The row owns no state of its own: it reads the document, subscribes to it, and
 * writes the fields back. / 控件不持有自己的状态：读取文档、订阅变化、回写字段。
 */
import { createElement as h, useEffect, useState } from "react";
import {
	AUTO,
	CATALOGUE,
	DEFAULTS,
	FIELD_EXTRA,
	FIELD_LANGUAGE,
	FIELD_REMINDER,
	MAX_REMINDER_MINUTES,
	REMINDER_EVERY_TURN,
	REMINDER_OFF,
	type ThinkingSettings,
	nativeNameFor,
	normalizeSettings
} from "../core.js";
import type { Dict } from "./locales.js";

/** The settings document handle the host hands to a client plugin. / 宿主交给客户端插件的设置文档句柄。 */
export interface SettingsDoc {
	getSnapshot(): { value?: unknown; revision?: number };
	subscribe(listener: () => void): () => void;
	set(field: string, value: unknown): unknown;
	unset(field: string): unknown;
}

/** UI primitives this plugin can use when the host provides them. / 宿主提供时本插件可用的 UI 原语。 */
export interface UiPrimitives {
	Menu?: unknown;
	IconChevronDownOutlineRegular?: unknown;
	IconChevronDownOutline14?: unknown;
	[key: string]: unknown;
}

/** What both surfaces receive from their slot. / 两个界面从插槽收到的内容。 */
interface Binding {
	/** Live settings document for the plugin namespace. / 插件命名空间的实时设置文档。 */
	doc: SettingsDoc;
	/** Bound translator for the host locale namespace. / 绑定到宿主 locale 命名空间的翻译函数。 */
	t: (key: keyof Dict) => string;
}

/** Preset reminder intervals in minutes. / 预设提醒间隔（分钟）。 */
const PRESET_MINUTES = [10, 30, 60] as const;

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
 * Write one field back, swallowing a refusal so a read-only host cannot break the UI.
 * 回写单个字段，并吞掉拒绝异常，使只读宿主不会让控件崩溃。
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

/** Subscribe one component to the document and re-read it on every revision. / 订阅设置文档，并在每次修订时重新读取。 */
function useSettings(doc: SettingsDoc): ThinkingSettings {
	const [settings, setSettings] = useState<ThinkingSettings>(() => readSettings(doc));
	useEffect(() => {
		const sync = (): void => setSettings(readSettings(doc));
		sync();
		return doc.subscribe(sync);
	}, [doc]);
	return settings;
}

/**
 * Build the language picker bound to the host's UI primitives.
 * 构建绑定到宿主 UI 原语的语言选择器。
 */
function createLanguagePicker(primitives: UiPrimitives | undefined) {
	const Menu = primitives?.Menu;
	const Chevron =
		primitives?.IconChevronDownOutlineRegular ??
		primitives?.IconChevronDownOutline14 ??
		primitives?.IconChevronDownOutlineMedium;

	return function LanguagePicker(props: Binding & { settings: ThinkingSettings }): unknown {
		const { doc, t, settings } = props;
		const [open, setOpen] = useState<boolean>(false);
		const items = [
			{ id: AUTO, label: t("autoLabel") },
			...CATALOGUE.map((language) => ({ id: language.tag, label: language.nativeName }))
		];
		const activeLabel =
			settings.language === AUTO ? t("autoLabel") : nativeNameFor(settings.language) ?? settings.language;
		const close = (): void => setOpen(false);
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
				onClick: (): void => setOpen((value: boolean) => !value)
			},
			activeLabel,
			Chevron === undefined ? null : h(Chevron, { className: "dsh_desk_lang_chevron" })
		);
		if (!Menu) return picker;
		return h(Menu, {
			open,
			anchor: picker,
			items,
			selectedId: settings.language,
			align: "end",
			portal: true,
			onClose: close,
			onSelect: choose
		});
	};
}

/** Map a stored minute count onto the picker id it should show. / 把存储的分钟数映射成选择器应显示的选项 id。 */
function derivedPreset(minutes: number): string {
	if (minutes < 0) return "off";
	if (minutes === REMINDER_EVERY_TURN) return "turn";
	const preset = PRESET_MINUTES.find((candidate) => candidate === minutes);
	return preset === undefined ? "custom" : String(preset);
}

/**
 * Build the reminder picker: presets, every turn, off, and a custom minute count.
 * 构建提醒选择器：预设、每轮、关闭，以及自定义分钟数。
 *
 * It uses the host Menu like the language picker, so the two controls match;
 * a native `<select>` renders its own list chrome and breaks the row style.
 * 与语言选择器一样使用宿主 Menu，两个控件因此外观一致；原生 `<select>` 的下拉列表
 * 自带浏览器样式，会破坏这一行。
 */
function createReminderPicker(primitives: UiPrimitives | undefined) {
	const Menu = primitives?.Menu;
	const Chevron =
		primitives?.IconChevronDownOutlineRegular ??
		primitives?.IconChevronDownOutline14 ??
		primitives?.IconChevronDownOutlineMedium;

	return function ReminderPicker(props: Binding & { settings: ThinkingSettings }): unknown {
		const { doc, t, settings } = props;
		const derived = derivedPreset(settings.reminderMinutes);
		const current = settings.reminderMinutes > 0 ? settings.reminderMinutes : 30;
		const [selected, setSelected] = useState<string>(derived);
		const [open, setOpen] = useState<boolean>(false);
		const [draft, setDraft] = useState<string>(String(current));

		// An external change (the other surface, or a re-read) wins over a local
		// selection; a local "custom" survives because it leaves `derived` alone.
		// 外部改动（另一入口或重新读取）优先于本地选择；本地的「自定义」不会改变
		// `derived`，因此能保持选中。
		useEffect(() => {
			setSelected(derived);
		}, [derived]);

		// Keep the input in step with the stored value, so an accepted edit never
		// falls back to the previous number while the document update lands.
		// 让输入框跟随存储值，避免写入落盘前先闪回上一个数字。
		useEffect(() => {
			setDraft(String(current));
		}, [current]);

		const labelOf = (id: string): string => {
			if (id === "off") return t("reminderOff");
			if (id === "turn") return t("reminderTurn");
			if (id === "custom") return t("reminderCustom");
			return `${id} ${t("reminderUnit")}`;
		};

		const items = ["off", "turn", ...PRESET_MINUTES.map(String), "custom"].map((id) => ({
			id,
			label: labelOf(id)
		}));

		const choose = (id: string): void => {
			setOpen(false);
			setSelected(id);
			if (id === "off") writeField(doc, FIELD_REMINDER, REMINDER_OFF);
			else if (id === "turn") writeField(doc, FIELD_REMINDER, REMINDER_EVERY_TURN);
			else if (id !== "custom") writeField(doc, FIELD_REMINDER, Number(id));
		};

		const commit = (): void => {
			const minutes = Math.round(Number(draft));
			if (!Number.isFinite(minutes) || draft.trim() === "") {
				setDraft(String(current));
				return;
			}
			const clamped = Math.min(MAX_REMINDER_MINUTES, Math.max(1, minutes));
			writeField(doc, FIELD_REMINDER, clamped);
			setDraft(String(clamped));
		};

		const picker = h(
			"button",
			{
				type: "button",
				className: "dsh_desk_lang_picker",
				"aria-haspopup": "menu",
				"aria-expanded": open,
				onClick: (): void => setOpen((value: boolean) => !value)
			},
			labelOf(selected),
			Chevron === undefined ? null : h(Chevron, { className: "dsh_desk_lang_chevron" })
		);

		const control = Menu
			? h(Menu, {
					open,
					anchor: picker,
					items,
					selectedId: selected,
					align: "end",
					portal: true,
					onClose: (): void => setOpen(false),
					onSelect: choose
				})
			: picker;

		if (selected !== "custom") return control;
		return h(
			"div",
			{ className: "dsh_desk_lang_control" },
			control,
			h("input", {
				type: "number",
				className: "dsh_desk_lang_input",
				min: 1,
				max: MAX_REMINDER_MINUTES,
				placeholder: String(settings.reminderMinutes > 0 ? settings.reminderMinutes : 30),
				value: draft,
				onChange: (event: { currentTarget: { value: string } }): void => setDraft(event.currentTarget.value),
				onBlur: commit,
				onKeyDown: (event: { key: string }): void => {
					if (event.key === "Enter") commit();
				}
			}),
			h("span", { className: "dsh_desk_lang_hint" }, t("reminderCustomHint"))
		);
	};
}

/**
 * Build the extra-injection picker: on or off.
 * 构建额外注入选择器：开启或关闭。
 *
 * It shares the host Menu with the other controls, so the three read as one column.
 * 与另外两个控件共用宿主 Menu，三者在视觉上成一列。
 */
function createExtraPicker(primitives: UiPrimitives | undefined) {
	const Menu = primitives?.Menu;
	const Chevron =
		primitives?.IconChevronDownOutlineRegular ??
		primitives?.IconChevronDownOutline14 ??
		primitives?.IconChevronDownOutlineMedium;

	return function ExtraPicker(props: Binding & { settings: ThinkingSettings; disabled?: boolean }): unknown {
		const { doc, t, settings, disabled = false } = props;
		const [open, setOpen] = useState<boolean>(false);
		const items = [
			{ id: "on", label: t("extraOn") },
			{ id: "off", label: t("extraOff") }
		];
		const close = (): void => setOpen(false);
		const choose = (id: string): void => {
			writeField(doc, FIELD_EXTRA, id === "on");
			close();
		};
		const picker = h(
			"button",
			{
				type: "button",
				className: "dsh_desk_lang_picker",
				"aria-haspopup": "menu",
				"aria-expanded": open,
				disabled,
				onClick: (): void => setOpen((value: boolean) => !value)
			},
			settings.extraInjection ? t("extraOn") : t("extraOff"),
			Chevron === undefined ? null : h(Chevron, { className: "dsh_desk_lang_chevron" })
		);
		if (!Menu) return picker;
		return h(Menu, {
			open,
			anchor: picker,
			items,
			selectedId: settings.extraInjection ? "on" : "off",
			align: "end",
			portal: true,
			onClose: close,
			onSelect: choose
		});
	};
}

/**
 * Build the General settings row: heading, description and the language picker.
 * 构建「通用」设置行：标题、说明与语言选择器。
 */
export function createRow(primitives: UiPrimitives | undefined): (props: Binding) => unknown {
	const LanguagePicker = createLanguagePicker(primitives);
	return function ThinkingLanguageRow(props: Binding): unknown {
		const settings = useSettings(props.doc);
		return h(
			"div",
			{ className: "dsh_desk_lang_row" },
			h(
				"div",
				{ className: "dsh_desk_lang_text" },
				h("div", { className: "dsh_desk_lang_title" }, props.t("heading")),
				h("div", { className: "dsh_desk_lang_desc" }, props.t("description"))
			),
			h(LanguagePicker, { doc: props.doc, t: props.t, settings })
		);
	};
}

/**
 * Build the plugin configuration card: language and reminder interval.
 * 构建插件配置卡片：思考语言与提醒间隔。
 *
 * The host renders this inside the plugin's detail page; `view: 'summary'` is the
 * one-line form a card may ask for, which this plugin leaves empty.
 * 宿主把它渲染在插件详情页里；`view: 'summary'` 是卡片可能请求的单行形式，本插件
 * 留空。
 */
export function createConfigCard(primitives: UiPrimitives | undefined): (props: Binding & { view?: string }) => unknown {
	const LanguagePicker = createLanguagePicker(primitives);
	const ReminderPicker = createReminderPicker(primitives);
	const ExtraPicker = createExtraPicker(primitives);
	return function ThinkingLanguageCard(props: Binding & { view?: string }): unknown {
		const settings = useSettings(props.doc);
		if (props.view === "summary") return null;
		const binding = { doc: props.doc, t: props.t, settings };
		// Turning the reminder off stops both injections, so the extra-injection
		// control greys out instead of accepting a value that cannot take effect.
		// 提醒关闭时两处注入都会停，因此额外注入控件置灰，而不是让一个不生效的取值可选。
		const reminderOff = settings.reminderMinutes < 0;
		return h(
			"div",
			null,
			h(
				"div",
				{ className: "dsh_desk_lang_row" },
				h(
					"div",
					{ className: "dsh_desk_lang_text" },
					h("div", { className: "dsh_desk_lang_title" }, props.t("heading")),
					h("div", { className: "dsh_desk_lang_desc" }, props.t("description"))
				),
				h(LanguagePicker, binding)
			),
			h(
				"div",
				{ className: "dsh_desk_lang_row" },
				h(
					"div",
					{ className: "dsh_desk_lang_text" },
					h("div", { className: "dsh_desk_lang_title" }, props.t("reminderHeading")),
					h("div", { className: "dsh_desk_lang_desc" }, props.t("reminderDescription"))
				),
				h(ReminderPicker, binding)
			),
			h(
				"div",
				{ className: reminderOff ? "dsh_desk_lang_row dsh_desk_lang_row_disabled" : "dsh_desk_lang_row" },
				h(
					"div",
					{ className: "dsh_desk_lang_text" },
					h("div", { className: "dsh_desk_lang_title" }, props.t("extraHeading")),
					h("div", { className: "dsh_desk_lang_desc" }, props.t("extraDescription"))
				),
				h(ExtraPicker, { ...binding, disabled: reminderOff })
			)
		);
	};
}

// Declaration order follows the host's own PreferenceRow verbatim —
// packages/client/ui-chat/src/client/settings/PreferenceRow.module.css, MIT,
// Copyright (c) 2026 DeepSeek — because that is the row this one sits beside.
// Class names differ (the host's are CSS-Modules hashes) and the picker carries a
// trailing `flex:none` the host does not need; every other character matches.
// 声明顺序逐字照宿主自己的 PreferenceRow——因为那就是本行紧邻的邻居。类名不同，
// 选择器末尾多一个宿主不需要的 `flex:none`；除此之外逐字符一致。
const rowCss = [
	".dsh_desk_lang_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}",
	".dsh_desk_lang_row_disabled{opacity:.45;pointer-events:none}",
	".dsh_desk_lang_text{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}",
	".dsh_desk_lang_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}",
	".dsh_desk_lang_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}",
	".dsh_desk_lang_picker{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex;flex:none}",
	".dsh_desk_lang_picker:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".dsh_desk_lang_chevron{flex:none}",
	".dsh_desk_lang_control{align-items:center;gap:8px;display:flex;flex:none}",
	".dsh_desk_lang_input{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;width:88px;font:inherit;color:var(--dsw-alias-label-primary);border:none;padding:0 12px;font-size:14px}",
	".dsh_desk_lang_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}"
].join("\n");

/** Marks the injected stylesheet, so a second mount can detect the first. / 标记已注入的样式表，使第二次挂载能发现第一次。 */
const STYLE_MARKER = "dsh-thinking-lang";

/**
 * Inject the settings stylesheet once per document, replacing a stale one.
 * 每份文档只注入一次设置样式表，已过期的那张会被替换。
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

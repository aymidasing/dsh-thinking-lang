/**
 * Settings copy for the General row and the plugin's configuration card.
 * 「通用」设置行与插件配置卡片使用的文案。
 *
 * The host resolves {@link dictionaries} against the interface language; the
 * settings card renders its own controls from the same keys.
 * 宿主按界面语言解析 {@link dictionaries}；配置卡片用同一批键渲染自己的控件。
 */

/** One dictionary of settings copy. / 一份设置文案字典。 */
export interface Dict {
	/** Row heading. / 行标题。 */
	heading: string;
	/** Row description. / 行说明。 */
	description: string;
	/** Label of the "follow the host locale" option. / 「跟随宿主语言」选项的标签。 */
	autoLabel: string;
	/** Reminder row heading. / 提醒行标题。 */
	reminderHeading: string;
	/** Reminder row description. / 提醒行说明。 */
	reminderDescription: string;
	/** Label of the "disabled" reminder option. / 关闭提醒的选项标签。 */
	reminderOff: string;
	/** Label of the "every turn" reminder option. / 每轮提醒的选项标签。 */
	reminderTurn: string;
	/** Label of the custom interval option. / 自定义间隔的选项标签。 */
	reminderCustom: string;
	/** Suffix for a preset interval. / 预设间隔的单位后缀。 */
	reminderUnit: string;
	/** Hint under the custom interval input. / 自定义间隔输入框的提示。 */
	reminderCustomHint: string;
}

/** Simplified Chinese copy. / 简体中文文案。 */
export const zh: Dict = {
	heading: "思考语言",
	description: "内部推理与规划使用的语言。「自动」优先跟随操作系统语言，其次是界面语言。",
	autoLabel: "自动",
	reminderHeading: "提醒间隔",
	reminderDescription: "两次提醒之间的最小间隔；关闭后只保留系统提示里的规则。",
	reminderOff: "关闭",
	reminderTurn: "每轮",
	reminderCustom: "自定义",
	reminderUnit: "分钟",
	reminderCustomHint: "1–1440 分钟"
};

/** English copy. / 英文文案。 */
export const en: Dict = {
	heading: "Thinking language",
	description:
		"Language used for internal reasoning and planning. Automatic follows the operating-system language first, then the UI language.",
	autoLabel: "Automatic",
	reminderHeading: "Reminder interval",
	reminderDescription: "Minimum gap between reminders. Off keeps only the system-prompt rule.",
	reminderOff: "Off",
	reminderTurn: "Every turn",
	reminderCustom: "Custom",
	reminderUnit: "min",
	reminderCustomHint: "1–1440 minutes"
};

/** Dictionaries keyed by UI locale, handed to the host locale service. / 以界面语言为键、交给宿主 locale 服务的字典。 */
export const dictionaries: Record<string, Dict> = { zh, en };

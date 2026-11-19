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
	/** Extra-injection row heading. / 额外注入行的标题。 */
	extraHeading: string;
	/** Extra-injection row description. / 额外注入行的说明。 */
	extraDescription: string;
	/** Label of the enabled option. / 开启选项的标签。 */
	extraOn: string;
	/** Label of the disabled option. / 关闭选项的标签。 */
	extraOff: string;
	/** Message shown when a write fails. / 写入失败时显示的提示。 */
	saveError: string;
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
	reminderCustomHint: "1–1440 分钟",
	extraHeading: "额外提醒注入",
	extraDescription: "把额外提醒放进本轮技能目录，没有新目录时独立发送。提醒间隔为「关闭」时停用。",
	extraOn: "开启",
	extraOff: "关闭",
	saveError: "设置未能保存，请重试。"
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
	reminderCustomHint: "1–1440 minutes",
	extraHeading: "Extra reminder injection",
	extraDescription:
		"Adds a reminder to the skill catalogue, or sends it separately if no catalogue is sent. Turning reminders off also turns this off.",
	extraOn: "On",
	extraOff: "Off",
	saveError: "Could not save this setting. Try again."
};

/** Dictionaries keyed by UI locale, handed to the host locale service. / 以界面语言为键、交给宿主 locale 服务的字典。 */
export const dictionaries: Record<string, Dict> = { zh, en };

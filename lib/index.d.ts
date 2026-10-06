/**
 * Host entry: the settings namespace, the prompt section, and the language line.
 * 宿主入口：设置命名空间、提示词段、以及每步注入的语言行。
 *
 * Injection shape (see README for the reasoning):
 * 注入形态（设计理由见 README）：
 *
 *   section  order   1  →  the rules plus the language name, once per session
 *   context  order -10  →  the language name, re-evaluated on every model call
 *
 *   section  order   1  →  规则加语言名，每会话组装一次
 *   context  order -10  →  语言名，每次模型调用重新求值
 *
 * The host context is described by a local structural interface rather than the
 * `@deepseek-ai/cordis` type, so this package carries no DSH type dependency.
 * 宿主上下文用本文件内的结构化接口描述，而不引用 `@deepseek-ai/cordis` 的类型，
 * 因此本包不依赖任何 DSH 类型包。
 */
import z from "@deepseek-ai/schemastery";
import { type ThinkingSettings } from "./core.js";
/** Stable Cordis plugin name. / 稳定的 Cordis 插件名。 */
export declare const name = "thinking-language";
/** Plugin-level service requirements; services are acquired per branch below. / 插件级服务声明；服务在下方逐分支获取。 */
export declare const inject: string[];
/** Durable settings schema; the field defaults to {@link AUTO}. / 持久化设置 schema；字段默认为 {@link AUTO}。 */
export declare const Config: z<ThinkingSettings>;
/** The host plugin context shape this entry relies on. / 本入口依赖的宿主插件上下文形状。 */
interface HostContext {
    get(name: string): unknown;
    inject(names: string[], callback: (ctx: HostContext) => void): unknown;
    systemPrompt: {
        section(section: {
            name: string;
            order?: number;
            text: () => string;
        }): unknown;
        context(context: {
            name: string;
            order?: number;
            text: () => string;
        }): unknown;
    };
}
/**
 * Register the settings consumer, the prompt section, and the per-step language line.
 * 注册设置消费方、提示词段，以及每步注入的语言行。
 */
export declare function apply(ctx: HostContext): void;
export {};

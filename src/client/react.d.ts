/**
 * Minimal ambient types for the host-provided React runtime.
 * 为宿主提供的 React 运行时声明最小环境类型。
 *
 * The plugin never bundles React — the DSH client module loader injects it — and
 * this package deliberately does not depend on `@types/react`, so only the three
 * APIs the panel actually calls are declared here.
 * 本插件不打包 React（由 DSH 客户端模块加载器注入），且刻意不依赖
 * `@types/react`，因此这里只声明面板真正调用的三个 API。
 */
declare module "react" {
	/**
	 * Create one element of any component type.
	 * 创建任意组件类型的一个元素。
	 */
	export function createElement(
		type: unknown,
		props: Record<string, unknown> | null,
		...children: unknown[]
	): unknown;

	/**
	 * Hold one piece of component state.
	 * 保存一份组件状态。
	 */
	export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void];

	/**
	 * Run a side effect after render, optionally cleaning it up on unmount.
	 * 在渲染后运行副作用，并可选地在卸载时清理。
	 */
	export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
}

/**
 * Client bundle settings for tsdown.
 * tsdown 的客户端打包设置。
 *
 * The bundle is emitted as CommonJS because DSH loads a client plugin inside a
 * `require`-based factory: an ESM bundle would have to be rewritten into that
 * shape afterwards, which this way never happens.
 * 产物以 CommonJS 输出，因为 DSH 是在一个基于 `require` 的工厂里加载客户端插件的：
 * ESM 产物事后还得改写成那个形态，而这样做之后这一步根本不存在。
 *
 * Externals are declared once, in `package.json` (`dsh.client.external`), and read
 * back here so the platform surface has a single source of truth.
 * 外部依赖只在 `package.json` 的 `dsh.client.external` 里声明一次，并在此读回，使
 * 平台接口只有一个事实来源。
 */
import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

/** The package manifest, read for the external list. / 包清单，用于读取外部依赖列表。 */
const manifest = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")) as {
	dsh?: { client?: { external?: string[] } };
};

export default defineConfig({
	entry: ["src/client/index.ts"],
	format: "cjs",
	platform: "browser",
	target: "es2022",
	treeshake: true,
	dts: false,
	external: manifest.dsh?.client?.external ?? [],
	outputOptions: {
		file: "client/client.raw.cjs"
	}
});

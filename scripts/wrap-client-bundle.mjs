#!/usr/bin/env node
/**
 * Wrap the tsdown CommonJS client bundle in the DSH `__ModuleLoader__` factory.
 * 把 tsdown 产出的 CommonJS 客户端包包装进 DSH 的 `__ModuleLoader__` 工厂。
 *
 * DSH hands the factory a single `require`, so the bundle body is placed inside a
 * function scope that also provides `module` and `exports` — the two names a
 * CommonJS body expects to find.
 * DSH 只交给工厂一个 `require`，因此产物主体被放进一个同时提供 `module` 与
 * `exports` 的函数作用域里——这正是 CommonJS 主体预期能找到的两个名字。
 *
 * Reads `client/client.raw.cjs`, writes `client/client.js`.
 * 读 `client/client.raw.cjs`，写 `client/client.js`。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "client", "client.raw.cjs");
const target = join(here, "..", "client", "client.js");

/** The id DSH addresses this client bundle by. / DSH 用来定位本客户端包的 id。 */
const BUNDLE_ID = "dsh-thinking-lang";

/**
 * Prefix every non-empty line, so the wrapped body stays readable.
 * 给每个非空行加前缀，使包装后的主体保持可读。
 */
function indent(text, prefix) {
	return text
		.split("\n")
		.map((line) => (line === "" ? line : prefix + line))
		.join("\n");
}

const body = indent(readFileSync(source, "utf8").trimEnd(), "\t\t");

const bundle = [
	"window.__ModuleLoader__.load({",
	`\tid: ${JSON.stringify(BUNDLE_ID)},`,
	"\tfactory: (require) => {",
	"\t\tconst module = { exports: {} };",
	"\t\tconst exports = module.exports;",
	body,
	"\t\treturn module.exports;",
	"\t}",
	"});",
	""
].join("\n");

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, bundle, "utf8");
console.log(`wrapped ${target}`);

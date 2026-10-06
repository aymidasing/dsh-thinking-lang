#!/usr/bin/env node
/**
 * Check that a packed tarball carries everything the plugin loads at runtime.
 * 校验打包产物带着插件运行时加载的全部文件。
 *
 * The repository keeps TypeScript sources only, so `lib/` and `client/` exist in the
 * tarball alone; a `files` entry that stopped matching would ship a package that
 * installs and then fails to load, which no other check catches.
 * 仓库只存 TypeScript 源码，`lib/` 与 `client/` 只存在于包里；一旦 `files` 条目不再
 * 匹配，发出去的包会装上却加载不起来，而其它检查都发现不了。
 *
 * The archive is read in-process — no `tar` binary and no child process — so the same
 * check runs under CI and inside a sandbox that forbids piped subprocesses.
 * 归档在本进程内读取——不用 `tar` 可执行文件、不起子进程——于是同一套检查在 CI 与
 * 禁止管道子进程的沙箱里都能跑。
 *
 * Usage / 用法: node scripts/verify-pack.mjs [tarball]
 */
import { gunzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Entries the Host and the Client load by path. / 宿主与客户端按路径加载的条目。 */
const REQUIRED = [
	"package/package.json",
	"package/cordis.patch.yml",
	"package/lib/index.js",
	"package/lib/index.d.ts",
	"package/lib/core.js",
	"package/client/client.js"
];

/** USTAR stores the size in octal here, and the type flag one byte further on. */
const SIZE_OFFSET = 124;
const SIZE_LENGTH = 12;
const TYPE_OFFSET = 156;
const BLOCK = 512;

/** Read every regular file of a USTAR archive into a name → contents map. */
function readArchive(buffer) {
	const files = new Map();
	let offset = 0;
	while (offset + BLOCK <= buffer.length) {
		const header = buffer.subarray(offset, offset + BLOCK);
		if (header.every((byte) => byte === 0)) break;
		const field = (start, length) =>
			header
				.subarray(start, start + length)
				.toString("utf8")
				.replace(/\0.*$/u, "")
				.trim();
		const name = field(0, 100);
		const size = Number.parseInt(field(SIZE_OFFSET, SIZE_LENGTH), 8) || 0;
		const type = String.fromCharCode(header[TYPE_OFFSET]);
		const dataStart = offset + BLOCK;
		if (type === "0" || type === "\0" || type === "") files.set(name, buffer.subarray(dataStart, dataStart + size));
		offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
	}
	return files;
}

/** The tarball to check: the argument, or the newest pack in the working directory. */
function resolveTarball(argument) {
	if (argument !== undefined && argument !== "") return argument;
	const candidates = readdirSync(".").filter((name) => /^dsh-thinking-lang-\d.*\.tgz$/u.test(name));
	if (candidates.length === 0) throw new Error("no dsh-thinking-lang-*.tgz here; run npm pack first");
	return candidates.sort().at(-1);
}

const tarball = resolveTarball(process.argv[2]);
const files = readArchive(gunzipSync(readFileSync(tarball)));

const missing = REQUIRED.filter((entry) => !files.has(entry));
if (missing.length > 0) {
	console.error(`${tarball} is missing: ${missing.join(", ")}`);
	console.error(`it holds ${String(files.size)} files; check the "files" field in package.json`);
	process.exit(1);
}

const manifest = JSON.parse(files.get("package/package.json").toString("utf8"));
if (manifest.dsh?.bundle?.patch === undefined) {
	console.error(`${tarball}: package.json declares no dsh.bundle.patch, so the Host would never load it`);
	process.exit(1);
}

if (!files.get("package/client/client.js").toString("utf8").includes("__ModuleLoader__")) {
	console.error(`${tarball}: client/client.js is not wrapped in the DSH module-loader factory`);
	process.exit(1);
}

console.log(`${tarball}: ok — ${String(files.size)} files, ${manifest.name}@${manifest.version}`);
console.log(`entry: ${join("lib", "index.js")} · client: ${join("client", "client.js")}`);

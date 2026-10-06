# dsh-thinking-lang

面向 **DeepSeek Harness（dsh-desk）** 的插件：设置智能体内部推理（思考）所用的语言。

**目标环境：** DeepSeek Harness **`0.2.0-rc.2`+**（`dsh -V`）。**License：** MIT。

> **本项目的代码、文案与文档均由 DeepSeek 生成**（在人工指导下迭代产出）。它不是 DeepSeek Harness 官方组件，未经官方审核；使用前请自行阅读源码。

---

## 它做什么

在**设置 → 通用**里新增一行「思考语言」，位于宿主自身的语言设置项下方。整行只有一个下拉框：

| 配置项 | 取值 | 作用 |
|--------|------|------|
| **思考语言** | 自动 / 简体中文 / 繁體中文 / English | 内部推理与规划所用的语言 |

### `auto` 是怎么判定的

选「自动」时，按顺序取**第一个**能映射到语言目录的来源：

| 顺序 | 来源 | 取值方式 |
|---|---|---|
| 1 | **操作系统语言** | POSIX 环境变量 `LC_ALL` / `LC_MESSAGES` / `LANG`；Windows 上这些通常为空，改用 `Intl.DateTimeFormat().resolvedOptions().locale`（跟随系统区域设置） |
| 2 | **DSH 界面语言** | 设置服务里 `locale` 命名空间的 `preference` 字段 |
| 3 | **兜底** | 硬编码的 `zh-CN`（`FALLBACK_TAG`） |

标签先被清洗成 BCP-47（`_`→`-`，去掉 `.UTF-8`、`@latin` 这类 POSIX 修饰），再交给平台自带的 `Intl.Locale` 拆成语言／文字／地区三段，**不手写标签文法**。查找从最具体到最一般：完整标签 → 带文字的 → 带地区的 → 裸主标签，所以 `en-GB` 会落到 `en`。

中文是唯一的例外——两个条目共用 `zh` 这个主标签，决定简繁的是**文字**而不是地区。这部分交给 CLDR：`maximize()` 会把短标签省略的文字补出来，`Hant` 判为繁體、其余判为简体。于是 `zh-TW`/`zh-HK`/`zh-MO`/`zh-Hant` 都是繁體，`zh`/`zh-SG`/`zh-Hans` 都是简体，两张对照表都不需要。

| 系统 | 界面 | 结果 |
|---|---|---|
| `zh-CN` | `en-US` | 简体中文 |
| `en-US` | `zh-CN` | English |
| `fr-FR`（目录里没有） | `en-US` | English（落到下一级） |
| 取不到 | 取不到 | 简体中文 |

在下拉里**显式选了某个语言**时，那个选择优先于上面全部三级，与系统/界面语言无关。

---

## 提示词是怎么注入的

一份提示词被拆成两半，注入两个不同的位置——**区别不在内容，而在求值时机**。

| | `systemPrompt.section` | `systemPrompt.context` |
|---|---|---|
| 由谁生成 | [`sectionText`](src/core.ts) | [`contextText`](src/core.ts) |
| 内容 | 一行规则，**直接写出语言名** | 只有语言名加一句强调 |
| 随什么变化 | 随思考语言变 | 随思考语言变 |
| 求值时机 | 每会话组装一次 | **每次模型调用**重新求值 |
| 顺序 | `order: 1` | `order: -10` |

### 实际注入的文本

两段文本都由 [`src/core.ts`](src/core.ts) 生成。**这里是公开文档，不转载注入原文**——它们会直接进入模型上下文，属于实现细节，只以「去看代码」的方式给出入口。

| | `systemPrompt.section` | `systemPrompt.context` |
|---|---|---|
| 生成函数 | `sectionText` | `contextText` |
| 形状 | 一行规则，句中嵌入所选语言的英文名 | 一个固定标记，后接所选语言的英文名与一句强调 |
| 长度 | 124–136 字符（**每种语言一份**） | 53–65 字符 |
| 语言名形式 | 英文名，如 `Simplified Chinese` / `Traditional Chinese` / `English` | 同左 |

要看注入原文，读 [`src/core.ts`](src/core.ts) 里这两个函数；改完 `npm run build` 即可生效。

这个拆分带来两个直接结果：

1. **切语言在下一轮立即生效** —— context 每一步都重新求值，不必重启或新开会话。
2. **section 里那个语言名要等新会话** —— 它在会话组装时定稿。同一个会话中途改语言，context 那行会立刻跟着变，但 section 里的名字要等下次组装才跟上。

> 两段都带语言，是**有意的冗余**：section 是权威版本（位于 persona 之后、所有工具说明之前），context 只负责实时性。想去掉重复就删掉 context——代价是切语言必须新开会话。

### 顺序与优先级

- section 的 `order: 1` 紧跟在宿主的 persona 之后、第一个策略段之前——也就是渲染出来的 persona 那句话的下一行。
- context 的 `order: -10` 排在其它每步注入块之前。注意：section 与 context 属于两个不同的序列，两者的 order 数值不可直接比较。

> 取值依据是 DSH 自己的分段表：`@deepseek-ai/dsh-system-prompt` 里的 `SECTION_ORDERS`——身份 `-1000`、部署 persona `0`、`PLAN_POLICY` `500`、工具段从 `1000` 起。`order: 1` 正好落在 persona 与第一个策略段之间。

---

## Token 开销（实测）

用 DeepSeek V3 的词表实测（[`@lenml/tokenizer-deepseek_v3`](https://www.npmjs.com/package/@lenml/tokenizer-deepseek_v3)，不计特殊 token）：

| 语言 | section | context |
|---|---|---|
| 简体中文 | 29 | 16 |
| 繁體中文 | 29 | 16 |
| English | 28 | 15 |

语言名本身只占 1–2 token，所以**换语言对每轮开销几乎没有影响**。

section 每会话一次，不随轮次增长；context 每轮一次。跑 100 轮：

| 语言 | section | context × 100 | 合计 |
|---|---|---|---|
| 简体 / 繁體 | 29 | 1600 | 1629 |
| English | 28 | 1500 | 1528 |

---

## ⚠️ 切换语言的缓存代价

**这才是本插件唯一需要留意的开销，量级远大于上面那几十个 token。**

DeepSeek 的上下文缓存自动生效、无需改代码，但它**只认从第 0 个 token 起完全相同的前缀**——官方原话：「只有当两个请求的前缀内容相同时（从第 0 个 token 开始相同），才算重复。**中间开始的重复不能被缓存命中**。」（[API 上线硬盘缓存](https://api-docs.deepseek.com/zh-cn/news/news0802/)）

而 `section` 内嵌了所选语言的名字，位置又相当靠前（`order: 1`，紧跟 persona）。于是：

> 改一次思考语言，**从 section 那一行往后的前缀全部改变**——包括其余 system prompt（工具说明等）和全部对话历史，那一轮统统按「缓存未命中」计费。

差价是 **50 倍**（`deepseek-flash` 空闲时段：命中 0.02 元 / 百万 token，未命中 1 元 / 百万 token；高峰时段同样 50 倍。见[模型 & 价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)）。

`context` 那行同样随语言变化，只是它 inject 的深度不同、影响面可能小一些；两段中任何一段变了，从它往后的前缀都不再匹配。

**好消息是一次性的**：切完语言后新前缀会重新被缓存，从下一轮起恢复正常命中。所以代价约等于「重新算一遍完整上下文」这一次。

**实用建议**：选定一种语言就别频繁来回切，尤其别在一轮对话中间切。切换不影响正确性，只影响钱。

---

## 安装

从 [Releases](https://github.com/aymidasing/dsh-thinking-lang/releases) 取打包好的附件，按它的地址安装：

```bash
dsh plugin --profile desktop add https://github.com/aymidasing/dsh-thinking-lang/releases/download/v1.0.0/dsh-thinking-lang-1.0.0.tgz
```

同一段地址也可以粘进设置里的插件管理器。执行前请**完全退出桌面端**：`--profile desktop` 操作的 profile 必须已经初始化，且没有进程正占用它。

`main` 分支只有 TypeScript 源码；`lib/` 与 `client/` 是构建产物，只随 Release 提供，由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 在 tag 上构建并上传。附件名带版本号，所以每个版本的地址都是固定的。

从源码装（开发用）：

```bash
npm install
npm run build
dsh plugin --profile desktop add "$PWD"
```

装完重启 GUI。**语言约束对新会话生效**；切语言本身在已有会话的下一轮就生效。

更新：换用新版本的附件地址重装一次。依赖是以 URL 记录的，`pnpm update` 对它无效。

> **不要再用 `github:` 安装。** pnpm 11 默认拦下依赖的构建脚本，而 `github:` 源要靠 `prepare` 才产出 `lib/` 与 `client/`，安装会停在 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，除非在 profile 的 `pnpm-workspace.yaml` 里逐名放行 `allowBuilds`。Release 附件是构建好的成品，装它不需要任何构建授权。

---

## 构建

```bash
npm install
npm run check     # typecheck + build
```

构建分两段：

1. `tsc -p tsconfig.json` 编译宿主端到 `lib/`；
2. tsdown 把客户端打成 **CommonJS** 到 `client/client.raw.cjs`，再由 [`scripts/wrap-client-bundle.mjs`](scripts/wrap-client-bundle.mjs) 套上 DSH 的 `__ModuleLoader__` 工厂外壳，输出 `client/client.js`。

选 CommonJS 是为了让产物天生就是 `require(...)` 形态——DSH 的客户端工厂只提供 `require`，若先打成 ESM 就还得事后用正则把导入语句改回来。

Node（构建）需要 `^22.18.0 || >=24.11.0`；插件运行时不依赖本机 Node。

打包与发版：`npm pack` 产出 `dsh-thinking-lang-<version>.tgz`（`prepack` 会先构建），[`scripts/verify-pack.mjs`](scripts/verify-pack.mjs) 校验它带着运行时要加载的文件。发版流程是改 [`package.json`](package.json) 的 `version` → 提交 → `git tag v<version>` → 推送 tag；工作流会构建、校验并把附件传到该 tag 的 Release，tag 与 `version` 不一致时直接失败。

---

## 目录结构

| 路径 | 说明 |
|------|------|
| [`src/core.ts`](src/core.ts) | 语言目录、配置归一化、两份提示词生成。**纯函数，无宿主依赖**，客户端与宿主端共用。locale 解析走平台自带的 `Intl.Locale` |
| [`src/index.ts`](src/index.ts) | 宿主入口：Config schema、section 与 context 注册、语言解析（含操作系统语言探测） |
| [`src/client/index.ts`](src/client/index.ts) | 客户端入口：在 `settings.general.item` 插槽注册设置行 |
| [`src/client/panel.ts`](src/client/panel.ts) | 单行设置控件与样式 |
| [`src/client/locales.ts`](src/client/locales.ts) | 三套行文案（简 / 繁 / 英） |
| [`cordis.patch.yml`](cordis.patch.yml) | bundle patch，登记宿主入口 |
| [`PROVENANCE.md`](PROVENANCE.md) | 设置行样式的来源记录，以及从 `app.asar` 读宿主源码的方法（维护用） |
| `lib/` · `client/` | 构建产物，**不入库**——只随 Release 附件提供；[`package.json`](package.json) 的 `files` 白名单负责把它们打进包 |
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | tag 触发：构建、校验、上传 Release 附件 |
| [`scripts/verify-pack.mjs`](scripts/verify-pack.mjs) | 校验附件里带着运行时要加载的文件（构建链的看门人） |

### 依赖面

| 类型 | 包 | 说明 |
|---|---|---|
| 运行时 | `@deepseek-ai/schemastery` | DSH 的设置 schema 格式，`export const Config` 必需 |
| 构建期 | `typescript` · `tsdown` · `@types/node` | 只在 `npm run build` 时用到 |
| 宿主提供 | `@deepseek-ai/dsh-client-ui-primitives` | 客户端用 `tryRequire` 按需取用；宿主没有时降级为原生控件 |

**不依赖任何 DSH 类型包。** 宿主上下文由 [`src/index.ts`](src/index.ts) 里的本地 `HostContext` 接口结构化描述，所以包里没有 `@deepseek-ai/cordis`（既不是 dependency 也不是 peerDependency）。

宿主端对包只暴露四个导出：`name`、`inject`、`Config`、`apply`——其余全部是模块内私有。

### 设置行文案的语言（预留功能，默认关闭）

设置行的文案**可以**跟随思考语言而不是界面语言——选 繁體中文，这一行的标题与说明就变繁体。整套机制已经实现并接线完毕，但**当前不生效**。

| | |
|---|---|
| 开关 | [`src/client/locales.ts`](src/client/locales.ts) 里的 `COPY_FOLLOWS_THINKING_LANGUAGE`，默认 `false` |
| 启用 | 改成 `true` → `npm run build` → 重启 GUI |
| 还要改别的文件吗 | 不用。三套字典与选取函数 `dictionaryFor` 都在 `locales.ts` 里 |

因为开关是编译期常量，构建时 rolldown 会把这条死分支连同繁体字典一起摇掉——当前产物里没有这些文案，行为与「只跟随界面语言」完全一致。语言选择器的选项始终显示各语言的本族语名（简体中文 / English），所以即使文案换成了你不熟悉的语言，也能从同一个下拉里切回来。

---

## 已知限制

- **section 的位置绑住宿主的分段表**：`order: 1` 取自 `@deepseek-ai/dsh-system-prompt` 的 `SECTION_ORDERS`（persona `0`、`PLAN_POLICY` `500`）。宿主若调整那张表，改 [`src/index.ts`](src/index.ts) 的 `SECTION_ORDER`。
- **设置行的位置绑住宿主语言项的 order**：宿主语言行注册在 `order: 0`（`@deepseek-ai/dsh-client-locale`），本插件用 `order: 1` 紧贴其后。宿主若调整，改 [`src/client/index.ts`](src/client/index.ts) 的 `ROW_ORDER` 即可。
- **只支持三种思考语言**：简体中文、繁體中文、English。要增删语言，改 [`src/core.ts`](src/core.ts) 的 `CATALOGUE`，并在 [`src/client/locales.ts`](src/client/locales.ts) 补上对应文案。
- **没有聊天命令**：切换语言只走设置页。如需 `/thinking-language`，可参照 `dsh-thinking-language` 的命令实现补上。
- **`auto` 依赖运行时能报出系统语言**：Linux/macOS 走环境变量，Windows 走 `Intl`。两者都拿不到时会静默落到界面语言，再不行才是 `zh-CN`——顺序与取值方式见上文「`auto` 是怎么判定的」。
- **与其它语言插件互斥**：本插件的插件 id 与设置命名空间都是 `thinking-language`，与同名的思考语言插件**无法共存**；包名 `dsh-thinking-lang` 与 `dsh-thinking-language` 也极为接近，注意区分。

---

## License

MIT，见 [LICENSE](LICENSE)。

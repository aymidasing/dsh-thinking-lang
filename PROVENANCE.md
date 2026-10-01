# 来源记录

本文件只记录一件事：设置行的样式从哪里来。使用说明看 [README.md](README.md)。

---

## 设置行样式：宿主 PreferenceRow

设置行的 CSS **声明顺序与属性值照宿主的 `PreferenceRow`**——也就是本行紧挨着的那一行。

| | |
|---|---|
| 宿主源码 | `packages/client/ui-chat/src/client/settings/PreferenceRow.module.css` |
| 包 | `@deepseek-ai/dsh-client-ui-chat` |
| 协议 | MIT，`Copyright (c) 2026 DeepSeek`（包内随附 LICENSE） |
| 仓库 | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（取自包的 `repository` 字段） |

逐属性核对结果：7 条规则一一对应，其中 6 条的属性集与顺序完全相同，选择器多一条 `flex:none`。

两处有意的差异：

- **类名**：宿主用 CSS Modules，编译后是 `XZcbxG_row` 这类带哈希的名字（每次构建都会变），运行时拿不到也复现不了；而且本插件的样式表注入到 `document.head`，是**页面级全局**表，裸 `.row` 会污染其它插件的元素。所以类名必须自起。
- **`flex:none`**：本行布局需要，宿主那一行不需要。

注意 `dsh-client-locale` 的 `LanguageRow.module.css` 是**另一个**组件，只有 5 条规则、没有说明文字；本行带标题 + 说明 + 选择器，对应的才是 `PreferenceRow`。

---

## 附：怎么从 app.asar 里读宿主源码

宿主升级后若要重新对照官方样式，按这几步走。踩过的坑一并记下：

- asar 头部布局是 `[payloadSize u32][stringLength u32][json...]`，JSON 从头部缓冲区的**偏移 8** 开始——按偏移 4 读会得到 `Unexpected non-whitespace character after JSON`；
- 文件数据起点是 `8 + headerSize`；
- 目录树里每个条目的 `offset` 是**字符串**而不是数字。用 `Number.isFinite(entry.offset)` 判断会把所有文件误判成 unpacked；正确判据是**没有 `offset` 字段**；
- 客户端包把 CSS Modules 编译成 JS 里的字符串，源头路径写在生成的注释里：搜 `dsh-css:` 或 `<组件名>.module.css.mjs` 就能定位到原始文件。

安装目录顶层只有 Electron 与 Chromium 的许可文件，容易误以为 DSH 客户端是闭源的；实际许可在各包内部，`@deepseek-ai/dsh-client-*` 都是 MIT。

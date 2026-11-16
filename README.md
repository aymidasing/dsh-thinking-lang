# dsh-thinking-lang

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

面向 **DeepSeek Harness（dsh-desk）** 的插件：设置智能体内部推理（思考）所用的语言。

**目标环境：** DeepSeek Harness **`0.2.0-rc.2`+**（`dsh -V`）。**License：** MIT。

> **本项目的代码、文案与文档均由 DeepSeek 生成**（在人工指导下迭代产出）。它不是 DeepSeek Harness 官方组件，未经官方审核；使用前请自行阅读源码。

---

## 它做什么

在**设置 → 通用**里新增一行「思考语言」，并在**插件页 → 本插件详情**里提供同一份配置。两处读写同一份设置：

| 配置项 | 取值 | 作用 |
|--------|------|------|
| **思考语言** | 自动 / 简体中文 / 繁體中文 / English | 内部推理与规划所用的语言 |
| **提醒间隔** | 关闭 / 每轮 / 10 / 30 / 60 分钟 / 自定义 1–1440 | 两次「用该语言思考」提醒之间的最小间隔，默认 **30 分钟** |

「关闭」只停止每轮提醒，系统提示里的规则仍然生效；「每轮」是每个对话轮次的第一步都提醒一次。

![设置 → 通用中的「思考语言」行](assets/settings-general.png)

*截图：设置 → 通用里的「思考语言」行，紧贴在宿主自己的界面语言下方。*

![插件详情页里的配置卡片：思考语言与提醒间隔](assets/plugin-config.png)

*截图：插件页 → 本插件详情里的同一份配置，含「提醒间隔」的预设与自定义输入。*

### 「自动」怎么判定

选「自动」时，按顺序取**第一个**能映射到语言目录的来源：

| 顺序 | 来源 | 取值方式 |
|---|---|---|
| 1 | **操作系统语言** | POSIX 环境变量 `LC_ALL` / `LC_MESSAGES` / `LANG`；Windows 上这些通常为空，改用系统区域设置 |
| 2 | **DSH 界面语言** | 设置里 `locale` 命名空间的 `preference` 字段 |
| 3 | **兜底** | `zh-CN` |

在下拉里**显式选了某个语言**时，那个选择优先于上面全部三级，与系统/界面语言无关。

---

## 安装与卸载

```bash
dsh plugin --profile desktop add dsh-thinking-lang
```

也可以把包名贴进设置里的插件管理器。执行前**完全退出桌面端**：`--profile desktop` 操作的 profile 不能被占用；装完重启 GUI。

**更新**：设置 → 插件里点「更新」，或重复上面那条命令。

**卸载**：

```bash
dsh plugin --profile desktop remove dsh-thinking-lang
```

设置里的「思考语言」行随之消失，提示词也不再注入；同样要在桌面端完全退出后执行。

**语言约束对新会话生效**；切语言本身在已有会话的下一轮就生效。

---

## 开发与实现细节

构建与发版、提示词注入机制、Token 开销、缓存影响、目录结构和已知限制，见 [DEVELOPMENT.md](DEVELOPMENT.md)。

---

## License

MIT，见 [LICENSE](LICENSE)。

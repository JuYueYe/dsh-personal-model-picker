# 内部实现说明

面向维护者。安装与变更概览见 [README.md](../README.md)。

## 界面细节

### 触发按钮（输入框旁）

同时显示当前模型名与推理等级，宽度自适应输入框容器：

```
[ deepseek-v4-pro   标准  ▾ ]
```

### 展开后的根菜单：两行

```
┌────────────────────────────────┐
│ 模型         deepseek-v4-pro  › │
│ 推理等级      标准             › │
└────────────────────────────────┘
```

两行各自展开成自己的列表。

### 「模型」展开后：供应商 + 模型 双栏

实际布局是 CSS Grid，列宽 `minmax(0, 1fr) minmax(0, 3fr)`：

```
┌──────────────┬────────────────────────────┐
│ 供应商        │  deepseek-官方   （吸顶）    │
├──────────────┤                            │
│ deepseek-官方 ●│  v4-flash  ✓              │
│ 示例中转      │  v4-pro                    │
│ …            │  …                         │
└──────────────┴────────────────────────────┘
     左栏 1fr            右栏 3fr（跨两行，各自滚动）
```

- **左栏**：供应商列表，`role="menuitemradio"`，可键盘操作；`onMouseEnter` / `onFocus` / `onClick` 都会切换右栏
- **右栏**：当前选中供应商的模型列表，表头吸顶；切换供应商时右栏滚动位置重置
- **卡片高度固定**：`MODEL_PANE_HEIGHT = 348px`（28px 列头 + 320px 模型列 + 卡片内边距）
- 点选即提交，没有二次确认
- **面板背景不透明**：`._7KE1Ra_menu` 用 `--dsw-alias-bg-layer-1`（浅色 `#fff` / 深色 `#232324`）。官方的 `--dsw-menu-surface-fill` 只有 58% / 45% 不透明度，靠 `backdrop-filter: blur(40px) saturate(150%)` 补足；本插件不套那层模糊，必须用不透明 token，否则面板会透出后方内容。模型列的吸顶表头内联背景同步使用同一 token

### 「推理等级」展开后

独立一栏，不与模型列表混排。模型未声明可调等级时提示「当前使用供应商默认设置。此模型未声明可调推理等级，不会额外发送等级参数。」

## 两个入口共享同一份状态

| 入口 | 位置 | 实现 |
|---|---|---|
| `/model` 命令 | 命令面板（`popupSelect`） | `command.register({ name: "model", … })` |
| 输入框旁的模型座位 | 插槽 `conversation.input.model` | `slots.register({ name: "conversation.input.model" }, ModelSelect)` |

两者都从 `ctx.modelDirectories`（`ModelDirectoryResolver`）取**同一个 per-session `ModelDirectory`**，因此从哪个入口改效果一致，状态不会分叉。

## 数据流

- **目录来源**：`ctx.remote.session.modelCatalog()`。一个 Host generation 内最多加载一份，所有会话共享（`ModelCatalogDirectory`），并发调用复用同一次 in-flight 请求
- **自动刷新**：`llm/adapters-updated`、`settings/document-updated`、`credentials/reference-updated`
- **重置**：`connection/reset` → `resetGeneration()`，并清空已连接会话的目录
- **提交**：`ModelDirectory.select({ provider, model, reasoningEffort? })`，写入会话的持久投影帧
- **行 id**：`${providerId}/${modelId}` 只作不透明 key，选回时按已加载数据查表，从不解析字符串

## 边界行为

- **子代理会话不可选模型**：`sessions.subagentAddress(sessionId) !== undefined` 时 `available = false`，`/model` 与座位同时禁用
- **目录加载失败**：按供应商分组列出失败行（可见但不可选），每行给出错误信息，另有「重新加载」
- **模型不可用**：阻止输入框提交并提示（`blocked.composer`），由会话投影的 `routable === false` 驱动
- **过期响应**：目录刷新后，上一代 generation 的迟到响应会被丢弃

## 语言

`src/locales.js` 内置中英双语，**中文是 key 的 source of truth**，英文逐键对齐：

| key | 中文 | English |
|---|---|---|
| `menu.provider` | 供应商 | Provider |
| `menu.model` | 模型 | Model |
| `menu.effort` | 推理等级 | Effort |
| `effort.prefix` | 推理等级： | Effort:  |
| `trigger.fallback` | 选择模型 | Select model |
| `effort.providerDefault` | 供应商默认 | Default |

内置的 `deepseek-official/deepseek-v4-flash` 与 `deepseek-v4-pro` 两款模型的描述文案也做了本地化。

推理等级展开行的前缀与无障碍标签均已本地化：前缀用 `effort.prefix`，无障碍标签复用 `menu.effort`；原先重复的 `menu.thinking` 键已删除。用词与官方 0.2.0 的 `menu.effort` / `menu.aria` / `empty.efforts` 保持一致。

## 启用 / 禁用 / 恢复

- **停用**：bundle 开关会把本包从 `dsh.profile.bundles` 移除（依赖保留），其 bundle patch 不再参与下次启动组合。**停用后需重启宿主**，官方入口才会恢复。
- **恢复的前提**：profile 的最终 patch 里没有残留的强制 `disabled: true` 或强制 insert 条目。历史上那些直接改官方文件的 patch 脚本不要再跑，否则移除 bundle 也不能保证恢复。
- **已知问题**：旧版本的市场插件（如 dshmarket 1.47.0）反复开关可能留下孤立的 disabled 行。

## 目录结构

```
.
├─ src/
│   ├─ register.js       插件入口：注册字典、/model 命令、输入框座位
│   ├─ model-select.js   输入框座位组件（触发器 + 两级菜单 + 双栏 grid）
│   ├─ directory.js      per-session 模型目录（选择 / 提交 / 持久投影）
│   ├─ catalog.js        Host generation 共享目录（含 generation 失效）
│   ├─ service.js        ModelDirectoryResolver（注册为 ctx.modelDirectories）
│   ├─ locales.js        中英字典
│   ├─ styles.js         样式（含 .personal-model-columns 双栏）
│   ├─ classnames.js     内置 clsx
│   ├─ imports.js        运行时依赖声明
│   └─ host.js           宿主侧空实现
├─ dist/                 构建产物（宿主实际加载 dist/client.cjs）
├─ assets/               README 截图
├─ cordis.patch.yml      启停 patch
├─ package.json
├─ LICENSE               MIT（上游版权声明原样保留）
└─ THIRD_PARTY_NOTICES.md
```

## 校验

```bash
npm run check      # node --check dist/index.js && node --check dist/client.cjs
```

## 兼容性备注

- 依赖 DSH 的 slots、`modelDirectories`、sessions、`remote.session` 以及客户端模块加载机制
- 不是可以脱离 DSH 单独使用的通用网页组件
- **不保证任意核心/桌面版本兼容**；升级核心前请重新验证，未验证的版本不要继续用它替换官方入口

## 第三方来源

改编自官方 npm 包 `@deepseek-ai/dsh-client-ui-model-selection@0.1.5-rc.2`（MIT，`Copyright (c) 2026 DeepSeek`）：

- 官方元数据：https://registry.npmjs.org/@deepseek-ai%2fdsh-client-ui-model-selection/0.1.5-rc.2
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness，对应目录 `packages/client/ui-model-selection`
- 归档 SHA-512 已与 npm `dist.integrity` 核对一致，完整声明见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)

React 与 DSH 宿主服务由宿主提供，不是本包随附的另一套运行时。本仓库不将本地修改冒充上游作品，也不虚构本地修改的版权归属。
